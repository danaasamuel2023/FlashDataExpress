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
const paystackService = require('../../services/paystackService');
const { encrypt, mask, isConfigured } = require('../../utils/encryption');
const { generateReference } = require('../../utils/helpers');
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
      totalUsers, totalOrders, revenueAgg, depositsAgg,
      todayOrdersBySource, todayBySource,
      recentOrders, settings, totalStoresActivated
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

    res.json({
      status: 'success',
      data: {
        totalUsers,
        totalOrders,
        totalRevenue: revenueAgg[0]?.total || 0,
        totalDeposits: depositsAgg[0]?.total || 0,
        totalStoresActivated,
        // Combined today totals (kept for backwards compatibility)
        todayOrders: portal.orders + store.orders,
        todayRevenue: portal.revenue + store.revenue,
        todayProfit: portal.profit + store.profit,
        // Split: main portal vs agent stores
        todayPortal: portal,
        todayStore: store,
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
    const { sellingPrices, basePrices, agentPrices, subAgentPrices } = req.body;
    const updates = {};
    if (sellingPrices) updates['pricing.sellingPrices'] = sellingPrices;
    if (basePrices) updates['pricing.basePrices'] = basePrices;
    if (agentPrices) updates['pricing.agentPrices'] = agentPrices;
    if (subAgentPrices) updates['pricing.subAgentPrices'] = subAgentPrices;
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
    const existingAgentPrices = settings.pricing && settings.pricing.agentPrices || {};
    const existingSubAgentPrices = settings.pricing && settings.pricing.subAgentPrices || {};
    const sellingPrices = JSON.parse(JSON.stringify(existingSellingPrices));
    const agentPrices = JSON.parse(JSON.stringify(existingAgentPrices));
    const subAgentPrices = JSON.parse(JSON.stringify(existingSubAgentPrices));

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
        if (!subAgentPrices[network][capacity]) {
          subAgentPrices[network][capacity] = Math.round(basePrice * 1.04 * 100) / 100;
        }
      }
    }

    await Settings.findOneAndUpdate(
      { _id: 'app_settings' },
      { $set: { 'pricing.basePrices': basePrices, 'pricing.sellingPrices': sellingPrices, 'pricing.agentPrices': agentPrices, 'pricing.subAgentPrices': subAgentPrices, 'datamart.isConnected': true, 'pricing.lastFetchedAt': new Date() } },
      { upsert: true }
    );

    res.json({ status: 'success', message: `Synced ${packages.length} packages`, data: { basePrices, sellingPrices, agentPrices, subAgentPrices } });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    // Clone and strip sensitive secrets before returning
    const safe = settings.toObject();
    const encryptedTransferKey = safe?.paystack?.transferKey || '';
    if (safe.paystack) {
      safe.paystack.transferKey = undefined;
      safe.paystack.transferKeyMasked = mask(encryptedTransferKey);
      safe.paystack.transferKeyConfigured = isConfigured(encryptedTransferKey);
    }
    res.json({ status: 'success', data: safe });
  } catch (err) {
    console.error('Admin error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/admin/settings
router.put('/settings', async (req, res) => {
  try {
    const { datamart, paystack, sms, withdrawal, agentSupport, ordersPaused, ordersPausedMessage } = req.body;
    const updates = {};
    if (datamart) updates.datamart = datamart;
    if (sms) updates.sms = sms;
    if (withdrawal) updates.withdrawal = withdrawal;
    if (agentSupport) updates.agentSupport = agentSupport;
    if (ordersPaused !== undefined) updates.ordersPaused = !!ordersPaused;
    if (ordersPausedMessage !== undefined) updates.ordersPausedMessage = String(ordersPausedMessage);

    if (paystack) {
      // Handle the transfer key specially so we never persist plaintext.
      // Empty string → leave existing key untouched. Explicit null → clear it.
      const { transferKey, ...rest } = paystack;
      for (const [k, v] of Object.entries(rest)) {
        updates[`paystack.${k}`] = v;
      }
      if (transferKey === null) {
        updates['paystack.transferKey'] = '';
      } else if (typeof transferKey === 'string' && transferKey.trim()) {
        updates['paystack.transferKey'] = encrypt(transferKey.trim());
      }
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
