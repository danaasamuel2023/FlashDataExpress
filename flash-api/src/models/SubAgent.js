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

// referralCode, inviteCode, storeSlug indexes are created by schema-level unique+sparse
// Only add indexes not already defined on fields
SubAgentSchema.index({ parentAgentId: 1 });

const SubAgent = mongoose.model('SubAgent', SubAgentSchema);

// Fix indexes: drop ALL old indexes and recreate from schema
mongoose.connection.on('connected', async () => {
  try {
    // Drop all old conflicting indexes one by one
    const toDrop = [
      'storeId_1_userId_1',
      'referralCode_1',
      'inviteCode_1',
      'storeSlug_1',
    ];
    for (const name of toDrop) {
      try {
        await SubAgent.collection.dropIndex(name);
        console.log(`Dropped old SubAgent index: ${name}`);
      } catch (e) {
        // Doesn't exist — fine
      }
    }
    // Now recreate indexes from schema
    await SubAgent.createIndexes();
    console.log('SubAgent indexes synced successfully');
  } catch (e) {
    console.error('SubAgent index sync error:', e.message);
  }
});

module.exports = SubAgent;
