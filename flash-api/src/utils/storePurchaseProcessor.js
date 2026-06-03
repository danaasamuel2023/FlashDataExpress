const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const SubAgent = require('../models/SubAgent');
const DataPurchase = require('../models/DataPurchase');
const Settings = require('../models/Settings');
const datamartService = require('../services/datamartService');

// Credit agent + sub-agent profit for a CONFIRMED store/sub-shop sale.
// Profit is earned on delivery, not on order creation — crediting up front let
// failed/rejected orders pay out money that was never reversed. Only credits
// when status === 'completed'. Idempotent via storeDetails.profitCredited, so
// it's safe alongside the webhook/status-poller, which credit the same way for
// orders that complete asynchronously.
async function creditStoreProfit(purchase) {
  const sd = purchase.storeDetails || {};
  if (purchase.status !== 'completed' || sd.profitCredited) return;

  const agentProfit = sd.agentProfit || 0;
  const subAgentProfit = sd.subAgentProfit || 0;

  if (agentProfit > 0 && sd.storeId) {
    await Store.findOneAndUpdate(
      { _id: sd.storeId },
      { $inc: { totalEarnings: agentProfit, pendingBalance: agentProfit, totalSales: 1 } }
    );
  }
  if (subAgentProfit > 0 && sd.subAgentId) {
    await SubAgent.findOneAndUpdate(
      { _id: sd.subAgentId },
      { $inc: { totalEarnings: subAgentProfit, pendingBalance: subAgentProfit, totalSales: 1 } }
    );
  }
  purchase.storeDetails.profitCredited = true;
  await purchase.save();
}

