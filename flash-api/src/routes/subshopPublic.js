const router = require('express').Router();
const Store = require('../models/Store');
const SubAgent = require('../models/SubAgent');
const SubAgentProduct = require('../models/SubAgentProduct');
const User = require('../models/User');
const Settings = require('../models/Settings');
const paystackService = require('../services/paystackService');
const { generateReference } = require('../utils/helpers');
const { processSubShopPurchase, processSubShopCheckerPurchase } = require('../utils/storePurchaseProcessor');
const datamartService = require('../services/datamartService');
const ordersPaused = require('../middleware/ordersPaused');

const CHECKER_TYPES = ['WAEC', 'BECE'];
const subCheckerPrice = (sub, type) =>
  type === 'WAEC' ? (sub?.checkerPricing?.waecPrice || 0) : (sub?.checkerPricing?.becePrice || 0);

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
      .select('network capacity sellingPrice')
      .lean();
    const settings = await Settings.getSettings();
    const outOfStock = new Set(settings?.outOfStockNetworks || []);
    const annotated = products.map(p => ({ ...p, outOfStock: outOfStock.has(p.network) }));

    res.json({ status: 'success', data: annotated });
  } catch (err) {
    console.error('SubShop products error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subshop/:slug/checkers — WAEC/BECE checkers this sub-agent sells.
router.get('/:slug/checkers', async (req, res) => {
  try {
    const subAgent = await SubAgent.findOne({ storeSlug: req.params.slug, status: 'registered', isActive: true });
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const settings = await Settings.getSettings();
    const platformEnabled = settings?.resultChecker?.enabled !== false;
    if (!platformEnabled || !subAgent.checkerPricing?.enabled) {
      return res.json({ status: 'success', data: { enabled: false, products: [] } });
    }

    let stock = {};
    try {
      const upstream = await datamartService.getResultCheckers();
      for (const p of upstream) {
        stock[(p.name || '').toUpperCase()] = { inStock: !!p.inStock, stockCount: p.stockCount ?? null };
      }
    } catch { stock = {}; }

    const products = CHECKER_TYPES
      .map(type => ({
        checkerType: type,
        name: `${type} Result Checker`,
        price: subCheckerPrice(subAgent, type),
        inStock: stock[type] ? stock[type].inStock : true,
        stockCount: stock[type] ? stock[type].stockCount : null,
      }))
      .filter(p => p.price > 0);

    res.json({ status: 'success', data: { enabled: products.length > 0, products } });
  } catch (err) {
    console.error('SubShop checkers error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/subshop/:slug/buy-checker — customer buys a result checker (pays Paystack).
router.post('/:slug/buy-checker', ordersPaused, async (req, res) => {
  try {
    const { checkerType, phoneNumber } = req.body;
    if (!CHECKER_TYPES.includes(checkerType) || !phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'Checker type and phone number required' });
    }

    const subAgent = await SubAgent.findOne({ storeSlug: req.params.slug, status: 'registered', isActive: true }).populate('storeId');
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }
    const store = subAgent.storeId;
    if (!store || !store.isActive) {
      return res.status(404).json({ status: 'error', message: 'Parent store is not available' });
    }

    const settings = await Settings.getSettings();
    if (settings?.resultChecker?.enabled === false || !subAgent.checkerPricing?.enabled) {
      return res.status(400).json({ status: 'error', message: 'Result checkers are not available at this store.' });
    }

    const sellingPrice = subCheckerPrice(subAgent, checkerType);
    if (!sellingPrice || sellingPrice <= 0) {
      return res.status(400).json({ status: 'error', message: 'This checker is not available right now.' });
    }

    const reference = generateReference('SUBC');
    const agent = await User.findById(store.agentId);

    const feePercent = settings?.paystack?.paymentFeePercent ?? 3;
    const fee = Math.round(sellingPrice * feePercent) / 100;
    const chargeAmount = Math.round((sellingPrice + fee) * 100) / 100;

    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subshop/${subAgent.storeSlug}?payment=success`;

    const paystack = await paystackService.initializeTransaction({
      email: agent.email,
      amount: chargeAmount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        type: 'subagent_store_checker',
        subAgentId: subAgent._id.toString(),
        checkerType,
        phoneNumber,
        sellingPrice,
      },
    });

    res.json({
      status: 'success',
      data: { authorization_url: paystack.authorization_url, reference },
    });
  } catch (err) {
    console.error('SubShop buy-checker error:', err.message);
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

    const isChecker = verification.metadata?.type === 'subagent_store_checker';
    const result = isChecker
      ? await processSubShopCheckerPurchase({ reference, metadata: verification.metadata })
      : await processSubShopPurchase({ reference, metadata: verification.metadata });

    if (!result.ok) {
      const code = result.reason === 'subagent_not_found' || result.reason === 'parent_store_not_found' ? 404 : 400;
      return res.status(code).json({ status: 'error', message: result.reason });
    }

    if (result.alreadyProcessed) {
      return res.json({ status: 'success', message: 'Already processed', data: { ...result.purchase.toObject?.() || result.purchase, kind: isChecker ? 'checker' : 'data' } });
    }

    res.json({ status: 'success', data: { ...result.purchase.toObject?.() || result.purchase, kind: isChecker ? 'checker' : 'data' } });
  } catch (err) {
    console.error('SubShop verify error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
