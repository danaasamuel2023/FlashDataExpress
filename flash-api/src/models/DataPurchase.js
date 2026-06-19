const mongoose = require('mongoose');

const DataPurchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  phoneNumber: {
    type: String,
    required: true
  },
  network: {
    type: String,
    enum: ['YELLO', 'TELECEL', 'AT_PREMIUM'],
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  costPrice: {
    type: Number,
    default: 0
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  provider: {
    type: String,
    enum: ['datamart', 'ghust'],
    default: 'datamart'
  },
  datamartReference: String,
  datamartOrderId: String,
  // Upstream tracking id DataMart sends on its order webhook
  // (exportTracking.portalOrderId || apiOrderId) — shown to the customer.
  trackingId: String,
  // Human-readable delivery line, e.g. "Submitted to the Yello server on …".
  deliveryInfo: String,
  ghustReference: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  purchaseSource: {
    type: String,
    enum: ['direct', 'store', 'guest'],
    default: 'direct'
  },
  guestEmail: String,
  guestPhone: String,
  storeDetails: {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    storeName: String,
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sellingPrice: Number,
    agentProfit: Number,
    customerName: String,
    customerPhone: String,
    subAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubAgent' },
    subAgentProfit: Number,
    profitCredited: { type: Boolean, default: false }
  },
  balanceBefore: Number,
  balanceAfter: Number,
  failureReason: String,
  completedAt: Date,
  refundedAt: Date
}, {
  timestamps: true
});

DataPurchaseSchema.index({ userId: 1, createdAt: -1 });
DataPurchaseSchema.index({ reference: 1 });
DataPurchaseSchema.index({ datamartReference: 1 });
DataPurchaseSchema.index({ ghustReference: 1 });
DataPurchaseSchema.index({ status: 1 });
// Backs the delivery tracker's "latest delivered system-wide" lookup —
// narrow to completed + sort by placed time without an in-memory sort.
DataPurchaseSchema.index({ status: 1, createdAt: -1 });
DataPurchaseSchema.index({ 'storeDetails.storeId': 1, createdAt: -1 });

module.exports = mongoose.model('DataPurchase', DataPurchaseSchema);
