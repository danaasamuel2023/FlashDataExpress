'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Loader2, Moon, HelpCircle } from 'lucide-react';
import api from '@/lib/api';

// State → presentation. Mirrors DataMart's scanner states
// ('live' | 'waiting' | 'processing' | 'idle') plus our 'unknown' fallback.
const STATE_CONFIG = {
  live: {
    label: 'Live',
    icon: Radio,
    dot: 'bg-success',
    pulse: true,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
  },
  waiting: {
    label: 'Active',
    icon: Radio,
    dot: 'bg-success',
    pulse: true,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    dot: 'bg-blue-500',
    spin: true,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  idle: {
    label: 'Idle',
    icon: Moon,
    dot: 'bg-text-muted',
    color: 'text-text-muted',
    bg: 'bg-white/5',
    border: 'border-white/[0.06]',
  },
  unknown: {
    label: 'Unavailable',
    icon: HelpCircle,
    dot: 'bg-text-muted',
    color: 'text-text-muted',
    bg: 'bg-white/5',
    border: 'border-white/[0.06]',
  },
};

// e.g. "Jun 17, 11:29 PM" — short, human, no year.
function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Compact gap between two timestamps, e.g. "45s", "4m", "1h 12m".
function formatDuration(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0 || Number.isNaN(diff)) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DeliveryTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const fetchTracker = useCallback(async () => {
    try {
      const res = await api.get('/purchase/delivery-tracker');
      setData(res.data.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracker();
  }, [fetchTracker]);

  // Auto-refresh while the user has orders in flight (or the pipeline is busy),
  // so the status feels live without hammering the API when nothing's happening.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!data) return;
    const busy = data.yourPending > 0 || data.scanner?.active;
    if (!busy) return;
    timerRef.current = setTimeout(fetchTracker, 20000);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [data, fetchTracker]);

  // Don't render anything until we know there's something to show — keeps the
  // orders page clean for users with no pending orders and an idle pipeline.
  if (loading || !data) return null;
  const hidden = data.yourPending === 0 && !data.scanner?.active && data.scanner?.state !== 'unknown';
  if (hidden) return null;

  const state = data.scanner?.state || 'unknown';
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.unknown;
  const Icon = cfg.icon;
  const pendingBatches = data.scanner?.pendingBatches || 0;
  const last = data.latestDelivered;
  const placedAt = formatDateTime(last?.placedAt);
  const deliveredAt = formatDateTime(last?.deliveredAt);
  const waited = last?.exactDelivery
    ? formatDuration(last?.placedAt, last?.deliveredAt)
    : null;

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-4`}>
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0 mt-0.5">
          <span className={`block w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          {cfg.pulse && (
            <span className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${cfg.dot} animate-ping opacity-75`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className={`w-4 h-4 ${cfg.color} ${cfg.spin ? 'animate-spin' : ''}`} />
            <span className="font-bold text-sm text-white">Delivery System</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>

          <p className="text-xs text-text-muted mt-1.5">
            ⚡ Deliveries are lightning fast! Your order should reflect within some minutes.
          </p>

          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2 text-xs">
            {data.yourPending > 0 && (
              <span className="text-text">
                <span className={`font-extrabold ${cfg.color}`}>{data.yourPending}</span>
                {' '}of your order{data.yourPending === 1 ? '' : 's'} in the queue
              </span>
            )}
            {pendingBatches > 0 && (
              <span className="text-text-muted">
                {pendingBatches} batch{pendingBatches === 1 ? '' : 'es'} pending
              </span>
            )}
          </div>

          {last && deliveredAt && (
            <p className="text-xs text-text-muted mt-2">
              Last delivered:{' '}
              {last.trackingId && (
                <>
                  <span className="text-text font-mono">Tracking #{last.trackingId}</span>
                  {' — '}
                </>
              )}
              {placedAt && (
                <>placed <span className="text-text">{placedAt}</span>, </>
              )}
              delivered <span className="text-success">{deliveredAt}</span>
              {waited && (
                <>
                  {' '}
                  <span className={`font-semibold ${cfg.color}`}>· wait time {waited}</span>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
