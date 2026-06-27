const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const ResultCheckerPurchase = require('../models/ResultCheckerPurchase');
const datamartService = require('../services/datamartService');
const { generateReference } = require('../utils/helpers');

const TYPES = ['WAEC', 'BECE'];

const priceFor = (settings, checkerType) => {
  const rc = settings?.resultChecker || {};
  return checkerType === 'WAEC' ? (rc.waecPrice || 0) : (rc.becePrice || 0);
};

// GET /api/checker/products — WAEC/BECE with our selling price + live stock
router.get('/products', auth, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const rc = settings?.resultChecker || {};

    // Pull upstream availability; degrade gracefully if DataMart is unreachable.
    let stock = {};
    try {
      const upstream = await datamartService.getResultCheckers();
      for (const p of upstream) {
        stock[(p.name || '').toUpperCase()] = { inStock: !!p.inStock, stockCount: p.stockCount ?? null };
      }
    } catch {
      stock = {};
    }

    const products = TYPES.map(type => ({
      checkerType: type,
      name: `${type} Result Checker`,
      price: priceFor(settings, type),
      inStock: stock[type] ? stock[type].inStock : true,
      stockCount: stock[type] ? stock[type].stockCount : null,
    }));

    res.json({ status: 'success', data: { enabled: rc.enabled !== false, products } });
  } catch (err) {
    console.error('Checker products error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/checker/buy — buy a result checker, paid from wallet
router.post('/buy', auth, async (req, res) => {
  try {
    const { checkerType } = req.body;
    const phoneNumber = (req.body.phoneNumber || req.user.phoneNumber || '').toString().trim();

    if (!TYPES.includes(checkerType)) {
      return res.status(400).json({ status: 'error', message: 'Invalid checker type. Choose WAEC or BECE.' });
    }
    if (!phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'A phone number is required' });
    }

    const settings = await Settings.getSettings();
    const rc = settings?.resultChecker || {};
    if (rc.enabled === false) {
      return res.status(400).json({ status: 'error', message: 'Result checkers are currently unavailable.' });
    }

    const price = priceFor(settings, checkerType);
    const costPrice = rc.cost || 0;
    if (!price || price <= 0) {
      return res.status(400).json({ status: 'error', message: 'This checker is not available right now.' });
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

    const reference = generateReference('CHK');

    await Transaction.create({
      userId: req.user._id,
      type: 'purchase',
      amount: price,
      balanceBefore: updatedUser.walletBalance + price,
      balanceAfter: updatedUser.walletBalance,
      status: 'completed',
      reference,
      description: `${checkerType} Result Checker`,
      metadata: { source: 'result_checker', checkerType, phoneNumber },
    });

    const purchase = await ResultCheckerPurchase.create({
      userId: req.user._id,
      checkerType,
      phoneNumber,
      price,
      costPrice,
      reference,
      status: 'pending',
    });

    // Fulfil via DataMart. On failure nothing is delivered, so refund the wallet.
    try {
      const result = await datamartService.purchaseResultChecker({ checkerType, phoneNumber, ref: reference });
      if (!result?.serialNumber || !result?.pin) {
        throw new Error('No checker returned by provider');
      }
      purchase.serialNumber = result.serialNumber;
      purchase.pin = result.pin;
      purchase.datamartReference = result.reference || result.purchaseId || null;
      purchase.status = 'completed';
      await purchase.save();
    } catch (err) {
      const providerMessage = err.response?.data?.message || err.message || 'Provider error';

      // Refund — the order did not complete.
      const refundedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $inc: { walletBalance: price } },
        { new: true }
      );
      await Transaction.create({
        userId: req.user._id,
        type: 'refund',
        amount: price,
        balanceBefore: refundedUser.walletBalance - price,
        balanceAfter: refundedUser.walletBalance,
        status: 'completed',
        reference: generateReference('RFD'),
        description: `Refund — ${checkerType} Result Checker failed`,
        metadata: { source: 'result_checker_refund', checkerType, originalReference: reference },
      });

      purchase.status = 'refunded';
      purchase.failureReason = providerMessage;
      await purchase.save();

      return res.status(502).json({
        status: 'error',
        message: `Purchase failed: ${providerMessage}. You have been refunded.`,
        data: { reference, status: 'refunded' },
      });
    }

    res.json({
      status: 'success',
      message: 'Result checker purchased',
      data: {
        reference: purchase.reference,
        checkerType: purchase.checkerType,
        serialNumber: purchase.serialNumber,
        pin: purchase.pin,
        price: purchase.price,
        status: purchase.status,
        balance: updatedUser.walletBalance,
        createdAt: purchase.createdAt,
      },
    });
  } catch (err) {
    console.error('Checker buy error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/checker/history — the user's result checker purchases
router.get('/history', auth, async (req, res) => {
  try {
    const purchases = await ResultCheckerPurchase.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ status: 'success', data: purchases });
  } catch (err) {
    console.error('Checker history error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
