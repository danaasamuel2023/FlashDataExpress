const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },
  reference: {
    type: String,
    required: true,
    unique: true
  },
  momoDetails: {
    number: { type: String, required: true },
    network: { type: String, required: true },
    name: { type: String, required: true }
  },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date,
  rejectionReason: String
}, {
  timestamps: true
});

WithdrawalSchema.index({ userId: 1, createdAt: -1 });
WithdrawalSchema.index({ storeId: 1 });
WithdrawalSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
