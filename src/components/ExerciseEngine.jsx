import React, {Component, useEffect, useMemo, useState} from 'react';

const normalize = value => String(value).trim().replace(',', '.').toLowerCase();
const labels = {inicio:'Inicio', práctica:'Práctica', desafío:'Desafío'};

function ExerciseEngineContent({moduleId, exercises, completedIds, onComplete, onAttempt, onHint}) {
  const moduleExercises = useMemo(() => exercises.filter(exercise => exercise.module === moduleId), [exercises, moduleId]);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [showHint, setShowHint] = useState(false);
  const exercise = moduleExercises[index];

  useEffect(() => { setIndex(0); setMessage(''); setShowHint(false); }, [moduleId]);
  if (!exercise) return null;

  const selectExercise = next => { setIndex(next); setMessage(''); setShowHint(false); };
  const finish = correct => {
    onAttempt(exercise, correct);
    if (correct) {
      onComplete(exercise);
      setMessage({good:true, text:`${exercise.explanation} +${exercise.stars} estrellas.`});
    } else {
      setShowHint(true);
      setMessage({good:false, text:'Casi lo tienes. Revisa la pista, ajusta tu estrategia e inténtalo otra vez.'});
    }
  };

  return <section className={exercise.type === 'robot' ? 'robot-task' : 'task'}>
    <ExerciseNavigation exercises={moduleExercises} index={index} completedIds={completedIds} onSelect={selectExercise}/>
    <div className="exercise-meta"><span className={`level ${exercise.difficulty}`}>{labels[exercise.difficulty]}</span><span>{exercise.skill}</span><span>⭐ {exercise.stars}</span></div>
    <><ExerciseRenderer key={exercise.id} exercise={exercise} onValidate={finish}/><div className="hint-area">{showHint && <p className="hint">💡 <b>Pista:</b> {exercise.hint}</p>}<button type="button" className="hint-button" onClick={()=>{if(!showHint) onHint(exercise); setShowHint(value=>!value)}}>{showHint ? 'Ocultar pista' : 'Ver pista'}</button></div></>
    {message && <Feedback good={message.good} text={message.text}/>} 
  </section>;
}

class ExerciseErrorBoundary extends Component {
  constructor(props) { super(props); this.state = {hasError:false}; }
  static getDerivedStateFromError() { return {hasError:true}; }
  componentDidUpdate(previousProps) { if (previousProps.moduleId !== this.props.moduleId && this.state.hasError) this.setState({hasError:false}); }
  render() {
    if (this.state.hasError) return <section className="task engine-recovery" role="alert"><span>🧩</span><h3>Este reto necesita reiniciarse.</h3><p>No se perdió tu progreso. Regresa al tablero y vuelve a abrir el módulo.</p><button type="button" className="primary" onClick={()=>this.setState({hasError:false})}>Intentar de nuevo</button></section>;
    return this.props.children;
  }
}

export default function ExerciseEngine(props) { return <ExerciseErrorBoundary moduleId={props.moduleId}><ExerciseEngineContent {...props}/></ExerciseErrorBoundary>; }

function ExerciseNavigation({exercises,index,completedIds,onSelect}) { return <div className="task-nav"><b>Reto {index+1} de {exercises.length}</b><div>{exercises.map((item, position)=><button type="button" key={item.id} aria-label={`Ir al reto ${position+1}${completedIds.includes(item.id)?', resuelto':''}`} className={position===index?'active':completedIds.includes(item.id)?'complete':''} onClick={()=>onSelect(position)}>{position+1}</button>)}</div></div>; }

function ExerciseRenderer({exercise,onValidate}) {
  if (exercise.type === 'multiple-choice') return <MultipleChoice exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'multi-select') return <MultiSelect exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'numeric' || exercise.type === 'pattern') return <InputAnswer exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'order') return <OrderAnswer exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'staged') return <StagedProblem exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'division-lab') return <DivisionLab exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'fraction-builder') return <FractionBuilder exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'fraction-match') return <FractionMatch exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'chart') return <ChartExercise exercise={exercise} onValidate={onValidate}/>;
  if (exercise.type === 'robot') return <RobotExercise exercise={exercise} onValidate={onValidate}/>;
  return null;
}

