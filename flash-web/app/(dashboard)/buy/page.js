'use client';
import React, { useState, useEffect } from 'react';
import { ShoppingBag, Phone, Wallet, Smartphone, Check, Loader2, AlertCircle, ChevronDown, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import NetworkIcon from '@/components/shared/NetworkIcon';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const NETWORK_LIST = [
  { id: 'YELLO', label: 'MTN' },
  { id: 'TELECEL', label: 'Telecel' },
  { id: 'AT_PREMIUM', label: 'AirtelTigo' },
];

const getCardStyle = (network) => {
  if (network === 'YELLO') return { card: 'bg-yellow-400', text: 'text-black', sub: 'text-black/60', border: 'border-black/10', ring: 'ring-black/30', chevronBg: 'bg-black/10 hover:bg-black/20', btn: 'bg-yellow-500 hover:bg-yellow-600 text-black', expandBorder: 'border-yellow-300', priceColor: 'text-yellow-600' };
  if (network === 'TELECEL') return { card: 'bg-gradient-to-br from-red-600 to-red-700', text: 'text-white', sub: 'text-white/60', border: 'border-white/20', ring: 'ring-white/30', chevronBg: 'bg-white/10 hover:bg-white/20', btn: 'bg-red-800 hover:bg-red-900 text-white', expandBorder: 'border-red-700', priceColor: 'text-red-500' };
  if (network === 'AT_PREMIUM') return { card: 'bg-gradient-to-br from-purple-600 to-purple-700', text: 'text-white', sub: 'text-white/60', border: 'border-white/20', ring: 'ring-white/30', chevronBg: 'bg-white/10 hover:bg-white/20', btn: 'bg-purple-800 hover:bg-purple-900 text-white', expandBorder: 'border-purple-700', priceColor: 'text-purple-500' };
  return { card: 'bg-gray-600', text: 'text-white', sub: 'text-white/60', border: 'border-white/20', ring: 'ring-white/30', chevronBg: 'bg-white/10', btn: 'bg-gray-700 text-white', expandBorder: 'border-gray-600', priceColor: 'text-gray-400' };
};

const getNetworkName = (id) => NETWORK_LIST.find(n => n.id === id)?.label || id;

export default function BuyDataPage() {
  const { user, refreshUser } = useAuth();
  const [selectedNetwork, setSelectedNetwork] = useState('YELLO');
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [buying, setBuying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [errorMessage, setErrorMessage] = useState('');
  const [purchaseDone, setPurchaseDone] = useState(false);

  // Responsive columns for expansion panel
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 640);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const cols = windowWidth >= 1280 ? 4 : windowWidth >= 1024 ? 3 : windowWidth >= 640 ? 2 : 1;

  useEffect(() => {
    fetchPackages(selectedNetwork);
  }, [selectedNetwork]);

  useEffect(() => {
    setSelectedBundle(null);
    setPhoneNumber('');
    setErrorMessage('');
  }, [selectedNetwork]);

  const fetchPackages = async (network) => {
    setLoadingPackages(true);
    setPackages([]);
    try {
      const res = await api.get(`/purchase/packages?network=${network}`);
      setPackages(res.data.data || []);
    } catch {
      toast.error('Failed to load packages');
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleSelect = (pkg) => {
    if (selectedBundle?.capacity === pkg.capacity && selectedBundle?.price === pkg.price) {
      setSelectedBundle(null);
    } else {
      setSelectedBundle(pkg);
      setErrorMessage('');
    }
  };

  const handleBuy = async () => {
    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, '').length < 10) {
      setErrorMessage('Enter a valid phone number');
      return;
    }
    setErrorMessage('');
    setBuying(true);
    try {
      if (paymentMethod === 'wallet') {
        if (selectedBundle.price > (user?.walletBalance || 0)) {
          setErrorMessage('Insufficient balance. Top up or pay with MoMo.');
          setBuying(false);
          return;
        }
        await api.post('/purchase/buy', {
          network: selectedNetwork,
          capacity: selectedBundle.capacity,
          phoneNumber: phoneNumber.trim(),
        });
        toast.success('Data purchase successful!');
        refreshUser();
        setPurchaseDone(true);
      } else {
        const res = await api.post('/purchase/buy-with-momo', {
          network: selectedNetwork,
          capacity: selectedBundle.capacity,
          phoneNumber: phoneNumber.trim(),
        });
        const { authorization_url } = res.data.data;
        if (authorization_url) {
          window.location.href = authorization_url;
        } else {
          toast.error('Failed to initialize payment');
        }
      }
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
    const idx = packages.findIndex(p => p.capacity === selectedBundle.capacity && p.price === selectedBundle.price);
    if (idx === -1) return -1;
    return Math.floor(idx / cols) * cols + cols;
  };
  const expansionPos = getExpansionPosition();
  const style = getCardStyle(selectedNetwork);

  if (purchaseDone) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-xl font-extrabold text-white">Purchase Successful!</h2>
        <p className="text-text-muted text-sm mt-2 mb-6">
          {selectedBundle?.capacity}GB {getNetworkName(selectedNetwork)} data sent to {phoneNumber}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setPurchaseDone(false); setSelectedBundle(null); setPhoneNumber(''); }} className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-black font-bold rounded-xl text-sm transition-colors">
            Buy more
          </button>
          <a href="/transactions" className="px-5 py-2.5 border border-white/10 text-text-muted hover:text-white font-bold rounded-xl text-sm transition-colors">
            View history
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Buy Data</h1>
        <p className="text-text-muted text-sm mt-1">Choose a network and bundle to get started.</p>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-text-muted text-xs">Your balance</p>
          <p className="text-xl font-extrabold text-white">{formatCurrency(user?.walletBalance || 0)}</p>
        </div>
        <a href="/wallet" className="px-4 py-2 bg-primary hover:bg-primary-dark text-black font-bold text-sm rounded-xl transition-colors">
          Top up
        </a>
      </div>

      {/* Network Selection — colored buttons */}
      <div>
        <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider mb-3">Select Network</h2>
        <div className="flex gap-3 flex-wrap">
          {NETWORK_LIST.map((net) => {
            const isActive = selectedNetwork === net.id;
            return (
              <button
                key={net.id}
                onClick={() => setSelectedNetwork(net.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
                  isActive
                    ? net.id === 'YELLO' ? 'bg-yellow-400 text-black ring-2 ring-yellow-600 shadow-lg' :
                      net.id === 'TELECEL' ? 'bg-red-600 text-white ring-2 ring-red-800 shadow-lg' :
                      'bg-purple-600 text-white ring-2 ring-purple-800 shadow-lg'
                    : 'bg-surface-light text-text-muted hover:text-white border border-white/[0.04] hover:border-white/10'
                }`}
              >
                <NetworkIcon network={net.id} size={24} />
                {net.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bundle Cards Grid — DataMart style */}
      <div>
        <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider mb-3">
          {getNetworkName(selectedNetwork)} Bundles
        </h2>

        {loadingPackages ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-8 h-8 animate-spin ${
              selectedNetwork === 'YELLO' ? 'text-yellow-500' :
              selectedNetwork === 'TELECEL' ? 'text-red-600' : 'text-purple-600'
            }`} />
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-2xl border border-white/[0.04]">
            <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-text-muted text-sm">No bundles available for this network.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {packages.map((pkg, index) => {
              const isSelected = selectedBundle?.capacity === pkg.capacity && selectedBundle?.price === pkg.price;
              const showExpansion = selectedBundle && (index + 1) === Math.min(expansionPos, packages.length);

              return (
                <React.Fragment key={`${pkg.capacity}-${pkg.price}-${index}`}>
                  {/* Bundle Card */}
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
                        <span className={`text-xl font-bold ${style.text}`}>{formatCurrency(pkg.price)}</span>
                        {pkg.validity && <span className={`text-[10px] ${style.sub}`}>{pkg.validity}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Expansion Panel */}
                  {showExpansion && (
                    <div className={`col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 bg-surface rounded-2xl p-4 shadow-md border ${style.expandBorder}`}>
                      {/* Bundle info header */}
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <NetworkIcon network={selectedNetwork} size={28} />
                        <span className="font-bold text-white text-base">{selectedBundle.capacity}GB</span>
                        <span className="text-text-muted text-sm">&mdash;</span>
                        <span className={`font-bold text-base ${style.priceColor}`}>{formatCurrency(selectedBundle.price)}</span>
                      </div>

                      {errorMessage && (
                        <div className="bg-error/10 border border-error/20 text-error text-xs p-2 rounded-lg mb-3 text-center">
                          {errorMessage}
                        </div>
                      )}

                      {/* Payment method toggle */}
                      <div className="max-w-md mx-auto mb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setPaymentMethod('wallet')}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all text-sm font-bold ${
                              paymentMethod === 'wallet'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-white/[0.04] text-text-muted hover:border-white/10'
                            }`}
                          >
                            <Wallet className="w-4 h-4" />
                            Wallet ({formatCurrency(user?.walletBalance || 0)})
                          </button>
                          <button
                            onClick={() => setPaymentMethod('momo')}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all text-sm font-bold ${
                              paymentMethod === 'momo'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-white/[0.04] text-text-muted hover:border-white/10'
                            }`}
                          >
                            <Smartphone className="w-4 h-4" />
                            MoMo
                          </button>
                        </div>
                      </div>

                      {/* Insufficient balance warning */}
                      {paymentMethod === 'wallet' && selectedBundle.price > (user?.walletBalance || 0) && (
                        <div className="max-w-md mx-auto mb-3 bg-error/10 border border-error/20 rounded-lg p-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-error shrink-0" />
                          <p className="text-xs text-error">
                            Insufficient balance. <button onClick={() => setPaymentMethod('momo')} className="font-bold underline">Use MoMo</button> or <a href="/wallet" className="font-bold underline">top up</a>.
                          </p>
                        </div>
                      )}

                      {/* Phone + Buy */}
                      <div className="max-w-md mx-auto">
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                            placeholder="024 XXX XXXX"
                            className="flex-1 px-3 py-2.5 rounded-xl bg-surface-light text-white placeholder-text-muted border border-white/[0.04] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-center font-medium text-sm"
                          />
                          <button
                            onClick={handleBuy}
                            disabled={buying}
                            className={`px-5 py-2.5 ${style.btn} font-bold rounded-xl whitespace-nowrap text-sm transition-colors disabled:opacity-50 flex items-center gap-2`}
                          >
                            {buying ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ShoppingBag className="w-4 h-4" />
                            )}
                            {paymentMethod === 'wallet' ? 'Pay' : 'MoMo'} {formatCurrency(selectedBundle.price)}
                          </button>
                        </div>
                        <p className="text-[10px] text-text-muted text-center mt-1.5">Data will be sent to this number</p>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
