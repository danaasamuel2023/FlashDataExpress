const router = require('express').Router();
const auth = require('../middleware/auth');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const DataPurchase = require('../models/DataPurchase');
const Settings = require('../models/Settings');
const paystackService = require('../services/paystackService');
const { generateReference } = require('../utils/helpers');

const STORE_ACTIVATION_FEE = 50; // GH₵50

// POST /api/store/initialize-payment — Start Paystack payment for store activation
router.post('/initialize-payment', auth, async (req, res) => {
  try {
    const existing = await Store.findOne({ agentId: req.user._id });
    if (existing) {
      return res.status(400).json({ status: 'error', message: 'You already have a store' });
    }

    const { storeName, description, contactPhone, theme, momoDetails } = req.body;
    if (!storeName) {
      return res.status(400).json({ status: 'error', message: 'Store name is required' });
    }

    const reference = generateReference('SAC');

    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/store/setup?reference=${reference}`;

    const paystack = await paystackService.initializeTransaction({
      email: req.user.email,
      amount: STORE_ACTIVATION_FEE,
      reference,
      callback_url: callbackUrl,
      metadata: {
        type: 'store_activation',
        userId: req.user._id.toString(),
        storeName,
        description: description || '',
        contactPhone: contactPhone || '',
        theme: theme || { primaryColor: '#FF6B00' },
        momoDetails: momoDetails || {},
      },
    });

    res.json({
      status: 'success',
      data: { authorization_url: paystack.authorization_url, reference },
    });
  } catch (err) {
    console.error('Store activation payment error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/store/verify-activation — Verify Paystack payment and create store
router.get('/verify-activation', auth, async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) {
      return res.status(400).json({ status: 'error', message: 'Reference required' });
    }

    // Check if store already exists (payment already processed)
    const existing = await Store.findOne({ agentId: req.user._id });
    if (existing) {
      return res.json({ status: 'success', message: 'Store already created', data: existing });
    }

    const verification = await paystackService.verifyTransaction(reference);
    if (verification.status !== 'success') {
      return res.status(400).json({ status: 'error', message: 'Payment not verified' });
    }

    const meta = verification.metadata;
    if (meta.type !== 'store_activation' || meta.userId !== req.user._id.toString()) {
      return res.status(400).json({ status: 'error', message: 'Invalid activation payment' });
    }

    // Generate slug
    let storeSlug = meta.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugExists = await Store.findOne({ storeSlug });
    if (slugExists) {
      storeSlug += '-' + Date.now().toString(36);
    }

    const store = await Store.create({
      agentId: req.user._id,
      storeName: meta.storeName,
      storeSlug,
      description: meta.description,
      contactPhone: meta.contactPhone,
      theme: meta.theme,
      momoDetails: meta.momoDetails,
    });

    res.status(201).json({ status: 'success', data: store });
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Store.findOne({ agentId: req.user._id });
      return res.json({ status: 'success', message: 'Store already created', data: existing });
    }
    console.error('Store activation verify error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/store/my-store
router.get('/my-store', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    res.json({ status: 'success', data: store });
  } catch (err) {
    console.error('Store error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/store/update
router.put('/update', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const { storeName, description, contactPhone, contactWhatsapp, theme, isActive, momoDetails } = req.body;
    if (storeName) store.storeName = storeName;
    if (description !== undefined) store.description = description;
    if (contactPhone) store.contactPhone = contactPhone;
    if (contactWhatsapp !== undefined) store.contactWhatsapp = contactWhatsapp;
    if (theme) store.theme = { ...store.theme, ...theme };
    if (isActive !== undefined) store.isActive = isActive;
    if (momoDetails) store.momoDetails = momoDetails;

    await store.save();
    res.json({ status: 'success', data: store });
  } catch (err) {
    console.error('Store error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/store/agent-packages — Returns the agent's cost prices (agentPrices if set, else sellingPrices)
router.get('/agent-packages', auth, async (req, res) => {
  try {
    const { network } = req.query;
    const settings = await Settings.getSettings();
    const agentPrices = settings?.pricing?.agentPrices || {};
    const sellingPrices = settings?.pricing?.sellingPrices || {};

    const result = [];
    const networks = network ? [network] : [...new Set([...Object.keys(agentPrices), ...Object.keys(sellingPrices)])];

    for (const net of networks) {
      // Prefer agent-specific prices, fall back to selling prices
      const agentNetPrices = agentPrices[net] || {};
      const sellingNetPrices = sellingPrices[net] || {};
      const allCapacities = [...new Set([...Object.keys(agentNetPrices), ...Object.keys(sellingNetPrices)])];

      for (const capacity of allCapacities) {
        const price = agentNetPrices[capacity] || sellingNetPrices[capacity];
        if (price > 0) {
          result.push({ network: net, capacity: parseFloat(capacity), price });
        }
      }
    }

    result.sort((a, b) => a.capacity - b.capacity);
    res.json({ status: 'success', data: result });
  } catch (err) {
    console.error('Store agent-packages error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/store/products
router.get('/products', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    const products = await StoreProduct.find({ storeId: store._id });
    res.json({ status: 'success', data: products });
  } catch (err) {
    console.error('Store error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/store/products
router.put('/products', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ status: 'error', message: 'Products must be an array' });
    }

    // Use agent-specific prices as base prices (what the agent pays to the platform)
    const settings = await Settings.getSettings();
    const agentPrices = settings?.pricing?.agentPrices || {};
    const sellingPrices = settings?.pricing?.sellingPrices || {};

    const ops = products.map(p => {
      // Enforce correct base price from platform settings
      const basePrice = (agentPrices[p.network] || {})[String(p.capacity)]
        || (sellingPrices[p.network] || {})[String(p.capacity)]
        || p.basePrice;

      return {
        updateOne: {
          filter: { storeId: store._id, network: p.network, capacity: p.capacity },
          update: {
            $set: {
              basePrice,
              sellingPrice: p.sellingPrice,
              isActive: p.isActive !== false,
            },
          },
          upsert: true,
        },
      };
    });

    if (ops.length > 0) {
      await StoreProduct.bulkWrite(ops);
    }

    const updated = await StoreProduct.find({ storeId: store._id });
    res.json({ status: 'success', data: updated });
  } catch (err) {
    console.error('Store error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/store/sales
router.get('/sales', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) return res.status(404).json({ status: 'error', message: 'Store not found' });

    const sales = await DataPurchase.find({ 'storeDetails.storeId': store._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ status: 'success', data: sales });
  } catch (err) {
    console.error('Store error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/store/daily-sales — Today's store sales with profit
router.get('/daily-sales', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) return res.status(404).json({ status: 'error', message: 'Store not found' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sales = await DataPurchase.find({
      'storeDetails.storeId': store._id,
      createdAt: { $gte: todayStart },
    }).sort({ createdAt: -1 }).limit(200).lean();

    const todayProfit = sales.reduce((sum, s) => sum + (s.storeDetails?.agentProfit || 0), 0);
    const todayRevenue = sales.reduce((sum, s) => sum + (s.price || 0), 0);

    res.json({
      status: 'success',
      data: { sales, todayProfit, todayRevenue, count: sales.length },
    });
  } catch (err) {
    console.error('Store error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/store/earnings
router.get('/earnings', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) return res.status(404).json({ status: 'error', message: 'Store not found' });

    res.json({
      status: 'success',
      data: {
        totalEarnings: store.totalEarnings,
        pendingBalance: store.pendingBalance,
        totalSales: store.totalSales,
      },
    });
  } catch (err) {
    console.error('Store error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
