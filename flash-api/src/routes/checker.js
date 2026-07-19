const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const ResultCheckerPurchase = require('../models/ResultCheckerPurchase');
const datamartService = require('../services/datamartService');
const { generateReference } = require('../utils/helpers');

const TYPES = ['WAEC', 'BECE'];
const MAX_QUANTITY = 50;

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

// POST /api/checker/buy — buy one or more result checkers, paid from wallet.
// quantity defaults to 1. Each unit is fulfilled separately via DataMart (the
// upstream API delivers one serial/PIN per call); units that fail are refunded
// individually, so a partial success still delivers the ones that went through.
router.post('/buy', auth, async (req, res) => {
  try {
    const { checkerType } = req.body;
    const phoneNumber = (req.body.phoneNumber || req.user.phoneNumber || '').toString().trim();

    let quantity = parseInt(req.body.quantity, 10);
    if (!Number.isFinite(quantity)) quantity = 1;

    if (!TYPES.includes(checkerType)) {
      return res.status(400).json({ status: 'error', message: 'Invalid checker type. Choose WAEC or BECE.' });
    }
    if (!phoneNumber) {
      return res.status(400).json({ status: 'error', message: 'A phone number is required' });
    }
    if (quantity < 1 || quantity > MAX_QUANTITY) {
      return res.status(400).json({ status: 'error', message: `Quantity must be between 1 and ${MAX_QUANTITY}.` });
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

    const totalCost = price * quantity;
    const batchReference = quantity > 1 ? generateReference('CHKB') : undefined;

    // Atomic wallet debit for the whole batch — guarantees no negative balance.
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: totalCost } },
      { $inc: { walletBalance: -totalCost } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    // Record the batch debit as one purchase transaction.
    await Transaction.create({
      userId: req.user._id,
      type: 'purchase',
      amount: totalCost,
      balanceBefore: updatedUser.walletBalance + totalCost,
      balanceAfter: updatedUser.walletBalance,
      status: 'completed',
      reference: batchReference || generateReference('CHK'),
      description: quantity > 1
        ? `${quantity}× ${checkerType} Result Checkers`
        : `${checkerType} Result Checker`,
      metadata: { source: 'result_checker', checkerType, phoneNumber, quantity, batchReference },
    });

    // Fulfil each unit independently. Track successes and failures so we refund
    // only what didn't deliver.
    const delivered = [];
    const failures = [];

    for (let i = 0; i < quantity; i++) {
      const reference = generateReference('CHK');
      const purchase = await ResultCheckerPurchase.create({
        userId: req.user._id,
        checkerType,
        phoneNumber,
        price,
        costPrice,
        reference,
        batchReference,
        status: 'pending',
      });

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
        delivered.push({
          reference: purchase.reference,
          serialNumber: purchase.serialNumber,
          pin: purchase.pin,
        });
      } catch (err) {
        const providerMessage = err.response?.data?.message || err.message || 'Provider error';
        purchase.status = 'refunded';
        purchase.failureReason = providerMessage;
        await purchase.save();
        failures.push({ reference: purchase.reference, reason: providerMessage });
      }
    }

    // Refund the units that failed, in one transaction.
    let finalBalance = updatedUser.walletBalance;
    if (failures.length > 0) {
      const refundAmount = price * failures.length;
      const refundedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $inc: { walletBalance: refundAmount } },
        { new: true }
      );
      finalBalance = refundedUser.walletBalance;
      await Transaction.create({
        userId: req.user._id,
        type: 'refund',
        amount: refundAmount,
        balanceBefore: refundedUser.walletBalance - refundAmount,
        balanceAfter: refundedUser.walletBalance,
        status: 'completed',
        reference: generateReference('RFD'),
        description: failures.length > 1 || quantity > 1
          ? `Refund — ${failures.length}× ${checkerType} Result Checker failed`
          : `Refund — ${checkerType} Result Checker failed`,
        metadata: {
          source: 'result_checker_refund',
          checkerType,
          batchReference,
          failedReferences: failures.map(f => f.reference),
        },
      });
    }

    // Nothing delivered — surface as an error (fully refunded).
    if (delivered.length === 0) {
      return res.status(502).json({
        status: 'error',
        message: `Purchase failed: ${failures[0]?.reason || 'Provider error'}. You have been refunded.`,
        data: { checkerType, quantity, deliveredCount: 0, failedCount: failures.length, balance: finalBalance },
      });
    }

    res.json({
      status: 'success',
      message: failures.length > 0
        ? `${delivered.length} of ${quantity} delivered — ${failures.length} refunded.`
        : (quantity > 1 ? `${quantity} result checkers purchased` : 'Result checker purchased'),
      data: {
        checkerType,
        quantity,
        deliveredCount: delivered.length,
        failedCount: failures.length,
        checkers: delivered,
        batchReference: batchReference || null,
        balance: finalBalance,
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
