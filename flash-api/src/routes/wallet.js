const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const paystackService = require('../services/paystackService');
const { generateReference } = require('../utils/helpers');

// GET /api/wallet/balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance');
    res.json({ status: 'success', data: { balance: user.walletBalance } });
  } catch (err) {
    console.error('Wallet error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/wallet/transactions
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ status: 'success', data: transactions });
  } catch (err) {
    console.error('Wallet error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/wallet/deposit
router.post('/deposit', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const value = parseFloat(amount);
    if (!value || isNaN(value) || value < 1) {
      return res.status(400).json({ status: 'error', message: 'Minimum deposit is GH₵1' });
    }
    if (value > 10000) {
      return res.status(400).json({ status: 'error', message: 'Maximum deposit is GH₵10,000' });
    }

    const reference = generateReference('DEP');
    const user = await User.findById(req.user._id);

    // Create pending transaction
    await Transaction.create({
      userId: user._id,
      type: 'deposit',
      amount: value,
      balanceBefore: user.walletBalance,
      balanceAfter: user.walletBalance,
      status: 'pending',
      reference,
      gateway: 'paystack',
      description: `Wallet deposit of GH₵${value.toFixed(2)}`,
    });

    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`;

    const paystack = await paystackService.initializeTransaction({
      email: user.email,
      amount: value,
      reference,
      callback_url: callbackUrl,
      metadata: { userId: user._id.toString(), type: 'deposit' },
    });

    res.json({
      status: 'success',
      data: { authorization_url: paystack.authorization_url, reference },
    });
  } catch (err) {
    console.error('Wallet error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/wallet/verify-payment
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ status: 'error', message: 'Reference is required' });
    }

    const transaction = await Transaction.findOne({ reference, userId: req.user._id });
    if (!transaction) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }
    if (transaction.status === 'completed') {
      return res.json({ status: 'success', message: 'Already verified', data: transaction });
    }

    const verification = await paystackService.verifyTransaction(reference);
    if (verification.status !== 'success') {
      await Transaction.updateOne({ _id: transaction._id }, { status: 'failed' });
      return res.status(400).json({ status: 'error', message: 'Payment verification failed' });
    }

    // Credit wallet atomically
    const user = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $inc: { walletBalance: transaction.amount } },
      { new: true }
    );

    await Transaction.updateOne(
      { _id: transaction._id },
      {
        status: 'completed',
        balanceAfter: user.walletBalance,
        balanceBefore: user.walletBalance - transaction.amount,
      }
    );

    res.json({ status: 'success', message: 'Payment verified', data: { balance: user.walletBalance } });
  } catch (err) {
    console.error('Wallet error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
