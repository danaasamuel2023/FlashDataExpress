'use client';

const icons = {
  YELLO: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="16" fill="#FFCC00"/>
      <ellipse cx="50" cy="50" rx="38" ry="26" stroke="#000" strokeWidth="4" fill="none"/>
      <text x="50" y="57" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontSize="20" fontWeight="900" fill="#000">MTN</text>
    </svg>
  ),
  TELECEL: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="16" fill="#FFF"/>
      <circle cx="50" cy="50" r="42" fill="#E30613"/>
      <text x="50" y="65" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="600" fill="#FFF">t</text>
    </svg>
  ),
  AT_PREMIUM: ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#0066B3"/>
      <circle cx="35" cy="40" r="6" fill="#FFF"/>
      <circle cx="65" cy="40" r="6" fill="#FFF"/>
      <path d="M30 58 Q50 78 70 58" stroke="#FFF" strokeWidth="6" fill="none" strokeLinecap="round"/>
    </svg>
  )
};

export default function NetworkIcon({ network, size = 40 }) {
  const Icon = icons[network] || icons.YELLO;
  return <Icon size={size} />;
}
