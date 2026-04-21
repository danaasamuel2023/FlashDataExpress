const crypto = require('crypto');

// AES-256-GCM encryption for sensitive secrets stored in the database.
// The key is derived from ENCRYPTION_KEY (preferred) or JWT_SECRET. Losing
// that env var makes existing ciphertexts unrecoverable — set ENCRYPTION_KEY
// in production and never change it.

const CIPHER = 'aes-256-gcm';
const PREFIX = 'v1';

function getKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing ENCRYPTION_KEY (or JWT_SECRET) env var for encryption');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`) && value.split(':').length === 4;
}

function encrypt(plain) {
  if (plain == null || plain === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER, getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

function decrypt(value) {
  if (!value) return '';
  if (!isEncrypted(value)) return value; // legacy plaintext fallback
  try {
    const [, ivB64, tagB64, ctB64] = value.split(':');
    const decipher = crypto.createDecipheriv(CIPHER, getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
    return pt.toString('utf8');
  } catch (err) {
    throw new Error('Failed to decrypt stored secret: ' + err.message);
  }
}

function mask(storedValue) {
  if (!storedValue) return '';
  let plain;
  try { plain = decrypt(storedValue); } catch { return '••••••••'; }
  if (!plain) return '';
  if (plain.length <= 8) return '••••••••';
  return plain.slice(0, 5) + '••••' + plain.slice(-4);
}

function isConfigured(storedValue) {
  if (!storedValue) return false;
  try { return !!decrypt(storedValue); } catch { return false; }
}

module.exports = { encrypt, decrypt, mask, isConfigured, isEncrypted };
