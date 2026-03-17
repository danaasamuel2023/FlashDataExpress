'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShoppingBag, Phone, Mail, Loader2, Check, AlertCircle, Zap, ArrowLeft, Search, Hash, Clock, Package, ChevronDown, ChevronUp, XCircle, User, Shield } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import NetworkIcon from '@/components/shared/NetworkIcon';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const NETWORKS = [
  { id: 'YELLO', label: 'MTN', color: '#FFCC00' },
  { id: 'TELECEL', label: 'Telecel', color: '#E60000' },
  { id: 'AT_PREMIUM', label: 'AirtelTigo', color: '#7c3aed' },
];

const getNetworkName = (network) => {
  if (network === 'YELLO') return 'MTN';
  if (network === 'TELECEL') return 'Telecel';
  if (network === 'AT_PREMIUM') return 'AirtelTigo';
  return network;
};

const getCardStyle = (network) => {
  if (network === 'YELLO') return { card: 'bg-yellow-400', text: 'text-black', sub: 'text-black/60', btn: 'bg-yellow-500 hover:bg-yellow-600 text-black', border: 'border-yellow-300 dark:border-yellow-700', chevronBg: 'bg-black/10 hover:bg-black/20' };
  if (network === 'TELECEL') return { card: 'bg-gradient-to-br from-red-600 to-red-700', text: 'text-white', sub: 'text-white/60', btn: 'bg-red-800 hover:bg-red-900 text-white', border: 'border-red-300 dark:border-red-700', chevronBg: 'bg-white/10 hover:bg-white/20' };
  if (network === 'AT_PREMIUM') return { card: 'bg-gradient-to-br from-purple-600 to-purple-700', text: 'text-white', sub: 'text-white/60', btn: 'bg-purple-800 hover:bg-purple-900 text-white', border: 'border-purple-300 dark:border-purple-700', chevronBg: 'bg-white/10 hover:bg-white/20' };
  return { card: 'bg-gray-500', text: 'text-white', sub: 'text-white/60', btn: 'bg-gray-700 text-white', border: 'border-gray-300', chevronBg: 'bg-white/10' };
};

