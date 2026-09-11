import { useOutletContext } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Panel } from '../components/ui/Panel';
import { Progress } from '../components/ui/Progress';
import { fmt, meetsRequirements, remaining } from '../app/format';
import type { ShellContext } from '../components/shell/AppShell';

export function ResearchView() {
  const { catalog, state, execute } = useOutletContext<ShellContext>();
  return <><header className="page-header"><div><div className="eyebrow">SCIENCE DIRECTORATE</div><h1>Pesquisa</h1><p>Programa global do império · taxa efetiva {fmt(state.capacities.effective_research_rate, 2)}/s</p></div></header><div className="tech-grid">{catalog.technologies.map(technology => { const completed = state.research.completed.includes(technology.id); const active = state.research.active === technology.id; const available = meetsRequirements(catalog, state, technology); return <Panel key={technology.id} title={technology.name} eyebrow={technology.category}><p>{technology.description}</p><div className="metric-line"><span>Status</span><Badge tone={completed ? 'good' : active ? 'blue' : available ? 'neutral' : 'warn'}>{completed ? 'CONCLUÍDA' : active ? 'PESQUISANDO' : available ? 'DISPONÍVEL' : 'BLOQUEADA'}</Badge></div>{active && <Progress value={100 * (1 - state.research.remaining_work / Math.max(1, technology.duration))} text={`${remaining(state.research.complete_at)} · ${fmt(100 * (1 - state.research.remaining_work / Math.max(1, technology.duration)))}%`} />}<small>{technology.requires.length ? `Requer: ${technology.requires.join(', ')}` : 'Sem requisitos'}</small>{!completed && available && !state.research.active && <button className="action compact" onClick={() => void execute('research', { id: technology.id })}>Pesquisar</button>}</Panel>; })}</div></>;
}
