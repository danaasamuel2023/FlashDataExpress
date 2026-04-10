const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const SubAgent = require('../models/SubAgent');
const SubAgentProduct = require('../models/SubAgentProduct');
const User = require('../models/User');
const DataPurchase = require('../models/DataPurchase');
const Withdrawal = require('../models/Withdrawal');
const Settings = require('../models/Settings');
const { formatPhone, generateReference } = require('../utils/helpers');

// Middleware: authenticate sub-agent via JWT (same token system, but verifies they are a sub-agent)
const subagentAuth = async (req, res, next) => {
  try {
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ status: 'error', message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ status: 'error', message: 'Invalid token' });

    const subAgent = await SubAgent.findOne({ userId: user._id, status: 'registered', isActive: true })
      .populate('storeId', 'storeName storeSlug agentId contactWhatsapp contactPhone');
    if (!subAgent) return res.status(403).json({ status: 'error', message: 'Not a registered sub-agent' });

    req.user = user;
    req.subAgent = subAgent;
    next();
  } catch (err) {
    res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
};

// ─── PARENT AGENT ROUTES (require auth) ───

// POST /api/subagent/generate-invite — Parent agent generates an invite link
router.post('/generate-invite', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ agentId: req.user._id });
    if (!store) {
      return res.status(404).json({ status: 'error', message: 'You need a store first' });
    }

    const inviteCode = store.storeName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') +
      'INV' +
      Math.random().toString(36).substring(2, 8).toUpperCase();

    const subAgent = await SubAgent.create({
      storeId: store._id,
      parentAgentId: req.user._id,
      inviteCode,
      status: 'pending',
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subagent/register/${inviteCode}`;

    res.status(201).json({
      status: 'success',
      data: {
        inviteCode,
        inviteLink,
        subAgentId: subAgent._id,
      },
    });
  } catch (err) {
    console.error('SubAgent generate-invite error:', err.code, err.message, JSON.stringify(err.keyPattern));
    if (err.code === 11000) {
      // Retry once with a different code in case of collision
      try {
        const retryCode = store.storeName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') +
          'INV' +
          Math.random().toString(36).substring(2, 8).toUpperCase();
        const subAgent = await SubAgent.create({
          storeId: store._id,
          parentAgentId: req.user._id,
          inviteCode: retryCode,
          status: 'pending',
        });
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subagent/register/${retryCode}`;
        return res.status(201).json({
          status: 'success',
          data: { inviteCode: retryCode, inviteLink, subAgentId: subAgent._id },
        });
      } catch (retryErr) {
        console.error('SubAgent generate-invite retry error:', retryErr.code, retryErr.message, JSON.stringify(retryErr.keyPattern));
        return res.status(400).json({ status: 'error', message: 'Failed to generate invite. The old database index may need to be removed. Check server logs.' });
      }
    }
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subagent/invite-info/:code — Public: get info about an invite
router.get('/invite-info/:code', async (req, res) => {
  try {
    const subAgent = await SubAgent.findOne({
      inviteCode: req.params.code.toUpperCase(),
      status: 'pending',
    }).populate('storeId', 'storeName storeSlug description theme');

    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Invalid or expired invite link' });
    }

    const parentAgent = await User.findById(subAgent.parentAgentId).select('name');

    res.json({
      status: 'success',
      data: {
        storeName: subAgent.storeId?.storeName,
        storeDescription: subAgent.storeId?.description,
        parentAgentName: parentAgent?.name,
        inviteCode: subAgent.inviteCode,
      },
    });
  } catch (err) {
    console.error('SubAgent invite-info error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/subagent/register — Public: sub-agent registers via invite code
router.post('/register', [
  body('inviteCode').trim().notEmpty().withMessage('Invite code is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('storeName').trim().notEmpty().withMessage('Store name is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: errors.array()[0].msg });
    }

    const { inviteCode, name, email, password, phoneNumber, storeName } = req.body;
    const formattedPhone = formatPhone(phoneNumber);

    // Find the pending invite
    const subAgent = await SubAgent.findOne({
      inviteCode: inviteCode.toUpperCase(),
      status: 'pending',
    }).populate('storeId');

    if (!subAgent) {
      return res.status(404).json({ status: 'error', message: 'Invalid or expired invite link' });
    }

    // Check if email/phone already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber: formattedPhone }] });
    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'email' : 'phone number';
      return res.status(400).json({ status: 'error', message: `An account with this ${field} already exists` });
    }

    // Create User account
    const user = new User({
      name: name.trim(),
      email,
      password,
      phoneNumber: formattedPhone,
    });
    await user.save();

    // Generate store slug for sub-agent
    let storeSlug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugExists = await SubAgent.findOne({ storeSlug });
    if (slugExists) {
      storeSlug += '-' + Date.now().toString(36);
    }
    // Also check main Store slugs
    const mainSlugExists = await Store.findOne({ storeSlug });
    if (mainSlugExists) {
      storeSlug += '-sub-' + Date.now().toString(36);
    }

    // Generate referral code
    const referralCode = storeName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') +
      name.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, 'X') +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    // Update sub-agent record
    subAgent.userId = user._id;
    subAgent.storeName = storeName.trim();
    subAgent.storeSlug = storeSlug;
    subAgent.contactPhone = formattedPhone;
    subAgent.referralCode = referralCode;
    subAgent.status = 'registered';
    await subAgent.save();

    // Auto-populate products from parent store with parent's selling prices as base prices
    const parentProducts = await StoreProduct.find({ storeId: subAgent.storeId._id, isActive: true });
    if (parentProducts.length > 0) {
      const subProducts = parentProducts.map(p => ({
        subAgentId: subAgent._id,
        network: p.network,
        capacity: p.capacity,
        basePrice: p.sellingPrice, // Parent's selling price = sub-agent's cost
        sellingPrice: Math.round((p.sellingPrice * 1.1) * 100) / 100, // Default 10% markup
        isActive: true,
      }));
      await SubAgentProduct.insertMany(subProducts);
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
        subAgent: {
          id: subAgent._id,
          storeName: subAgent.storeName,
          storeSlug: subAgent.storeSlug,
          parentStoreName: subAgent.storeId?.storeName,
        },
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      const messages = {
        email: 'An account with this email already exists',
        phoneNumber: 'An account with this phone number already exists',
        storeSlug: 'This store name is already taken. Please choose another.',
        referralCode: 'Registration failed. Please try again.',
        inviteCode: 'This invite has already been used.',
      };
      return res.status(400).json({ status: 'error', message: messages[field] || 'Registration failed. Please try again.' });
    }
    console.error('SubAgent register error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/subagent/login — Sub-agent login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Valid email and password required' });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ status: 'error', message: 'Your account has been deactivated.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // Verify they are a registered sub-agent
    const subAgent = await SubAgent.findOne({ userId: user._id, status: 'registered' })
      .populate('storeId', 'storeName storeSlug');
    if (!subAgent) {
      return res.status(403).json({ status: 'error', message: 'No sub-agent account found for this email' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      status: 'success',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
        subAgent: {
          id: subAgent._id,
          storeName: subAgent.storeName,
          storeSlug: subAgent.storeSlug,
          parentStoreName: subAgent.storeId?.storeName,
          totalEarnings: subAgent.totalEarnings,
          totalSales: subAgent.totalSales,
          pendingBalance: subAgent.pendingBalance,
        },
      },
    });
  } catch (err) {
    console.error('SubAgent login error:', err.message);
    res.status(500).json({ status: 'error', message: 'Login failed. Please try again.' });
  }
});

