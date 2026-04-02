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
  status: {
    type: String,
    enum: ['pending', 'registered'],
    default: 'pending'
  }
}, {
  timestamps: true,
  autoIndex: false
});

SubAgentSchema.index({ referralCode: 1 });
SubAgentSchema.index({ inviteCode: 1 });
SubAgentSchema.index({ storeSlug: 1 });
SubAgentSchema.index({ parentAgentId: 1 });

const SubAgent = mongoose.model('SubAgent', SubAgentSchema);

// Fix indexes: drop old problematic compound index and sync
mongoose.connection.on('connected', async () => {
  try {
    // Drop old compound unique index that blocks pending invites
    try {
      await SubAgent.collection.dropIndex('storeId_1_userId_1');
      console.log('Dropped old storeId_1_userId_1 index');
    } catch (e) {
      // Already dropped or doesn't exist
    }
    // Ensure current schema indexes exist
    await SubAgent.ensureIndexes();
  } catch (e) {
    console.error('SubAgent index sync error:', e.message);
  }
});

module.exports = SubAgent;
