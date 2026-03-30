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
    required: true
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  commissionPercent: {
    type: Number,
    required: true,
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
  }
}, {
  timestamps: true
});

SubAgentSchema.index({ storeId: 1, userId: 1 }, { unique: true });
SubAgentSchema.index({ referralCode: 1 });
SubAgentSchema.index({ parentAgentId: 1 });

module.exports = mongoose.model('SubAgent', SubAgentSchema);
