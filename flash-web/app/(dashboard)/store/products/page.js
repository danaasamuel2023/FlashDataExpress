'use client';
import { useState, useEffect } from 'react';
import { ShoppingBag, Save, Loader2, AlertCircle } from 'lucide-react';
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

export default function StoreProductsPage() {
  const [products, setProducts] = useState([]);
  const [packages, setPackages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('YELLO');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, ...pkgResponses] = await Promise.all([
        api.get('/store/products'),
        ...NETWORKS.map(n => api.get(`/purchase/packages?network=${n.id}`)),
      ]);
      setProducts(productsRes.data.data || []);
      const pkgs = {};
      NETWORKS.forEach((n, i) => {
        pkgs[n.id] = pkgResponses[i].data.data || [];
      });
      setPackages(pkgs);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getProductPrice = (network, capacity) => {
    const product = products.find(p => p.network === network && p.capacity === capacity);
    return product?.sellingPrice || '';
  };

  const handlePriceChange = (network, capacity, basePrice, value) => {
    const price = parseFloat(value);
    setProducts(prev => {
      const existing = prev.find(p => p.network === network && p.capacity === capacity);
      if (existing) {
        return prev.map(p =>
          p.network === network && p.capacity === capacity
            ? { ...p, sellingPrice: price || '' }
            : p
        );
      }
      return [...prev, { network, capacity, basePrice, sellingPrice: price || '', isActive: true }];
    });
  };

  const handleSave = async () => {
    const toSave = products
      .filter(p => p.sellingPrice && p.sellingPrice > 0)
      .map(p => ({
        network: p.network,
        capacity: p.capacity,
        basePrice: p.basePrice,
        sellingPrice: p.sellingPrice,
        isActive: p.isActive !== false,
      }));

    setSaving(true);
    try {
      await api.put('/store/products', { products: toSave });
      toast.success('Products saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
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

  const networkPackages = packages[selectedNetwork] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Store Products</h1>
          <p className="text-text-muted text-sm mt-1">Set custom selling prices for your store.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>
          <Save className="w-4 h-4" /> Save
        </Button>
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
                : 'bg-surface-light text-text-muted hover:bg-white/5'
            }`}
          >
            <NetworkIcon network={net.id} size={20} />
            {net.label}
          </button>
        ))}
      </div>

      {/* Products table */}
      {networkPackages.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-text-muted text-sm">No packages available for this network.</p>
          </div>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Bundle</th>
                  <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Base Price</th>
                  <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Your Price</th>
                  <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Profit</th>
                </tr>
              </thead>
              <tbody>
                {networkPackages.map((pkg, i) => {
                  const sellingPrice = getProductPrice(selectedNetwork, pkg.capacity);
                  const profit = sellingPrice ? sellingPrice - pkg.price : 0;
                  return (
                    <tr key={i} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-bold text-sm text-white">{pkg.capacity}GB</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-text-muted">{formatCurrency(pkg.price)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={sellingPrice}
                          onChange={(e) => handlePriceChange(selectedNetwork, pkg.capacity, pkg.price, e.target.value)}
                          className="w-24 px-3 py-1.5 rounded-lg border border-white/10 bg-surface-light text-sm font-semibold text-white focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <p className={`text-sm font-bold ${profit > 0 ? 'text-success' : profit < 0 ? 'text-error' : 'text-text-muted'}`}>
                          {profit > 0 ? '+' : ''}{formatCurrency(profit)}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
