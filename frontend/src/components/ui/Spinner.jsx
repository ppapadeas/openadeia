/**
 * Spinner — lightweight loading indicator
 * size: 'sm' | 'md' | 'lg'
 */
export default function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 14, md: 18, lg: 28 };
  const s = sizes[size] ?? 18;
  return (
    <span
      className={`inline-block rounded-full border-2 border-white/20 border-t-white animate-spin flex-shrink-0 ${className}`}
      style={{ width: s, height: s }}
      aria-label="Φόρτωση…"
      role="status"
    />
  );
}
