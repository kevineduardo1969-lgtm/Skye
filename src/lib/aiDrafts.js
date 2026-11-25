export const supportedAiTypes = ['multiple-choice', 'numeric', 'multi-select', 'order'];

const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value.map(text).filter(Boolean) : [];

export function normalizeAiProposal(raw = {}) {
  const interaction_type = supportedAiTypes.includes(raw.interaction_type) ? raw.interaction_type : 'multiple-choice';
  const options = list(raw.options).slice(0, 6);
  const answer = list(raw.answer);
  return {
    title:text(raw.title).slice(0, 100),
    module_id:text(raw.module_id).slice(0, 80),
    skill:text(raw.skill).slice(0, 120),
    difficulty:['inicio', 'práctica', 'desafío'].includes(raw.difficulty) ? raw.difficulty : 'inicio',
    interaction_type,
    prompt:text(raw.prompt).slice(0, 600),
    options:interaction_type === 'numeric' ? [] : options,
    answer,
    hint:text(raw.hint).slice(0, 400),
    explanation:text(raw.explanation).slice(0, 600),
    stars:Math.min(10, Math.max(1, Number(raw.stars) || 3)),
  };
}

export function aiProposalToChallenge(proposal, teacherId, groupId) {
  const item = normalizeAiProposal(proposal);
  if (!teacherId || !groupId || !item.title || !item.module_id || !item.skill || !item.prompt || !item.hint || !item.explanation) throw new Error('Completa los datos del reto antes de guardarlo.');
  if (item.interaction_type === 'numeric') {
    if (!item.answer[0]) throw new Error('El reto numérico necesita una respuesta esperada.');
    return {...item, teacher_id:teacherId, group_id:groupId, status:'draft', options:[], answer:item.answer[0], data:{}};
  }
  if (item.interaction_type === 'order') {
    const steps = item.answer.length > 1 ? item.answer : item.options;
    if (steps.length < 2) throw new Error('El reto de pasos necesita por lo menos dos pasos ordenados.');
    return {...item, teacher_id:teacherId, group_id:groupId, status:'draft', options:[], answer:steps, data:{}};
  }
  if (item.options.length < 2) throw new Error('Agrega por lo menos dos opciones.');
  const dbOptions = item.options.map((option, index) => ({id:`o${index + 1}`, text:option}));
  const selected = item.answer.map(value => dbOptions.find(option => option.text === value)?.id).filter(Boolean);
  if (!selected.length || (item.interaction_type === 'multiple-choice' && selected.length !== 1)) throw new Error('Revisa que la respuesta coincida con las opciones del reto.');
  return {...item, teacher_id:teacherId, group_id:groupId, status:'draft', options:dbOptions, answer:item.interaction_type === 'multi-select' ? selected : selected[0], data:{}};
}

