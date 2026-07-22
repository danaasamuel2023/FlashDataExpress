const router = require('express').Router();
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/adminAuth');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const DataPurchase = require('../../models/DataPurchase');
const Store = require('../../models/Store');
const SubAgent = require('../../models/SubAgent');
const Withdrawal = require('../../models/Withdrawal');
const { Referral } = require('../../models/Referral');
const Settings = require('../../models/Settings');
const Announcement = require('../../models/Announcement');
const ApiKey = require('../../models/ApiKey');
const datamartService = require('../../services/datamartService');
const paystackService = require('../../services/paystackService');
const { encrypt, mask, isConfigured } = require('../../utils/encryption');
const { generateReference } = require('../../utils/helpers');
const { refundFailedPurchase } = require('../../utils/refund');
const { creditStoreProfit } = require('../../utils/storePurchaseProcessor');
// All purchases go through DataMart

// All admin routes require auth + admin
router.use(auth, adminAuth);

// Sales from the main portal: direct wallet, MoMo top-ups, and guest checkouts.
// Anything from an agent's store/subshop is excluded.
const PORTAL_SOURCES = ['direct', 'guest'];
const STORE_SOURCES = ['store'];

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayActiveStatuses = ['completed', 'processing', 'pending'];

    const [
      totalUsers, totalOrders, depositsAgg,
      todayOrdersBySource, todayBySource,
      lifetimeOrdersBySource, lifetimeBySource,
      recentOrders, settings, totalStoresActivated
    ] = await Promise.all([
      User.countDocuments(),
      DataPurchase.countDocuments(),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Today's order count by source
      DataPurchase.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: '$purchaseSource', count: { $sum: 1 } } },
      ]),
      // Today's revenue + profit by source
      DataPurchase.aggregate([
        { $match: { createdAt: { $gte: todayStart }, status: { $in: todayActiveStatuses } } },
        {
          $group: {
            _id: '$purchaseSource',
            revenue: { $sum: '$price' },
            cost: { $sum: '$costPrice' },
          },
        },
      ]),
      // Lifetime order count by source (all statuses)
      DataPurchase.aggregate([
        { $group: { _id: '$purchaseSource', count: { $sum: 1 } } },
      ]),
      // Lifetime revenue + profit by source (active orders only)
      DataPurchase.aggregate([
        { $match: { status: { $in: todayActiveStatuses } } },
        {
          $group: {
            _id: '$purchaseSource',
            revenue: { $sum: '$price' },
            cost: { $sum: '$costPrice' },
          },
        },
      ]),
      DataPurchase.find().sort({ createdAt: -1 }).limit(10).lean(),
      Settings.getSettings(),
      Store.countDocuments(),
    ]);

    const sumBy = (arr, predicate, field) =>
      arr.filter(predicate).reduce((s, b) => s + (b[field] || 0), 0);

    const isPortal = (b) => PORTAL_SOURCES.includes(b._id);
    const isStore = (b) => STORE_SOURCES.includes(b._id);

    const portal = {
      orders: sumBy(todayOrdersBySource, isPortal, 'count'),
      revenue: sumBy(todayBySource, isPortal, 'revenue'),
      profit: sumBy(todayBySource, isPortal, 'revenue') - sumBy(todayBySource, isPortal, 'cost'),
    };
    const store = {
      orders: sumBy(todayOrdersBySource, isStore, 'count'),
      revenue: sumBy(todayBySource, isStore, 'revenue'),
      profit: sumBy(todayBySource, isStore, 'revenue') - sumBy(todayBySource, isStore, 'cost'),
    };

    const lifetimePortal = {
      orders: sumBy(lifetimeOrdersBySource, isPortal, 'count'),
      revenue: sumBy(lifetimeBySource, isPortal, 'revenue'),
      profit: sumBy(lifetimeBySource, isPortal, 'revenue') - sumBy(lifetimeBySource, isPortal, 'cost'),
    };
    const lifetimeStore = {
      orders: sumBy(lifetimeOrdersBySource, isStore, 'count'),
      revenue: sumBy(lifetimeBySource, isStore, 'revenue'),
      profit: sumBy(lifetimeBySource, isStore, 'revenue') - sumBy(lifetimeBySource, isStore, 'cost'),
    };

    res.json({
      status: 'success',
      data: {
        totalUsers,
        totalOrders,
        totalRevenue: lifetimePortal.revenue + lifetimeStore.revenue,
        totalDeposits: depositsAgg[0]?.total || 0,
        totalStoresActivated,
        // Combined today totals (kept for backwards compatibility)
        todayOrders: portal.orders + store.orders,
        todayRevenue: portal.revenue + store.revenue,
        todayProfit: portal.profit + store.profit,
        // Split: main portal vs agent stores
        todayPortal: portal,
        todayStore: store,
        lifetimePortal,
        lifetimeStore,
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

// GET /api/admin/daily-history — rolling daily payment breakdown (default 7 days)
router.get('/daily-history', async (req, res) => {
  try {
    const days = Math.min(31, Math.max(1, parseInt(req.query.days, 10) || 7));
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const [txs, orders] = await Promise.all([
      Transaction.find({ createdAt: { $gte: startDate } }).lean(),
      DataPurchase.find({ createdAt: { $gte: startDate } }).lean(),
    ]);

    const buckets = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = {
        date: key,
        deposits: 0, depositCount: 0,
        purchases: 0, purchaseCount: 0,
        refunds: 0, refundCount: 0,
        withdrawals: 0, withdrawalCount: 0,
        orderRevenue: 0, orderCost: 0, orderCount: 0,
        failedOrders: 0,
      };
    }

    for (const tx of txs) {
      const key = new Date(tx.createdAt).toISOString().slice(0, 10);
      const bucket = buckets[key];
      if (!bucket || tx.status !== 'completed') continue;
      if (tx.type === 'deposit') { bucket.deposits += tx.amount; bucket.depositCount += 1; }
      else if (tx.type === 'purchase') { bucket.purchases += tx.amount; bucket.purchaseCount += 1; }
      else if (tx.type === 'refund') { bucket.refunds += tx.amount; bucket.refundCount += 1; }
      else if (tx.type === 'withdrawal') { bucket.withdrawals += tx.amount; bucket.withdrawalCount += 1; }
    }

    for (const o of orders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const bucket = buckets[key];
      if (!bucket) continue;
      bucket.orderCount += 1;
      if (['completed', 'processing', 'pending'].includes(o.status)) {
        bucket.orderRevenue += o.price || 0;
        bucket.orderCost += o.costPrice || 0;
      }
      if (o.status === 'failed' || o.status === 'refunded') bucket.failedOrders += 1;
    }

    const daysList = Object.values(buckets)
      .map(b => ({ ...b, profit: Math.round((b.orderRevenue - b.orderCost) * 100) / 100 }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      status: 'success',
      data: {
        days: daysList,
        weekTotal: {
          deposits: daysList.reduce((s, d) => s + d.deposits, 0),
          purchases: daysList.reduce((s, d) => s + d.purchases, 0),
          refunds: daysList.reduce((s, d) => s + d.refunds, 0),
          withdrawals: daysList.reduce((s, d) => s + d.withdrawals, 0),
          orderRevenue: daysList.reduce((s, d) => s + d.orderRevenue, 0),
          profit: daysList.reduce((s, d) => s + d.profit, 0),
          orderCount: daysList.reduce((s, d) => s + d.orderCount, 0),
          failedOrders: daysList.reduce((s, d) => s + d.failedOrders, 0),
        },
      },
    });
  } catch (err) {
    console.error('Admin daily-history error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/daily-sales - Today's individual sales
// Query: ?source=portal | store (default: all)
router.get('/daily-sales', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const source = String(req.query.source || '').toLowerCase();
    const filter = { createdAt: { $gte: todayStart } };
    if (source === 'portal') filter.purchaseSource = { $in: PORTAL_SOURCES };
    else if (source === 'store') filter.purchaseSource = { $in: STORE_SOURCES };

    const sales = await DataPurchase.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const totalRevenue = sales.reduce((sum, s) => sum + (s.price || 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + ((s.price || 0) - (s.costPrice || 0)), 0);

    res.json({
      status: 'success',
      data: { sales, totalRevenue, totalProfit, count: sales.length, source: source || 'all' },
    });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/stores - List all activated stores with today + lifetime stats.
// Use this to see who has activated a store and how their sales are doing.
router.get('/stores', async (req, res) => {
  try {
    const stores = await Store.find()
      .populate('agentId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const storeIds = stores.map(s => s._id);
    const todayAgg = await DataPurchase.aggregate([
      {
        $match: {
          'storeDetails.storeId': { $in: storeIds },
          createdAt: { $gte: todayStart },
          status: { $in: ['completed', 'processing', 'pending'] },
        },
      },
      {
        $group: {
          _id: '$storeDetails.storeId',
          revenue: { $sum: '$price' },
          profit: { $sum: '$storeDetails.agentProfit' },
          count: { $sum: 1 },
        },
      },
    ]);

    const todayByStore = new Map(todayAgg.map(t => [String(t._id), t]));

    const data = stores.map(s => {
      const today = todayByStore.get(String(s._id)) || { revenue: 0, profit: 0, count: 0 };
      return {
        _id: s._id,
        storeName: s.storeName,
        storeSlug: s.storeSlug,
        isActive: s.isActive,
        contactPhone: s.contactPhone,
        agent: s.agentId ? {
          _id: s.agentId._id,
          name: s.agentId.name,
          email: s.agentId.email,
          phone: s.agentId.phone,
        } : null,
        activatedAt: s.createdAt,
        totalSales: s.totalSales || 0,
        totalEarnings: s.totalEarnings || 0,
        pendingBalance: s.pendingBalance || 0,
        todayRevenue: today.revenue,
        todayProfit: today.profit,
        todaySales: today.count,
      };
    });

    res.json({ status: 'success', data });
  } catch (err) {
    console.error('Admin stores error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/stores/:id/daily-sales - Today's sales for a specific agent store
router.get('/stores/:id/daily-sales', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id).populate('agentId', 'name email');
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sales = await DataPurchase.find({
      'storeDetails.storeId': store._id,
      createdAt: { $gte: todayStart },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const todayRevenue = sales.reduce((sum, s) => sum + (s.price || 0), 0);
    const todayProfit = sales.reduce((sum, s) => sum + (s.storeDetails?.agentProfit || 0), 0);

    res.json({
      status: 'success',
      data: {
        store: {
          _id: store._id,
          storeName: store.storeName,
          storeSlug: store.storeSlug,
          agent: store.agentId,
          activatedAt: store.createdAt,
          totalSales: store.totalSales || 0,
          totalEarnings: store.totalEarnings || 0,
          pendingBalance: store.pendingBalance || 0,
        },
        sales,
        todayRevenue,
        todayProfit,
        count: sales.length,
      },
    });
  } catch (err) {
    console.error('Admin store daily-sales error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/admin/stores/:id/credit - Manually credit an agent store's profit.
// For delivered orders whose profit wasn't auto-credited (e.g. a stuck-pending
// order the admin is settling by hand). Adds to both totalEarnings (lifetime) and
// pendingBalance (withdrawable), and records an audit entry on the store.
router.post('/stores/:id/credit', async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!amount || !isFinite(amount) || amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid amount greater than 0.' });
    }
    const reason = (req.body?.reason || '').trim() || 'Manual profit credit by admin';

    const store = await Store.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { totalEarnings: amount, pendingBalance: amount },
        $push: { manualCredits: { amount, reason, creditedBy: req.user._id, createdAt: new Date() } },
      },
      { new: true }
    );
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    res.json({
      status: 'success',
      message: `Credited ${amount} to ${store.storeName}`,
      data: {
        totalEarnings: store.totalEarnings,
        pendingBalance: store.pendingBalance,
        totalSales: store.totalSales,
      },
    });
  } catch (err) {
    console.error('Admin store credit error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/sub-agents - All sub-agents with THEIR OWN sales & profit.
// Sub-shop orders also live under the parent agent's store, but their profit is
// split: storeDetails.agentProfit -> agent, storeDetails.subAgentProfit -> sub-agent.
// Here we report only the sub-agent's cut so it's never conflated with the agent's.
router.get('/sub-agents', async (req, res) => {
  try {
    const subAgents = await SubAgent.find()
      .populate('parentAgentId', 'name email phone')
      .populate('storeId', 'storeName storeSlug')
      .sort({ createdAt: -1 })
      .lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const subAgentIds = subAgents.map(s => s._id);
    const todayAgg = await DataPurchase.aggregate([
      {
        $match: {
          'storeDetails.subAgentId': { $in: subAgentIds },
          createdAt: { $gte: todayStart },
          status: { $in: ['completed', 'processing', 'pending'] },
        },
      },
      {
        $group: {
          _id: '$storeDetails.subAgentId',
          revenue: { $sum: '$price' },
          profit: { $sum: '$storeDetails.subAgentProfit' },
          count: { $sum: 1 },
        },
      },
    ]);
    const todayBySub = new Map(todayAgg.map(t => [String(t._id), t]));

    const data = subAgents.map(s => {
      const today = todayBySub.get(String(s._id)) || { revenue: 0, profit: 0, count: 0 };
      return {
        _id: s._id,
        storeName: s.storeName || (s.storeId?.storeName ? `${s.storeId.storeName} (sub)` : 'Sub-shop'),
        storeSlug: s.storeSlug,
        isActive: s.isActive,
        status: s.status,
        contactPhone: s.contactPhone,
        commissionPercent: s.commissionPercent,
        parentAgent: s.parentAgentId ? {
          _id: s.parentAgentId._id,
          name: s.parentAgentId.name,
          email: s.parentAgentId.email,
          phone: s.parentAgentId.phone,
        } : null,
        parentStoreName: s.storeId?.storeName || null,
        joinedAt: s.createdAt,
        // Lifetime, tracked on the SubAgent doc (sub-agent's own cut only)
        totalSales: s.totalSales || 0,
        totalEarnings: s.totalEarnings || 0,
        pendingBalance: s.pendingBalance || 0,
        // Today (sub-agent's own profit, not the agent's)
        todayRevenue: today.revenue,
        todayProfit: today.profit,
        todaySales: today.count,
      };
    });

    res.json({ status: 'success', data });
  } catch (err) {
    console.error('Admin sub-agents error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/sub-agents/:id/daily-sales - Today's sales for one sub-agent,
// reporting the sub-agent's own profit per order.
router.get('/sub-agents/:id/daily-sales', async (req, res) => {
  try {
    const subAgent = await SubAgent.findById(req.params.id)
      .populate('parentAgentId', 'name email')
      .populate('storeId', 'storeName storeSlug')
      .populate('userId', 'name email phoneNumber')
      .lean();
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Sub-agent not found' });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sales = await DataPurchase.find({
      'storeDetails.subAgentId': subAgent._id,
      createdAt: { $gte: todayStart },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const todayRevenue = sales.reduce((sum, s) => sum + (s.price || 0), 0);
    const todayProfit = sales.reduce((sum, s) => sum + (s.storeDetails?.subAgentProfit || 0), 0);

    res.json({
      status: 'success',
      data: {
        subAgent: {
          _id: subAgent._id,
          storeName: subAgent.storeName || subAgent.storeId?.storeName || 'Sub-shop',
          storeSlug: subAgent.storeSlug,
          parentAgent: subAgent.parentAgentId,
          parentStoreName: subAgent.storeId?.storeName || null,
          commissionPercent: subAgent.commissionPercent,
          joinedAt: subAgent.createdAt,
          totalSales: subAgent.totalSales || 0,
          totalEarnings: subAgent.totalEarnings || 0,
          pendingBalance: subAgent.pendingBalance || 0,
          // Login account (present once the sub-agent has registered).
          status: subAgent.status,
          hasAccount: !!subAgent.userId,
          loginEmail: subAgent.userId?.email || null,
        },
        sales,
        todayRevenue,
        todayProfit,
        count: sales.length,
      },
    });
  } catch (err) {
    console.error('Admin sub-agent daily-sales error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/admin/sub-agents/:id/credit - Manually credit a sub-agent's profit.
// Mirrors /stores/:id/credit for the sub-agent's own cut.
router.post('/sub-agents/:id/credit', async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!amount || !isFinite(amount) || amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid amount greater than 0.' });
    }
    const reason = (req.body?.reason || '').trim() || 'Manual profit credit by admin';

    const subAgent = await SubAgent.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { totalEarnings: amount, pendingBalance: amount },
        $push: { manualCredits: { amount, reason, creditedBy: req.user._id, createdAt: new Date() } },
      },
      { new: true }
    );
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Sub-agent not found' });
    }

    res.json({
      status: 'success',
      message: `Credited ${amount} to ${subAgent.storeName || 'sub-agent'}`,
      data: {
        totalEarnings: subAgent.totalEarnings,
        pendingBalance: subAgent.pendingBalance,
        totalSales: subAgent.totalSales,
      },
    });
  } catch (err) {
    console.error('Admin sub-agent credit error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/sub-agents/:id/password - Admin sets a new password for a sub-agent.
// A sub-agent logs in with the SAME User account referenced by SubAgent.userId, so
// this resets that linked User's password. Only possible once the sub-agent has
// registered (userId set); pending invites have no account yet.
router.put('/sub-agents/:id/password', async (req, res) => {
  try {
    const newPassword = (req.body?.newPassword || '').toString();
    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters.' });
    }

    const subAgent = await SubAgent.findById(req.params.id);
    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Sub-agent not found' });
    }
    if (!subAgent.userId) {
      return res.status(400).json({
        status: 'error',
        message: 'This sub-agent has not registered yet — there is no login to reset.',
      });
    }

    const user = await User.findById(subAgent.userId);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Linked login account not found' });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      status: 'success',
      message: `Password reset for ${subAgent.storeName || user.name || user.email}`,
      data: { _id: subAgent._id, email: user.email },
    });
  } catch (err) {
    console.error('Admin sub-agent password reset error:', err.message);
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

// PUT /api/admin/users/:id/password - Admin sets a new password for a user (agent).
// Loads the doc and saves so the User pre-save hook hashes it once (bcrypt, cost 12).
// Do NOT use findByIdAndUpdate here — it bypasses the hook and would store plaintext.
router.put('/users/:id/password', async (req, res) => {
  try {
    const newPassword = (req.body?.newPassword || '').toString();
    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      status: 'success',
      message: `Password reset for ${user.name || user.email}`,
      data: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Admin user password reset error:', err.message);
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

// GET /api/admin/refunds - List refunded orders, filterable by date range / search.
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&search=phone|reference&source=portal|store
router.get('/refunds', async (req, res) => {
  try {
    const { from, to, search, source } = req.query;
    const filter = { status: 'refunded' };

    // Filter by refundedAt when given. Fall back to createdAt for older records
    // that may not have refundedAt set.
    if (from || to) {
      const range = {};
      if (from) range.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      filter.$or = [{ refundedAt: range }, { refundedAt: { $exists: false }, createdAt: range }];
    }

    const src = String(source || '').toLowerCase();
    if (src === 'portal') filter.purchaseSource = { $in: PORTAL_SOURCES };
    else if (src === 'store') filter.purchaseSource = { $in: STORE_SOURCES };

    if (search && search.trim()) {
      const s = search.trim();
      const searchOr = [
        { phoneNumber: { $regex: s, $options: 'i' } },
        { reference: { $regex: s, $options: 'i' } },
        { datamartReference: { $regex: s, $options: 'i' } },
      ];
      // Combine with any date $or by AND-ing them via $and
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const refunds = await DataPurchase.find(filter)
      .populate('userId', 'name email phone')
      .sort({ refundedAt: -1, createdAt: -1 })
      .limit(500)
      .lean();

    const totalAmount = refunds.reduce((s, r) => s + (r.price || 0), 0);

    res.json({
      status: 'success',
      data: { refunds, count: refunds.length, totalAmount },
    });
  } catch (err) {
    console.error('Admin refunds error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/orders/awaiting-refund - Failed orders that have not been refunded.
// Same filters as /admin/refunds. Use POST /admin/orders/:id/refund to refund.
router.get('/orders/awaiting-refund', async (req, res) => {
  try {
    const { from, to, search, source } = req.query;
    const filter = { status: 'failed' };

    if (from || to) {
      const range = {};
      if (from) range.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      filter.createdAt = range;
    }

    const src = String(source || '').toLowerCase();
    if (src === 'portal') filter.purchaseSource = { $in: PORTAL_SOURCES };
    else if (src === 'store') filter.purchaseSource = { $in: STORE_SOURCES };

    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { phoneNumber: { $regex: s, $options: 'i' } },
        { reference: { $regex: s, $options: 'i' } },
        { datamartReference: { $regex: s, $options: 'i' } },
      ];
    }

    const orders = await DataPurchase.find(filter)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const totalAmount = orders.reduce((s, r) => s + (r.price || 0), 0);

    res.json({
      status: 'success',
      data: { orders, count: orders.length, totalAmount },
    });
  } catch (err) {
    console.error('Admin awaiting-refund error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/orders/pending - Store/sub-shop orders still pending or processing.
// Agent profit is credited on delivery, so these have NOT paid out yet. Some may
// already be delivered at the provider but stuck pending on our side; use
// POST /admin/orders/:id/complete to mark them delivered and credit profit.
router.get('/orders/pending', async (req, res) => {
  try {
    const { from, to, search } = req.query;
    const filter = {
      status: { $in: ['pending', 'processing'] },
      purchaseSource: { $in: STORE_SOURCES },
    };

    if (from || to) {
      const range = {};
      if (from) range.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      filter.createdAt = range;
    }

    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { phoneNumber: { $regex: s, $options: 'i' } },
        { reference: { $regex: s, $options: 'i' } },
        { datamartReference: { $regex: s, $options: 'i' } },
      ];
    }

    const orders = await DataPurchase.find(filter)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const totalAmount = orders.reduce((s, r) => s + (r.price || 0), 0);
    const totalUncredited = orders.reduce(
      (s, r) => s + (r.storeDetails?.agentProfit || 0) + (r.storeDetails?.subAgentProfit || 0),
      0
    );

    res.json({
      status: 'success',
      data: { orders, count: orders.length, totalAmount, totalUncredited },
    });
  } catch (err) {
    console.error('Admin pending-orders error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/admin/orders/:id/complete - Mark a pending/processing order as
// delivered and credit agent/sub-agent profit. Use when the order actually
// delivered at the provider but stayed pending on our side. Profit crediting is
// idempotent (storeDetails.profitCredited), so it's safe if the webhook/poller
// later completes the same order. Pass { verify: true } to re-check DataMart
// first and refuse if the provider reports the order failed.
router.post('/orders/:id/complete', async (req, res) => {
  try {
    const purchase = await DataPurchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }
    if (purchase.status === 'completed') {
      return res.status(400).json({ status: 'error', message: 'Order is already completed' });
    }
    if (purchase.status === 'refunded') {
      return res.status(400).json({
        status: 'error',
        message: 'Order was refunded. Reverse the refund from Refunds instead.',
      });
    }

    if (req.body?.verify && purchase.datamartReference) {
      try {
        const result = await datamartService.checkOrderStatus(purchase.datamartReference);
        const providerStatus = (result?.status || '').toLowerCase();
        if (providerStatus === 'failed' || providerStatus === 'rejected') {
          return res.status(400).json({
            status: 'error',
            message: `Provider reports this order as "${providerStatus}". Not completing.`,
          });
        }
      } catch (e) {
        // Provider unreachable — fall through and let admin force the completion.
      }
    }

    purchase.status = 'completed';
    if (!purchase.completedAt) purchase.completedAt = new Date();
    purchase.failureReason = undefined;
    await purchase.save();

    // Credits agent + sub-agent profit once, guarded by storeDetails.profitCredited.
    await creditStoreProfit(purchase);

    res.json({
      status: 'success',
      message: 'Order marked delivered and profit credited',
      data: { purchase },
    });
  } catch (err) {
    console.error('Admin complete order error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/admin/orders/:id/refund - Manually refund any non-refunded order.
// Credits the buyer's wallet with the selling price; agent profit is left intact.
router.post('/orders/:id/refund', async (req, res) => {
  try {
    const purchase = await DataPurchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }
    if (purchase.status === 'refunded') {
      return res.status(400).json({ status: 'error', message: 'Order is already refunded' });
    }

    const reason = (req.body?.reason || '').trim()
      || `Manual refund by admin (${purchase.failureReason || 'no failure reason recorded'})`;

    const result = await refundFailedPurchase(purchase, reason);
    res.json({ status: 'success', message: 'Refund issued', data: { purchase, refund: result } });
  } catch (err) {
    console.error('Admin manual refund error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/admin/refunds/:id/reverse - Reverse a refund the system issued by
// mistake (e.g., the order actually delivered). Debits the user's wallet by the
// refund amount — wallet may go negative; admin has authorized this.
router.post('/refunds/:id/reverse', async (req, res) => {
  try {
    const purchase = await DataPurchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }
    if (purchase.status !== 'refunded') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot reverse — order status is "${purchase.status}".`,
      });
    }

    const amount = purchase.price || 0;
    let user = null;

    if (purchase.userId && amount > 0) {
      // Allow wallet to go negative — admin acknowledges this.
      user = await User.findOneAndUpdate(
        { _id: purchase.userId },
        { $inc: { walletBalance: -amount } },
        { new: true }
      );
      if (user) {
        await Transaction.create({
          userId: purchase.userId,
          type: 'purchase',
          amount,
          balanceBefore: user.walletBalance + amount,
          balanceAfter: user.walletBalance,
          status: 'completed',
          reference: generateReference('REV'),
          gateway: 'system',
          description: `Refund reversed by admin — ${purchase.capacity}GB ${purchase.network} to ${purchase.phoneNumber} (delivered)`,
          metadata: {
            source: 'refund_reversal',
            originalPurchaseId: purchase._id,
            originalReference: purchase.reference,
            reversedBy: req.user._id,
            previousFailureReason: purchase.failureReason || null,
          },
        });
      }
    }

    purchase.status = 'completed';
    if (!purchase.completedAt) purchase.completedAt = new Date();
    purchase.refundedAt = undefined;
    purchase.failureReason = undefined;
    await purchase.save();

    res.json({
      status: 'success',
      message: 'Refund reversed',
      data: {
        purchase,
        userWalletBalance: user?.walletBalance ?? null,
      },
    });
  } catch (err) {
    console.error('Admin reverse refund error:', err.message);
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

// POST /api/admin/withdrawals/:id/check-status — Re-query Paystack for this
// transfer's current status, update the withdrawal, and return the fresh record.
router.post('/withdrawals/:id/check-status', async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ status: 'error', message: 'Withdrawal not found' });
    }

    const lookup = withdrawal.paystackTransferCode || withdrawal.reference;
    if (!lookup) {
      return res.status(400).json({
        status: 'error',
        message: 'This withdrawal has no Paystack transfer on record (manual or not yet approved).',
      });
    }

    let transfer;
    try {
      transfer = await paystackService.fetchTransfer(lookup);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return res.status(400).json({ status: 'error', message: `Paystack lookup failed: ${msg}` });
    }

    const newStatus = (transfer?.status || '').toLowerCase();
    withdrawal.paystackTransferStatus = newStatus || withdrawal.paystackTransferStatus;
    if (transfer?.transfer_code) withdrawal.paystackTransferCode = transfer.transfer_code;

    // Map Paystack transfer status → our withdrawal status
    if (newStatus === 'success') {
      withdrawal.status = 'completed';
      withdrawal.rejectionReason = undefined;
    } else if (newStatus === 'failed' || newStatus === 'reversed') {
      // Only refund pendingBalance if we haven't already (status was completed/processing)
      if (withdrawal.status === 'completed' || withdrawal.status === 'processing') {
        if (withdrawal.subAgentId) {
          const SubAgent = require('../../models/SubAgent');
          await SubAgent.findOneAndUpdate(
            { _id: withdrawal.subAgentId },
            { $inc: { pendingBalance: withdrawal.amount } }
          );
        } else if (withdrawal.storeId) {
          await Store.findOneAndUpdate(
            { _id: withdrawal.storeId },
            { $inc: { pendingBalance: withdrawal.amount } }
          );
        }
      }
      withdrawal.status = 'rejected';
      withdrawal.rejectionReason =
        transfer?.failures?.[0]?.message ||
        transfer?.reason ||
        transfer?.gateway_response ||
        `Paystack reported: ${newStatus}`;
    } else if (newStatus === 'pending' || newStatus === 'otp' || newStatus === 'processing') {
      withdrawal.status = 'processing';
    }

    await withdrawal.save();
    res.json({
      status: 'success',
      data: withdrawal,
      paystack: {
        status: newStatus,
        transfer_code: transfer?.transfer_code,
        reason: transfer?.reason,
        failureMessage: transfer?.failures?.[0]?.message,
        gatewayResponse: transfer?.gateway_response,
        createdAt: transfer?.createdAt,
      },
    });
  } catch (err) {
    console.error('Admin check-status error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/withdrawals/:id
// Body: { status: 'completed' | 'rejected', rejectionReason?, mode?: 'auto' | 'manual' }
//   - 'auto' (default when transfer key is set): initiate a Paystack transfer.
//   - 'manual': mark completed without touching Paystack (admin paid out-of-band).
router.put('/withdrawals/:id', async (req, res) => {
  try {
    const { status, rejectionReason, mode } = req.body;
    if (!['completed', 'rejected'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal || withdrawal.status !== 'pending') {
      return res.status(400).json({ status: 'error', message: 'Withdrawal not found or already processed' });
    }

    if (status === 'rejected') {
      withdrawal.status = 'rejected';
      withdrawal.processedBy = req.user._id;
      withdrawal.processedAt = new Date();
      if (rejectionReason) withdrawal.rejectionReason = rejectionReason;
      if (withdrawal.subAgentId) {
        const SubAgent = require('../../models/SubAgent');
        await SubAgent.findOneAndUpdate(
          { _id: withdrawal.subAgentId },
          { $inc: { pendingBalance: withdrawal.amount } }
        );
      } else if (withdrawal.storeId) {
        await Store.findOneAndUpdate(
          { _id: withdrawal.storeId },
          { $inc: { pendingBalance: withdrawal.amount } }
        );
      }
      await withdrawal.save();
      return res.json({ status: 'success', data: withdrawal });
    }

    // status === 'completed'
    const settings = await Settings.getSettings();
    const keyConfigured = isConfigured(settings?.paystack?.transferKey || '');
    const chosenMode = mode === 'manual' || !keyConfigured ? 'manual' : 'auto';

    if (chosenMode === 'manual') {
      withdrawal.status = 'completed';
      withdrawal.processedBy = req.user._id;
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      return res.json({ status: 'success', data: withdrawal, mode: 'manual' });
    }

    // Auto payout via Paystack transfer
    try {
      const { recipient, transfer } = await paystackService.payoutToMomo({
        name: withdrawal.momoDetails?.name || 'Agent',
        accountNumber: withdrawal.momoDetails?.number,
        network: withdrawal.momoDetails?.network,
        amountGHS: withdrawal.netAmount,
        reference: withdrawal.reference,
        reason: `Withdrawal ${withdrawal.reference}`,
      });

      const transferStatus = (transfer?.status || '').toLowerCase();
      // Paystack statuses: 'success' (completed), 'pending' (in-flight), 'otp' (requires OTP finalisation)
      withdrawal.status = transferStatus === 'success' ? 'completed' : 'processing';
      withdrawal.processedBy = req.user._id;
      withdrawal.processedAt = new Date();
      withdrawal.paystackRecipientCode = recipient?.recipient_code || '';
      withdrawal.paystackTransferCode = transfer?.transfer_code || '';
      withdrawal.paystackTransferStatus = transferStatus;
      if (transferStatus === 'otp') {
        withdrawal.rejectionReason = 'Paystack requires OTP finalisation on the sender account — complete it in the Paystack dashboard.';
      }
      await withdrawal.save();
      return res.json({
        status: 'success',
        data: withdrawal,
        mode: 'auto',
        paystack: { transferStatus, transferCode: transfer?.transfer_code },
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Paystack transfer failed';
      console.error('Withdrawal auto-payout failed:', msg);
      return res.status(400).json({
        status: 'error',
        message: `Payout failed: ${msg}. You can retry or approve manually.`,
      });
    }
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
        agentPrices: settings?.pricing?.agentPrices || {},
        subAgentPrices: settings?.pricing?.subAgentPrices || {},
        guestPrices: settings?.pricing?.guestPrices || {},
        apiPrices: settings?.pricing?.apiPrices || {},
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
    const { sellingPrices, basePrices, agentPrices, subAgentPrices, guestPrices, apiPrices } = req.body;

    const current = await Settings.getSettings();
    const cur = current.pricing || {};
    // basePrices = the platform / DataMart cost. It's the hard floor: no other
    // tier may be saved below it. Use the incoming base if provided, else live.
    const base = basePrices || cur.basePrices || {};

    // Clamp every value in a tier up to the platform cost for its SKU.
    const floorAtBase = (tier) => {
      if (!tier) return tier;
      const out = JSON.parse(JSON.stringify(tier));
      for (const net of Object.keys(out)) {
        for (const cap of Object.keys(out[net] || {})) {
          const b = (base[net] || {})[cap];
          if (b != null && Number(out[net][cap]) < b) out[net][cap] = b;
        }
      }
      return out;
    };

    // Guest / API tiers are sparse overrides: only SKUs the admin explicitly
    // priced (> 0) are stored. Anything else is dropped so it falls back to the
    // selling price at order time. Each stored value is floored at `floorMap`
    // (e.g. base cost, or the selling price) so the tier never undercuts it.
    const sparseOverride = (tier, floorMap) => {
      const out = {};
      for (const net of Object.keys(tier || {})) {
        for (const cap of Object.keys(tier[net] || {})) {
          const v = Number(tier[net][cap]);
          if (!v || v <= 0) continue;
          const floor = Math.max(
            Number((base[net] || {})[cap]) || 0,
            Number((floorMap?.[net] || {})[cap]) || 0
          );
          if (!out[net]) out[net] = {};
          out[net][cap] = v < floor ? floor : v;
        }
      }
      return out;
    };

    // The effective User price after this save — guest checkout must never be
    // cheaper than what regular users pay, so the guest tier is floored at it.
    const effectiveSelling = (sellingPrices ? floorAtBase(sellingPrices) : null) || cur.sellingPrices || {};

    const updates = {};
    if (basePrices) updates['pricing.basePrices'] = basePrices;
    // Guests pay at least the User price; API accounts only need to clear base
    // cost (admins may give developers/resellers a lower wholesale rate).
    if (guestPrices) updates['pricing.guestPrices'] = sparseOverride(guestPrices, effectiveSelling);
    if (apiPrices) updates['pricing.apiPrices'] = sparseOverride(apiPrices, null);

    // Agent price is exactly what the admin enters — only floored at the
    // DataMart cost so we never sell below what we pay. No imposed markup.
    let agentClamped = null;
    if (sellingPrices) updates['pricing.sellingPrices'] = floorAtBase(sellingPrices);
    if (agentPrices) {
      agentClamped = floorAtBase(agentPrices);
      updates['pricing.agentPrices'] = agentClamped;
    }

    // Sub-shop cost basis ALWAYS mirrors the agent price — the agent buys at the
    // admin-set price whether they sell directly or through a sub-agent. Any
    // incoming subAgentPrices is ignored in favour of the agent tier.
    if (agentPrices || subAgentPrices) {
      const effectiveAgent = agentClamped || cur.agentPrices || {};
      updates['pricing.subAgentPrices'] = JSON.parse(JSON.stringify(effectiveAgent));
    }

    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      { $set: updates },
      { upsert: true }
    );
    res.json({ status: 'success', message: 'Pricing updated (agent price = admin entry, floored only at DataMart cost; sub-shop cost = agent price)' });
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
    const existingAgentPrices = settings.pricing && settings.pricing.agentPrices || {};
    const existingSubAgentPrices = settings.pricing && settings.pricing.subAgentPrices || {};
    const existingGuestPrices = settings.pricing && settings.pricing.guestPrices || {};
    const existingApiPrices = settings.pricing && settings.pricing.apiPrices || {};
    const sellingPrices = JSON.parse(JSON.stringify(existingSellingPrices));
    const agentPrices = JSON.parse(JSON.stringify(existingAgentPrices));
    const subAgentPrices = JSON.parse(JSON.stringify(existingSubAgentPrices));
    const guestPrices = JSON.parse(JSON.stringify(existingGuestPrices));
    const apiPrices = JSON.parse(JSON.stringify(existingApiPrices));

    for (const network of Object.keys(basePrices)) {
      if (!sellingPrices[network]) sellingPrices[network] = {};
      if (!agentPrices[network]) agentPrices[network] = {};
      if (!subAgentPrices[network]) subAgentPrices[network] = {};
      for (const [capacity, basePrice] of Object.entries(basePrices[network])) {
        // Only set if price doesn't already exist for this bundle
        if (!sellingPrices[network][capacity]) {
          sellingPrices[network][capacity] = Math.round(basePrice * 1.05 * 100) / 100;
        }
        if (!agentPrices[network][capacity]) {
          agentPrices[network][capacity] = Math.round(basePrice * 1.03 * 100) / 100;
        }
        // subAgentPrices is always mirrored from the agent tier below — no
        // separate default needed.
      }
    }

    // Self-heal pass over EVERY entry (not just newly-added ones): no tier may
    // sit below the platform/DataMart cost, and the sub-shop cost basis ALWAYS
    // equals the agent price. No imposed markup — admin's entered prices stand.
    for (const network of Object.keys(basePrices)) {
      for (const capacity of Object.keys(basePrices[network])) {
        const b = basePrices[network][capacity];
        if (b == null) continue;
        if (agentPrices[network][capacity] < b) agentPrices[network][capacity] = b;
        if (sellingPrices[network][capacity] < b) sellingPrices[network][capacity] = b;
        subAgentPrices[network][capacity] = agentPrices[network][capacity];
        // Guest/API tiers are sparse overrides — only re-floor entries that
        // already exist; never auto-create them (absence = falls back to selling).
        // Guest is floored at the User price (never cheaper than regular users);
        // API only needs to clear base cost.
        if (guestPrices[network] && guestPrices[network][capacity] != null) {
          const guestFloor = Math.max(b, sellingPrices[network][capacity] || 0);
          if (guestPrices[network][capacity] < guestFloor) guestPrices[network][capacity] = guestFloor;
        }
        if (apiPrices[network] && apiPrices[network][capacity] != null && apiPrices[network][capacity] < b) {
          apiPrices[network][capacity] = b;
        }
      }
    }

    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      { $set: { 'pricing.basePrices': basePrices, 'pricing.sellingPrices': sellingPrices, 'pricing.agentPrices': agentPrices, 'pricing.subAgentPrices': subAgentPrices, 'pricing.guestPrices': guestPrices, 'pricing.apiPrices': apiPrices, 'datamart.isConnected': true, 'pricing.lastFetchedAt': new Date() } },
      { upsert: true }
    );

    res.json({ status: 'success', message: `Synced ${packages.length} packages`, data: { basePrices, sellingPrices, agentPrices, subAgentPrices } });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// Sensitive credential fields that must never leave the server in plaintext.
// Each entry: dot path on the Settings document.
const SECRET_FIELDS = [
  'paystack.secretKey',
  'paystack.transferKey',
  'datamart.apiKey',
  'datamart.webhookSecret',
  'sms.apiKey',
  'ghust.apiKey',
  'ghust.webhookSecret',
];

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const safe = settings.toObject();

    // Replace every secret with a masked preview + configured flag. Plaintext
    // values are masked too (mask/isConfigured handle non-encrypted input).
    for (const path of SECRET_FIELDS) {
      const [group, key] = path.split('.');
      const stored = safe?.[group]?.[key] || '';
      if (safe[group]) {
        safe[group][key] = undefined;
        safe[group][`${key}Masked`] = mask(stored);
        safe[group][`${key}Configured`] = isConfigured(stored);
      }
    }

    res.json({ status: 'success', data: safe });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// Apply a "leave alone if blank, clear if null, replace if non-empty string"
// update for a credential field. Returns nothing — mutates `updates` in place.
function applySecretUpdate(updates, group, key, value, { encryptOnSave = false } = {}) {
  if (value === null) {
    updates[`${group}.${key}`] = '';
    return;
  }
  if (typeof value === 'string' && value.trim()) {
    updates[`${group}.${key}`] = encryptOnSave ? encrypt(value.trim()) : value.trim();
  }
  // undefined / empty string → no-op (preserve existing value)
}

// PUT /api/admin/settings
router.put('/settings', async (req, res) => {
  try {
    const { datamart, paystack, sms, ghust, withdrawal, agentSupport, ordersPaused, ordersPausedMessage, outOfStockNetworks } = req.body;
    const updates = {};
    if (withdrawal) updates.withdrawal = withdrawal;
    if (agentSupport) updates.agentSupport = agentSupport;
    if (ordersPaused !== undefined) updates.ordersPaused = !!ordersPaused;
    if (ordersPausedMessage !== undefined) updates.ordersPausedMessage = String(ordersPausedMessage);
    if (Array.isArray(outOfStockNetworks)) {
      updates.outOfStockNetworks = outOfStockNetworks.map(String);
    }

    if (datamart) {
      const { apiKey, webhookSecret, ...rest } = datamart;
      for (const [k, v] of Object.entries(rest)) updates[`datamart.${k}`] = v;
      applySecretUpdate(updates, 'datamart', 'apiKey', apiKey);
      applySecretUpdate(updates, 'datamart', 'webhookSecret', webhookSecret);
    }

    if (sms) {
      const { apiKey, ...rest } = sms;
      for (const [k, v] of Object.entries(rest)) updates[`sms.${k}`] = v;
      applySecretUpdate(updates, 'sms', 'apiKey', apiKey);
    }

    if (ghust) {
      const { apiKey, webhookSecret, ...rest } = ghust;
      for (const [k, v] of Object.entries(rest)) updates[`ghust.${k}`] = v;
      applySecretUpdate(updates, 'ghust', 'apiKey', apiKey);
      applySecretUpdate(updates, 'ghust', 'webhookSecret', webhookSecret);
    }

    if (paystack) {
      const { secretKey, transferKey, ...rest } = paystack;
      for (const [k, v] of Object.entries(rest)) updates[`paystack.${k}`] = v;
      applySecretUpdate(updates, 'paystack', 'secretKey', secretKey);
      // Transfer key is the one that gets encrypted at rest.
      applySecretUpdate(updates, 'paystack', 'transferKey', transferKey, { encryptOnSave: true });
    }

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

// POST /api/admin/settings/test-transfer-key — Verify the transfer key works
router.post('/settings/test-transfer-key', async (req, res) => {
  try {
    const client = await paystackService.getTransferClient();
    // Hit a lightweight endpoint — listing banks verifies the key works
    const resp = await client.get('/bank?currency=GHS&type=mobile_money');
    res.json({
      status: 'success',
      data: {
        connected: resp.data?.status === true,
        banksFound: Array.isArray(resp.data?.data) ? resp.data.data.length : 0,
      },
    });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(400).json({ status: 'error', message: `Transfer key test failed: ${msg}` });
  }
});

// POST /api/admin/orders/pause - Quick toggle for pausing orders
router.post('/orders/pause', async (req, res) => {
  try {
    const { paused, message } = req.body;
    const updates = { ordersPaused: !!paused };
    if (message !== undefined) updates.ordersPausedMessage = String(message);
    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      { $set: updates },
      { upsert: true }
    );
    res.json({ status: 'success', data: { ordersPaused: !!paused } });
  } catch (err) {
    console.error('Admin pause error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

const VALID_NETWORKS = ['YELLO', 'TELECEL', 'AT_PREMIUM'];

// POST /api/admin/orders/out-of-stock - Toggle a single network's stock state
router.post('/orders/out-of-stock', async (req, res) => {
  try {
    const { network, outOfStock } = req.body;
    if (!VALID_NETWORKS.includes(network)) {
      return res.status(400).json({ status: 'error', message: 'Invalid network' });
    }
    const settings = await Settings.getSettings();
    const current = new Set(settings?.outOfStockNetworks || []);
    if (outOfStock) {
      current.add(network);
    } else {
      current.delete(network);
    }
    const next = Array.from(current);
    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      { $set: { outOfStockNetworks: next } },
      { upsert: true }
    );
    res.json({ status: 'success', data: { outOfStockNetworks: next } });
  } catch (err) {
    console.error('Admin out-of-stock error:', err.message);
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

// ─── ANNOUNCEMENTS (admin-posted updates for agents & sub-agents) ───

// GET /api/admin/announcements — list every announcement (active or not)
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ pinned: -1, createdAt: -1 })
      .lean();
    res.json({ status: 'success', data: announcements });
  } catch (err) {
    console.error('Admin announcements list error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/admin/announcements — create
router.post('/announcements', async (req, res) => {
  try {
    const { title, message, audience, pinned, isActive } = req.body;
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Title and message are required' });
    }
    const allowed = ['agents', 'subagents', 'all'];
    const announcement = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      audience: allowed.includes(audience) ? audience : 'all',
      pinned: !!pinned,
      isActive: isActive !== false,
      createdBy: req.user._id,
    });
    res.status(201).json({ status: 'success', data: announcement });
  } catch (err) {
    console.error('Admin announcement create error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/announcements/:id — update / toggle
router.put('/announcements/:id', async (req, res) => {
  try {
    const { title, message, audience, pinned, isActive } = req.body;
    const update = {};
    if (title !== undefined) update.title = String(title).trim();
    if (message !== undefined) update.message = String(message).trim();
    if (audience !== undefined && ['agents', 'subagents', 'all'].includes(audience)) update.audience = audience;
    if (pinned !== undefined) update.pinned = !!pinned;
    if (isActive !== undefined) update.isActive = !!isActive;

    const announcement = await Announcement.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!announcement) {
      return res.status(404).json({ status: 'error', message: 'Announcement not found' });
    }
    res.json({ status: 'success', data: announcement });
  } catch (err) {
    console.error('Admin announcement update error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// DELETE /api/admin/announcements/:id
router.delete('/announcements/:id', async (req, res) => {
  try {
    const deleted = await Announcement.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'Announcement not found' });
    }
    res.json({ status: 'success', message: 'Announcement deleted' });
  } catch (err) {
    console.error('Admin announcement delete error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// ─── RESULT CHECKER CONFIG (WAEC / BECE pricing + availability) ───

// GET /api/admin/checker-config — current pricing + live DataMart stock
router.get('/checker-config', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const rc = settings?.resultChecker || {};

    let stock = null;
    try {
      const upstream = await datamartService.getResultCheckers();
      stock = upstream.map(p => ({
        checkerType: (p.name || '').toUpperCase(),
        inStock: !!p.inStock,
        stockCount: p.stockCount ?? null,
        providerPrice: p.price ?? null,
      }));
    } catch (err) {
      stock = null; // DataMart unreachable — pricing still editable.
    }

    res.json({
      status: 'success',
      data: {
        enabled: rc.enabled !== false,
        cost: rc.cost ?? 15.7,
        waecPrice: rc.waecPrice ?? 0,
        becePrice: rc.becePrice ?? 0,
        // Agent cost basis when agents/sub-agents resell checkers on their shops.
        agentWaecPrice: rc.agentWaecPrice ?? 0,
        agentBecePrice: rc.agentBecePrice ?? 0,
        stock,
      },
    });
  } catch (err) {
    console.error('Admin checker-config get error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/checker-config — update pricing / availability
router.put('/checker-config', async (req, res) => {
  try {
    const { enabled, cost, waecPrice, becePrice, agentWaecPrice, agentBecePrice } = req.body;
    const update = {};
    if (enabled !== undefined) update['resultChecker.enabled'] = !!enabled;
    if (cost !== undefined && cost >= 0) update['resultChecker.cost'] = Number(cost);
    if (waecPrice !== undefined && waecPrice >= 0) update['resultChecker.waecPrice'] = Number(waecPrice);
    if (becePrice !== undefined && becePrice >= 0) update['resultChecker.becePrice'] = Number(becePrice);
    if (agentWaecPrice !== undefined && agentWaecPrice >= 0) update['resultChecker.agentWaecPrice'] = Number(agentWaecPrice);
    if (agentBecePrice !== undefined && agentBecePrice >= 0) update['resultChecker.agentBecePrice'] = Number(agentBecePrice);

    await Settings.findByIdAndUpdate('app_settings', { $set: update }, { upsert: true });
    const settings = await Settings.getSettings();
    res.json({ status: 'success', message: 'Result checker settings updated', data: settings.resultChecker });
  } catch (err) {
    console.error('Admin checker-config update error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// ─── DEVELOPER API KEYS (admin approves access) ───

// GET /api/admin/api-keys — list every API key with its owner
router.get('/api-keys', async (req, res) => {
  try {
    const keys = await ApiKey.find()
      .populate('userId', 'name email phoneNumber walletBalance')
      .sort({ status: 1, createdAt: -1 })
      .lean();
    const data = keys.map(k => ({
      id: k._id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      status: k.status,
      lastUsedAt: k.lastUsedAt || null,
      createdAt: k.createdAt,
      user: k.userId ? {
        id: k.userId._id,
        name: k.userId.name,
        email: k.userId.email,
        phoneNumber: k.userId.phoneNumber,
        walletBalance: k.userId.walletBalance,
      } : null,
    }));
    res.json({ status: 'success', data });
  } catch (err) {
    console.error('Admin api-keys list error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/api-keys/:id — approve (active) or revoke an API key
router.put('/api-keys/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'revoked', 'pending'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'status must be active, revoked or pending' });
    }
    const keyDoc = await ApiKey.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!keyDoc) {
      return res.status(404).json({ status: 'error', message: 'API key not found' });
    }
    res.json({ status: 'success', message: `API key ${status === 'active' ? 'approved' : status}`, data: { id: keyDoc._id, status: keyDoc.status } });
  } catch (err) {
    console.error('Admin api-key update error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
