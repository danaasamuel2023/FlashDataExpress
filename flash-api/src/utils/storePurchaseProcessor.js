const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const SubAgent = require('../models/SubAgent');
const DataPurchase = require('../models/DataPurchase');
const ResultCheckerPurchase = require('../models/ResultCheckerPurchase');
const Settings = require('../models/Settings');
const datamartService = require('../services/datamartService');

// Agent cost basis for a reselling checker sale (platform charges the agent this).
const checkerAgentCost = (settings, type) =>
  type === 'WAEC' ? (settings?.resultChecker?.agentWaecPrice || 0)
                  : (settings?.resultChecker?.agentBecePrice || 0);
// A seller's own customer price for a checker type, from their checkerPricing.
const sellerCheckerPrice = (pricing, type) =>
  type === 'WAEC' ? (pricing?.waecPrice || 0) : (pricing?.becePrice || 0);

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
      if (!purchase.completedAt) purchase.completedAt = new Date();
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
      if (!purchase.completedAt) purchase.completedAt = new Date();
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

// Idempotent: fulfils a paid result-checker purchase on an AGENT shop. Verifies
// the agent's current checker price, buys one checker from DataMart, delivers the
// serial/PIN, and credits the agent's profit (price - agent cost) on success.
// Mirrors processStorePurchase but for checkers (synchronous delivery).
async function processStoreCheckerPurchase({ reference, metadata }) {
  const meta = metadata || {};
  if (!meta.storeId || !meta.checkerType || !meta.phoneNumber) {
    return { ok: false, reason: 'missing_metadata' };
  }

  const existing = await ResultCheckerPurchase.findOne({ reference });
  if (existing) {
    return { ok: true, alreadyProcessed: true, purchase: existing };
  }

  const store = await Store.findById(meta.storeId);
  if (!store) return { ok: false, reason: 'store_not_found' };

  const settings = await Settings.getSettings();
  const type = meta.checkerType;
  const sellingPrice = sellerCheckerPrice(store.checkerPricing, type);
  const agentCost = checkerAgentCost(settings, type);
  const agentProfit = Math.round((sellingPrice - agentCost) * 100) / 100;

  let purchase;
  try {
    purchase = await ResultCheckerPurchase.create({
      userId: store.agentId,
      checkerType: type,
      phoneNumber: meta.phoneNumber,
      price: sellingPrice,
      costPrice: agentCost,
      reference,
      purchaseSource: 'store',
      status: 'pending',
      storeDetails: {
        storeId: store._id,
        storeName: store.storeName,
        agentId: store.agentId,
        agentProfit: Math.max(0, agentProfit),
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const dup = await ResultCheckerPurchase.findOne({ reference });
      return { ok: true, alreadyProcessed: true, purchase: dup };
    }
    throw err;
  }

  await fulfilChecker(purchase, type, meta.phoneNumber, reference);
  return { ok: true, alreadyProcessed: false, purchase };
}

// Idempotent: fulfils a paid result-checker purchase on a SUB-AGENT shop. Splits
// profit: sub-agent gets (their price - parent's price); agent gets (parent's
// price - platform agent cost). Mirrors processSubShopPurchase.
async function processSubShopCheckerPurchase({ reference, metadata }) {
  const meta = metadata || {};
  if (!meta.subAgentId || !meta.checkerType || !meta.phoneNumber) {
    return { ok: false, reason: 'missing_metadata' };
  }

  const existing = await ResultCheckerPurchase.findOne({ reference });
  if (existing) {
    return { ok: true, alreadyProcessed: true, purchase: existing };
  }

  const subAgent = await SubAgent.findById(meta.subAgentId).populate('storeId');
  if (!subAgent) return { ok: false, reason: 'subagent_not_found' };
  const store = subAgent.storeId;
  if (!store) return { ok: false, reason: 'parent_store_not_found' };

  const settings = await Settings.getSettings();
  const type = meta.checkerType;
  const customerPrice = sellerCheckerPrice(subAgent.checkerPricing, type);
  const subAgentCost = sellerCheckerPrice(store.checkerPricing, type); // parent's price
  const agentCost = checkerAgentCost(settings, type);
  const subAgentProfit = Math.round((customerPrice - subAgentCost) * 100) / 100;
  const agentProfit = Math.round((subAgentCost - agentCost) * 100) / 100;

  let purchase;
  try {
    purchase = await ResultCheckerPurchase.create({
      userId: store.agentId,
      checkerType: type,
      phoneNumber: meta.phoneNumber,
      price: customerPrice,
      costPrice: agentCost,
      reference,
      purchaseSource: 'subshop',
      status: 'pending',
      storeDetails: {
        storeId: store._id,
        storeName: store.storeName,
        agentId: store.agentId,
        agentProfit: Math.max(0, agentProfit),
        subAgentId: subAgent._id,
        subAgentProfit: Math.max(0, subAgentProfit),
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const dup = await ResultCheckerPurchase.findOne({ reference });
      return { ok: true, alreadyProcessed: true, purchase: dup };
    }
    throw err;
  }

  await fulfilChecker(purchase, type, meta.phoneNumber, reference);
  return { ok: true, alreadyProcessed: false, purchase };
}

// Buy the checker from DataMart, store the serial/PIN, and credit seller profit.
// On provider failure the purchase is marked failed (no auto-refund — the buyer
// paid via Paystack; the seller/admin resolves it manually, same as failed data
// orders on storefronts). Reuses creditStoreProfit — it credits agent/sub-agent
// pendingBalance idempotently for any doc carrying storeDetails.
async function fulfilChecker(purchase, checkerType, phoneNumber, reference) {
  try {
    const result = await datamartService.purchaseResultChecker({ checkerType, phoneNumber, ref: reference });
    if (!result?.serialNumber || !result?.pin) {
      throw new Error('No checker returned by provider');
    }
    purchase.serialNumber = result.serialNumber;
    purchase.pin = result.pin;
    purchase.datamartReference = result.reference || result.purchaseId || null;
    purchase.status = 'completed';
    await purchase.save();
    await creditStoreProfit(purchase);
  } catch (err) {
    purchase.status = 'failed';
    purchase.failureReason = err.response?.data?.message || err.message || 'Provider error';
    await purchase.save();
  }
}

module.exports = {
  processStorePurchase,
  processSubShopPurchase,
  creditStoreProfit,
  processStoreCheckerPurchase,
  processSubShopCheckerPurchase,
};
