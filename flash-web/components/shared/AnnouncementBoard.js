'use client';
import { useState, useEffect } from 'react';
import { Megaphone, Copy, Check, Pin } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

// Admin-posted updates that agents / sub-agents can copy and forward to their
// own customers. `endpoint` differs per portal; `variant` switches styling
// between the token-based dashboard and the gray sub-agent portal.
export default function AnnouncementBoard({ endpoint, variant = 'default' }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    let active = true;
    api.get(endpoint)
      .then(res => { if (active) setItems(res.data.data || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [endpoint]);

  const handleCopy = (item) => {
    navigator.clipboard.writeText(item.message);
    setCopiedId(item._id);
    toast.success('Message copied — paste it for your customers!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Nothing to show → render nothing (keeps the dashboard clean).
  if (!loaded || items.length === 0) return null;

  const sub = variant === 'subagent';
  const card = sub
    ? 'bg-gray-900 border border-gray-800'
    : 'bg-card border border-white/[0.06]';
  const muted = sub ? 'text-gray-500' : 'text-text-muted';
  const accent = sub ? 'text-amber-400' : 'text-primary';
  const accentBg = sub ? 'bg-amber-500/10' : 'bg-primary/10';
  const copyBtn = sub
    ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
    : 'bg-primary/10 text-primary hover:bg-primary/20';

  return (
    <div className={`${card} rounded-2xl p-4 sm:p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-9 h-9 ${accentBg} rounded-xl flex items-center justify-center`}>
          <Megaphone className={`w-5 h-5 ${accent}`} />
        </div>
        <div>
          <h2 className="font-bold text-white text-sm">Announcements</h2>
          <p className={`text-[11px] ${muted}`}>Updates from the team — tap Copy to share with your customers.</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item._id}
            className={`rounded-xl p-3.5 ${sub ? 'bg-gray-800/50 border border-gray-800' : 'bg-white/[0.02] border border-white/[0.05]'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                {item.pinned && <Pin className={`w-3.5 h-3.5 flex-shrink-0 ${accent}`} />}
                <p className="font-bold text-white text-sm truncate">{item.title}</p>
              </div>
              <button
                onClick={() => handleCopy(item)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ${copyBtn}`}
              >
                {copiedId === item._id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === item._id ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className={`text-xs mt-2 whitespace-pre-wrap ${sub ? 'text-gray-300' : 'text-text'}`}>{item.message}</p>
            {item.createdAt && (
              <p className={`text-[10px] mt-2 ${muted}`}>
                {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