// Idempotent: creates a DataPurchase for a verified store payment, forwards the
// order to DataMart, and credits agent/sub-agent profit only once delivery is
// confirmed. Safe to call from BOTH verify-payment and the Paystack webhook.
async function processStorePurchase({ reference, metadata }) {
  const meta = metadata || {};
  if (!meta.storeId || !meta.network || !meta.capacity || !meta.phoneNumber) {
    return { ok: false, reason: 'missing_metadata' };
  }

  const existing = await DataPurchase.findOne({ reference });
  if (existing) {
    return { ok: true, alreadyProcessed: true, purchase: existing };
  }

  const store = await Store.findById(meta.storeId);
  if (!store) {
    return { ok: false, reason: 'store_not_found' };
  }

  const verifyProduct = await StoreProduct.findOne({
    storeId: store._id,
    network: meta.network,
    capacity: meta.capacity,
    isActive: true,
  });
  const storeSettings = await Settings.getSettings();
  const platformAgentPrices = storeSettings?.pricing?.agentPrices || {};
  const platformSellingPrices = storeSettings?.pricing?.sellingPrices || {};
  const verifiedSellingPrice = verifyProduct?.sellingPrice || meta.sellingPrice;
  const verifiedBasePrice = (platformAgentPrices[meta.network] || {})[String(meta.capacity)]
    || (platformSellingPrices[meta.network] || {})[String(meta.capacity)]
    || verifyProduct?.basePrice || 0;
  let agentProfit = verifiedSellingPrice - verifiedBasePrice;

  let subAgentProfit = 0;
  let subAgentRef = meta.subAgentId || null;
  if (subAgentRef) {
    const subAgent = await SubAgent.findById(subAgentRef);
    if (subAgent && subAgent.isActive) {
      subAgentProfit = Math.round((agentProfit * subAgent.commissionPercent / 100) * 100) / 100;
      agentProfit = Math.round((agentProfit - subAgentProfit) * 100) / 100;
    } else {
      subAgentRef = null;
    }
  }

  let purchase;
  try {
    purchase = await DataPurchase.create({
      userId: store.agentId,
      phoneNumber: meta.phoneNumber,
      network: meta.network,
      capacity: meta.capacity,
      price: verifiedSellingPrice,
      costPrice: verifiedBasePrice,
      reference,
      provider: 'datamart',
      status: 'pending',
      purchaseSource: 'store',
      storeDetails: {
        storeId: store._id,
        storeName: store.storeName,
        agentId: store.agentId,
        agentProfit,
        sellingPrice: verifiedSellingPrice,
        subAgentId: subAgentRef || undefined,
        subAgentProfit: subAgentProfit || undefined,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const existing = await DataPurchase.findOne({ reference });
      return { ok: true, alreadyProcessed: true, purchase: existing };
    }
    throw err;
  }

  try {
    const result = await datamartService.purchaseData({
      network: meta.network,
      capacity: meta.capacity,
      phoneNumber: meta.phoneNumber,
    });
    purchase.datamartReference = result?.orderReference || result?.reference;
    purchase.datamartOrderId = result?.purchaseId || result?.orderId;
    const dmStatus = (result?.orderStatus || result?.status || '').toLowerCase();
    if (dmStatus === 'completed' || dmStatus === 'success' || dmStatus === 'delivered') {
      purchase.status = 'completed';
    }
    await purchase.save();
  } catch (err) {
    purchase.status = 'failed';
    purchase.failureReason = err.message;
    await purchase.save();
  }

  // Credit profit only if delivery is confirmed now. Orders still pending/
  // processing are credited later by the webhook/status-poller on completion.
  await creditStoreProfit(purchase);

  return { ok: true, alreadyProcessed: false, purchase };
}

// Idempotent: creates a DataPurchase for a verified sub-agent shop payment,
// credits agent + sub-agent profits, and forwards the order to DataMart.
async function processSubShopPurchase({ reference, metadata }) {
  const meta = metadata || {};
  if (!meta.subAgentId || !meta.network || !meta.capacity || !meta.phoneNumber) {
    return { ok: false, reason: 'missing_metadata' };
  }

  const existing = await DataPurchase.findOne({ reference });
  if (existing) {
    return { ok: true, alreadyProcessed: true, purchase: existing };
  }

  const subAgent = await SubAgent.findById(meta.subAgentId).populate('storeId');
  if (!subAgent) {
    return { ok: false, reason: 'subagent_not_found' };
  }
  const store = subAgent.storeId;
  if (!store) {
    return { ok: false, reason: 'parent_store_not_found' };
  }

  const storeSettings = await Settings.getSettings();
  const platformSubAgentPrices = storeSettings?.pricing?.subAgentPrices || {};
  const platformAgentPrices = storeSettings?.pricing?.agentPrices || {};
  const platformSellingPrices = storeSettings?.pricing?.sellingPrices || {};
  const platformCost = (platformSubAgentPrices[meta.network] || {})[String(meta.capacity)]
    || (platformAgentPrices[meta.network] || {})[String(meta.capacity)]
    || (platformSellingPrices[meta.network] || {})[String(meta.capacity)] || 0;

  const customerPrice = meta.sellingPrice;
  const subAgentCost = meta.basePrice;
  const subAgentProfit = Math.round((customerPrice - subAgentCost) * 100) / 100;
  const agentProfit = Math.round((subAgentCost - platformCost) * 100) / 100;

  let purchase;
  try {
    purchase = await DataPurchase.create({
      userId: store.agentId,
      phoneNumber: meta.phoneNumber,
      network: meta.network,
      capacity: meta.capacity,
      price: customerPrice,
      costPrice: platformCost,
      reference,
      provider: 'datamart',
      status: 'pending',
      purchaseSource: 'store',
      storeDetails: {
        storeId: store._id,
        storeName: store.storeName,
        agentId: store.agentId,
        agentProfit: Math.max(0, agentProfit),
        sellingPrice: customerPrice,
        subAgentId: subAgent._id,
        subAgentProfit: Math.max(0, subAgentProfit),
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const existing = await DataPurchase.findOne({ reference });
      return { ok: true, alreadyProcessed: true, purchase: existing };
    }
    throw err;
  }

  try {
    const result = await datamartService.purchaseData({
      network: meta.network,
      capacity: meta.capacity,
      phoneNumber: meta.phoneNumber,
    });
    purchase.datamartReference = result?.orderReference || result?.reference;
    purchase.datamartOrderId = result?.purchaseId || result?.orderId;
    const dmStatus = (result?.orderStatus || result?.status || '').toLowerCase();
    if (dmStatus === 'completed' || dmStatus === 'success' || dmStatus === 'delivered') {
      purchase.status = 'completed';
    }
    await purchase.save();
  } catch (err) {
    purchase.status = 'failed';
    purchase.failureReason = err.message;
    await purchase.save();
  }

  // Credit profit only if delivery is confirmed now. Orders still pending/
  // processing are credited later by the webhook/status-poller on completion.
  await creditStoreProfit(purchase);

  return { ok: true, alreadyProcessed: false, purchase };
}

module.exports = { processStorePurchase, processSubShopPurchase };
