'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Copyable({ label, value, accentClass = 'bg-primary/10 text-primary' }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 bg-black/30 rounded-lg px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-white font-mono break-all">{value}</p>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); toast.success(`${label} copied`); setTimeout(() => setCopied(false), 1500); }}
        className={`p-2 rounded-lg ${accentClass} hover:brightness-110 flex-shrink-0`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
