const router = require('express').Router();
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const User = require('../models/User');
const Settings = require('../models/Settings');
const paystackService = require('../services/paystackService');
const SubAgent = require('../models/SubAgent');
const { generateReference } = require('../utils/helpers');
const { processStorePurchase } = require('../utils/storePurchaseProcessor');
const ordersPaused = require('../middleware/ordersPaused');

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
      .select('network capacity sellingPrice')
      .lean();
    const settings = await Settings.getSettings();
    const outOfStock = new Set(settings?.outOfStockNetworks || []);
    const annotated = products.map(p => ({ ...p, outOfStock: outOfStock.has(p.network) }));
    res.json({ status: 'success', data: annotated });
  } catch (err) {
    console.error('Store public error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/shop/:slug/buy
router.post('/:slug/buy', ordersPaused, async (req, res) => {
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

    const result = await processStorePurchase({
      reference,
      metadata: verification.metadata,
    });

    if (!result.ok) {
      const code = result.reason === 'store_not_found' ? 404 : 400;
      return res.status(code).json({ status: 'error', message: result.reason });
    }

    if (result.alreadyProcessed) {
      return res.json({ status: 'success', message: 'Already processed', data: result.purchase });
    }

    res.json({ status: 'success', data: result.purchase });
  } catch (err) {
    console.error('Store public error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
