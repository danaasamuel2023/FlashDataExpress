const mongoose = require('mongoose');

// A WAEC/BECE result checker bought by a customer and fulfilled via DataMart's
// /api/checkers reseller API. Stores the delivered serial number + PIN so the
// customer can view them anytime in their history.
const ResultCheckerPurchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  checkerType: { type: String, enum: ['WAEC', 'BECE'], required: true },
  phoneNumber: { type: String },
  // Delivered credentials (present once status === 'completed').
  serialNumber: { type: String },
  pin: { type: String },
  // What the customer paid us, and what DataMart charged us.
  price: { type: Number, required: true },
  costPrice: { type: Number, default: 0 },
  reference: { type: String, required: true, unique: true },
  datamartReference: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending', index: true },
  failureReason: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('ResultCheckerPurchase', ResultCheckerPurchaseSchema);