// ─── SUB-AGENT AUTHENTICATED ROUTES ───

// GET /api/subagent/my-dashboard — Sub-agent's dashboard
router.get('/my-dashboard', subagentAuth, async (req, res) => {
  try {
    const sales = await DataPurchase.find({
      'storeDetails.subAgentId': req.subAgent._id,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      status: 'success',
      data: {
        subAgent: {
          id: req.subAgent._id,
          storeName: req.subAgent.storeName,
          storeSlug: req.subAgent.storeSlug,
          totalEarnings: req.subAgent.totalEarnings,
          totalSales: req.subAgent.totalSales,
          pendingBalance: req.subAgent.pendingBalance,
          contactPhone: req.subAgent.contactPhone || '',
          contactWhatsapp: req.subAgent.contactWhatsapp || '',
          parentStoreName: req.subAgent.storeId?.storeName,
          parentWhatsapp: req.subAgent.storeId?.contactWhatsapp || '',
          parentPhone: req.subAgent.storeId?.contactPhone || '',
          isActive: req.subAgent.isActive,
          momoDetails: req.subAgent.momoDetails || {},
        },
        sales,
      },
    });
  } catch (err) {
    console.error('SubAgent dashboard error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subagent/my-daily-sales — Sub-agent's today's sales
router.get('/my-daily-sales', subagentAuth, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sales = await DataPurchase.find({
      'storeDetails.subAgentId': req.subAgent._id,
      createdAt: { $gte: todayStart },
    }).sort({ createdAt: -1 }).limit(200).lean();

    const todayProfit = sales.reduce((sum, s) => sum + (s.storeDetails?.subAgentProfit || 0), 0);
    const todayRevenue = sales.reduce((sum, s) => sum + (s.price || 0), 0);

    res.json({
      status: 'success',
      data: { sales, todayProfit, todayRevenue, count: sales.length },
    });
  } catch (err) {
    console.error('SubAgent daily-sales error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subagent/my-products — Sub-agent's products with pricing
router.get('/my-products', subagentAuth, async (req, res) => {
  try {
    const products = await SubAgentProduct.find({ subAgentId: req.subAgent._id });
    res.json({ status: 'success', data: products });
  } catch (err) {
    console.error('SubAgent products error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/subagent/my-products — Sub-agent updates their selling prices
router.put('/my-products', subagentAuth, async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ status: 'error', message: 'Products must be an array' });
    }

    // Also refresh base prices from parent store's current selling prices
    const parentProducts = await StoreProduct.find({ storeId: req.subAgent.storeId._id, isActive: true });
    const parentPriceMap = {};
    parentProducts.forEach(p => {
      parentPriceMap[`${p.network}_${p.capacity}`] = p.sellingPrice;
    });

    const ops = products.map(p => {
      const parentPrice = parentPriceMap[`${p.network}_${p.capacity}`];
      const basePrice = parentPrice || p.basePrice;
      const sellingPrice = Math.max(p.sellingPrice, basePrice); // Can't sell below cost

      return {
        updateOne: {
          filter: { subAgentId: req.subAgent._id, network: p.network, capacity: p.capacity },
          update: {
            $set: {
              basePrice,
              sellingPrice,
              isActive: p.isActive !== false,
            },
          },
          upsert: true,
        },
      };
    });

    if (ops.length > 0) {
      await SubAgentProduct.bulkWrite(ops);
    }

    const updated = await SubAgentProduct.find({ subAgentId: req.subAgent._id });
    res.json({ status: 'success', data: updated });
  } catch (err) {
    console.error('SubAgent update products error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/subagent/my-store — Sub-agent updates their store details
router.put('/my-store', subagentAuth, async (req, res) => {
  try {
    const { storeName, contactPhone, contactWhatsapp, momoDetails } = req.body;
    if (storeName) req.subAgent.storeName = storeName;
    if (contactPhone) req.subAgent.contactPhone = contactPhone;
    if (contactWhatsapp !== undefined) req.subAgent.contactWhatsapp = contactWhatsapp;
    if (momoDetails) req.subAgent.momoDetails = momoDetails;

    await req.subAgent.save();
    res.json({ status: 'success', data: req.subAgent });
  } catch (err) {
    console.error('SubAgent update store error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/subagent/withdrawal-request — Sub-agent requests withdrawal
router.post('/withdrawal-request', subagentAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    const value = parseFloat(amount);

    const settings = await Settings.getSettings();
    const minAmount = settings?.withdrawal?.minimumAmount || 10;
    const feePercent = settings?.withdrawal?.feePercent || 0;

    if (!value || value < minAmount) {
      return res.status(400).json({ status: 'error', message: `Minimum withdrawal is GH₵${minAmount}` });
    }

    if (value > req.subAgent.pendingBalance) {
      return res.status(400).json({
        status: 'error',
        message: `You can only withdraw up to ${req.subAgent.pendingBalance.toFixed(2)} GH₵`,
      });
    }

    if (!req.subAgent.momoDetails?.number) {
      return res.status(400).json({ status: 'error', message: 'Set up your MoMo details first' });
    }

    const pendingWithdrawal = await Withdrawal.findOne({
      userId: req.user._id,
      status: 'pending',
    });
    if (pendingWithdrawal) {
      return res.status(400).json({ status: 'error', message: 'You have a pending withdrawal request' });
    }

    const fee = Math.round(value * feePercent / 100 * 100) / 100;
    const netAmount = value - fee;

    const updated = await SubAgent.findOneAndUpdate(
      { _id: req.subAgent._id, pendingBalance: { $gte: value } },
      { $inc: { pendingBalance: -value } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ status: 'error', message: 'Insufficient balance' });
    }

    const withdrawal = await Withdrawal.create({
      userId: req.user._id,
      subAgentId: req.subAgent._id,
      amount: value,
      fee,
      netAmount,
      reference: generateReference('SWD'),
      momoDetails: req.subAgent.momoDetails,
    });

    res.json({ status: 'success', data: withdrawal });
  } catch (err) {
    console.error('SubAgent withdrawal error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subagent/withdrawal-history — Sub-agent's withdrawal history
router.get('/withdrawal-history', subagentAuth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ status: 'success', data: withdrawals });
  } catch (err) {
    console.error('SubAgent withdrawal history error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// ─── PARENT AGENT MANAGEMENT ROUTES (require auth) ───

// GET /api/subagent/list — Parent lists their sub-agents
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

// PUT /api/subagent/:id — Parent updates sub-agent
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

// DELETE /api/subagent/:id — Parent removes sub-agent
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

    // Also remove their products
    await SubAgentProduct.deleteMany({ subAgentId: subAgent._id });

    res.json({ status: 'success', message: 'Subagent removed' });
  } catch (err) {
    console.error('SubAgent delete error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/subagent/sales/:id — Parent views specific sub-agent's sales
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

// Legacy: POST /api/subagent/invite — kept for backward compat
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
      status: 'registered',
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

module.exports = router;
