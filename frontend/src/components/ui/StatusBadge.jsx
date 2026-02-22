import { DOC_STATUS } from '../../utils/index.js';

export default function StatusBadge({ status }) {
  const s = DOC_STATUS[status] || DOC_STATUS.pending;
  return (
    <span className="badge text-xs"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