function MultipleChoice({exercise,onValidate}) { const [selected,setSelected] = useState(''); return <><h3>{exercise.prompt}</h3><div className="options" role="group" aria-label="Opciones de respuesta">{exercise.options.map((option,index)=><button type="button" key={option.id} aria-pressed={selected===option.id} className={selected===option.id?'chosen':''} onClick={()=>setSelected(option.id)}><i>{String.fromCharCode(65+index)}</i>{option.text}</button>)}</div><CheckButton onClick={()=>onValidate(selected===exercise.answer)} disabled={!selected}/></>; }

function MultiSelect({exercise,onValidate}) { const [selected,setSelected] = useState([]); const toggle = id => setSelected(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]); const correct = selected.length===exercise.answer.length && exercise.answer.every(item=>selected.includes(item)); return <><h3>{exercise.prompt}</h3><div className="options" role="group" aria-label="Selecciona todas las opciones correctas">{exercise.options.map((option,index)=><button type="button" key={option.id} aria-pressed={selected.includes(option.id)} className={selected.includes(option.id)?'chosen':''} onClick={()=>toggle(option.id)}><i>{String.fromCharCode(65+index)}</i>{option.text}</button>)}</div><CheckButton onClick={()=>onValidate(correct)} disabled={!selected.length}/></>; }

function InputAnswer({exercise,onValidate}) { const [value,setValue] = useState(''); const pattern = exercise.data?.sequence; return <><h3>{exercise.prompt}</h3>{pattern && <div className="sequence" aria-label={`Secuencia: ${pattern.join(', ')}`}>{pattern.map((item,index)=><span key={index}>{item}</span>)}</div>}<label className="answer-input">Escribe tu respuesta<input inputMode="decimal" value={value} onChange={event=>setValue(event.target.value)} placeholder="Tu respuesta"/></label>{exercise.data?.suffix && <p className="answer-suffix">Respuesta en {exercise.data.suffix}.</p>}<CheckButton onClick={()=>onValidate(normalize(value)===normalize(exercise.answer))} disabled={!value.trim()}/></>; }

function OrderAnswer({exercise,onValidate}) { const [items,setItems] = useState(exercise.data.items); const [drag,setDrag] = useState(null); const shift=(position,direction)=>{let copy=[...items], next=position+direction;if(next<0||next>=copy.length)return;copy.splice(next,0,copy.splice(position,1)[0]);setItems(copy)}; const drop=position=>{if(drag===null||drag===position)return;let copy=[...items];copy.splice(position,0,copy.splice(drag,1)[0]);setItems(copy);setDrag(null)}; return <><h3>{exercise.prompt}</h3><p className="sub">Arrastra las tarjetas o usa las flechas para organizar los pasos.</p><ol className="sortable">{items.map((item,position)=><li key={item} draggable onDragStart={()=>setDrag(position)} onDragOver={event=>event.preventDefault()} onDrop={()=>drop(position)}><b>{position+1}</b><span>{item}</span><div><button type="button" aria-label={`Subir ${item}`} onClick={()=>shift(position,-1)}>↑</button><button type="button" aria-label={`Bajar ${item}`} onClick={()=>shift(position,1)}>↓</button></div></li>)}</ol><CheckButton label="Comprobar algoritmo" onClick={()=>onValidate(items.join('|')===exercise.answer.join('|'))}/></>; }

function StagedProblem({exercise,onValidate}) { const [answers,setAnswers] = useState([]); const setAnswer=(step,answer)=>setAnswers(current=>{let copy=[...current];copy[step]=answer;return copy}); const correct=exercise.data.steps.every((step,index)=>answers[index]===step.answer); return <><div className="problem"><span>🧪</span><h3>{exercise.prompt}</h3></div>{exercise.data.steps.map((step,index)=><fieldset key={step.label}><legend>{index+1}. {step.label}</legend>{step.options.map((option,optionIndex)=><label key={option}><input type="radio" name={`${exercise.id}-${index}`} checked={answers[index]===optionIndex} onChange={()=>setAnswer(index,optionIndex)}/><span>{option}</span></label>)}</fieldset>)}<CheckButton label="Revisar mi razonamiento" onClick={()=>onValidate(correct)} disabled={answers.length!==exercise.data.steps.length}/></>; }

