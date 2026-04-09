const router = require('express').Router();
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const User = require('../models/User');
const DataPurchase = require('../models/DataPurchase');
const Settings = require('../models/Settings');
const paystackService = require('../services/paystackService');
const datamartService = require('../services/datamartService');
const SubAgent = require('../models/SubAgent');
const { generateReference } = require('../utils/helpers');

// GET /api/shop/:slug
router.get('/:slug', async (req, res) => {
  try {
    const store = await Store.findOne({ storeSlug: req.params.slug, isActive: true })
      .select('storeName storeSlug description theme contactPhone');
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    res.json({ status: 'success', data: store });
  } catch (err) {
    console.error('Store public error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/shop/:slug/products
router.get('/:slug/products', async (req, res) => {
  try {
    const store = await Store.findOne({ storeSlug: req.params.slug, isActive: true });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    const products = await StoreProduct.find({ storeId: store._id, isActive: true })
      .select('network capacity sellingPrice');
    res.json({ status: 'success', data: products });
  } catch (err) {
    console.error('Store public error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/shop/:slug/buy
router.post('/:slug/buy', async (req, res) => {
  try {
    const { network, capacity, phoneNumber, ref } = req.body;
    if (!network || !capacity || !phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'Network, capacity, and phone number required' });
    }

    const store = await Store.findOne({ storeSlug: req.params.slug, isActive: true });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const product = await StoreProduct.findOne({
      storeId: store._id,
      network,
      capacity,
      isActive: true,
    });
    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Product not available' });
    }

    let subAgentId = null;
    if (ref) {
      const subAgent = await SubAgent.findOne({ referralCode: ref.toUpperCase(), storeId: store._id, isActive: true });
      if (subAgent) {
        subAgentId = subAgent._id.toString();
      }
    }

    const reference = generateReference('SHP');
    const agent = await User.findById(store.agentId);

    const settings = await Settings.getSettings();
    const feePercent = settings?.paystack?.paymentFeePercent ?? 3;
    const fee = Math.round(product.sellingPrice * feePercent) / 100;
    const chargeAmount = Math.round((product.sellingPrice + fee) * 100) / 100;

    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shop/${store.storeSlug}?payment=success`;

    const paystack = await paystackService.initializeTransaction({
      email: agent.email,
      amount: chargeAmount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        storeId: store._id.toString(),
        network,
        capacity,
        phoneNumber,
        sellingPrice: product.sellingPrice,
        basePrice: product.basePrice,
        type: 'store_purchase',
        subAgentId,
      },
    });

    res.json({
      status: 'success',
      data: { authorization_url: paystack.authorization_url, reference },
    });
  } catch (err) {
    console.error('Store public error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/shop/:slug/verify-payment
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
    const store = await Store.findById(meta.storeId);
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const existing = await DataPurchase.findOne({ reference });
    if (existing) {
      return res.json({ status: 'success', message: 'Already processed', data: existing });
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
    // Use agent-specific prices if set, otherwise fall back to regular selling prices
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
    if (subAgentRef && subAgentProfit > 0) {
      await SubAgent.findOneAndUpdate(
        { _id: subAgentRef },
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
    }

    res.json({ status: 'success', data: purchase });
  } catch (err) {
    console.error('Store public error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
