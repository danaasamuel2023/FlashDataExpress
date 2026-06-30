const router = require('express').Router();
const apiKeyAuth = require('../../middleware/apiKeyAuth');
const ordersPaused = require('../../middleware/ordersPaused');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const DataPurchase = require('../../models/DataPurchase');
const Settings = require('../../models/Settings');
const datamartService = require('../../services/datamartService');
const referralService = require('../../services/referralService');
const { generateReference, validateGhanaPhone } = require('../../utils/helpers');

const VALID_NETWORKS = ['YELLO', 'TELECEL', 'AT_PREMIUM'];

// Developer-friendly aliases → internal network codes. Lets integrators send
// "MTN" / "AT" / "VODAFONE" instead of our internal codes.
const NETWORK_ALIASES = {
  MTN: 'YELLO', YELLO: 'YELLO',
  TELECEL: 'TELECEL', VODAFONE: 'TELECEL',
  AT: 'AT_PREMIUM', AIRTELTIGO: 'AT_PREMIUM', AT_PREMIUM: 'AT_PREMIUM', ATPREMIUM: 'AT_PREMIUM',
};

const resolveNetwork = (n) => NETWORK_ALIASES[String(n || '').trim().toUpperCase()] || null;

// All v1 routes require a valid, approved API key.
router.use(apiKeyAuth);

// GET /api/v1/packages — available networks, capacities and prices
router.get('/packages', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};
    const apiPrices = settings?.pricing?.apiPrices || {};
    const outOfStock = new Set(settings?.outOfStockNetworks || []);

    const requested = req.query.network ? resolveNetwork(req.query.network) : null;
    const networks = requested ? [requested] : Object.keys(sellingPrices);

    const result = [];
    for (const net of networks) {
      const networkPrices = sellingPrices[net] || {};
      for (const [capacity, sellPrice] of Object.entries(networkPrices)) {
        // Effective API price = override if set, else regular selling price.
        const price = (apiPrices[net] || {})[capacity] || sellPrice;
        if (price > 0) {
          result.push({
            network: net,
            capacity: parseFloat(capacity),
            price,
            currency: 'GHS',
            outOfStock: outOfStock.has(net),
          });
        }
      }
    }
    result.sort((a, b) => (a.network).localeCompare(b.network) || a.capacity - b.capacity);

    res.json({ status: 'success', data: result });
  } catch (err) {
    console.error('API v1 packages error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/v1/balance — the account's wallet balance
router.get('/balance', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance');
    res.json({
      status: 'success',
      data: { balance: user?.walletBalance || 0, currency: 'GHS' },
    });
  } catch (err) {
    console.error('API v1 balance error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/v1/buy — purchase a data bundle, paid from the wallet balance
router.post('/buy', ordersPaused, async (req, res) => {
  try {
    const { capacity, phoneNumber } = req.body || {};
    const network = resolveNetwork(req.body?.network);

    if (!req.body?.network || !capacity || !phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'network, capacity and phoneNumber are required' });
    }
    if (!network || !VALID_NETWORKS.includes(network)) {
      return res.status(400).json({ status: 'error', message: 'Invalid network. Use MTN, TELECEL or AT.' });
    }
    if (!validateGhanaPhone(phoneNumber)) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid Ghana phone number' });
    }

    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};
    const apiPrices = settings?.pricing?.apiPrices || {};
    const basePrices = settings?.pricing?.basePrices || {};
    const outOfStock = new Set(settings?.outOfStockNetworks || []);

    if (outOfStock.has(network)) {
      return res.status(400).json({ status: 'error', message: `${network} is currently out of stock` });
    }

    // API price override falls back to the regular selling price when unset.
    const price = (apiPrices[network] || {})[String(capacity)]
      || (sellingPrices[network] || {})[String(capacity)];
    const costPrice = (basePrices[network] || {})[String(capacity)] || 0;
    if (!price) {
      return res.status(400).json({ status: 'error', message: 'Package not available' });
    }

    // Atomic wallet debit.
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: price } },
      { $inc: { walletBalance: -price } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    const reference = generateReference('API');

    await Transaction.create({
      userId: req.user._id,
      type: 'purchase',
      amount: price,
      balanceBefore: updatedUser.walletBalance + price,
      balanceAfter: updatedUser.walletBalance,
      status: 'completed',
      reference,
      description: `${capacity}GB ${network} data to ${phoneNumber} (API)`,
      metadata: { source: 'api', network, capacity, phoneNumber, apiKeyId: req.apiKey?._id },
    });

    const purchase = await DataPurchase.create({
      userId: req.user._id,
      phoneNumber,
      network,
      capacity,
      price,
      costPrice,
      reference,
      provider: 'datamart',
      status: 'pending',
      purchaseSource: 'direct',
    });

    try {
      const result = await datamartService.purchaseData({ network, capacity, phoneNumber });
      purchase.datamartReference = result?.reference || result?.orderReference;
      purchase.status = 'processing';
      await purchase.save();
    } catch (err) {
      const providerMessage = err.response?.data?.message || err.message || 'Unknown error';
      purchase.status = 'failed';
      purchase.failureReason = providerMessage;
      await purchase.save();
      // Auto-refund disabled — admin reviews/refunds failures (matches /buy).
      return res.status(502).json({
        status: 'error',
        message: `Purchase failed: ${providerMessage}. It will be reviewed and refunded by admin if charged.`,
        data: { reference, status: 'failed' },
      });
    }

    referralService.processCommission(req.user._id, price, purchase._id);

    res.json({
      status: 'success',
      message: 'Purchase submitted',
      data: {
        reference: purchase.reference,
        network: purchase.network,
        capacity: purchase.capacity,
        phoneNumber: purchase.phoneNumber,
        price: purchase.price,
        currency: 'GHS',
        status: purchase.status,
        balance: updatedUser.walletBalance,
        createdAt: purchase.createdAt,
      },
    });
  } catch (err) {
    console.error('API v1 buy error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/v1/orders/:reference — status of a previously placed order
router.get('/orders/:reference', async (req, res) => {
  try {
    const purchase = await DataPurchase.findOne({
      reference: req.params.reference,
      userId: req.user._id,
    }).select('reference network capacity phoneNumber price status failureReason createdAt completedAt').lean();

    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    res.json({
      status: 'success',
      data: {
        reference: purchase.reference,
        network: purchase.network,
        capacity: purchase.capacity,
        phoneNumber: purchase.phoneNumber,
        price: purchase.price,
        currency: 'GHS',
        status: purchase.status,
        failureReason: purchase.failureReason || null,
        createdAt: purchase.createdAt,
        completedAt: purchase.completedAt || null,
      },
    });
  } catch (err) {
    console.error('API v1 order status error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