function DivisionLab({exercise,onValidate}) { const {dividend,divisor,object}=exercise.data; const [groups,setGroups]=useState(Array(divisor).fill(0)); const given=groups.reduce((sum,value)=>sum+value,0),remaining=dividend-given,quotient=Math.floor(dividend/divisor),residue=dividend%divisor; const distribute=()=>setGroups(current=>{if(current.reduce((sum,value)=>sum+value,0)>=dividend)return current;let next=[...current],target=current.reduce((sum,value)=>sum+value,0)%divisor;next[target]+=1;return next}); const reset=()=>setGroups(Array(divisor).fill(0)); const solved=remaining===0&&groups.every(value=>value===quotient); return <><h3>{exercise.prompt}</h3><div className="division-math"><span>Dividendo <b>{dividend}</b></span><span>Divisor <b>{divisor}</b></span><span>Cociente <b>{quotient}</b></span><span>Residuo <b>{residue}</b></span></div><div className="distribution-groups">{groups.map((amount,index)=><div className="group-bucket" key={index}><b>Equipo {index+1}</b><div aria-label={`${amount} objetos`}>{Array.from({length:amount},(_,item)=><span key={item}>{object}</span>)}</div><small>{amount} recibidos</small></div>)}</div><p className="remaining-objects">Quedan por repartir: <b>{remaining}</b> {object}</p><div className="lab-actions"><button type="button" className="primary" onClick={distribute} disabled={!remaining}>Repartir una vuelta</button><button type="button" className="hint-button" onClick={reset}>Reiniciar reparto</button></div><CheckButton label="Comprobar reparto" onClick={()=>onValidate(solved)} disabled={!given}/></>; }

function FractionBuilder({exercise,onValidate}) { const {total,target}=exercise.data; const [parts,setParts]=useState([]); const toggle=index=>setParts(current=>current.includes(index)?current.filter(part=>part!==index):current.length>=target?current:[...current,index]); return <><h3>{exercise.prompt}</h3><div className="fraction-bar" role="group" aria-label="Barra dividida en partes iguales">{Array.from({length:total},(_,index)=><button type="button" key={index} aria-label={`Parte ${index+1} de ${total}`} aria-pressed={parts.includes(index)} className={parts.includes(index)?'filled':''} onClick={()=>toggle(index)} />)}</div><p className="fraction-count"><b>{parts.length}/{total}</b> partes seleccionadas</p><CheckButton label="Comprobar fracción" onClick={()=>onValidate(parts.length===target)}/></>; }

function FractionMatch({exercise,onValidate}) { const [selected,setSelected]=useState([]); const [dragged,setDragged]=useState(null); const toggle=id=>setSelected(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]); const correct=selected.length===exercise.answer.length&&exercise.answer.every(item=>selected.includes(item)); return <><h3>{exercise.prompt}</h3><div className="fraction-target" onDragOver={event=>event.preventDefault()} onDrop={()=>{if(dragged)toggle(dragged);setDragged(null)}}><span>Objetivo</span><b>{exercise.data.target}</b><small>Suelta aquí las equivalentes</small></div><div className="fraction-cards">{exercise.options.map(option=><button type="button" draggable key={option.id} aria-pressed={selected.includes(option.id)} className={selected.includes(option.id)?'selected':''} onDragStart={()=>setDragged(option.id)} onClick={()=>toggle(option.id)}>{option.text}</button>)}</div><p className="sub">Puedes arrastrar una tarjeta al objetivo o tocarla para seleccionarla.</p><CheckButton label="Comprobar equivalencias" onClick={()=>onValidate(correct)} disabled={!selected.length}/></>; }

