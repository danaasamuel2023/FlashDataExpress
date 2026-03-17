const axios = require('axios');
const Settings = require('../models/Settings');

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
}

module.exports = new PaystackService();
