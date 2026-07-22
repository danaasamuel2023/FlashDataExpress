const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  storeName: {
    type: String,
    required: true,
    maxlength: 50,
    trim: true
  },
  storeSlug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 200
  },
  isActive: {
    type: Boolean,
    default: true
  },
  theme: {
    primaryColor: { type: String, default: '#FF6B00' },
    logoUrl: String,
    bannerText: String
  },
  contactPhone: String,
  contactWhatsapp: String,
  subAgentInviteCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true,
  },
  // WAEC/BECE result checkers the agent resells on their shop. enabled + the
  // customer price they set for each type. Cost basis is Settings.resultChecker
  // agent price; profit = price - agent cost, credited on delivery.
  checkerPricing: {
    enabled: { type: Boolean, default: false },
    waecPrice: { type: Number, default: 0 },
    becePrice: { type: Number, default: 0 },
  },
  totalEarnings: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },
  // Audit trail for admin-issued manual profit credits (e.g. a delivered order
  // whose profit wasn't auto-credited). Each entry adds to totalEarnings + pendingBalance.
  manualCredits: [{
    amount: Number,
    reason: String,
    creditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
  momoDetails: {
    number: String,
    network: { type: String, enum: ['MTN', 'Telecel', 'AirtelTigo', 'mtn', 'telecel', 'airteltigo'] },
    name: String
  }
}, {
  timestamps: true
});

StoreSchema.index({ agentId: 1 });
StoreSchema.index({ storeSlug: 1 });

module.exports = mongoose.model('Store', StoreSchema);
