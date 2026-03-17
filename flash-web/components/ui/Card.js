export default function Card({ children, className = '', padding = true, hover = false, glow = false, ...props }) {
  return (
    <div
      className={`
        bg-card rounded-2xl border border-card-border
        ${padding ? 'p-5 sm:p-6' : ''}
        ${hover ? 'hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 cursor-pointer' : ''}
        ${glow ? 'glow-primary' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
