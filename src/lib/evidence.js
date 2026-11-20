import {supabase} from './supabase';

export const emptyPerformance = {attempts:0, hints:0, correct:0};

export function summarizeEvidence(rows = []) {
  const byExercise = {};
  const completed = new Set();
  let stars = 0;

  rows.forEach(row => {
    const current = byExercise[row.exercise_id] || {...emptyPerformance};
    byExercise[row.exercise_id] = {
      attempts: Math.max(current.attempts, row.attempts || 0),
      hints: Math.max(current.hints, row.hints_used || 0),
      correct: Math.max(current.correct, row.status === 'resuelto' ? 1 : 0),
    };
    if (row.status === 'resuelto') completed.add(row.exercise_id);
    stars += row.stars_earned || 0;
  });

  return {done:[...completed], stars, performance:byExercise};
}

export async function loadEvidence() {
  if (!supabase) return [];
  const {data, error} = await supabase
    .from('learning_evidence')
    .select('id,exercise_id,module_id,skill,status,attempts,hints_used,stars_earned,response,created_at')
    .order('created_at', {ascending:true});
  if (error) throw error;
  return data || [];
}

export async function saveEvidence(exercise, details) {
  if (!supabase) return null;
  const {error} = await supabase.rpc('record_learning_evidence', {
    p_exercise_id: exercise.id,
    p_module_id: exercise.module,
    p_skill: exercise.skill,
    p_status: details.status,
    p_attempts: details.attempts || 0,
    p_hints_used: details.hints || 0,
    p_stars_earned: details.stars || 0,
    p_response: details.response ?? null,
  });
  if (error) throw error;
}
