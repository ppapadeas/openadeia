import db from '../config/database.js';
import { getRules, validateStageTransition } from './nok-rules.js';

/**
 * Advance a project to the next workflow stage.
 * Validates all required documents/studies for current stage are complete.
 */
export async function advanceStage(projectId, userId) {
  const project = await db('projects').where({ id: projectId, deleted: false }).first();
  if (!project) throw new Error('Project not found');

  const rules = getRules(project.type);
  const stages = rules.workflowStages;
  const currentIdx = stages.indexOf(project.stage);
  if (currentIdx === -1) throw new Error('Current stage not in workflow');
  if (currentIdx === stages.length - 1) throw new Error('Already at final stage');

  const nextStage = stages[currentIdx + 1];

  // Validate readiness for advancing
  const check = await checkStageReadiness(project, rules);
  if (!check.ready) {
    return { advanced: false, reason: check.reason, missing: check.missing };
  }

  const newProgress = Math.round(((currentIdx + 1) / (stages.length - 1)) * 100);

  await db.transaction(async (trx) => {
    await trx('projects').where({ id: projectId }).update({
      stage: nextStage,
      progress: newProgress,
      updated_at: db.fn.now(),
    });
    await trx('workflow_logs').insert({
      project_id: projectId,
      action: `Μετάβαση σταδίου: ${project.stage} → ${nextStage}`,
      from_stage: project.stage,
      to_stage: nextStage,
      user_id: userId,
      metadata: { progress: newProgress },
    });
  });

  return { advanced: true, fromStage: project.stage, toStage: nextStage, progress: newProgress };
}

async function checkStageReadiness(project, rules) {
  const stage = project.stage;
  const missing = [];

  if (stage === 'data_collection') {
    // All required documents must be uploaded or signed
    const docs = await db('documents').where({ project_id: project.id });
    const docMap = Object.fromEntries(docs.map(d => [d.doc_type, d.status]));
    for (const req of rules.requiredDocuments) {
      const status = docMap[req.id];
      if (!status || !['uploaded', 'signed'].includes(status)) {
        missing.push(`Έγγραφο: ${req.label}`);
      }
    }
  }

  if (stage === 'studies') {
    // All required studies must be uploaded/signed
    const studyDocs = await db('documents')
      .where({ project_id: project.id })
      .whereIn('doc_type', rules.requiredStudies.map(s => s.id));
    const studyMap = Object.fromEntries(studyDocs.map(d => [d.doc_type, d.status]));
    for (const req of rules.requiredStudies) {
      const status = studyMap[req.id];
      if (!status || !['uploaded', 'signed'].includes(status)) {
        missing.push(`Μελέτη: ${req.label}`);
      }
    }
  }

  if (stage === 'signatures') {
    // All documents requiring signatures must have status 'signed'
    const allDocs = [...rules.requiredDocuments, ...rules.requiredStudies];
    const toSign = allDocs.filter(d => d.signerRole);
    if (toSign.length > 0) {
      const docs = await db('documents')
        .where({ project_id: project.id })
        .whereIn('doc_type', toSign.map(d => d.id));
      const docMap = Object.fromEntries(docs.map(d => [d.doc_type, d.status]));
      for (const req of toSign) {
        if (docMap[req.id] !== 'signed') {
          missing.push(`Υπογραφή: ${req.label}`);
        }
      }
    }
  }

  return { ready: missing.length === 0, reason: missing.join(', '), missing };
}

export async function rejectToStage(projectId, targetStage, reason, userId) {
  const project = await db('projects').where({ id: projectId }).first();
  if (!project) throw new Error('Project not found');

  await db.transaction(async (trx) => {
    await trx('projects').where({ id: projectId }).update({
      stage: targetStage,
      updated_at: db.fn.now(),
    });
    await trx('workflow_logs').insert({
      project_id: projectId,
      action: `Απόρριψη: ${project.stage} → ${targetStage}`,
      from_stage: project.stage,
      to_stage: targetStage,
      user_id: userId,
      metadata: { reason },
    });
  });
}
