const mongoose = require('mongoose');

// A WAEC/BECE result checker bought by a customer and fulfilled via DataMart's
// /api/checkers reseller API. Stores the delivered serial number + PIN so the
// customer can view them anytime in their history.
const ResultCheckerPurchaseSchema = new mongoose.Schema({
  // Absent for anonymous storefront (agent/sub-agent shop) buyers.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  checkerType: { type: String, enum: ['WAEC', 'BECE'], required: true },
  phoneNumber: { type: String },
  // Delivered credentials (present once status === 'completed').
  serialNumber: { type: String },
  pin: { type: String },
  // What the customer paid us, and what DataMart charged us.
  price: { type: Number, required: true },
  costPrice: { type: Number, default: 0 },
  reference: { type: String, required: true, unique: true },
  // Groups the units bought together in one bulk order (absent for single buys).
  batchReference: { type: String, index: true },
  datamartReference: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending', index: true },
  failureReason: { type: String },
  // Where the sale came from. 'direct' = main dashboard wallet buy; 'store' =
  // agent shop; 'subshop' = sub-agent shop. Store/sub-shop sales carry the profit
  // split so it can be credited to the seller's pending balance on delivery.
  purchaseSource: { type: String, enum: ['direct', 'store', 'subshop'], default: 'direct', index: true },
  storeDetails: {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    storeName: String,
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agentProfit: Number,
    subAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubAgent' },
    subAgentProfit: Number,
    profitCredited: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('ResultCheckerPurchase', ResultCheckerPurchaseSchema);
