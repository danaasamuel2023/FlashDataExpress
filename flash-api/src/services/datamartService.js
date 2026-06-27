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
      capacity: String(capacity),
      phoneNumber,
      gateway: 'wallet',
    });
    return res.data?.data;
  }

  async checkOrderStatus(reference) {
    const client = await this.getClient();
    const res = await client.get(`/api/developer/order-status/${reference}`);
    const data = res.data?.data;
    if (data) {
      // DataMart returns 'orderStatus', normalize to 'status' for internal use
      data.status = data.orderStatus || data.status;
    }
    return data;
  }

  // ── Result checkers (WAEC / BECE) — DataMart /api/checkers, same reseller key ──

  // Available checker products with upstream stock counts.
  async getResultCheckers() {
    const client = await this.getClient();
    const res = await client.get('/api/checkers/products');
    return res.data?.data || [];
  }

  // Buy one checker. `ref` is our own reference so the two systems share an id.
  // skipSms: true — we deliver the serial/PIN on-screen and in history ourselves.
  async purchaseResultChecker({ checkerType, phoneNumber, ref }) {
    const client = await this.getClient();
    const res = await client.post('/api/checkers/purchase', {
      checkerType,
      phoneNumber,
      ref,
      skipSms: true,
    });
    return res.data?.data;
  }

  async checkResultCheckerStatus(reference) {
    const client = await this.getClient();
    const res = await client.get(`/api/checkers/order-status/${reference}`);
    return res.data?.data;
  }

  // Live state of DataMart's delivery scanner pipeline. We authenticate with
  // our single reseller key, so the upstream `yourOrders` field reflects ALL
  // FlashData orders in the batch (other customers included) — the caller is
  // responsible for stripping it before returning to an end user.
  async getDeliveryTracker() {
    const client = await this.getClient();
    const res = await client.get('/api/developer/delivery-tracker');
    return res.data?.data;
  }
}

module.exports = new DataMartService();
