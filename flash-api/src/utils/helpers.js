const crypto = require('crypto');

const generateReference = (prefix = 'DS') => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

const formatPhone = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('233')) cleaned = '0' + cleaned.substring(3);
  if (cleaned.startsWith('+233')) cleaned = '0' + cleaned.substring(4);
  if (!cleaned.startsWith('0') && cleaned.length === 9) cleaned = '0' + cleaned;
  return cleaned;
};

const validateGhanaPhone = (phone) => {
  const cleaned = formatPhone(phone);
  return /^0[2-5][0-9]{8}$/.test(cleaned);
};

const getNetworkFromPhone = (phone) => {
  const cleaned = formatPhone(phone);
  const prefix = cleaned.substring(0, 3);
  const mtnPrefixes = ['024', '054', '055', '059', '025', '053'];
  const telecelPrefixes = ['020', '050'];
  const atPrefixes = ['026', '056', '027', '057', '023'];

  if (mtnPrefixes.includes(prefix)) return 'YELLO';
  if (telecelPrefixes.includes(prefix)) return 'TELECEL';
  if (atPrefixes.includes(prefix)) return 'AT_PREMIUM';
  return null;
};

module.exports = { generateReference, formatPhone, validateGhanaPhone, getNetworkFromPhone };
