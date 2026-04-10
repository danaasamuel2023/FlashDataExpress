'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wallet, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function SubAgentWithdrawalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [momoNumber, setMomoNumber] = useState('');
  const [momoNetwork, setMomoNetwork] = useState('MTN');
  const [momoName, setMomoName] = useState('');
  const [savingMomo, setSavingMomo] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (!token) {
      router.push('/subagent/login');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, wdRes] = await Promise.all([
        api.get('/subagent/my-dashboard'),
        api.get('/subagent/withdrawal-history'),
      ]);
      setDashboard(dashRes.data.data);
      setWithdrawals(wdRes.data.data || []);
      const momo = dashRes.data.data.subAgent.momoDetails || {};
      setMomoNumber(momo.number || '');
      setMomoNetwork(momo.network || 'MTN');
      setMomoName(momo.name || '');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/subagent/login');
      } else {
        toast.error('Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMomo = async () => {
    if (!momoNumber.trim() || !momoName.trim()) {
      toast.error('Enter your MoMo number and name');
      return;
    }
    setSavingMomo(true);
    try {
      await api.put('/subagent/my-store', {
        momoDetails: { number: momoNumber.trim(), network: momoNetwork, name: momoName.trim() },
      });
      toast.success('MoMo details saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingMomo(false);
    }
  };

  const handleWithdraw = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!momoNumber.trim() || !momoName.trim()) {
      toast.error('Set up your MoMo details first');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/subagent/withdrawal-request', { amount: val });
      toast.success('Withdrawal request submitted!');
      setAmount('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Withdrawal failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const subAgent = dashboard?.subAgent;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/subagent/dashboard" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold text-white">Withdrawals</h1>
            <p className="text-xs text-gray-500">Cash out your earnings</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Balance */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Available to Withdraw</p>
              <p className="text-2xl font-extrabold text-white">{formatCurrency(subAgent?.pendingBalance || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Earned</p>
              <p className="text-2xl font-extrabold text-white">{formatCurrency(subAgent?.totalEarnings || 0)}</p>
            </div>
          </div>
        </div>

        {/* MoMo Details */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="font-bold text-white text-sm mb-3">MoMo Details</p>
          <div className="space-y-3">
            <input
              type="text"
              value={momoName}
              onChange={e => setMomoName(e.target.value)}
              placeholder="Recipient Name"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={momoNetwork}
                onChange={e => setMomoNetwork(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="MTN">MTN</option>
                <option value="Telecel">Telecel</option>
                <option value="AirtelTigo">AirtelTigo</option>
              </select>
              <input
                type="tel"
                value={momoNumber}
                onChange={e => setMomoNumber(e.target.value)}
                placeholder="024 XXX XXXX"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSaveMomo}
              disabled={savingMomo}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {savingMomo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save MoMo Details
            </button>
          </div>
        </div>

        {/* Request Withdrawal */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="font-bold text-white text-sm mb-3">Request Withdrawal</p>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount (GH₵)"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleWithdraw}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              Withdraw
            </button>
          </div>
        </div>

        {/* Withdrawal History */}
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Withdrawal History</h2>
          {withdrawals.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <Wallet className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No withdrawals yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {withdrawals.map(w => (
                <div key={w._id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{formatCurrency(w.netAmount)}</p>
                    <p className="text-xs text-gray-500">{formatDate(w.createdAt)} &middot; {w.reference}</p>
                    {w.rejectionReason && <p className="text-xs text-red-400 mt-1">{w.rejectionReason}</p>}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    w.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                    w.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                    w.status === 'processing' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
