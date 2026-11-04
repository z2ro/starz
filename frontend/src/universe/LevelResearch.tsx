import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ShellContext } from '../components/shell/AppShell';
import { apiRequest } from '../api/client';
import { cost, label, duration, remaining } from '../app/format';
import type { Universe } from './types';
export function LevelResearch(){
 const {state,catalog,execute,busy,activePlanetId}=useOutletContext<ShellContext>();
 const [category,setCategory]=useState('all');
 const q=useQuery({queryKey:['universe',activePlanetId],queryFn:()=>apiRequest<Universe>(`/api/universe${activePlanetId?'?planet_id='+encodeURIComponent(activePlanetId):''}`),refetchInterval:15000});
 const categories=[...new Set(catalog.technologies.map(t=>t.category))];
 return <div className="universe-command"><header><span className="eyebrow">SCIENCE DIRECTORATE · LEVEL PROGRESSION</span><h1>Pesquisa imperial</h1><p>32 linhas · custos ×1,70 e trabalho ×1,55 por nível · efeitos aditivos entre níveis. Cada linha possui limite técnico 50 neste experimento.</p><p>{state.research.active?`${label(catalog,state.research.active)} → nível ${(state.empire_levels?.[state.research.active]??0)+1} · ${remaining(state.research.complete_at)}`:'Nenhuma pesquisa ativa'} · {state.capacities.effective_research_rate.toFixed(2)} trabalho/s</p></header><div className="universe-tabs"><button aria-pressed={category==='all'} onClick={()=>setCategory('all')}>TODAS</button>{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>{q.error&&<p role="alert">{q.error.message}</p>}<div className="universe-research">{q.data?.research.filter(t=>category==='all'||catalog.technologies.find(c=>c.id===t.id)?.category===category).map(t=><section key={t.id}><div><h2>{label(catalog,t.id)} <small>Nível {t.level} → {t.next_level}</small></h2><p>{catalog.technologies.find(c=>c.id===t.id)?.description}</p><p>{cost(catalog,t.cost)} · {t.work} trabalho · ETA {duration(t.work/Math.max(.01,state.capacities.effective_research_rate))}</p>{Object.entries(t.effects).map(([key,v])=><p key={key}><b>{key}</b>: {v.current.toFixed(2)} → {v.next.toFixed(2)}<span> · modificadores aditivos; slots/colônias são inteiros e armazenamento usa 1,7^nível</span></p>)}<p>{t.requirements.length?t.requirements.join(' · '):'Requisitos atendidos'}</p></div><button className="button" disabled={busy||!!state.research.active||t.requirements.length>0||Object.entries(t.cost).some(([r,n])=>(state.stocks[r]??0)<n)} onClick={()=>void execute('research',{id:t.id,planet_id:activePlanetId}).catch(()=>undefined)}>{state.research.active===t.id?'PESQUISANDO':`PESQUISAR NÍVEL ${t.next_level}`}</button></section>)}</div></div>;
}
