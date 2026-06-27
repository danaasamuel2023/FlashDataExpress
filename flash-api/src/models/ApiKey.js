const mongoose = require('mongoose');

// Developer API keys. Users generate a key from the portal; an admin must
// approve it (status 'active') before it can authenticate requests to /api/v1.
// Only the SHA-256 hash of the key is stored — the plaintext is shown once.
const ApiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, trim: true, default: 'API key' },
  // SHA-256 hex of the full key. Lookups hash the incoming key and match here.
  keyHash: { type: String, required: true, unique: true },
  // First chars of the key for display, e.g. "fdx_a1b2c3" — never the secret.
  keyPrefix: { type: String, required: true },
  // pending → awaiting admin approval; active → usable; revoked → disabled.
  status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending', index: true },
  lastUsedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('ApiKey', ApiKeySchema);
