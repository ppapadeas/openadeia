import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesPath = join(__dirname, '../../config/nok-rules.json');

const NOK_RULES = JSON.parse(readFileSync(rulesPath, 'utf8'));

export function getRules(type) {
  if (!NOK_RULES[type]) throw new Error(`Unknown permit type: ${type}`);
  return NOK_RULES[type];
}

export function getAllTypes() {
  return Object.entries(NOK_RULES).map(([id, r]) => ({ id, label: r.label, shortLabel: r.shortLabel }));
}

export function getChecklist(type) {
  const rules = getRules(type);
  return {
    studies: rules.requiredStudies,
    documents: rules.requiredDocuments,
    approvals: rules.requiredApprovals,
    workflowStages: rules.workflowStages,
    estimatedDays: rules.estimatedDays,
    fees: rules.fees,
  };
}

export function validateStageTransition(type, fromStage, toStage) {
  const rules = getRules(type);
  const stages = rules.workflowStages;
  const fromIdx = stages.indexOf(fromStage);
  const toIdx = stages.indexOf(toStage);
  if (fromIdx === -1 || toIdx === -1) return { valid: false, reason: 'Invalid stage' };
  if (toIdx !== fromIdx + 1 && toStage !== 'data_collection') {
    return { valid: false, reason: 'Cannot skip stages' };
  }
  return { valid: true };
}

export default NOK_RULES;
