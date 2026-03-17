'use client';

export default function Logo({ size = 'md' }) {
  const iconDim = { sm: 28, md: 32, lg: 40 }[size];
  const textSize = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' }[size];

  return (
    <span className="inline-flex items-center gap-2 group">
      {/* Rounded square with orange-to-rose gradient, lightning bolt with speed lines */}
      <svg width={iconDim} height={iconDim} viewBox="0 0 40 40" fill="none" className="transition-transform duration-300 group-hover:scale-110">
        {/* Gradient background */}
        <defs>
          <linearGradient id="flash-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#flash-grad)" className="group-hover:opacity-90 transition-opacity" />
        {/* Speed lines */}
        <line x1="6" y1="14" x2="14" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
        <line x1="4" y1="20" x2="13" y2="20" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.4" />
        <line x1="6" y1="26" x2="14" y2="26" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.3" />
        {/* Lightning bolt */}
        <path d="M22 6 L16 19 L22 19 L17 34 L30 17 L23 17 L28 6 Z" fill="white" />
      </svg>
      {/* Text: "Flash" + "Data" + EXPRESS badge */}
      <div className={`flex items-baseline gap-0.5 ${textSize} font-extrabold tracking-tight`}>
        <span className="text-gray-900 dark:text-white">Flash</span>
        <span className="text-orange-500">Data</span>
        <span className="ml-1 text-[9px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider leading-none self-center">Express</span>
      </div>
    </span>
  );
}
