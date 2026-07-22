const router = require('express').Router();
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const User = require('../models/User');
const Settings = require('../models/Settings');
const paystackService = require('../services/paystackService');
const SubAgent = require('../models/SubAgent');
const { generateReference } = require('../utils/helpers');
const { processStorePurchase, processStoreCheckerPurchase } = require('../utils/storePurchaseProcessor');
const datamartService = require('../services/datamartService');
const ordersPaused = require('../middleware/ordersPaused');

const CHECKER_TYPES = ['WAEC', 'BECE'];
const storeCheckerPrice = (store, type) =>
  type === 'WAEC' ? (store?.checkerPricing?.waecPrice || 0) : (store?.checkerPricing?.becePrice || 0);

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

// GET /api/shop/:slug/checkers — WAEC/BECE checkers this store sells, with the
// agent's own price and live upstream stock. Empty if the agent hasn't enabled them.
router.get('/:slug/checkers', async (req, res) => {
  try {
    const store = await Store.findOne({ storeSlug: req.params.slug, isActive: true });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const settings = await Settings.getSettings();
    const platformEnabled = settings?.resultChecker?.enabled !== false;
    const storeEnabled = !!store.checkerPricing?.enabled;
    if (!platformEnabled || !storeEnabled) {
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
        price: storeCheckerPrice(store, type),
        inStock: stock[type] ? stock[type].inStock : true,
        stockCount: stock[type] ? stock[type].stockCount : null,
      }))
      .filter(p => p.price > 0);

    res.json({ status: 'success', data: { enabled: products.length > 0, products } });
  } catch (err) {
    console.error('Store checkers error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/shop/:slug/buy-checker — customer buys a result checker (pays Paystack).
router.post('/:slug/buy-checker', ordersPaused, async (req, res) => {
  try {
    const { checkerType, phoneNumber } = req.body;
    if (!CHECKER_TYPES.includes(checkerType) || !phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'Checker type and phone number required' });
    }

    const store = await Store.findOne({ storeSlug: req.params.slug, isActive: true });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const settings = await Settings.getSettings();
    if (settings?.resultChecker?.enabled === false || !store.checkerPricing?.enabled) {
      return res.status(400).json({ status: 'error', message: 'Result checkers are not available at this store.' });
    }

    const sellingPrice = storeCheckerPrice(store, checkerType);
    if (!sellingPrice || sellingPrice <= 0) {
      return res.status(400).json({ status: 'error', message: 'This checker is not available right now.' });
    }

    const reference = generateReference('SHPC');
    const agent = await User.findById(store.agentId);

    const feePercent = settings?.paystack?.paymentFeePercent ?? 3;
    const fee = Math.round(sellingPrice * feePercent) / 100;
    const chargeAmount = Math.round((sellingPrice + fee) * 100) / 100;

    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shop/${store.storeSlug}?payment=success`;

    const paystack = await paystackService.initializeTransaction({
      email: agent.email,
      amount: chargeAmount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        type: 'store_checker',
        storeId: store._id.toString(),
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
    console.error('Store buy-checker error:', err.message);
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

    const isChecker = verification.metadata?.type === 'store_checker';
    const result = isChecker
      ? await processStoreCheckerPurchase({ reference, metadata: verification.metadata })
      : await processStorePurchase({ reference, metadata: verification.metadata });

    if (!result.ok) {
      const code = result.reason === 'store_not_found' ? 404 : 400;
      return res.status(code).json({ status: 'error', message: result.reason });
    }

    if (result.alreadyProcessed) {
      return res.json({ status: 'success', message: 'Already processed', data: { ...result.purchase.toObject?.() || result.purchase, kind: isChecker ? 'checker' : 'data' } });
    }

    res.json({ status: 'success', data: { ...result.purchase.toObject?.() || result.purchase, kind: isChecker ? 'checker' : 'data' } });
  } catch (err) {
    console.error('Store public error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
