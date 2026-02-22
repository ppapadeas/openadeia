import { STAGES, PERMIT_TYPES } from '../../utils/index.js';

const STAGE_ORDERS = {
  vod:  ['init', 'data_collection', 'submission', 'review', 'approved'],
  cat1: ['init', 'data_collection', 'studies', 'submission', 'review', 'approved'],
  cat2: ['init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved'],
  cat3: ['init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved'],
};

export default function StageIndicator({ type, currentStage }) {
  const stageIds = STAGE_ORDERS[type] || STAGE_ORDERS.cat2;
  const currentIdx = stageIds.indexOf(currentStage);
  const pt = PERMIT_TYPES[type] || PERMIT_TYPES.vod;

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {stageIds.map((sid, i) => {
        const stageObj = STAGES.find(s => s.id === sid);
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={sid} className="flex items-center min-w-0 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              active ? 'text-white' : done ? 'text-emerald-400' : 'text-text-muted'
            }`} style={active ? { background: pt.color + '30', color: pt.color } : {}}>
              <span>{stageObj?.icon}</span>
              <span className="whitespace-nowrap">{stageObj?.label}</span>
            </div>
            {i < stageIds.length - 1 && (
              <span className={`text-lg mx-0.5 ${done ? 'text-emerald-400' : 'text-text-muted/30'}`}>›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