function ChartExercise({exercise,onValidate}) { const [selected,setSelected]=useState(''); const largest=Math.max(...exercise.data.rows.map(([,value])=>value)); return <><h3>{exercise.prompt}</h3><div className="data-view"><table><caption>Puntos por equipo</caption><thead><tr><th>Equipo</th><th>Puntos</th></tr></thead><tbody>{exercise.data.rows.map(([name,value])=><tr key={name}><td>{name}</td><td>{value}</td></tr>)}</tbody></table><div className="bar-chart" aria-label="Gráfica de barras de puntos por equipo">{exercise.data.rows.map(([name,value])=><div key={name}><i style={{height:`${(value/largest)*100}%`}} /><b>{value}</b><span>{name}</span></div>)}</div></div><div className="options" role="group" aria-label="Opciones de respuesta">{exercise.options.map((option,index)=><button type="button" key={option.id} aria-pressed={selected===option.id} className={selected===option.id?'chosen':''} onClick={()=>setSelected(option.id)}><i>{String.fromCharCode(65+index)}</i>{option.text}</button>)}</div><CheckButton onClick={()=>onValidate(selected===exercise.answer)} disabled={!selected}/></>; }

function RobotExercise({exercise,onValidate}) { const [code,setCode]=useState([]); const [position,setPosition]=useState(exercise.data.start); const [running,setRunning]=useState(false); const labels={A:'↑ Avanzar',L:'↶ Izquierda',R:'↷ Derecha'}; const directions=['N','E','S','W']; const movement={N:[-1,0],E:[0,1],S:[1,0],W:[0,-1]}; const run=()=>{let direction=exercise.data.direction,at=exercise.data.start,route=[];code.forEach(command=>{if(command==='L')direction=directions[(directions.indexOf(direction)+3)%4];if(command==='R')direction=directions[(directions.indexOf(direction)+1)%4];if(command==='A'){let [row,col]=movement[direction],next=[at[0]+row,at[1]+col];if(next[0]>=0&&next[0]<3&&next[1]>=0&&next[1]<3)at=next;route.push(at)}});setPosition(exercise.data.start);setRunning(true);route.forEach((step,index)=>setTimeout(()=>{setPosition(step);if(index===route.length-1){setRunning(false);onValidate(code.join(',')===exercise.answer.join(',')&&step.join(',')===exercise.data.target.join(','))}},360*(index+1)));if(!route.length){setRunning(false);onValidate(false)}}; return <><h3>{exercise.prompt}</h3><div className="robot-layout"><div className={'robot-grid '+(running?'running':'')} aria-label="Cuadrícula de tres por tres del robot">{Array.from({length:9},(_,index)=>{let cell=[Math.floor(index/3),index%3],robot=cell.join(',')===position.join(','),battery=cell.join(',')===exercise.data.target.join(',');return <div key={index} className={battery?'battery':robot?'robot-cell':''}>{battery?'🔋':robot?'🤖':''}</div>})}</div><div className="coder"><h3>Construye la secuencia</h3><p>{exercise.hint}</p><div className="code-line" aria-live="polite">{code.length?code.map((item,index)=><button type="button" aria-label={`Quitar instrucción ${index+1}`} key={`${item}-${index}`} onClick={()=>setCode(current=>current.filter((_,position)=>position!==index))}>{labels[item]} ×</button>):<span>Agrega instrucciones aquí</span>}</div><div className="commands">{Object.entries(labels).map(([command,label])=><button type="button" key={command} onClick={()=>{setCode(current=>[...current,command]);setPosition(exercise.data.start)}}>{label}</button>)}</div><CheckButton label={running?'Ejecutando…':'▶ Ejecutar algoritmo'} onClick={run} disabled={!code.length||running}/></div></div></>; }

function CheckButton({label='Comprobar respuesta',onClick,disabled}) { return <button type="button" className="primary" onClick={onClick} disabled={disabled}>{label}</button>; }
function Feedback({good,text}) { return <div className={'feedback '+(good?'good':'try')} role="status" aria-live="polite"><b>{good?'✦ ¡Muy bien!':'↻ Sigue explorando'}</b><span>{text}</span></div>; }
