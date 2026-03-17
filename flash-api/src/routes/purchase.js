const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const DataPurchase = require('../models/DataPurchase');
const Settings = require('../models/Settings');
const datamartService = require('../services/datamartService');
// All purchases go through DataMart
const paystackService = require('../services/paystackService');
const referralService = require('../services/referralService');
const { generateReference, formatPhone, validateGhanaPhone } = require('../utils/helpers');

const VALID_NETWORKS = ['YELLO', 'TELECEL', 'AT_PREMIUM'];

// GET /api/purchase/guest-packages - Public, no auth
router.get('/guest-packages', async (req, res) => {
  try {
    const { network } = req.query;
    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};

    const result = [];
    const networks = network ? [network] : Object.keys(sellingPrices);

    for (const net of networks) {
      const networkPrices = sellingPrices[net] || {};
      for (const [capacity, price] of Object.entries(networkPrices)) {
        if (price > 0) {
          result.push({ network: net, capacity: parseFloat(capacity), price });
        }
      }
    }

    result.sort((a, b) => a.capacity - b.capacity);
    res.json({ status: 'success', data: result });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/purchase/guest-buy - Public, no auth, MoMo only
router.post('/guest-buy', async (req, res) => {
  try {
    const { network, capacity, phoneNumber, email } = req.body;
    if (!network || !capacity || !phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'Network, capacity, and phone number are required' });
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ status: 'error', message: 'A valid email is required for payment' });
    }
    if (!VALID_NETWORKS.includes(network)) {
      return res.status(400).json({ status: 'error', message: 'Invalid network' });
    }
    if (!validateGhanaPhone(phoneNumber)) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid Ghana phone number' });
    }

    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};
    const networkPrices = sellingPrices[network] || {};
    const price = networkPrices[String(capacity)];

    if (!price) {
      return res.status(400).json({ status: 'error', message: 'Package not available' });
    }

    const reference = generateReference('GST');
    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/quick-buy?payment=callback&reference=${reference}`;

    const paystack = await paystackService.initializeTransaction({
      email,
      amount: price,
      reference,
      callback_url: callbackUrl,
      metadata: {
        type: 'guest_purchase',
        network,
        capacity,
        phoneNumber,
        email,
        price,
      },
    });

    res.json({
      status: 'success',
      data: { authorization_url: paystack.authorization_url, reference },
    });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/purchase/guest-status/:ref - Public, no auth
router.get('/guest-status/:ref', async (req, res) => {
  try {
    const purchase = await DataPurchase.findOne({ reference: req.params.ref, purchaseSource: 'guest' });
    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Purchase not found' });
    }
    res.json({ status: 'success', data: { status: purchase.status, network: purchase.network, capacity: purchase.capacity, phoneNumber: purchase.phoneNumber } });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/purchase/packages
router.get('/packages', auth, async (req, res) => {
  try {
    const { network } = req.query;
    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};

    // Build packages from admin-set selling prices
    const result = [];
    const networks = network ? [network] : Object.keys(sellingPrices);

    for (const net of networks) {
      const networkPrices = sellingPrices[net] || {};
      for (const [capacity, price] of Object.entries(networkPrices)) {
        if (price > 0) {
          result.push({
            network: net,
            capacity: parseFloat(capacity),
            price,
          });
        }
      }
    }

    // Sort by capacity
    result.sort((a, b) => a.capacity - b.capacity);

    res.json({ status: 'success', data: result });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/purchase/buy
router.post('/buy', auth, async (req, res) => {
  try {
    const { network, capacity, phoneNumber } = req.body;
    if (!network || !capacity || !phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'Network, capacity, and phone number are required' });
    }
    if (!VALID_NETWORKS.includes(network)) {
      return res.status(400).json({ status: 'error', message: 'Invalid network' });
    }
    if (!validateGhanaPhone(phoneNumber)) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid Ghana phone number' });
    }

    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};
    const basePrices = settings?.pricing?.basePrices || {};
    const networkPrices = sellingPrices[network] || {};
    const price = networkPrices[String(capacity)];
    const costPrice = (basePrices[network] || {})[String(capacity)] || 0;

    if (!price) {
      return res.status(400).json({ status: 'error', message: 'Package not available' });
    }

    // Check balance
    const user = await User.findById(req.user._id);
    if (user.walletBalance < price) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    // Debit wallet atomically
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, walletBalance: { $gte: price } },
      { $inc: { walletBalance: -price } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    const reference = generateReference('PUR');

    // Create transaction
    await Transaction.create({
      userId: user._id,
      type: 'purchase',
      amount: price,
      balanceBefore: updatedUser.walletBalance + price,
      balanceAfter: updatedUser.walletBalance,
      status: 'completed',
      reference,
      description: `${capacity}GB ${network} data to ${phoneNumber}`,
    });

    // Create purchase record
    const purchase = await DataPurchase.create({
      userId: user._id,
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

    // Send to DataMart
    try {
      const result = await datamartService.purchaseData({ network, capacity, phoneNumber });
      purchase.datamartReference = result?.reference || result?.orderReference;
      purchase.status = 'processing';
      await purchase.save();
    } catch (err) {
      purchase.status = 'failed';
      await purchase.save();
      // Refund
      await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { walletBalance: price } }
      );
      await Transaction.create({
        userId: user._id,
        type: 'refund',
        amount: price,
        balanceBefore: updatedUser.walletBalance,
        balanceAfter: updatedUser.walletBalance + price,
        status: 'completed',
        reference: generateReference('RFD'),
        description: `Refund for failed ${capacity}GB ${network} purchase`,
      });
      return res.status(500).json({ status: 'error', message: 'Purchase failed. Your balance has been refunded.' });
    }

    // Process referral commission
    referralService.processCommission(user._id, price, purchase._id);

    res.json({ status: 'success', message: 'Purchase submitted', data: purchase });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/purchase/buy-with-momo - Pay directly with MoMo via Paystack
router.post('/buy-with-momo', auth, async (req, res) => {
  try {
    const { network, capacity, phoneNumber } = req.body;
    if (!network || !capacity || !phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'Network, capacity, and phone number are required' });
    }
    if (!VALID_NETWORKS.includes(network)) {
      return res.status(400).json({ status: 'error', message: 'Invalid network' });
    }
    if (!validateGhanaPhone(phoneNumber)) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid Ghana phone number' });
    }

    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};
    const networkPrices = sellingPrices[network] || {};
    const price = networkPrices[String(capacity)];

    if (!price) {
      return res.status(400).json({ status: 'error', message: 'Package not available' });
    }

    const user = await User.findById(req.user._id);
    const reference = generateReference('MOM');
    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`;

    // Create pending transaction
    await Transaction.create({
      userId: user._id,
      type: 'purchase',
      amount: price,
      balanceBefore: user.walletBalance,
      balanceAfter: user.walletBalance,
      status: 'pending',
      reference,
      gateway: 'paystack',
      description: `${capacity}GB ${network} data to ${phoneNumber} (MoMo)`,
    });

    // Initialize Paystack payment
    const paystack = await paystackService.initializeTransaction({
      email: user.email,
      amount: price,
      reference,
      callback_url: callbackUrl,
      metadata: {
        userId: user._id.toString(),
        type: 'direct_purchase',
        network,
        capacity,
        phoneNumber,
        price,
      },
    });

    res.json({
      status: 'success',
      data: { authorization_url: paystack.authorization_url, reference },
    });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/purchase/history
router.get('/history', auth, async (req, res) => {
  try {
    const purchases = await DataPurchase.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ status: 'success', data: purchases });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/purchase/status/:ref
router.get('/status/:ref', auth, async (req, res) => {
  try {
    const purchase = await DataPurchase.findOne({ reference: req.params.ref, userId: req.user._id });
    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Purchase not found' });
    }
    res.json({ status: 'success', data: purchase });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
