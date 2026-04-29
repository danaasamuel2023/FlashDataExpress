const router = require('express').Router();
const auth = require('../middleware/auth');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const SubAgent = require('../models/SubAgent');
const SubAgentProduct = require('../models/SubAgentProduct');
const DataPurchase = require('../models/DataPurchase');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
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

    // Record the activation as a transaction so it shows in admin/user history.
    // Balance is unchanged because payment was made directly via Paystack.
    try {
      const agent = await User.findById(req.user._id).select('walletBalance');
      const existingTx = await Transaction.findOne({ reference });
      if (!existingTx) {
        await Transaction.create({
          userId: req.user._id,
          type: 'purchase',
          amount: STORE_ACTIVATION_FEE,
          balanceBefore: agent?.walletBalance || 0,
          balanceAfter: agent?.walletBalance || 0,
          status: 'completed',
          reference,
          gateway: 'paystack',
          description: `Store activation: ${meta.storeName}`,
          metadata: { source: 'store_activation', storeId: store._id, storeName: meta.storeName },
        });
      }
    } catch (txErr) {
      console.error('Store activation transaction log failed:', txErr.message);
    }

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

    // Cascade parent's selling price → sub-agents' basePrice (their cost)
    const subAgents = await SubAgent.find({ storeId: store._id, status: 'registered' }).select('_id');
    if (subAgents.length > 0) {
      const subAgentIds = subAgents.map(s => s._id);
      const subOps = [];
      for (const p of updated) {
        subOps.push({
          updateMany: {
            filter: { subAgentId: { $in: subAgentIds }, network: p.network, capacity: p.capacity },
            update: { $set: { basePrice: p.sellingPrice } },
          },
        });
      }
      if (subOps.length > 0) {
        await SubAgentProduct.bulkWrite(subOps);
      }
    }

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

// GET /api/store/daily-history — rolling per-day breakdown of store sales
router.get('/daily-history', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) return res.status(404).json({ status: 'error', message: 'Store not found' });

    const days = Math.min(31, Math.max(1, parseInt(req.query.days, 10) || 7));
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const sales = await DataPurchase.find({
      'storeDetails.storeId': store._id,
      createdAt: { $gte: startDate },
    }).lean();

    const buckets = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = {
        date: key,
        salesCount: 0, completedCount: 0, failedCount: 0,
        revenue: 0, profit: 0,
      };
    }

    for (const s of sales) {
      const key = new Date(s.createdAt).toISOString().slice(0, 10);
      const bucket = buckets[key];
      if (!bucket) continue;
      bucket.salesCount += 1;
      if (s.status === 'completed') bucket.completedCount += 1;
      if (s.status === 'failed' || s.status === 'refunded') bucket.failedCount += 1;
      if (['completed', 'processing', 'pending'].includes(s.status)) {
        bucket.revenue += s.price || 0;
        bucket.profit += s.storeDetails?.agentProfit || 0;
      }
    }

    const daysList = Object.values(buckets)
      .map(b => ({ ...b, profit: Math.round(b.profit * 100) / 100, revenue: Math.round(b.revenue * 100) / 100 }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      status: 'success',
      data: {
        days: daysList,
        weekTotal: {
          salesCount: daysList.reduce((s, d) => s + d.salesCount, 0),
          completedCount: daysList.reduce((s, d) => s + d.completedCount, 0),
          failedCount: daysList.reduce((s, d) => s + d.failedCount, 0),
          revenue: Math.round(daysList.reduce((s, d) => s + d.revenue, 0) * 100) / 100,
          profit: Math.round(daysList.reduce((s, d) => s + d.profit, 0) * 100) / 100,
        },
      },
    });
  } catch (err) {
    console.error('Store daily-history error:', err.message);
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
