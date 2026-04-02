const mongoose = require('mongoose');

const SubAgentSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  parentAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  storeName: {
    type: String,
    maxlength: 50,
    trim: true
  },
  storeSlug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  contactPhone: String,
  contactWhatsapp: String,
  // Legacy commission field (kept for backward compat with old sub-agents)
  commissionPercent: {
    type: Number,
    default: 30,
    min: 1,
    max: 90
  },
  totalEarnings: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },
  isActive: {
    type: Boolean,
    default: true
  },
  // 'pending' = invite generated but not yet registered, 'registered' = sub-agent has registered
  status: {
    type: String,
    enum: ['pending', 'registered'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Only enforce one sub-agent per store+user when userId is set (not for pending invites)
SubAgentSchema.index(
  { storeId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);
SubAgentSchema.index({ referralCode: 1 });
SubAgentSchema.index({ inviteCode: 1 });
SubAgentSchema.index({ storeSlug: 1 });
SubAgentSchema.index({ parentAgentId: 1 });

const SubAgent = mongoose.model('SubAgent', SubAgentSchema);

// Drop the old problematic index if it exists (one-time migration)
SubAgent.collection.dropIndex('storeId_1_userId_1').catch(() => {
  // Index may not exist or already dropped — ignore
});

module.exports = SubAgent;
