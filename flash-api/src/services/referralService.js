const User = require('../models/User');
const { Referral, ReferralEarning } = require('../models/Referral');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const { generateReference } = require('../utils/helpers');

class ReferralService {
  async processCommission(purchaseUserId, purchaseAmount, purchaseId) {
    try {
      const settings = await Settings.getSettings();
      if (!settings?.referral?.enabled) return;

      const user = await User.findById(purchaseUserId);
      if (!user?.referredBy) return;

      const referral = await Referral.findOne({
        referredUserId: purchaseUserId,
        status: 'active',
      });
      if (!referral) return;

      const commissionPercent = settings.referral.commissionPercent || 0;
      if (commissionPercent <= 0) return;

      const commissionAmount = Math.round((purchaseAmount * commissionPercent / 100) * 100) / 100;
      if (commissionAmount <= 0) return;

      // Credit referrer wallet atomically
      const referrer = await User.findOneAndUpdate(
        { _id: referral.referrerId },
        { $inc: { walletBalance: commissionAmount } },
        { new: true }
      );

      if (!referrer) return;

      // Create transaction
      await Transaction.create({
        userId: referral.referrerId,
        type: 'referral_earning',
        amount: commissionAmount,
        balanceBefore: referrer.walletBalance - commissionAmount,
        balanceAfter: referrer.walletBalance,
        status: 'completed',
        reference: generateReference('REF'),
        description: `Referral commission from ${user.name}`,
      });

      // Create earning record
      await ReferralEarning.create({
        referrerId: referral.referrerId,
        referredUserId: purchaseUserId,
        purchaseId,
        type: 'commission',
        commissionAmount,
        status: 'paid',
      });

      // Check bonus data milestones
      await this.checkBonusMilestones(referral.referrerId, settings);
    } catch (err) {
      console.error('Referral commission error:', err.message);
    }
  }

  async checkBonusMilestones(referrerId, settings) {
    const milestones = settings?.referral?.bonusDataMilestones || [];
    if (milestones.length === 0) return;

    const referralCount = await Referral.countDocuments({
      referrerId,
      status: 'active',
    });

    for (const milestone of milestones) {
      if (referralCount >= milestone.referralCount) {
        const existing = await ReferralEarning.findOne({
          referrerId,
          type: 'bonus_data',
          bonusCapacity: milestone.bonusGB,
        });
        if (!existing) {
          await ReferralEarning.create({
            referrerId,
            type: 'bonus_data',
            bonusCapacity: milestone.bonusGB,
            status: 'pending',
          });
        }
      }
    }
  }
}

module.exports = new ReferralService();
