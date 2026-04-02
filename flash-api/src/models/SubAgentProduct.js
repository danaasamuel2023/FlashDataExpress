const mongoose = require('mongoose');

const SubAgentProductSchema = new mongoose.Schema({
  subAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubAgent',
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

SubAgentProductSchema.index({ subAgentId: 1, network: 1, capacity: 1 }, { unique: true });

module.exports = mongoose.model('SubAgentProduct', SubAgentProductSchema);
