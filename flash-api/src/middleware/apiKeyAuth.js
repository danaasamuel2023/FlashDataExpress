const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

// Authenticates public /api/v1 requests via a developer API key supplied in
// the `x-api-key` header (or `Authorization: Bearer <key>`). The key must be
// admin-approved (status 'active'). Attaches req.user and req.apiKey.
const apiKeyAuth = async (req, res, next) => {
  try {
    const headerKey = req.header('x-api-key')
      || req.header('Authorization')?.replace('Bearer ', '').trim();

    if (!headerKey) {
      return res.status(401).json({ status: 'error', message: 'API key required. Send it in the x-api-key header.' });
    }

    const keyDoc = await ApiKey.findOne({ keyHash: hashKey(headerKey) });
    if (!keyDoc) {
      return res.status(401).json({ status: 'error', message: 'Invalid API key' });
    }
    if (keyDoc.status === 'pending') {
      return res.status(403).json({ status: 'error', message: 'This API key is awaiting admin approval.' });
    }
    if (keyDoc.status !== 'active') {
      return res.status(403).json({ status: 'error', message: 'This API key has been revoked.' });
    }

    const user = await User.findById(keyDoc.userId);
    if (!user || !user.isActive) {
      return res.status(403).json({ status: 'error', message: 'Account is inactive.' });
    }

    // Throttled last-used stamp — avoids a write on every call.
    const now = Date.now();
    if (!keyDoc.lastUsedAt || now - new Date(keyDoc.lastUsedAt).getTime() > 60000) {
      ApiKey.updateOne({ _id: keyDoc._id }, { lastUsedAt: new Date() }).catch(() => {});
    }

    req.user = user;
    req.apiKey = keyDoc;
    next();
  } catch (err) {
    console.error('API key auth error:', err.message);
    res.status(401).json({ status: 'error', message: 'Invalid API key' });
  }
};

module.exports = apiKeyAuth;
module.exports.hashKey = hashKey;