// Track Order Component
function TrackOrder() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchType, setSearchType] = useState('phone');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchValue.trim()) {
      setError('Please enter a phone number or reference');
      return;
    }
    setLoading(true);
    setError('');
    setOrders(null);
    try {
      const endpoint = searchType === 'phone'
        ? `/purchase/guest-status-by-phone/${searchValue.trim()}`
        : `/purchase/guest-status/${searchValue.trim()}`;
      const res = await api.get(endpoint);
      const data = res.data.data;
      setOrders(Array.isArray(data) ? data : data ? [data] : []);
    } catch {
      setError('No orders found. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': case 'delivered': return <Check className="w-4 h-4 text-emerald-500" />;
      case 'pending': case 'waiting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'pending': case 'waiting': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getNetworkBadgeColor = (network) => {
    if (network === 'YELLO') return 'bg-yellow-500';
    if (network === 'TELECEL') return 'bg-red-500';
    if (network === 'AT_PREMIUM') return 'bg-purple-500';
    return 'bg-gray-500';
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Search className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold">Track Your Order</h3>
            <p className="text-sm text-white/80">Check delivery status by phone or reference</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="mt-3 p-4 rounded-xl border shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2 p-1 rounded-lg bg-gray-100 dark:bg-gray-700">
              <button
                type="button"
                onClick={() => setSearchType('phone')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  searchType === 'phone'
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Phone className="w-4 h-4" /> Phone Number
              </button>
              <button
                type="button"
                onClick={() => setSearchType('reference')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  searchType === 'reference'
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Hash className="w-4 h-4" /> Reference
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={searchType === 'phone' ? 'Enter phone number (e.g., 0241234567)' : 'Enter order reference'}
                className="w-full px-4 py-3 pl-12 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                {searchType === 'phone' ? <Phone className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Searching...</>
              ) : (
                <><Search className="w-5 h-5" /> Track Order</>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-lg flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {orders && orders.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <Package className="w-5 h-5" />
                Found {orders.length} order{orders.length > 1 ? 's' : ''}
              </h4>
              {orders.map((order, index) => (
                <div key={index} className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${getNetworkBadgeColor(order.network)} flex items-center justify-center text-white font-bold text-xs`}>
                        {getNetworkName(order.network)?.substring(0, 3)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {getNetworkName(order.network)} {order.capacity}GB
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">To: {order.phoneNumber}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)} flex items-center gap-1`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {order.reference && (
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Reference</p>
                        <p className="font-mono text-xs break-all text-gray-900 dark:text-white">{order.reference}</p>
                      </div>
                    )}
                    {order.price && (
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Amount</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(order.price)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!orders && !error && (
            <div className="mt-4 p-3 rounded-lg border bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600">
              <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                Enter your phone number or order reference to check your order status.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Confirmation Modal
function ConfirmationModal({ isOpen, onClose, onConfirm, bundle, network, phoneNumber, email, isProcessing }) {
  if (!isOpen || !bundle) return null;

  const getColors = (net) => {
    if (net === 'YELLO') return { bg: 'from-yellow-400 to-yellow-500', text: 'text-black', btn: 'bg-yellow-500 hover:bg-yellow-400 text-black' };
    if (net === 'TELECEL') return { bg: 'from-red-500 to-red-600', text: 'text-white', btn: 'bg-red-500 hover:bg-red-400 text-white' };
    if (net === 'AT_PREMIUM') return { bg: 'from-purple-500 to-purple-600', text: 'text-white', btn: 'bg-purple-500 hover:bg-purple-400 text-white' };
    return { bg: 'from-yellow-400 to-yellow-500', text: 'text-black', btn: 'bg-yellow-500 hover:bg-yellow-400 text-black' };
  };

  const colors = getColors(network);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl animate-[modal-pop_0.2s_ease-out]">
        <div className={`bg-gradient-to-r ${colors.bg} ${colors.text} p-5 text-center`}>
          <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Confirm Purchase</h2>
        </div>

        <div className="p-6 text-center">
          <p className="text-gray-400 mb-4">Sending data to:</p>

          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-5 mb-4">
            <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-wider mb-2">{phoneNumber}</p>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${colors.btn}`}>
              {bundle.capacity}GB {getNetworkName(network)}
            </span>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-600/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-orange-700 dark:text-orange-400 text-sm font-semibold">Delivery Time</span>
            </div>
            <p className="text-orange-800 dark:text-orange-200 text-sm">
              Usually <strong>instant - 2 minutes</strong>
            </p>
          </div>

          <p className="text-orange-600 dark:text-orange-400 text-sm mb-6">
            Data cannot be reversed once sent!
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className={`flex-1 py-3 ${colors.btn} font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                `Pay ${formatCurrency(bundle.price)}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GuestBuyPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    }>
      <GuestBuyContent />
    </Suspense>
  );
}

function GuestBuyContent() {
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  const paymentRef = searchParams.get('reference') || searchParams.get('trxref');

  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('YELLO');
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [buying, setBuying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);

  // Responsive column tracking for expansion panels
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 640);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cols = windowWidth >= 1280 ? 4 : windowWidth >= 1024 ? 3 : windowWidth >= 640 ? 2 : 1;

  useEffect(() => {
    if (paymentStatus === 'callback' && paymentRef) {
      checkGuestOrder(paymentRef);
    }
  }, [paymentStatus, paymentRef]);

  useEffect(() => {
    fetchPackages(selectedNetwork);
  }, [selectedNetwork]);

  // Reset selection when switching networks
  useEffect(() => {
    setSelectedBundle(null);
    setPhoneNumber('');
    setEmail('');
    setErrorMessage('');
  }, [selectedNetwork]);

  const fetchPackages = async (network) => {
    setLoadingPackages(true);
    setPackages([]);
    try {
      const res = await api.get(`/purchase/guest-packages?network=${network}`);
      setPackages(res.data.data || []);
    } catch {
      toast.error('Failed to load packages');
    } finally {
      setLoadingPackages(false);
    }
  };

  const checkGuestOrder = async (ref) => {
    setVerifying(true);
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await api.get(`/purchase/guest-status/${ref}`);
      setOrderStatus(res.data.data);
    } catch {
      setOrderStatus({ status: 'pending' });
    } finally {
      setVerifying(false);
    }
  };

  const formatPhone = (val) => {
    let num = val.replace(/\D/g, '');
    if (num.length > 0 && !num.startsWith('0')) num = '0' + num;
    return num.slice(0, 10);
  };

  const handleSelect = (pkg) => {
    if (selectedBundle?.capacity === pkg.capacity && selectedBundle?.price === pkg.price) {
      setSelectedBundle(null);
    } else {
      setSelectedBundle(pkg);
      setErrorMessage('');
    }
  };

  const handleBuyClick = () => {
    if (!selectedBundle) return;
    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, '').length < 10) {
      setErrorMessage('Enter a valid phone number');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Enter your email for payment receipt');
      return;
    }
    setErrorMessage('');
    setShowConfirmation(true);
  };

  const handleConfirmedPurchase = async () => {
    setBuying(true);
    try {
      const res = await api.post('/purchase/guest-buy', {
        network: selectedNetwork,
        capacity: selectedBundle.capacity,
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
      });
      const { authorization_url } = res.data.data;
      if (authorization_url) {
        window.location.href = authorization_url;
      } else {
        setShowConfirmation(false);
        toast.error('Failed to initialize payment');
      }
    } catch (err) {
      setShowConfirmation(false);
      toast.error(err.response?.data?.message || 'Purchase failed');
    } finally {
      setBuying(false);
    }
  };

  const getExpansionPosition = () => {
    if (!selectedBundle) return -1;
    const idx = packages.findIndex(p => p.capacity === selectedBundle.capacity && p.price === selectedBundle.price);
    if (idx === -1) return -1;
    return Math.floor(idx / cols) * cols + cols;
  };
  const expansionPos = getExpansionPosition();

  // Payment callback view
  if (paymentStatus === 'callback') {
    if (verifying) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Processing your order...</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Please wait while we confirm your payment.</p>
          </div>
        </div>
      );
    }

    const status = orderStatus?.status;
    const isSuccess = status === 'completed' || status === 'processing' || status === 'pending';

    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className={`w-16 h-16 ${isSuccess ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-red-100 dark:bg-red-500/10'} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            {isSuccess ? <Check className="w-8 h-8 text-emerald-500" /> : <AlertCircle className="w-8 h-8 text-red-500" />}
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {isSuccess ? 'Payment Received!' : 'Something went wrong'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 mb-2">
            {isSuccess
              ? `Your ${orderStatus?.capacity}GB ${NETWORKS.find(n => n.id === orderStatus?.network)?.label || ''} data is being delivered to ${orderStatus?.phoneNumber}.`
              : 'We could not process your order. If you were charged, please contact support.'}
          </p>
          {isSuccess && status !== 'completed' && (
            <p className="text-xs text-gray-400 mb-6">Data is usually delivered within 2 minutes.</p>
          )}
          <div className="flex gap-3 justify-center mt-6">
            <Link href="/quick-buy">
              <button className="px-6 py-3 bg-orange-500 text-white font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors">
                Buy more data
              </button>
            </Link>
            <Link href="/sign-up">
              <button className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold text-sm rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                Create account
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const style = getCardStyle(selectedNetwork);

  // Main buy flow
  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-3 sm:py-6">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmedPurchase}
        bundle={selectedBundle}
        network={selectedNetwork}
        phoneNumber={phoneNumber}
        email={email}
        isProcessing={buying}
      />

      {/* Title */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Buy Data Bundles</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No account needed &bull; Pay via MoMo &bull; Instant delivery
        </p>
      </div>

      {/* Track Order */}
      <TrackOrder />

      {/* Network Selection - DataMart style colored buttons */}
      <div className="mb-4">
        <div className="flex gap-3 flex-wrap">
          {NETWORKS.map((net) => {
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
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <NetworkIcon network={net.id} size={28} />
                {net.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Guest Checkout Notice */}
      <div className="mb-4 p-3 rounded-xl border-l-4 bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-600">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            No account needed &bull; Pay with MoMo &bull; Track order above
          </p>
        </div>
      </div>

      {/* Delivery Notice */}
      <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <p className="text-xs sm:text-sm text-center text-red-600 dark:text-red-400">
          Delivery: Usually instant &bull; No refunds for wrong numbers &bull; Data will be delivered!
        </p>
      </div>

      {/* Products Grid - DataMart style colored cards */}
      {loadingPackages ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className={`w-8 h-8 animate-spin ${
            selectedNetwork === 'YELLO' ? 'text-yellow-500' :
            selectedNetwork === 'TELECEL' ? 'text-red-600' : 'text-purple-600'
          }`} />
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No bundles available</h3>
          <p className="text-gray-500 dark:text-gray-400">No packages available for this network right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {packages.map((pkg, index) => {
            const cardStyle = getCardStyle(selectedNetwork);
            const isSelected = selectedBundle?.capacity === pkg.capacity && selectedBundle?.price === pkg.price;
            const showExpansion = selectedBundle && (index + 1) === Math.min(expansionPos, packages.length);

            return (
              <React.Fragment key={`${pkg.capacity}-${pkg.price}-${index}`}>
                {/* Bundle Card */}
                <div className="relative">
                  <div
                    onClick={() => handleSelect(pkg)}
                    className={`${cardStyle.card} overflow-hidden cursor-pointer transition-all hover:shadow-lg rounded-2xl hover:-translate-y-1 ${
                      isSelected ? 'ring-2 ring-black/30 shadow-xl -translate-y-1' : ''
                    }`}
                  >
                    <div className="p-5">
                      {/* Top row: Logo + chevron */}
                      <div className="flex items-start justify-between mb-3">
                        <NetworkIcon network={selectedNetwork} size={40} />
                        <button className={`w-8 h-8 rounded-full flex items-center justify-center ${cardStyle.chevronBg} transition`}>
                          <ChevronDown className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* GB amount */}
                      <h3 className={`text-3xl font-bold ${cardStyle.text}`}>{pkg.capacity}GB</h3>
                      <p className={`text-sm ${cardStyle.sub} mb-3`}>{getNetworkName(selectedNetwork)} Bundle</p>

                      {/* Price + duration */}
                      <div className="flex items-center justify-between">
                        <span className={`text-2xl font-bold ${cardStyle.text}`}>{formatCurrency(pkg.price)}</span>
                        <span className={`text-xs ${cardStyle.sub}`}>No Expiry</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expansion Panel - spans full row */}
                {showExpansion && (
                  <div className={`col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 bg-white dark:bg-gray-800 rounded-2xl p-3 sm:p-4 shadow-md border ${cardStyle.border}`}>
                    {/* Header */}
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <NetworkIcon network={selectedNetwork} size={32} />
                      <span className="font-bold text-gray-900 dark:text-white text-base">{selectedBundle.capacity}GB</span>
                      <span className="text-gray-400 dark:text-gray-500 text-sm">&mdash;</span>
                      <span className={`font-bold text-base ${
                        selectedNetwork === 'YELLO' ? 'text-yellow-600 dark:text-yellow-400' :
                        selectedNetwork === 'TELECEL' ? 'text-red-600 dark:text-red-400' :
                        'text-purple-600 dark:text-purple-400'
                      }`}>{formatCurrency(selectedBundle.price)}</span>
                    </div>

                    {errorMessage && (
                      <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs p-2 rounded-lg mb-2 text-center border border-red-200 dark:border-red-800">
                        {errorMessage}
                      </div>
                    )}

                    <div className="max-w-md mx-auto space-y-2">
                      {/* Email */}
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your email (for receipt)"
                        className="w-full px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none text-center font-medium text-sm"
                      />
                      {/* Phone + Buy button */}
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                          placeholder="024 XXX XXXX"
                          className="flex-1 px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none text-center font-medium text-sm"
                        />
                        <button
                          onClick={handleBuyClick}
                          className={`px-5 py-2.5 ${cardStyle.btn} font-bold rounded-xl whitespace-nowrap text-sm transition-colors`}
                        >
                          Buy {formatCurrency(selectedBundle.price)}
                        </button>
                      </div>
                      <p className="text-xs text-center text-gray-400 dark:text-gray-500">Data will be sent to this number</p>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Create Account CTA */}
      <div className="mt-8 p-6 rounded-2xl text-center bg-white dark:bg-gray-800 shadow-sm">
        <User className="w-10 h-10 mx-auto mb-3 text-orange-500 dark:text-orange-400" />
        <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">Want more features?</h3>
        <p className="text-sm mb-4 text-gray-500 dark:text-gray-400">Create a free account for wallet payments, order history & referral rewards</p>
        <div className="flex justify-center gap-3">
          <Link href="/sign-in" className="px-5 py-2 rounded-lg font-medium border transition-colors border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Sign In
          </Link>
          <Link href="/sign-up" className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors">
            Sign Up Free
          </Link>
        </div>
      </div>
    </div>
  );
}
