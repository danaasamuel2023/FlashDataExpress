// Colored badge that identifies an order's purchaseSource at a glance.
// Used across admin views so portal vs store sales are never confused.
export default function SourceBadge({ source, size = 'sm' }) {
  const map = {
    store: { label: 'STORE', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    guest: { label: 'GUEST', cls: 'bg-primary/15 text-primary border-primary/30' },
    direct: { label: 'PORTAL', cls: 'bg-success/10 text-success border-success/30' },
  };
  const cfg = map[source] || map.direct;
  const sizeCls = size === 'xs'
    ? 'text-[9px] px-1.5 py-0.5'
    : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`inline-block font-bold uppercase tracking-wider rounded border ${sizeCls} ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
