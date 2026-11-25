import test from 'node:test';
import assert from 'node:assert/strict';
import {aiProposalToChallenge, normalizeAiProposal} from '../src/lib/aiDrafts.js';

test('normaliza una propuesta y limita estrellas', () => {
  const proposal = normalizeAiProposal({title:'  Patrón de semillas ', module_id:'pattern', skill:'Patrones', difficulty:'desafío', interaction_type:'multiple-choice', prompt:'¿Qué sigue?', options:['2','4','6'], answer:['4'], hint:'Mira el cambio.', explanation:'Suma dos.', stars:20});
  assert.equal(proposal.title, 'Patrón de semillas');
  assert.equal(proposal.stars, 10);
});

test('convierte una propuesta de selección en borrador seguro', () => {
  const result = aiProposalToChallenge({title:'Datos', module_id:'logic', skill:'Clasificación', interaction_type:'multi-select', prompt:'Elige datos.', options:['Cantidad','Color','Precio'], answer:['Cantidad','Precio'], hint:'Busca números.', explanation:'Los datos ayudan a decidir.', stars:3}, 'teacher-id', 'group-id');
  assert.deepEqual(result.answer, ['o1', 'o3']);
  assert.equal(result.status, 'draft');
});

