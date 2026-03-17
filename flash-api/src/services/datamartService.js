const axios = require('axios');
const Settings = require('../models/Settings');

class DataMartService {
  async getClient() {
    const settings = await Settings.getSettings();
    if (!settings?.datamart?.apiUrl || !settings?.datamart?.apiKey) {
      throw new Error('DataMart API not configured');
    }
    return axios.create({
      baseURL: settings.datamart.apiUrl,
      headers: { 'X-API-Key': settings.datamart.apiKey },
      timeout: 30000,
    });
  }

  async testConnection() {
    try {
      const client = await this.getClient();
      const res = await client.get('/api/developer/data-packages');
      return { connected: true, packages: res.data?.data?.length || 0 };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  async getPackages(network) {
    const client = await this.getClient();
    const res = await client.get('/api/developer/data-packages', {
      params: network ? { network } : {},
    });

    const data = res.data?.data;
    if (!data) return [];

    // DataMart returns packages grouped by network: { YELLO: [...], TELECEL: [...] }
    // Flatten into a single array
    if (Array.isArray(data)) return data;

    const packages = [];
    for (const [net, pkgs] of Object.entries(data)) {
      if (Array.isArray(pkgs)) {
        for (const pkg of pkgs) {
          packages.push({
            network: pkg.network || net,
            capacity: parseFloat(pkg.capacity),
            price: parseFloat(pkg.price),
            inStock: pkg.inStock,
          });
        }
      }
    }
    return packages;
  }

  async purchaseData({ network, capacity, phoneNumber }) {
    const client = await this.getClient();
    const res = await client.post('/api/developer/purchase', {
      network,
      capacity,
      phoneNumber,
    });
    return res.data?.data;
  }

  async checkOrderStatus(reference) {
    const client = await this.getClient();
    const res = await client.get(`/api/developer/order-status/${reference}`);
    return res.data?.data;
  }
}

module.exports = new DataMartService();
