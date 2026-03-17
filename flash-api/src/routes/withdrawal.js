const router = require('express').Router();
const auth = require('../middleware/auth');
const Store = require('../models/Store');
const Withdrawal = require('../models/Withdrawal');
const Settings = require('../models/Settings');
const { generateReference } = require('../utils/helpers');

// POST /api/withdrawal/request
router.post('/request', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const value = parseFloat(amount);

    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const settings = await Settings.getSettings();
    const minAmount = settings?.withdrawal?.minimumAmount || 10;
    const feePercent = settings?.withdrawal?.feePercent || 0;

    if (!value || value < minAmount) {
      return res.status(400).json({ status: 'error', message: `Minimum withdrawal is GH₵${minAmount}` });
    }

    if (value > store.pendingBalance) {
      return res.status(400).json({
        status: 'error',
        message: `You can only withdraw up to ${store.pendingBalance.toFixed(2)} GH₵`,
      });
    }

    // Check for pending withdrawal
    const pendingWithdrawal = await Withdrawal.findOne({
      userId: req.user._id,
      status: 'pending',
    });
    if (pendingWithdrawal) {
      return res.status(400).json({ status: 'error', message: 'You have a pending withdrawal request' });
    }

    const fee = Math.round(value * feePercent / 100 * 100) / 100;
    const netAmount = value - fee;

    // Deduct from pending balance atomically
    const updated = await Store.findOneAndUpdate(
      { _id: store._id, pendingBalance: { $gte: value } },
      { $inc: { pendingBalance: -value } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    const withdrawal = await Withdrawal.create({
      userId: req.user._id,
      storeId: store._id,
      amount: value,
      fee,
      netAmount,
      reference: generateReference('WDR'),
      momoDetails: store.momoDetails,
    });

    res.json({ status: 'success', data: withdrawal });
  } catch (err) {
    console.error('Withdrawal error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/withdrawal/history
router.get('/history', auth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ status: 'success', data: withdrawals });
  } catch (err) {
    console.error('Withdrawal error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
