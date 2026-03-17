'use client';
import { useState, useEffect } from 'react';
import { Search, Loader2, ShieldCheck, ShieldOff, UserCheck, UserX, Wallet, ChevronDown, X } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/constants';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);
  const [creditModal, setCreditModal] = useState(null); // user object or null
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState('credit'); // 'credit' or 'debit'
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id, updates, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setUpdating(id);
    try {
      const res = await api.put(`/admin/users/${id}`, updates);
      setUsers(prev => prev.map(u => u._id === id ? res.data.data : u));
      toast.success('User updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setUpdating(null);
    }
  };

  const toggleRole = (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const msg = newRole === 'admin'
      ? `Make ${user.name} an admin? They will have full access to the admin panel.`
      : `Remove admin role from ${user.name}?`;
    updateUser(user._id, { role: newRole }, msg);
  };

  const toggleActive = (user) => {
    const msg = user.isActive !== false
      ? `Deactivate ${user.name}? They won't be able to log in.`
      : `Reactivate ${user.name}?`;
    updateUser(user._id, { isActive: user.isActive === false ? true : false }, msg);
  };

  const handleCreditDebit = async () => {
    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const user = creditModal;
    const newBalance = creditType === 'credit'
      ? (user.walletBalance || 0) + amount
      : (user.walletBalance || 0) - amount;

    if (newBalance < 0) {
      toast.error('Balance cannot go below zero');
      return;
    }

    const action = creditType === 'credit' ? 'Credit' : 'Debit';
    const msg = `${action} GH\u20B5${amount.toFixed(2)} ${creditType === 'credit' ? 'to' : 'from'} ${user.name}?\n\nCurrent balance: GH\u20B5${(user.walletBalance || 0).toFixed(2)}\nNew balance: GH\u20B5${newBalance.toFixed(2)}`;

    if (!confirm(msg)) return;

    setUpdating(user._id);
    try {
      const res = await api.put(`/admin/users/${user._id}`, { walletBalance: newBalance });
      setUsers(prev => prev.map(u => u._id === user._id ? res.data.data : u));
      toast.success(`${action}ed GH\u20B5${amount.toFixed(2)} ${creditType === 'credit' ? 'to' : 'from'} ${user.name}`);
      setCreditModal(null);
      setCreditAmount('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update balance');
    } finally {
      setUpdating(null);
    }
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phoneNumber?.includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Users</h1>
        <p className="text-text-muted text-sm mt-1">{users.length} registered users</p>
      </div>

      <Input
        icon={Search}
        placeholder="Search by name, email, or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-center text-text-muted py-8">No users found</p>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="!p-0 overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">User</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Phone</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Balance</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Role</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Joined</th>
                    <th className="text-right text-xs font-semibold text-text-muted px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u._id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/5">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-sm text-white">{u.name}</p>
                        <p className="text-xs text-text-muted">{u.email}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-text-muted">{u.phoneNumber || '\u2014'}</td>
                      <td className="px-5 py-3 text-sm font-bold text-white">{formatCurrency(u.walletBalance || 0)}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-white/[0.06] text-text-muted'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.isActive !== false ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                        }`}>
                          {u.isActive !== false ? 'active' : 'disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted">{formatDate(u.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setCreditModal(u); setCreditType('credit'); setCreditAmount(''); }}
                            disabled={updating === u._id}
                            title="Credit / Debit wallet"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-success/10 text-success hover:bg-success/20 transition-colors"
                          >
                            <Wallet className="w-3.5 h-3.5 inline mr-1" />
                            Wallet
                          </button>
                          <button
                            onClick={() => toggleRole(u)}
                            disabled={updating === u._id}
                            title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              u.role === 'admin'
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'bg-white/[0.06] text-text-muted hover:bg-white/10'
                            }`}
                          >
                            {u.role === 'admin' ? (
                              <><ShieldCheck className="w-3.5 h-3.5 inline mr-1" />Admin</>
                            ) : (
                              <><ShieldOff className="w-3.5 h-3.5 inline mr-1" />User</>
                            )}
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={updating === u._id}
                            title={u.isActive !== false ? 'Deactivate' : 'Activate'}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              u.isActive !== false
                                ? 'bg-error/10 text-error hover:bg-error/20'
                                : 'bg-success/10 text-success hover:bg-success/20'
                            }`}
                          >
                            {u.isActive !== false ? (
                              <><UserX className="w-3.5 h-3.5 inline mr-1" />Deactivate</>
                            ) : (
                              <><UserCheck className="w-3.5 h-3.5 inline mr-1" />Activate</>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(u => (
              <Card key={u._id} className="!p-0">
                <button
                  onClick={() => setExpandedUser(expandedUser === u._id ? null : u._id)}
                  className="w-full px-4 py-3 flex items-center justify-between"
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm text-white">{u.name}</p>
                    <p className="text-xs text-text-muted">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{formatCurrency(u.walletBalance || 0)}</span>
                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${expandedUser === u._id ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expandedUser === u._id && (
                  <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">Phone</span>
                      <span className="text-text-muted">{u.phoneNumber || '\u2014'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">Role</span>
                      <span className={`font-semibold px-2 py-0.5 rounded-full ${
                        u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-white/[0.06] text-text-muted'
                      }`}>{u.role}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">Status</span>
                      <span className={`font-semibold px-2 py-0.5 rounded-full ${
                        u.isActive !== false ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                      }`}>{u.isActive !== false ? 'active' : 'disabled'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">Joined</span>
                      <span className="text-text-muted">{formatDate(u.createdAt)}</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => { setCreditModal(u); setCreditType('credit'); setCreditAmount(''); }}
                        disabled={updating === u._id}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-success/10 text-success hover:bg-success/20 transition-colors"
                      >
                        <Wallet className="w-3.5 h-3.5 inline mr-1" /> Wallet
                      </button>
                      <button
                        onClick={() => toggleRole(u)}
                        disabled={updating === u._id}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                          u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-white/[0.06] text-text-muted'
                        }`}
                      >
                        {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={updating === u._id}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                          u.isActive !== false ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
                        }`}
                      >
                        {u.isActive !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Credit/Debit Modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCreditModal(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
              <div>
                <h3 className="font-bold text-white">Adjust Wallet</h3>
                <p className="text-xs text-text-muted mt-0.5">{creditModal.name} - {creditModal.email}</p>
              </div>
              <button onClick={() => setCreditModal(null)} className="p-1 rounded-lg hover:bg-white/[0.06]">
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-center">
                <p className="text-xs text-text-muted">Current Balance</p>
                <p className="text-2xl font-extrabold text-white">{formatCurrency(creditModal.walletBalance || 0)}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCreditType('credit')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    creditType === 'credit'
                      ? 'bg-success text-white'
                      : 'bg-white/[0.06] text-text-muted'
                  }`}
                >
                  + Credit
                </button>
                <button
                  onClick={() => setCreditType('debit')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    creditType === 'debit'
                      ? 'bg-red-500 text-white'
                      : 'bg-white/[0.06] text-text-muted'
                  }`}
                >
                  - Debit
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted mb-1.5 block">
                  Amount (GH\u20B5)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoFocus
                />
              </div>

              {creditAmount && parseFloat(creditAmount) > 0 && (
                <div className="bg-white/[0.03] rounded-xl p-3 text-sm">
                  <div className="flex justify-between text-text-muted">
                    <span>Current</span>
                    <span>{formatCurrency(creditModal.walletBalance || 0)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted mt-1">
                    <span>{creditType === 'credit' ? '+ Credit' : '- Debit'}</span>
                    <span className={creditType === 'credit' ? 'text-success' : 'text-red-500'}>
                      {creditType === 'credit' ? '+' : '-'}{formatCurrency(parseFloat(creditAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-white mt-2 pt-2 border-t border-white/[0.04]">
                    <span>New Balance</span>
                    <span>{formatCurrency(
                      creditType === 'credit'
                        ? (creditModal.walletBalance || 0) + parseFloat(creditAmount)
                        : (creditModal.walletBalance || 0) - parseFloat(creditAmount)
                    )}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreditDebit}
                fullWidth
                size="lg"
                loading={updating === creditModal._id}
                className={creditType === 'debit' ? '!bg-red-500 hover:!bg-red-600' : ''}
              >
                {creditType === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
