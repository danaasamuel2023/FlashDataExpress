const router = require('express').Router();
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const SubAgent = require('../models/SubAgent');
const SubAgentProduct = require('../models/SubAgentProduct');
const User = require('../models/User');
const DataPurchase = require('../models/DataPurchase');
const Settings = require('../models/Settings');
const paystackService = require('../services/paystackService');
const datamartService = require('../services/datamartService');
const { generateReference } = require('../utils/helpers');
const { refundFailedPurchase } = require('../utils/refund');
const ordersPaused = require('../middleware/ordersPaused');

// GET /api/subshop/:slug — Get sub-agent store info (public)
router.get('/:slug', async (req, res) => {
  try {
    const subAgent = await SubAgent.findOne({
      storeSlug: req.params.slug,
      status: 'registered',
      isActive: true,
    }).populate('storeId', 'storeName theme contactWhatsapp contactPhone');

    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    res.json({
      status: 'success',
      data: {
        storeName: subAgent.storeName,
        storeSlug: subAgent.storeSlug,
        contactPhone: subAgent.contactPhone,
        contactWhatsapp: subAgent.contactWhatsapp,
        theme: subAgent.storeId?.theme || { primaryColor: '#FF6B00' },
        parentStoreName: subAgent.storeId?.storeName,
        parentWhatsapp: subAgent.storeId?.contactWhatsapp || '',
        parentPhone: subAgent.storeId?.contactPhone || '',
      },
    });
  } catch (err) {
    console.error('SubShop public error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subshop/:slug/products — Get sub-agent's active products (public)
router.get('/:slug/products', async (req, res) => {
  try {
    const subAgent = await SubAgent.findOne({
      storeSlug: req.params.slug,
      status: 'registered',
      isActive: true,
    });
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const products = await SubAgentProduct.find({ subAgentId: subAgent._id, isActive: true })
      .select('network capacity sellingPrice');

    res.json({ status: 'success', data: products });
  } catch (err) {
    console.error('SubShop products error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/subshop/:slug/buy — Customer initiates purchase from sub-agent store
router.post('/:slug/buy', ordersPaused, async (req, res) => {
  try {
    const { network, capacity, phoneNumber } = req.body;
    if (!network || !capacity || !phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'Network, capacity, and phone number required' });
    }

    const subAgent = await SubAgent.findOne({
      storeSlug: req.params.slug,
      status: 'registered',
      isActive: true,
    }).populate('storeId');

    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const store = subAgent.storeId;
    if (!store || !store.isActive) {
      return res.status(404).json({ status: 'error', message: 'Parent store is not available' });
    }

    // Get sub-agent's product pricing
    const subProduct = await SubAgentProduct.findOne({
      subAgentId: subAgent._id,
      network,
      capacity,
      isActive: true,
    });
    if (!subProduct) {
      return res.status(404).json({ status: 'error', message: 'Product not available' });
    }

    const reference = generateReference('SUB');
    const agent = await User.findById(store.agentId);

    const settings = await Settings.getSettings();
    const feePercent = settings?.paystack?.paymentFeePercent ?? 3;
    const fee = Math.round(subProduct.sellingPrice * feePercent) / 100;
    const chargeAmount = Math.round((subProduct.sellingPrice + fee) * 100) / 100;

    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subshop/${subAgent.storeSlug}?payment=success`;

    const paystack = await paystackService.initializeTransaction({
      email: agent.email,
      amount: chargeAmount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        type: 'subagent_store_purchase',
        storeId: store._id.toString(),
        subAgentId: subAgent._id.toString(),
        network,
        capacity,
        phoneNumber,
        sellingPrice: subProduct.sellingPrice,
        basePrice: subProduct.basePrice, // Parent's selling price (sub-agent's cost)
      },
    });

    res.json({
      status: 'success',
      data: { authorization_url: paystack.authorization_url, reference },
    });
  } catch (err) {
    console.error('SubShop buy error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subshop/:slug/verify-payment — Verify payment and complete purchase
router.get('/:slug/verify-payment', async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) {
      return res.status(400).json({ status: 'error', message: 'Reference required' });
    }

    const verification = await paystackService.verifyTransaction(reference);
    if (verification.status !== 'success') {
      return res.status(400).json({ status: 'error', message: 'Payment not verified' });
    }

    const meta = verification.metadata;

    const subAgent = await SubAgent.findById(meta.subAgentId).populate('storeId');
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Sub-agent not found' });
    }
    const store = subAgent.storeId;

    const existing = await DataPurchase.findOne({ reference });
    if (existing) {
      return res.json({ status: 'success', message: 'Already processed', data: existing });
    }

    // Calculate profits
    // Platform cost (what the parent agent pays to the platform)
    const storeSettings = await Settings.getSettings();
    const platformSubAgentPrices = storeSettings?.pricing?.subAgentPrices || {};
    const platformAgentPrices = storeSettings?.pricing?.agentPrices || {};
    const platformSellingPrices = storeSettings?.pricing?.sellingPrices || {};
    // Use sub-agent-specific prices if set, then agent prices, then regular selling prices
    const platformCost = (platformSubAgentPrices[meta.network] || {})[String(meta.capacity)]
      || (platformAgentPrices[meta.network] || {})[String(meta.capacity)]
      || (platformSellingPrices[meta.network] || {})[String(meta.capacity)] || 0;

    // Sub-agent's selling price to customer
    const customerPrice = meta.sellingPrice;
    // Sub-agent's cost = parent's selling price (meta.basePrice)
    const subAgentCost = meta.basePrice;

    // Sub-agent profit = customer price - sub-agent's cost (parent's selling price)
    const subAgentProfit = Math.round((customerPrice - subAgentCost) * 100) / 100;
    // Parent agent profit = sub-agent's cost (parent's selling price) - platform cost
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
        return res.json({ status: 'success', message: 'Already processed', data: existing });
      }
      throw err;
    }

    // Credit profits immediately (payment already verified)
    if (agentProfit > 0) {
      await Store.findOneAndUpdate(
        { _id: store._id },
        { $inc: { totalEarnings: agentProfit, pendingBalance: agentProfit, totalSales: 1 } }
      );
    }
    if (subAgentProfit > 0) {
      await SubAgent.findOneAndUpdate(
        { _id: subAgent._id },
        { $inc: { totalEarnings: subAgentProfit, pendingBalance: subAgentProfit, totalSales: 1 } }
      );
    }
    purchase.storeDetails.profitCredited = true;
    await purchase.save();

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
      try {
        await refundFailedPurchase(purchase, err.message);
      } catch (refundErr) {
        console.error('SubShop auto-refund failed:', refundErr.message, 'ref:', purchase.reference);
      }
    }

    res.json({ status: 'success', data: purchase });
  } catch (err) {
    console.error('SubShop verify error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
