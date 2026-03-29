import { formatDate } from '../../../utils/index.js';

export default function TimelineTab({ logs }) {
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-4 items-start">
          <div className="w-2 h-2 rounded-full bg-accent-blue mt-2 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium">{log.action}</div>
            <div className="text-xs text-text-muted mt-0.5">
              {log.user_name || 'Σύστημα'} · {formatDate(log.created_at)}
              {log.from_stage && <span> · {log.from_stage} → {log.to_stage}</span>}
            </div>
          </div>
        </div>
      ))}
      {logs.length === 0 && <div className="text-text-muted text-sm">Δεν υπάρχει ιστορικό</div>}
    </div>
  );
}
