import { useMemo, useState, type CSSProperties } from 'react';
import { useOutletContext } from 'react-router-dom';
import { cost, fmt, label, remaining } from '../app/format';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataRow } from '../components/ui/DataRow';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Inspector, InspectorSection } from '../components/ui/Inspector';
import { Progress } from '../components/ui/Progress';
import { SectionHeader } from '../components/ui/SectionHeader';
import type { ShellContext } from '../components/shell/AppShell';
import type { Technology } from '../types/game';
import { defaultTechnologyId, technologyGraph, technologyState, type TechnologyState } from './researchMap';

type StatusFilter = 'all' | TechnologyState;
const statusLabel: Record<TechnologyState, string> = { completed: 'CONCLUÍDA', active: 'ATIVA', available: 'DISPONÍVEL', locked: 'BLOQUEADA' };
const statusTone: Record<TechnologyState, 'positive' | 'research' | 'active' | 'default'> = { completed: 'positive', active: 'research', available: 'active', locked: 'default' };
const progress = (technology: Technology, remainingWork: number) => 100 * (1 - remainingWork / Math.max(1, technology.duration));

export function ResearchView() {
  const { catalog, state, execute, busy } = useOutletContext<ShellContext>();
  const graph = useMemo(() => technologyGraph(catalog.technologies), [catalog.technologies]);
  const categories = useMemo(() => [...new Set(catalog.technologies.map(technology => technology.category))], [catalog.technologies]);
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState(() => defaultTechnologyId(catalog, state));
  const selected = catalog.technologies.find(technology => technology.id === selectedId) ?? catalog.technologies.find(technology => technology.id === defaultTechnologyId(catalog, state));
  const visible = catalog.technologies.filter(technology => (category === 'all' || technology.category === category) && (status === 'all' || technologyState(catalog, state, technology) === status));
  const completed = state.research.completed.length;

  if (!catalog.technologies.length) return <div className="research-command"><header className="research-command-header"><div><span className="eyebrow">SCIENCE DIRECTORATE</span><h1>Pesquisa</h1></div></header><EmptyState title="Nenhuma tecnologia catalogada" icon="research">O catálogo atual não contém programas científicos.</EmptyState></div>;

  return <div className="research-command">
    <header className="research-command-header"><div><span className="eyebrow">SCIENCE DIRECTORATE</span><h1>Sistemas científicos</h1><p>Programa global do império · dependências e desbloqueios do catálogo científico.</p></div><div className="research-command-rate"><Icon name="research" className="ui-icon" /><span>Taxa efetiva de pesquisa</span><strong>{fmt(state.capacities.effective_research_rate, 2)}/s</strong><small>{completed} / {catalog.technologies.length} concluída(s)</small></div></header>

    <section className="research-filters" aria-label="Filtros de pesquisa"><div className="research-filter-group" role="group" aria-label="Categorias"><span>Categoria</span><button type="button" className={category === 'all' ? 'active' : ''} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>TODAS</button>{categories.map(item => <button type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="research-filter-group" role="group" aria-label="Estados"><span>Estado</span>{(['all', 'available', 'active', 'completed', 'locked'] as StatusFilter[]).map(item => <button type="button" className={status === item ? 'active' : ''} aria-pressed={status === item} key={item} onClick={() => setStatus(item)}>{item === 'all' ? 'TODAS' : statusLabel[item]}</button>)}</div></section>

    <div className="research-map-layout"><TechnologyMap catalog={catalog} state={state} technologies={visible} graph={graph} selectedId={selected?.id} onSelect={setSelectedId} /><TechnologyInspector catalog={catalog} state={state} technology={selected} execute={execute} busy={busy} /></div>
    <ActiveResearchConsole catalog={catalog} state={state} />
  </div>;
}

function TechnologyMap({ catalog, state, technologies, graph, selectedId, onSelect }: { catalog: ShellContext['catalog']; state: ShellContext['state']; technologies: Technology[]; graph: ReturnType<typeof technologyGraph>; selectedId?: string; onSelect: (id: string) => void }) {
  const visibleIds = new Set(technologies.map(technology => technology.id));
  const edges = graph.edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  const columns = [...new Set(technologies.map(technology => graph.depth[technology.id] ?? 0))].sort((a, b) => a - b);
  const rows = Math.max(1, ...columns.map(depth => technologies.filter(technology => graph.depth[technology.id] === depth).length));
  return <section className="technology-map-shell" aria-label="Mapa de sistemas científicos"><SectionHeader title="Mapa tecnológico" eyebrow="DEPENDÊNCIAS REAIS" count={technologies.length} />
    {technologies.length ? <div className="technology-map" style={{ '--graph-columns': columns.length, '--graph-rows': rows } as CSSProperties}><svg className="technology-edges" aria-hidden="true" viewBox={`0 0 ${columns.length * 100} ${rows * 100}`} preserveAspectRatio="none">{edges.map(edge => { const fromDepth = graph.depth[edge.from]; const toDepth = graph.depth[edge.to]; const fromRow = technologies.filter(technology => graph.depth[technology.id] === fromDepth).findIndex(technology => technology.id === edge.from); const toRow = technologies.filter(technology => graph.depth[technology.id] === toDepth).findIndex(technology => technology.id === edge.to); const sourceCompleted = state.research.completed.includes(edge.from); return <line key={`${edge.from}-${edge.to}`} className={sourceCompleted ? 'complete' : ''} x1={fromDepth * 100 + 92} y1={fromRow * 100 + 50} x2={toDepth * 100 + 8} y2={toRow * 100 + 50} />; })}</svg>{columns.map(depth => <div className="technology-column" key={depth}>{technologies.filter(technology => graph.depth[technology.id] === depth).map(technology => <TechnologyNode key={technology.id} technology={technology} state={technologyState(catalog, state, technology)} selected={technology.id === selectedId} activeProgress={state.research.active === technology.id ? progress(technology, state.research.remaining_work) : undefined} onSelect={onSelect} />)}</div>)}</div> : <EmptyState title="Nenhuma tecnologia neste filtro" icon="research">Ajuste categoria ou estado para ver outros programas científicos.</EmptyState>}
  </section>;
}

function TechnologyNode({ technology, state, selected, activeProgress, onSelect }: { technology: Technology; state: TechnologyState; selected: boolean; activeProgress?: number; onSelect: (id: string) => void }) {
  return <button type="button" className={`technology-node state-${state} ${selected ? 'selected' : ''}`} aria-pressed={selected} aria-label={`${technology.name}: ${statusLabel[state]}`} onClick={() => onSelect(technology.id)}><Icon name="research" className="ui-icon" /><span><small>{technology.category}</small><strong>{technology.name}</strong><em>{statusLabel[state]}</em>{activeProgress !== undefined && <Progress value={activeProgress} tone="research" />}</span></button>;
}

function TechnologyInspector({ catalog, state, technology, execute, busy }: { catalog: ShellContext['catalog']; state: ShellContext['state']; technology?: Technology; execute: ShellContext['execute']; busy: boolean }) {
  if (!technology) return <Inspector label="Inspector de tecnologia" className="technology-inspector" state="empty"><EmptyState title="Nenhuma tecnologia selecionada" icon="research">Selecione um programa no mapa científico.</EmptyState></Inspector>;
  const status = technologyState(catalog, state, technology);
  const active = status === 'active';
  const canStart = status === 'available' && !state.research.active;
  const externalRequirements = technology.requires.filter(id => !catalog.technologies.some(item => item.id === id));
  return <Inspector label="Inspector de tecnologia" className="technology-inspector" state={status === 'locked' ? 'unavailable' : 'default'} header={<div className="technology-inspector-header"><Icon name="research" className="ui-icon" /><div><span className="eyebrow">{technology.category}</span><strong>{technology.name}</strong></div><Badge tone={statusTone[status]}>{statusLabel[status]}</Badge></div>} summary={<p className="technology-description">{technology.description}</p>}>
    <InspectorSection title="Status"><DataRow label="Estado" value={statusLabel[status]} tone={statusTone[status]} />{active && <DataRow label="Taxa efetiva" value={fmt(state.capacities.effective_research_rate, 2)} unit="/s" tone="research" />}</InspectorSection>
    {technology.requires.length > 0 && <InspectorSection title="Requisitos">{technology.requires.map(id => { const satisfied = state.research.completed.includes(id) || (state.districts[id] ?? 0) > 0; return <DataRow key={id} label={label(catalog, id)} value={satisfied ? 'Atendido' : 'Pendente'} tone={satisfied ? 'positive' : 'warning'} />; })}</InspectorSection>}
    {technology.unlocks.length > 0 && <InspectorSection title="Desbloqueia">{technology.unlocks.map(id => <DataRow key={id} label={label(catalog, id)} value="Desbloqueia" tone="active" />)}</InspectorSection>}
    <InspectorSection title="Trabalho e custo"><DataRow label="Trabalho necessário" value={fmt(technology.duration)} unit="unidades" />{Object.keys(technology.cost).length > 0 && <DataRow label="Custo" value={cost(catalog, technology.cost)} />}</InspectorSection>
    {active && <InspectorSection title="Pesquisa ativa"><Progress value={progress(technology, state.research.remaining_work)} text={`${remaining(state.research.complete_at)} · ${fmt(progress(technology, state.research.remaining_work))}%`} tone="research" /><DataRow label="Trabalho restante" value={fmt(state.research.remaining_work, 2)} unit="unidades" /></InspectorSection>}
    <InspectorSection title="Ação">{canStart ? <Button variant="primary" loading={busy} onClick={() => void execute('research', { id: technology.id }).catch(() => undefined)}>Iniciar pesquisa</Button> : <p className="technology-action-note">{active ? 'Programa de pesquisa em andamento.' : status === 'completed' ? 'Pesquisa já concluída.' : state.research.active ? 'Programa de pesquisa já ativo.' : externalRequirements.length ? 'Requisitos externos pendentes.' : 'Requisitos ainda não atendidos.'}</p>}</InspectorSection>
  </Inspector>;
}

function ActiveResearchConsole({ catalog, state }: { catalog: ShellContext['catalog']; state: ShellContext['state'] }) {
  const technology = state.research.active ? catalog.technologies.find(item => item.id === state.research.active) : undefined;
  return <section className="active-research-console" aria-label="Pesquisa ativa"><SectionHeader title="Pesquisa ativa" eyebrow="CONSOLE CIENTÍFICO" count={technology ? 1 : 0} />{technology ? <div className="active-research-content"><Icon name="research" className="ui-icon" /><div><strong>{technology.name}</strong><span>Programa científico global · taxa efetiva {fmt(state.capacities.effective_research_rate, 2)}/s</span><Progress value={progress(technology, state.research.remaining_work)} text={`${remaining(state.research.complete_at)} · ${fmt(state.research.remaining_work, 2)} unidades restantes`} tone="research" /></div><Badge tone="research">EM PESQUISA</Badge></div> : <EmptyState title="Nenhum programa em andamento" icon="research">Não existe fila de pesquisa no domínio atual.</EmptyState>}</section>;
}
