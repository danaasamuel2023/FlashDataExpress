const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['registered', 'active'],
    default: 'registered'
  }
}, {
  timestamps: true
});

ReferralSchema.index({ referrerId: 1, createdAt: -1 });
ReferralSchema.index({ referredUserId: 1 });

const ReferralEarningSchema = new mongoose.Schema({
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DataPurchase'
  },
  type: {
    type: String,
    enum: ['commission', 'bonus_data'],
    required: true
  },
  commissionAmount: Number,
  commissionPercent: Number,
  purchaseAmount: Number,
  bonusCapacity: Number,
  bonusNetwork: String,
  milestoneName: String,
  status: {
    type: String,
    enum: ['pending', 'credited', 'failed'],
    default: 'pending'
  },
  creditedAt: Date
}, {
  timestamps: true
});

ReferralEarningSchema.index({ referrerId: 1, createdAt: -1 });

const Referral = mongoose.model('Referral', ReferralSchema);
const ReferralEarning = mongoose.model('ReferralEarning', ReferralEarningSchema);

module.exports = { Referral, ReferralEarning };
