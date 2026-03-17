const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { Referral, ReferralEarning } = require('../models/Referral');

// GET /api/referral/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const totalReferred = await Referral.countDocuments({ referrerId: req.user._id });

    const earnings = await ReferralEarning.aggregate([
      { $match: { referrerId: req.user._id, type: 'commission', status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);

    const bonusData = await ReferralEarning.aggregate([
      { $match: { referrerId: req.user._id, type: 'bonus_data' } },
      { $group: { _id: null, total: { $sum: '$bonusCapacity' } } },
    ]);

    const referredUsers = await Referral.find({ referrerId: req.user._id })
      .populate('referredUserId', 'name createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      status: 'success',
      data: {
        totalReferred,
        totalEarnings: earnings[0]?.total || 0,
        bonusDataEarned: bonusData[0]?.total ? `${bonusData[0].total}GB` : '0GB',
        referredUsers: referredUsers.map(r => ({
          name: r.referredUserId?.name || 'Unknown',
          joinedAt: r.referredUserId?.createdAt?.toISOString?.()?.split('T')[0] || '',
          status: r.status,
        })),
      },
    });
  } catch (err) {
    console.error('Referral error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/referral/code
router.get('/code', auth, async (req, res) => {
  try {
    res.json({ status: 'success', data: { referralCode: req.user.referralCode } });
  } catch (err) {
    console.error('Referral error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
