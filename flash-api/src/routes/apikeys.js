const router = require('express').Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const ApiKey = require('../models/ApiKey');
const { hashKey } = require('../middleware/apiKeyAuth');

// Public view of a key — never includes the secret.
const publicKey = (k) => ({
  id: k._id,
  name: k.name,
  keyPrefix: k.keyPrefix,
  status: k.status,
  lastUsedAt: k.lastUsedAt || null,
  createdAt: k.createdAt,
});

// GET /api/api-keys — list the signed-in user's API keys
router.get('/', auth, async (req, res) => {
  try {
    const keys = await ApiKey.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ status: 'success', data: keys.map(publicKey) });
  } catch (err) {
    console.error('API keys list error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/api-keys — generate a new key (starts as pending admin approval).
// Returns the full key ONCE; only its hash is stored.
router.post('/', auth, async (req, res) => {
  try {
    const existing = await ApiKey.countDocuments({ userId: req.user._id, status: { $ne: 'revoked' } });
    if (existing >= 5) {
      return res.status(400).json({ status: 'error', message: 'You already have the maximum number of API keys. Revoke one first.' });
    }

    const raw = crypto.randomBytes(24).toString('hex'); // 48 hex chars
    const fullKey = `fdx_${raw}`;
    const keyPrefix = `fdx_${raw.slice(0, 6)}`;

    const keyDoc = await ApiKey.create({
      userId: req.user._id,
      name: (req.body?.name || 'API key').toString().trim().slice(0, 60) || 'API key',
      keyHash: hashKey(fullKey),
      keyPrefix,
      status: 'pending',
    });

    res.status(201).json({
      status: 'success',
      message: 'API key created. It will work once an admin approves it.',
      data: {
        ...publicKey(keyDoc),
        // Shown only this once — store it securely.
        key: fullKey,
      },
    });
  } catch (err) {
    console.error('API key create error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

// DELETE /api/api-keys/:id — revoke one of the user's keys
router.delete('/:id', auth, async (req, res) => {
  try {
    const keyDoc = await ApiKey.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: 'revoked' },
      { new: true }
    );
    if (!keyDoc) {
      return res.status(404).json({ status: 'error', message: 'API key not found' });
    }
    res.json({ status: 'success', message: 'API key revoked' });
  } catch (err) {
    console.error('API key revoke error:', err.message);
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
