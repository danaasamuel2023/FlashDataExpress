const router = require('express').Router();
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/adminAuth');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const DataPurchase = require('../../models/DataPurchase');
const Store = require('../../models/Store');
const Withdrawal = require('../../models/Withdrawal');
const { Referral } = require('../../models/Referral');
const Settings = require('../../models/Settings');
const datamartService = require('../../services/datamartService');
// All purchases go through DataMart

// All admin routes require auth + admin
router.use(auth, adminAuth);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers, totalOrders, revenueAgg, depositsAgg,
      todayOrders, todayRevenueAgg, todayProfitAgg,
      recentOrders, settings
    ] = await Promise.all([
      User.countDocuments(),
      DataPurchase.countDocuments(),
      Transaction.aggregate([
        { $match: { type: 'purchase', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Today's order count
      DataPurchase.countDocuments({ createdAt: { $gte: todayStart } }),
      // Today's revenue (selling price)
      DataPurchase.aggregate([
        { $match: { createdAt: { $gte: todayStart }, status: { $in: ['completed', 'processing', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]),
      // Today's profit (selling price - cost price)
      DataPurchase.aggregate([
        { $match: { createdAt: { $gte: todayStart }, status: { $in: ['completed', 'processing', 'pending'] } } },
        { $group: { _id: null, revenue: { $sum: '$price' }, cost: { $sum: '$costPrice' } } },
      ]),
      DataPurchase.find().sort({ createdAt: -1 }).limit(10).lean(),
      Settings.getSettings(),
    ]);

    const todayProfit = todayProfitAgg[0]
      ? (todayProfitAgg[0].revenue - todayProfitAgg[0].cost)
      : 0;

    res.json({
      status: 'success',
      data: {
        totalUsers,
        totalOrders,
        totalRevenue: revenueAgg[0]?.total || 0,
        totalDeposits: depositsAgg[0]?.total || 0,
        todayOrders,
        todayRevenue: todayRevenueAgg[0]?.total || 0,
        todayProfit,
        basePrices: settings?.pricing?.basePrices || {},
        sellingPrices: settings?.pricing?.sellingPrices || {},
        recentOrders,
      },
    });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/provider-prices - Fetch live prices from DataMart
router.get('/provider-prices', async (req, res) => {
  try {
    const packages = await datamartService.getPackages();
    const prices = {};
    for (const pkg of packages) {
      if (!prices[pkg.network]) prices[pkg.network] = {};
      prices[pkg.network][String(pkg.capacity)] = pkg.price;
    }
    res.json({ status: 'success', data: prices });
  } catch (err) {
    console.error('Provider prices error:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch provider prices. Check your DataMart API configuration.' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(500);
    res.json({ status: 'success', data: users });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { role, isActive, walletBalance } = req.body;
    const updates = {};
    if (role) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (walletBalance !== undefined) updates.walletBalance = walletBalance;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    res.json({ status: 'success', data: user });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(500);
    res.json({ status: 'success', data: transactions });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/withdrawals
router.get('/withdrawals', async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ status: 'success', data: withdrawals });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/withdrawals/:id
router.put('/withdrawals/:id', async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['completed', 'rejected'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal || withdrawal.status !== 'pending') {
      return res.status(400).json({ status: 'error', message: 'Withdrawal not found or already processed' });
    }

    withdrawal.status = status;
    withdrawal.processedBy = req.user._id;
    if (rejectionReason) withdrawal.rejectionReason = rejectionReason;

    // If rejected, refund the pending balance
    if (status === 'rejected') {
      await Store.findOneAndUpdate(
        { _id: withdrawal.storeId },
        { $inc: { pendingBalance: withdrawal.amount } }
      );
    }

    await withdrawal.save();
    res.json({ status: 'success', data: withdrawal });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/pricing
router.get('/pricing', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      status: 'success',
      data: {
        basePrices: settings?.pricing?.basePrices || {},
        sellingPrices: settings?.pricing?.sellingPrices || {},
      },
    });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/pricing
router.put('/pricing', async (req, res) => {
  try {
    const { sellingPrices, basePrices } = req.body;
    const updates = {};
    if (sellingPrices) updates['pricing.sellingPrices'] = sellingPrices;
    if (basePrices) updates['pricing.basePrices'] = basePrices;
    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      { $set: updates },
      { upsert: true }
    );
    res.json({ status: 'success', message: 'Pricing updated' });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/admin/pricing/sync
router.post('/pricing/sync', async (req, res) => {
  try {
    const packages = await datamartService.getPackages();
    const basePrices = {};

    for (const pkg of packages) {
      if (!basePrices[pkg.network]) basePrices[pkg.network] = {};
      basePrices[pkg.network][String(pkg.capacity)] = pkg.price;
    }

    // Also auto-populate selling prices for any bundles that don't have one yet
    // Default markup: 5% on top of base price, rounded to 2 decimal places
    const settings = await Settings.getSettings();
    const existingSellingPrices = settings.pricing && settings.pricing.sellingPrices || {};
    const sellingPrices = JSON.parse(JSON.stringify(existingSellingPrices));

    for (const network of Object.keys(basePrices)) {
      if (!sellingPrices[network]) sellingPrices[network] = {};
      for (const [capacity, basePrice] of Object.entries(basePrices[network])) {
        // Only set if selling price doesn't already exist for this bundle
        if (!sellingPrices[network][capacity]) {
          sellingPrices[network][capacity] = Math.round(basePrice * 1.05 * 100) / 100;
        }
      }
    }

    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      { $set: { 'pricing.basePrices': basePrices, 'pricing.sellingPrices': sellingPrices, 'datamart.isConnected': true, 'pricing.lastFetchedAt': new Date() } },
      { upsert: true }
    );

    res.json({ status: 'success', message: `Synced ${packages.length} packages`, data: { basePrices, sellingPrices } });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({ status: 'success', data: settings });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/settings
router.put('/settings', async (req, res) => {
  try {
    const { datamart, paystack, sms, withdrawal } = req.body;
    const updates = {};
    if (datamart) updates.datamart = datamart;
    if (paystack) updates.paystack = paystack;
    if (sms) updates.sms = sms;
    if (withdrawal) updates.withdrawal = withdrawal;

    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      { $set: updates },
      { upsert: true }
    );
    res.json({ status: 'success', message: 'Settings updated' });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/admin/settings/test-datamart
router.post('/settings/test-datamart', async (req, res) => {
  try {
    const result = await datamartService.testConnection();
    if (result.connected) {
      await Settings.findOneAndUpdate(
        { _id: 'app_settings' },
        { $set: { 'datamart.isConnected': true } },
        { upsert: true }
      );
    }
    res.json({ status: 'success', data: result });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/referrals
router.get('/referrals', async (req, res) => {
  try {
    const referrals = await Referral.find()
      .populate('referrerId', 'name')
      .populate('referredUserId', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ status: 'success', data: referrals });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/referrals/config
router.get('/referrals/config', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({ status: 'success', data: settings?.referral || {} });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/referrals/config
router.put('/referrals/config', async (req, res) => {
  try {
    const { enabled, commissionPercent, bonusDataMilestones } = req.body;
    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      {
        $set: {
          'referral.enabled': enabled,
          'referral.commissionPercent': commissionPercent,
          'referral.bonusDataMilestones': bonusDataMilestones,
        },
      },
      { upsert: true }
    );
    res.json({ status: 'success', message: 'Referral config updated' });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
