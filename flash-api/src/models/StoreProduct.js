const mongoose = require('mongoose');

const StoreProductSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
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
  basePrice: {
    type: Number,
    required: true
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

StoreProductSchema.index({ storeId: 1, network: 1, capacity: 1 }, { unique: true });

module.exports = mongoose.model('StoreProduct', StoreProductSchema);
