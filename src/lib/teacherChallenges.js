import {supabase} from './supabase';

const supportedTypes = new Set(['multiple-choice', 'numeric', 'multi-select', 'order']);

const shuffled = values => values.length > 1 ? [...values.slice(1), values[0]] : [...values];

export function toExercise(row) {
  if (!supportedTypes.has(row.interaction_type)) return null;
  const options = Array.isArray(row.options) ? row.options : [];
  const answer = row.answer ?? '';
  return {
    id:`teacher-${row.id}`,
    source:'teacher',
    teacherChallengeId:row.id,
    title:row.title,
    module:row.module_id,
    skill:row.skill,
    difficulty:row.difficulty,
    type:row.interaction_type,
    prompt:row.prompt,
    options:row.interaction_type === 'numeric' || row.interaction_type === 'order' ? undefined : options,
    answer,
    data:row.interaction_type === 'order' ? {items:shuffled(answer)} : row.data || {},
    hint:row.hint,
    explanation:row.explanation,
    stars:row.stars,
  };
}

export async function loadPublishedTeacherChallenges() {
  if (!supabase) return [];
  const {data, error} = await supabase.from('teacher_challenges')
    .select('id,title,module_id,skill,difficulty,interaction_type,prompt,options,answer,data,hint,explanation,stars,status')
    .eq('status', 'published')
    .order('created_at', {ascending:true});
  if (error) throw error;
  return (data || []).map(toExercise).filter(Boolean);
}

