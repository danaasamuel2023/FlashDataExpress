'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const NETWORKS = [
  { id: 'YELLO', label: 'MTN', color: 'bg-yellow-500' },
  { id: 'TELECEL', label: 'Telecel', color: 'bg-red-500' },
  { id: 'AT_PREMIUM', label: 'AirtelTigo', color: 'bg-blue-500' },
];

export default function SubAgentProductsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [activeNetwork, setActiveNetwork] = useState('YELLO');

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (!token) {
      router.push('/subagent/login');
      return;
    }
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/subagent/my-products');
      setProducts(res.data.data || []);
      // Set active network to first with products
      const nets = res.data.data.map(p => p.network);
      if (nets.length > 0 && !nets.includes(activeNetwork)) {
        setActiveNetwork(nets[0]);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/subagent/login');
      } else {
        toast.error('Failed to load products');
      }
    } finally {
      setLoading(false);
    }
  };

  const networkProducts = products.filter(p => p.network === activeNetwork).sort((a, b) => a.capacity - b.capacity);
  const availableNetworks = NETWORKS.filter(n => products.some(p => p.network === n.id));

  const handlePriceChange = (productId, newPrice) => {
    setProducts(prev =>
      prev.map(p => p._id === productId ? { ...p, sellingPrice: Number(newPrice) || 0 } : p)
    );
  };

  const handleToggle = (productId) => {
    setProducts(prev =>
      prev.map(p => p._id === productId ? { ...p, isActive: !p.isActive } : p)
    );
  };

  const handleSave = async () => {
    // Validate: no selling price below base price
    const invalid = products.find(p => p.sellingPrice < p.basePrice);
    if (invalid) {
      toast.error(`Selling price cannot be below your cost price (${formatCurrency(invalid.basePrice)}) for ${invalid.capacity}GB`);
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/subagent/my-products', {
        products: products.map(p => ({
          network: p.network,
          capacity: p.capacity,
          basePrice: p.basePrice,
          sellingPrice: p.sellingPrice,
          isActive: p.isActive,
        })),
      });
      setProducts(res.data.data);
      toast.success('Prices saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/subagent/dashboard" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-lg font-extrabold text-white">My Products</h1>
              <p className="text-xs text-gray-500">Set your selling prices. Your cost is shown for reference.</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Network tabs */}
        {availableNetworks.length > 0 && (
          <div className="flex gap-2">
            {availableNetworks.map(net => (
              <button
                key={net.id}
                onClick={() => setActiveNetwork(net.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  activeNetwork === net.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {net.label}
              </button>
            ))}
          </div>
        )}

        {/* Products table */}
        {networkProducts.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No products for this network yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-3 px-4 text-xs text-gray-500 font-medium">
              <div className="col-span-2">Bundle</div>
              <div className="col-span-3">Your Cost</div>
              <div className="col-span-3">Selling Price</div>
              <div className="col-span-2">Profit</div>
              <div className="col-span-2 text-right">Active</div>
            </div>

            {networkProducts.map(product => {
              const profit = (product.sellingPrice - product.basePrice).toFixed(2);
              const profitColor = profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-gray-500';

              return (
                <div
                  key={product._id}
                  className={`bg-gray-900 border rounded-xl p-4 grid grid-cols-12 gap-3 items-center ${
                    product.isActive ? 'border-gray-800' : 'border-gray-800/50 opacity-60'
                  }`}
                >
                  <div className="col-span-2">
                    <p className="text-white font-bold text-sm">{product.capacity}GB</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-gray-400 text-sm">{formatCurrency(product.basePrice)}</p>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      min={product.basePrice}
                      value={product.sellingPrice}
                      onChange={e => handlePriceChange(product._id, e.target.value)}
                      className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <p className={`text-sm font-medium ${profitColor}`}>
                      {formatCurrency(Math.max(0, profit))}
                    </p>
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      onClick={() => handleToggle(product._id)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        product.isActive ? 'bg-green-500' : 'bg-gray-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          product.isActive ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-600 text-center">
          Your cost is set by your parent agent. You earn the difference between your selling price and your cost.
        </p>
      </div>
    </div>
  );
}
