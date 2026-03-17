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
  totalEarnings: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },
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
