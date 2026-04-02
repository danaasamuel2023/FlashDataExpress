'use client';
import React, { useState, useEffect, use } from 'react';
import { ShoppingBag, Phone, Loader2, Check, Zap, AlertCircle, Shield, ChevronDown, Package, Clock, Wifi, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import NetworkIcon from '@/components/shared/NetworkIcon';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const NETWORKS = [
  { id: 'YELLO', label: 'MTN', gradient: 'from-yellow-400 to-yellow-600' },
  { id: 'TELECEL', label: 'Telecel', gradient: 'from-red-500 to-red-700' },
  { id: 'AT_PREMIUM', label: 'AirtelTigo', gradient: 'from-blue-500 to-blue-700' },
];

const getCardStyle = (network) => {
  if (network === 'YELLO') return { card: 'bg-yellow-400', text: 'text-black', sub: 'text-black/60', border: 'border-black/10', ring: 'ring-black/30', chevronBg: 'bg-black/10 hover:bg-black/20', btn: 'bg-yellow-500 hover:bg-yellow-600 text-black', expandBorder: 'border-yellow-300 dark:border-yellow-700', priceColor: 'text-yellow-600 dark:text-yellow-400' };
  if (network === 'TELECEL') return { card: 'bg-gradient-to-br from-red-600 to-red-700', text: 'text-white', sub: 'text-white/60', border: 'border-white/20', ring: 'ring-white/30', chevronBg: 'bg-white/10 hover:bg-white/20', btn: 'bg-red-800 hover:bg-red-900 text-white', expandBorder: 'border-red-300 dark:border-red-700', priceColor: 'text-red-600 dark:text-red-400' };
  if (network === 'AT_PREMIUM') return { card: 'bg-gradient-to-br from-purple-600 to-purple-700', text: 'text-white', sub: 'text-white/60', border: 'border-white/20', ring: 'ring-white/30', chevronBg: 'bg-white/10 hover:bg-white/20', btn: 'bg-purple-800 hover:bg-purple-900 text-white', expandBorder: 'border-purple-300 dark:border-purple-700', priceColor: 'text-purple-600 dark:text-purple-400' };
  return { card: 'bg-gray-600', text: 'text-white', sub: 'text-white/60', border: 'border-white/20', ring: 'ring-white/30', chevronBg: 'bg-white/10', btn: 'bg-gray-700 text-white', expandBorder: 'border-gray-600', priceColor: 'text-gray-400' };
};

const getNetworkName = (id) => NETWORKS.find(n => n.id === id)?.label || id;

export default function SubAgentShopPage({ params }) {
  const { slug } = use(params);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 640);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const cols = windowWidth >= 1280 ? 4 : windowWidth >= 1024 ? 3 : windowWidth >= 640 ? 2 : 1;

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored === 'dark' || (!stored && prefersDark);
    setIsDarkMode(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  useEffect(() => {
    fetchStore();
  }, [slug]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference') || params.get('trxref');
    if (ref && !paymentStatus) {
      setPaymentStatus('verifying');
      api.get(`/subshop/${slug}/verify-payment?reference=${ref}`)
        .then(() => setPaymentStatus('success'))
        .catch(() => setPaymentStatus('failed'));
      window.history.replaceState({}, '', `/subshop/${slug}`);
    }
  }, [slug]);

  useEffect(() => {
    setSelectedBundle(null);
    setPhoneNumber('');
  }, [selectedNetwork]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newMode);
  };

  const fetchStore = async () => {
    try {
      const [storeRes, productsRes] = await Promise.all([
        api.get(`/subshop/${slug}`),
        api.get(`/subshop/${slug}/products`),
      ]);
      setStore(storeRes.data.data);
      setProducts(productsRes.data.data || []);
      const availableNets = NETWORKS.filter(n => (productsRes.data.data || []).some(p => p.network === n.id));
      if (availableNets.length > 0) setSelectedNetwork(availableNets[0].id);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Store not found' : 'Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  const networkProducts = selectedNetwork ? products.filter(p => p.network === selectedNetwork) : [];

  const handleSelect = (pkg) => {
    if (selectedBundle?.capacity === pkg.capacity && selectedBundle?.sellingPrice === pkg.sellingPrice) {
      setSelectedBundle(null);
    } else {
      setSelectedBundle(pkg);
    }
  };

  const handleBuy = async () => {
    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid phone number');
      return;
    }
    if (!selectedBundle) return;
    setBuying(true);
    try {
      const res = await api.post(`/subshop/${slug}/buy`, {
        network: selectedNetwork,
        capacity: selectedBundle.capacity,
        phoneNumber: phoneNumber.trim(),
      });
      const { authorization_url } = res.data.data;
      window.location.href = authorization_url;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Purchase failed');
    } finally {
      setBuying(false);
    }
  };

  const formatPhone = (val) => {
    let num = val.replace(/\D/g, '');
    if (num.length > 0 && !num.startsWith('0')) num = '0' + num;
    return num.slice(0, 10);
  };

  const getExpansionPosition = () => {
    if (!selectedBundle) return -1;
    const idx = networkProducts.findIndex(p => p.capacity === selectedBundle.capacity && p.sellingPrice === selectedBundle.sellingPrice);
    if (idx === -1) return -1;
    return Math.floor(idx / cols) * cols + cols;
  };
  const expansionPos = getExpansionPosition();

  const primaryColor = store?.theme?.primaryColor || '#FF6B00';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: primaryColor }} />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading store...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{error}</h1>
          <p className="text-gray-400 text-sm mt-2">This store may no longer be available.</p>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verifying payment...</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Please wait while we confirm your purchase.</p>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Payment Successful!</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 mb-6">Your data bundle is being processed and will be delivered shortly.</p>
          <button
            onClick={() => setPaymentStatus(null)}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Payment Failed</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 mb-6">We couldn&apos;t verify your payment. If you were charged, please contact the store owner.</p>
          <button
            onClick={() => setPaymentStatus(null)}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-bold rounded-xl transition-colors"
          >
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  const style = selectedNetwork ? getCardStyle(selectedNetwork) : null;
  const availableNetworks = NETWORKS.filter(n => products.some(p => p.network === n.id));

  return (
    <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-b from-gray-50 via-white to-gray-50'}`}>
      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all"
      >
        {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
      </button>

      {/* Hero Section */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${adjustColor(primaryColor, -40)})` }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-3 justify-center sm:justify-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white fill-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold">{store?.storeName}</h1>
              </div>
              <p className="text-white/90 text-base sm:text-lg font-semibold">
                Buy Affordable Data Bundles
              </p>
              <p className="text-white/70 text-sm mt-1">Instant delivery &bull; Best prices &bull; All networks</p>
            </div>

            <div className="hidden sm:flex flex-col gap-3 bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg"><Zap className="w-4 h-4 text-yellow-300" /></div>
                <div>
                  <p className="font-bold text-sm">Fast Delivery</p>
                  <p className="text-xs text-white/70">Usually instant</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg"><Shield className="w-4 h-4 text-blue-300" /></div>
                <div>
                  <p className="font-bold text-sm">Secure Payment</p>
                  <p className="text-xs text-white/70">Paystack secured</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg"><Clock className="w-4 h-4 text-green-300" /></div>
                <div>
                  <p className="font-bold text-sm">24/7 Available</p>
                  <p className="text-xs text-white/70">Always open</p>
                </div>
              </div>
            </div>
          </div>

          <div className="sm:hidden mt-4 flex justify-around text-center">
            <div className="flex flex-col items-center"><Zap className="w-5 h-5 text-yellow-300 mb-1" /><span className="text-xs">Fast</span></div>
            <div className="flex flex-col items-center"><Shield className="w-5 h-5 text-blue-300 mb-1" /><span className="text-xs">Secure</span></div>
            <div className="flex flex-col items-center"><Clock className="w-5 h-5 text-green-300 mb-1" /><span className="text-xs">24/7</span></div>
            <div className="flex flex-col items-center"><Wifi className="w-5 h-5 text-purple-300 mb-1" /><span className="text-xs">All Networks</span></div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Network Selection Cards */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Choose Your Network</h2>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {availableNetworks.map(net => {
              const isActive = selectedNetwork === net.id;
              const netProducts = products.filter(p => p.network === net.id);
              return (
                <button
                  key={net.id}
                  onClick={() => setSelectedNetwork(net.id)}
                  className={`relative overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all hover:scale-105 ${
                    isActive ? 'ring-2 ring-offset-2 dark:ring-offset-gray-900' : ''
                  }`}
                  style={{ ringColor: isActive ? primaryColor : undefined }}
                >
                  <div className={`bg-gradient-to-br ${net.gradient} p-4 sm:p-5 text-white`}>
                    <div className="mb-2">
                      <NetworkIcon network={net.id} size={36} />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base">{net.label}</h3>
                    <p className="text-white/70 text-xs">{netProducts.length} bundles</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bundle Cards Grid */}
        {selectedNetwork && style && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              {getNetworkName(selectedNetwork)} Bundles
            </h2>

            {networkProducts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No bundles available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {networkProducts.map((pkg, index) => {
                  const isSelected = selectedBundle?.capacity === pkg.capacity && selectedBundle?.sellingPrice === pkg.sellingPrice;
                  const showExpansion = selectedBundle && (index + 1) === Math.min(expansionPos, networkProducts.length);

                  return (
                    <React.Fragment key={`${pkg.capacity}-${pkg.sellingPrice}-${index}`}>
                      <div
                        onClick={() => handleSelect(pkg)}
                        className={`${style.card} overflow-hidden cursor-pointer transition-all hover:shadow-lg rounded-2xl hover:-translate-y-1 ${
                          isSelected ? `ring-2 ${style.ring} shadow-xl -translate-y-1` : ''
                        }`}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <NetworkIcon network={selectedNetwork} size={32} />
                            <button className={`w-7 h-7 rounded-full flex items-center justify-center ${style.chevronBg} transition`}>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                          <h3 className={`text-2xl font-bold ${style.text}`}>{pkg.capacity}GB</h3>
                          <p className={`text-xs ${style.sub} mb-2`}>{getNetworkName(selectedNetwork)} Bundle</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-xl font-bold ${style.text}`}>{formatCurrency(pkg.sellingPrice)}</span>
                            <span className={`text-[10px] ${style.sub}`}>Non-Expiry</span>
                          </div>
                        </div>
                      </div>

                      {/* Expansion Panel */}
                      {showExpansion && (
                        <div className={`col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border ${style.expandBorder}`}>
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <NetworkIcon network={selectedNetwork} size={28} />
                            <span className="font-bold text-gray-900 dark:text-white text-base">{selectedBundle.capacity}GB</span>
                            <span className="text-gray-400 text-sm">&mdash;</span>
                            <span className={`font-bold text-base ${style.priceColor}`}>{formatCurrency(selectedBundle.sellingPrice)}</span>
                          </div>

                          <div className="max-w-md mx-auto">
                            <div className="flex gap-2">
                              <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                                placeholder="024 XXX XXXX"
                                className="flex-1 px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none text-center font-medium text-sm"
                              />
                              <button
                                onClick={handleBuy}
                                disabled={buying}
                                className={`px-5 py-2.5 ${style.btn} font-bold rounded-xl whitespace-nowrap text-sm transition-colors disabled:opacity-50 flex items-center gap-2`}
                              >
                                {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                                Pay {formatCurrency(selectedBundle.sellingPrice)}
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-1.5">Data will be sent to this number via MoMo payment</p>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="text-center py-6">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Powered by <span className="font-bold">FlashData</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function adjustColor(color, amount) {
  const clamp = (num) => Math.min(255, Math.max(0, num));
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00FF) + amount);
  const b = clamp((num & 0x0000FF) + amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
