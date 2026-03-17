'use client';
import { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import NetworkIcon from '@/components/shared/NetworkIcon';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const NETWORKS = [
  { id: 'YELLO', label: 'MTN' },
  { id: 'TELECEL', label: 'Telecel' },
  { id: 'AT_PREMIUM', label: 'AirtelTigo' },
];

export default function AdminPricingPage() {
  const [pricing, setPricing] = useState({ basePrices: {}, sellingPrices: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingGhust, setSyncingGhust] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('YELLO');
  const [newCapacity, setNewCapacity] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newSellingPrice, setNewSellingPrice] = useState('');

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const res = await api.get('/admin/pricing');
      setPricing(res.data.data || { basePrices: {}, sellingPrices: {} });
    } catch {
      toast.error('Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/admin/pricing/sync');
      toast.success('Prices synced from DataMart');
      fetchPricing();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncGhust = async () => {
    setSyncingGhust(true);
    try {
      await api.post('/admin/pricing/sync-ghust');
      toast.success('Prices synced from Ghust');
      fetchPricing();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Ghust sync failed');
    } finally {
      setSyncingGhust(false);
    }
  };

  const handlePriceChange = (network, capacity, value) => {
    setPricing(prev => ({
      ...prev,
      sellingPrices: {
        ...prev.sellingPrices,
        [network]: {
          ...prev.sellingPrices[network],
          [capacity]: parseFloat(value) || 0,
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/pricing', { sellingPrices: pricing.sellingPrices, basePrices: pricing.basePrices });
      toast.success('Pricing saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const handleAddBundle = () => {
    if (!newCapacity || !newSellingPrice) {
      toast.error('Enter capacity and selling price');
      return;
    }
    const cap = newCapacity;
    setPricing(prev => ({
      ...prev,
      basePrices: {
        ...prev.basePrices,
        [selectedNetwork]: {
          ...prev.basePrices[selectedNetwork],
          [cap]: parseFloat(newCostPrice) || 0,
        },
      },
      sellingPrices: {
        ...prev.sellingPrices,
        [selectedNetwork]: {
          ...prev.sellingPrices[selectedNetwork],
          [cap]: parseFloat(newSellingPrice) || 0,
        },
      },
    }));
    setNewCapacity('');
    setNewCostPrice('');
    setNewSellingPrice('');
    toast.success(`${cap}GB bundle added. Click Save to apply.`);
  };

  const handleDeleteBundle = (capacity) => {
    setPricing(prev => {
      const newBase = { ...prev.basePrices[selectedNetwork] };
      const newSelling = { ...prev.sellingPrices[selectedNetwork] };
      delete newBase[capacity];
      delete newSelling[capacity];
      return {
        ...prev,
        basePrices: { ...prev.basePrices, [selectedNetwork]: newBase },
        sellingPrices: { ...prev.sellingPrices, [selectedNetwork]: newSelling },
      };
    });
    toast.success(`${capacity}GB bundle removed. Click Save to apply.`);
  };

  const basePrices = pricing.basePrices[selectedNetwork] || {};
  const sellingPrices = pricing.sellingPrices[selectedNetwork] || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Pricing</h1>
          <p className="text-text-muted text-sm mt-1">Set selling prices for data bundles.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={syncingGhust} onClick={handleSyncGhust}>
            <RefreshCw className="w-4 h-4" /> Sync from Ghust
          </Button>
          <Button variant="outline" size="sm" loading={syncing} onClick={handleSync}>
            <RefreshCw className="w-4 h-4" /> Sync from DataMart
          </Button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </div>

      {/* Network tabs */}
      <div className="flex gap-2">
        {NETWORKS.map(net => (
          <button
            key={net.id}
            onClick={() => setSelectedNetwork(net.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              selectedNetwork === net.id
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
            }`}
          >
            <NetworkIcon network={net.id} size={20} />
            {net.label}
          </button>
        ))}
      </div>

      {/* Pricing table */}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Bundle</th>
                <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Cost Price</th>
                <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Selling Price</th>
                <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Margin</th>
                <th className="text-left text-xs font-semibold text-text-muted px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries({ ...basePrices, ...sellingPrices }).map(([capacity]) => {
                const cost = basePrices[capacity] || 0;
                const selling = sellingPrices[capacity] || 0;
                const margin = selling - cost;
                return (
                  <tr key={capacity} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3 font-bold text-sm text-white">{capacity}GB</td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={cost || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPricing(prev => ({
                            ...prev,
                            basePrices: {
                              ...prev.basePrices,
                              [selectedNetwork]: {
                                ...prev.basePrices[selectedNetwork],
                                [capacity]: val,
                              },
                            },
                          }));
                        }}
                        className="w-24 px-3 py-1.5 rounded-lg border border-white/10 text-sm font-semibold text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={selling || ''}
                        onChange={(e) => handlePriceChange(selectedNetwork, capacity, e.target.value)}
                        className="w-24 px-3 py-1.5 rounded-lg border border-white/10 text-sm font-semibold text-text focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-sm font-bold ${margin > 0 ? 'text-success' : margin < 0 ? 'text-error' : 'text-text-muted'}`}>
                        {margin > 0 ? '+' : ''}{formatCurrency(margin)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleDeleteBundle(capacity)} className="text-error/60 hover:text-error transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {Object.keys(basePrices).length === 0 && Object.keys(sellingPrices).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-muted text-sm">
                    No prices found. Add bundles manually or sync from a provider.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Add new bundle */}
      <Card>
        <h3 className="font-bold text-white text-sm mb-3">
          <Plus className="w-4 h-4 inline mr-1" />
          Add Bundle for {NETWORKS.find(n => n.id === selectedNetwork)?.label}
        </h3>
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs font-semibold text-text-muted block mb-1">Capacity (GB)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              placeholder="e.g. 1"
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              className="w-24 px-3 py-1.5 rounded-lg border border-white/10 text-sm font-semibold text-text focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted block mb-1">Cost Price (GH&#8373;)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={newCostPrice}
              onChange={(e) => setNewCostPrice(e.target.value)}
              className="w-28 px-3 py-1.5 rounded-lg border border-white/10 text-sm font-semibold text-text focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted block mb-1">Selling Price (GH&#8373;)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={newSellingPrice}
              onChange={(e) => setNewSellingPrice(e.target.value)}
              className="w-28 px-3 py-1.5 rounded-lg border border-white/10 text-sm font-semibold text-text focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
          </div>
          <Button size="sm" onClick={handleAddBundle}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
