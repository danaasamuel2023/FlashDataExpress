const router = require('express').Router();
const auth = require('../middleware/auth');
const ordersPaused = require('../middleware/ordersPaused');
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

// Customers paying with MoMo (whether logged-in non-wallet or guest) pay an
// extra 3% to cover payment processing. Wallet-funded purchases are free.
const MOMO_FEE_PERCENT = 3;
const addMomoFee = (price) =>
  Math.round((price + (price * MOMO_FEE_PERCENT) / 100) * 100) / 100;

// GET /api/purchase/guest-packages - Public, no auth
router.get('/guest-packages', async (req, res) => {
  try {
    const { network } = req.query;
    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};
    const outOfStock = new Set(settings?.outOfStockNetworks || []);

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
            outOfStock: outOfStock.has(net),
          });
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
router.post('/guest-buy', ordersPaused, async (req, res) => {
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
    const guestPrices = settings?.pricing?.guestPrices || {};
    const sellingPrice = (sellingPrices[network] || {})[String(capacity)];
    const guestOverride = (guestPrices[network] || {})[String(capacity)];
    // Guest price override falls back to the regular selling price when unset,
    // and is never allowed to undercut it — guests pay at least the User price.
    const price = Math.max(guestOverride || 0, sellingPrice || 0);

    if (!price) {
      return res.status(400).json({ status: 'error', message: 'Package not available' });
    }

    const reference = generateReference('GST');
    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/quick-buy?payment=callback&reference=${reference}`;

    const chargeAmount = addMomoFee(price);

    const paystack = await paystackService.initializeTransaction({
      email,
      amount: chargeAmount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        type: 'guest_purchase',
        network,
        capacity,
        phoneNumber,
        email,
        price,
        chargeAmount,
        feePercent: MOMO_FEE_PERCENT,
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
    const outOfStock = new Set(settings?.outOfStockNetworks || []);

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
            outOfStock: outOfStock.has(net),
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
router.post('/buy', auth, ordersPaused, async (req, res) => {
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
      metadata: { source: 'direct_purchase', network, capacity, phoneNumber },
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
      const providerMessage = err.response?.data?.message || err.message || 'Unknown error';
      purchase.status = 'failed';
      purchase.failureReason = providerMessage;
      await purchase.save();
      // Auto-refund disabled — admin will refund manually from /admin/refunds.
      return res.status(500).json({
        status: 'error',
        message: `Purchase failed: ${providerMessage}. Please contact support — admin will review and refund.`,
      });
    }

    // Process referral commission
    referralService.processCommission(user._id, price, purchase._id);

    res.json({ status: 'success', message: 'Purchase submitted', data: purchase });
  } catch (err) {
    console.error('Purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/purchase/bulk-buy — process many wallet-funded orders in one request.
// Validates every row first, debits the wallet once for the total, then
// submits each order to DataMart individually. Per-row failures are
// recorded as failed purchases; auto-refund is intentionally NOT triggered
// (matches the policy in /buy — admin handles refunds via /admin/refunds).
router.post('/bulk-buy', auth, ordersPaused, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No orders provided' });
    }
    if (items.length > 100) {
      return res.status(400).json({ status: 'error', message: 'Bulk purchase is limited to 100 orders per request' });
    }

    const settings = await Settings.getSettings();
    const sellingPrices = settings?.pricing?.sellingPrices || {};
    const basePrices = settings?.pricing?.basePrices || {};
    const outOfStock = new Set(settings?.outOfStockNetworks || []);

    // Validate every row up front and resolve prices. Any invalid row blocks
    // the whole batch so the agent can fix it before paying.
    const prepared = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i] || {};
      const { network, capacity, phoneNumber } = row;
      const rowLabel = `Row ${i + 1}`;

      if (!network || !capacity || !phoneNumber) {
        return res.status(400).json({ status: 'error', message: `${rowLabel}: network, capacity and phone number are required` });
      }
      if (!VALID_NETWORKS.includes(network)) {
        return res.status(400).json({ status: 'error', message: `${rowLabel}: invalid network` });
      }
      if (outOfStock.has(network)) {
        return res.status(400).json({ status: 'error', message: `${rowLabel}: ${network} is currently out of stock` });
      }
      if (!validateGhanaPhone(phoneNumber)) {
        return res.status(400).json({ status: 'error', message: `${rowLabel}: invalid Ghana phone number` });
      }
      const price = (sellingPrices[network] || {})[String(capacity)];
      if (!price) {
        return res.status(400).json({ status: 'error', message: `${rowLabel}: ${capacity}GB ${network} is not available` });
      }
      const costPrice = (basePrices[network] || {})[String(capacity)] || 0;
      prepared.push({ network, capacity, phoneNumber, price, costPrice });
    }

    const total = Math.round(prepared.reduce((s, r) => s + r.price, 0) * 100) / 100;

    // Atomic wallet debit for the whole batch.
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: total } },
      { $inc: { walletBalance: -total } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance for the full bulk order' });
    }

    const batchRef = generateReference('BULK');

    // Single summary transaction for the wallet debit.
    await Transaction.create({
      userId: req.user._id,
      type: 'purchase',
      amount: total,
      balanceBefore: updatedUser.walletBalance + total,
      balanceAfter: updatedUser.walletBalance,
      status: 'completed',
      reference: batchRef,
      description: `Bulk purchase: ${prepared.length} orders`,
      metadata: { source: 'bulk_purchase', count: prepared.length, batchRef },
    });

    const results = [];
    for (const row of prepared) {
      const reference = generateReference('PUR');
      let purchase;
      try {
        purchase = await DataPurchase.create({
          userId: req.user._id,
          phoneNumber: row.phoneNumber,
          network: row.network,
          capacity: row.capacity,
          price: row.price,
          costPrice: row.costPrice,
          reference,
          provider: 'datamart',
          status: 'pending',
          purchaseSource: 'direct',
        });
      } catch (err) {
        results.push({
          phoneNumber: row.phoneNumber, network: row.network, capacity: row.capacity, price: row.price,
          reference, status: 'failed', error: 'Could not record order',
        });
        continue;
      }

      try {
        const result = await datamartService.purchaseData({
          network: row.network, capacity: row.capacity, phoneNumber: row.phoneNumber,
        });
        purchase.datamartReference = result?.reference || result?.orderReference;
        purchase.status = 'processing';
        await purchase.save();
        results.push({
          phoneNumber: row.phoneNumber, network: row.network, capacity: row.capacity, price: row.price,
          reference, status: 'processing',
        });
      } catch (err) {
        const providerMessage = err.response?.data?.message || err.message || 'Unknown error';
        purchase.status = 'failed';
        purchase.failureReason = providerMessage;
        await purchase.save();
        results.push({
          phoneNumber: row.phoneNumber, network: row.network, capacity: row.capacity, price: row.price,
          reference, status: 'failed', error: providerMessage,
        });
      }
    }

    // Referral commission on the full debited amount.
    referralService.processCommission(req.user._id, total, null);

    const failedCount = results.filter(r => r.status === 'failed').length;
    res.json({
      status: 'success',
      message: failedCount === 0
        ? `${results.length} orders submitted`
        : `${results.length - failedCount} submitted, ${failedCount} failed — admin will review failures.`,
      data: {
        batchRef,
        total,
        count: results.length,
        failedCount,
        results,
        walletBalance: updatedUser.walletBalance,
      },
    });
  } catch (err) {
    console.error('Bulk purchase error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/purchase/buy-with-momo - Pay directly with MoMo via Paystack
router.post('/buy-with-momo', auth, ordersPaused, async (req, res) => {
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

    const chargeAmount = addMomoFee(price);

    // Create pending transaction (records the bundle price; the fee is paid
    // to Paystack on top and not credited to revenue)
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
      metadata: { source: 'momo_purchase', network, capacity, phoneNumber },
    });

    // Initialize Paystack payment
    const paystack = await paystackService.initializeTransaction({
      email: user.email,
      amount: chargeAmount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        userId: user._id.toString(),
        type: 'direct_purchase',
        network,
        capacity,
        phoneNumber,
        price,
        chargeAmount,
        feePercent: MOMO_FEE_PERCENT,
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

// GET /api/purchase/delivery-tracker
// Surfaces DataMart's delivery-scanner pipeline state to the user, paired with
// a count of THIS user's own in-flight orders. We deliberately drop the
// upstream `yourOrders` payload — under our shared reseller key it lists every
// FlashData customer's order in the batch, which would leak others' data.
router.get('/delivery-tracker', auth, async (req, res) => {
  try {
    const yourPending = await DataPurchase.countDocuments({
      userId: req.user._id,
      status: { $in: ['pending', 'processing'] },
    });

    // The system-wide most recent delivered order — a live "we just delivered
    // something" signal shown to everyone. Only the tracking id and timing are
    // exposed (no phone/name/user), so it carries no personal info.
    //
    // We rank by placedAt (createdAt) rather than completedAt: every order has
    // it, and with near-instant delivery the newest completed order is the
    // latest delivery. Some completion paths historically left completedAt
    // unset — ranking by completedAt would silently skip those orders.
    const lastOrder = await DataPurchase.findOne({
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .select('trackingId createdAt completedAt updatedAt')
      .lean();

    const latestDelivered = lastOrder
      ? {
          trackingId: lastOrder.trackingId || null,
          placedAt: lastOrder.createdAt,
          // Exact when we have it; fall back to updatedAt (≈ completion save)
          // for older rows that predate completedAt being set.
          deliveredAt: lastOrder.completedAt || lastOrder.updatedAt || null,
          // Only a real completedAt gives an accurate wait time; suppress it
          // otherwise so we don't show a misleading duration.
          exactDelivery: !!lastOrder.completedAt,
        }
      : null;

    let tracker = null;
    try {
      tracker = await datamartService.getDeliveryTracker();
    } catch (err) {
      // Degrade gracefully — the widget should still render the user's own
      // pending count even when the upstream tracker is unreachable.
      return res.json({
        status: 'success',
        data: {
          scanner: { state: 'unknown', active: false, waiting: false, waitSeconds: 0, pendingBatches: 0 },
          message: 'Live delivery status is temporarily unavailable.',
          lastDelivered: null,
          latestDelivered,
          checkingNow: null,
          yourPending,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const ld = tracker?.lastDelivered;
    res.json({
      status: 'success',
      data: {
        scanner: tracker?.scanner || { state: 'unknown', active: false, waiting: false, waitSeconds: 0, pendingBatches: 0 },
        message: tracker?.message || null,
        // Keep only non-PII pipeline timing, not the upstream tracking IDs.
        lastDelivered: ld?.deliveredAt
          ? { deliveredAt: ld.deliveredAt, placedAt: ld.placedAt || null }
          : null,
        latestDelivered,
        checkingNow: tracker?.checkingNow?.batchNumber
          ? { active: true }
          : null,
        yourPending,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Delivery tracker error:', err.message);
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
