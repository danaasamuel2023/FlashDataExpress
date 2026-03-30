const router = require('express').Router();
const auth = require('../middleware/auth');
const Store = require('../models/Store');
const SubAgent = require('../models/SubAgent');
const User = require('../models/User');
const DataPurchase = require('../models/DataPurchase');

// POST /api/subagent/invite
router.post('/invite', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'You need a store first' });
    }

    const { identifier, commissionPercent } = req.body;
    if (!identifier) {
      return res.status(400).json({ status: 'error', message: 'Phone number or email is required' });
    }

    const commission = Math.min(90, Math.max(1, Number(commissionPercent) || 30));

    const user = await User.findOne({
      $or: [
        { phoneNumber: identifier.trim() },
        { email: identifier.trim().toLowerCase() }
      ]
    });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found. They must register first.' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ status: 'error', message: 'You cannot add yourself as a subagent' });
    }

    const existing = await SubAgent.findOne({ storeId: store._id, userId: user._id });
    if (existing) {
      return res.status(400).json({ status: 'error', message: 'This user is already your subagent' });
    }

    const code = store.storeName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') +
      user.name.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, 'X') +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    const subAgent = await SubAgent.create({
      storeId: store._id,
      parentAgentId: req.user._id,
      userId: user._id,
      referralCode: code,
      commissionPercent: commission,
    });

    const populated = await SubAgent.findById(subAgent._id).populate('userId', 'name email phoneNumber');

    res.status(201).json({ status: 'success', data: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ status: 'error', message: 'This user is already a subagent' });
    }
    console.error('SubAgent invite error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subagent/list
router.get('/list', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const subAgents = await SubAgent.find({ storeId: store._id })
      .populate('userId', 'name email phoneNumber')
      .sort({ createdAt: -1 });

    res.json({ status: 'success', data: subAgents });
  } catch (err) {
    console.error('SubAgent list error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/subagent/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const subAgent = await SubAgent.findOne({ _id: req.params.id, storeId: store._id });
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Subagent not found' });
    }

    const { commissionPercent, isActive } = req.body;
    if (commissionPercent !== undefined) {
      subAgent.commissionPercent = Math.min(90, Math.max(1, Number(commissionPercent)));
    }
    if (isActive !== undefined) {
      subAgent.isActive = isActive;
    }

    await subAgent.save();
    const populated = await SubAgent.findById(subAgent._id).populate('userId', 'name email phoneNumber');
    res.json({ status: 'success', data: populated });
  } catch (err) {
    console.error('SubAgent update error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// DELETE /api/subagent/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const subAgent = await SubAgent.findOneAndDelete({ _id: req.params.id, storeId: store._id });
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Subagent not found' });
    }

    res.json({ status: 'success', message: 'Subagent removed' });
  } catch (err) {
    console.error('SubAgent delete error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subagent/my-dashboard
router.get('/my-dashboard', auth, async (req, res) => {
  try {
    const subAgent = await SubAgent.findOne({ userId: req.user._id, isActive: true })
      .populate('storeId', 'storeName storeSlug');
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'You are not a subagent of any store' });
    }

    const sales = await DataPurchase.find({
      'storeDetails.storeId': subAgent.storeId._id,
      'storeDetails.subAgentId': subAgent._id,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      status: 'success',
      data: {
        subAgent,
        sales,
      },
    });
  } catch (err) {
    console.error('SubAgent dashboard error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subagent/sales/:id
router.get('/sales/:id', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const subAgent = await SubAgent.findOne({ _id: req.params.id, storeId: store._id });
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Subagent not found' });
    }

    const sales = await DataPurchase.find({
      'storeDetails.storeId': store._id,
      'storeDetails.subAgentId': subAgent._id,
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ status: 'success', data: sales });
  } catch (err) {
    console.error('SubAgent sales error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
