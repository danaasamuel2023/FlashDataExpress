'use client';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/25 hover:shadow-orange-600/40',
  secondary: 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700',
  outline: 'border border-gray-200 dark:border-gray-700 hover:border-orange-500 text-gray-800 dark:text-white hover:text-orange-600 bg-transparent',
  ghost: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 bg-transparent',
  danger: 'bg-error hover:bg-red-600 text-white',
  accent: 'bg-navy hover:bg-navy-dark text-white font-bold'
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3.5 text-base rounded-xl',
  xl: 'px-8 py-4 text-lg rounded-2xl'
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold
        transition-all duration-200
        focus-ring
        disabled:opacity-50 disabled:cursor-not-allowed
        active:scale-[0.98]
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
