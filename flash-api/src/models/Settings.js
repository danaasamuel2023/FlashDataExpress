const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'app_settings'
  },
  datamart: {
    apiUrl: { type: String, default: 'https://api.datamartgh.shop' },
    apiKey: { type: String, default: '' },
    isConnected: { type: Boolean, default: false },
    lastSyncedAt: Date
  },
  ghust: {
    apiUrl: { type: String, default: '' },
    apiKey: { type: String, default: '' },
    webhookSecret: { type: String, default: '' },
    isConnected: { type: Boolean, default: false },
    lastSyncedAt: Date
  },
  paystack: {
    secretKey: { type: String, default: '' },
    publicKey: { type: String, default: '' },
    feePercent: { type: Number, default: 1.95 }
  },
  pricing: {
    basePrices: { type: mongoose.Schema.Types.Mixed, default: {} },
    sellingPrices: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastFetchedAt: Date
  },
  referral: {
    enabled: { type: Boolean, default: true },
    commissionPercent: { type: Number, default: 2 },
    bonusDataMilestones: [{
      referralCount: Number,
      bonusGB: Number,
      bonusNetwork: String
    }]
  },
  withdrawal: {
    minimumAmount: { type: Number, default: 10 },
    feePercent: { type: Number, default: 1 },
    autoApproveBelow: { type: Number, default: 0 }
  },
  store: {
    minimumMarkup: { type: Number, default: 0 },
    maximumMarkup: { type: Number, default: 50 }
  },
  sms: {
    apiKey: { type: String, default: '' },
    senderId: { type: String, default: 'DataSwift' },
    enabled: { type: Boolean, default: true }
  },
  appName: { type: String, default: 'DataSwift' },
  supportPhone: String,
  supportEmail: String,
  maintenanceMode: { type: Boolean, default: false },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

// Singleton pattern: always return the one settings document
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findById('app_settings');
  if (!settings) {
    settings = await this.create({ _id: 'app_settings' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);
