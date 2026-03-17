'use client';

export default function Input({
  label,
  error,
  icon: Icon,
  className = '',
  ...props
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-text-muted/50 pointer-events-none" />
        )}
        <input
          className={`
            w-full
            ${Icon ? 'pl-11' : 'pl-4'} pr-4 py-3
            bg-surface-light
            border border-card-border
            rounded-xl
            text-text text-sm
            placeholder:text-text-muted/40
            transition-all duration-200
            hover:border-gray-300 dark:hover:border-gray-600
            focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10
            disabled:bg-surface disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-error focus:border-error focus:ring-error/10' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-error font-medium">{error}</p>
      )}
    </div>
  );
}
