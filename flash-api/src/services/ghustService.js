const axios = require('axios');
const Settings = require('../models/Settings');

class GhustService {
  async getClient() {
    const settings = await Settings.getSettings();
    if (!settings?.ghust?.apiUrl || !settings?.ghust?.apiKey) {
      throw new Error('Ghust API not configured');
    }
    return axios.create({
      baseURL: settings.ghust.apiUrl,
      headers: {
        'Authorization': `Bearer ${settings.ghust.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection() {
    try {
      const client = await this.getClient();
      const res = await client.get('/api/packages');
      return { connected: true, packages: res.data?.data?.length || 0 };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  async getPackages(network) {
    const client = await this.getClient();
    const res = await client.get('/api/packages', {
      params: network ? { network } : {},
    });
    return res.data?.data || [];
  }

  async purchaseData({ network, capacity, phoneNumber, callbackUrl }) {
    const client = await this.getClient();
    const res = await client.post('/api/purchase', {
      network,
      capacity,
      phoneNumber,
      callbackUrl,
    });
    return res.data?.data;
  }

  async checkOrderStatus(reference) {
    const client = await this.getClient();
    const res = await client.get(`/api/order-status/${reference}`);
    return res.data?.data;
  }
}

module.exports = new GhustService();
