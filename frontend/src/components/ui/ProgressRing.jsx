export default function ProgressRing({ progress = 0, size = 54, stroke = 4, color = '#3B82F6' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(200,200,210,0.15)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: 11, fontWeight: 700, fill: color, fontFamily: 'DM Sans,sans-serif' }}>
        {progress}%
      </text>
    </svg>
  );
}
