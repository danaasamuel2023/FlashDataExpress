const axios = require('axios');
const Settings = require('../models/Settings');
const { decrypt } = require('../utils/encryption');

// Paystack mobile-money bank codes for Ghana
const GH_MOMO_BANK_CODES = {
  MTN: 'MTN',
  mtn: 'MTN',
  TELECEL: 'VOD',
  Telecel: 'VOD',
  telecel: 'VOD',
  VODAFONE: 'VOD',
  Vodafone: 'VOD',
  vodafone: 'VOD',
  AIRTELTIGO: 'ATL',
  AirtelTigo: 'ATL',
  airteltigo: 'ATL',
};

function resolveMomoBankCode(network) {
  if (!network) return null;
  return GH_MOMO_BANK_CODES[network] || GH_MOMO_BANK_CODES[String(network).toLowerCase()] || null;
}

class PaystackService {
  async getClient() {
    const settings = await Settings.getSettings();
    if (!settings?.paystack?.secretKey) {
      throw new Error('Paystack not configured');
    }
    return axios.create({
      baseURL: 'https://api.paystack.co',
      headers: { Authorization: `Bearer ${settings.paystack.secretKey}` },
      timeout: 30000,
    });
  }

  // Separate client scoped to the admin-provided transfer/payout key.
  // Decrypts on each call so the plaintext never sits in memory longer
  // than the single request.
  async getTransferClient() {
    const settings = await Settings.getSettings();
    const encrypted = settings?.paystack?.transferKey;
    if (!encrypted) {
      const err = new Error('Paystack transfer key not configured');
      err.code = 'TRANSFER_KEY_MISSING';
      throw err;
    }
    let key;
    try {
      key = decrypt(encrypted);
    } catch (e) {
      const err = new Error('Paystack transfer key could not be decrypted');
      err.code = 'TRANSFER_KEY_DECRYPT_FAILED';
      throw err;
    }
    if (!key) {
      const err = new Error('Paystack transfer key is empty');
      err.code = 'TRANSFER_KEY_MISSING';
      throw err;
    }
    return axios.create({
      baseURL: 'https://api.paystack.co',
      headers: { Authorization: `Bearer ${key}` },
      timeout: 30000,
    });
  }

  async initializeTransaction({ email, amount, reference, metadata, callback_url }) {
    const client = await this.getClient();
    const res = await client.post('/transaction/initialize', {
      email,
      amount: Math.round(amount * 100), // Paystack uses pesewas
      reference,
      metadata,
      callback_url,
      channels: ['mobile_money', 'card'],
      currency: 'GHS',
    });
    return res.data?.data;
  }

  async verifyTransaction(reference) {
    const client = await this.getClient();
    const res = await client.get(`/transaction/verify/${reference}`);
    return res.data?.data;
  }

  // Create a Paystack transfer recipient for Ghana mobile money.
  async createMomoRecipient({ name, accountNumber, network }) {
    const client = await this.getTransferClient();
    const bankCode = resolveMomoBankCode(network);
    if (!bankCode) {
      const err = new Error(`Unsupported MoMo network: ${network}`);
      err.code = 'UNSUPPORTED_NETWORK';
      throw err;
    }
    const res = await client.post('/transferrecipient', {
      type: 'mobile_money',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'GHS',
    });
    return res.data?.data; // { recipient_code, ... }
  }

  // Initiate a Paystack transfer to a previously-created recipient.
  // Returns { transfer_code, reference, status } — status may be 'success',
  // 'pending', or 'otp' (OTP finalisation not implemented yet).
  async initiateTransfer({ amountGHS, recipientCode, reason, reference }) {
    const client = await this.getTransferClient();
    const res = await client.post('/transfer', {
      source: 'balance',
      amount: Math.round(amountGHS * 100),
      recipient: recipientCode,
      reason: reason || 'Withdrawal',
      reference,
      currency: 'GHS',
    });
    return res.data?.data;
  }

  // Fetch a transfer's current state from Paystack. Accepts either the
  // numeric id, the transfer_code, or the withdrawal reference.
  async fetchTransfer(idOrCodeOrRef) {
    const client = await this.getTransferClient();
    const res = await client.get(`/transfer/${encodeURIComponent(idOrCodeOrRef)}`);
    return res.data?.data;
  }

  // One-shot helper: recipient + transfer. Returns the transfer record.
  async payoutToMomo({ name, accountNumber, network, amountGHS, reference, reason }) {
    const recipient = await this.createMomoRecipient({ name, accountNumber, network });
    const transfer = await this.initiateTransfer({
      amountGHS,
      recipientCode: recipient.recipient_code,
      reason,
      reference,
    });
    return { recipient, transfer };
  }
}

module.exports = new PaystackService();
module.exports.GH_MOMO_BANK_CODES = GH_MOMO_BANK_CODES;
module.exports.resolveMomoBankCode = resolveMomoBankCode;
