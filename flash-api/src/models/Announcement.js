const mongoose = require('mongoose');

// Admin-posted updates that agents and/or sub-agents can read and copy to
// forward to their own customers / sub-agents (e.g. when the admin announces
// something on the WhatsApp channel).
const AnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  // The body agents copy-paste. Plain text (newlines preserved).
  message: { type: String, required: true },
  // Who should see this board entry.
  audience: { type: String, enum: ['agents', 'subagents', 'all'], default: 'all' },
  isActive: { type: Boolean, default: true },
  // Pinned announcements sort to the top regardless of date.
  pinned: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

AnnouncementSchema.index({ isActive: 1, audience: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
