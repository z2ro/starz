import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCatalogQuery, useStateQuery } from '../../api/queries';
import { useGameMutation } from '../../api/mutations';
import { TopHud } from './TopHud';
import { Sidebar } from './Sidebar';
import { ContextPanel } from './ContextPanel';
import type { ActionName, Catalog, State } from '../../types/game';

export type ShellContext = { catalog: Catalog; state: State; activePlanetId?: string; setActivePlanetId: (id: string) => void; execute: (action: ActionName, body: Record<string, unknown>) => Promise<unknown>; busy: boolean; feedback?: { kind: 'success' | 'error'; message: string }; setFeedback: (feedback?: { kind: 'success' | 'error'; message: string }) => void };
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activePlanetId, setActivePlanetId] = useState<string>();
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedback, setFeedback] = useState<ShellContext['feedback']>();
  const catalogQuery = useCatalogQuery();
  const stateQuery = useStateQuery(activePlanetId);
  const mutation = useGameMutation(activePlanetId);
  const catalog = catalogQuery.data;
  const state = stateQuery.data;
  const execute = async (action: ActionName, body: Record<string, unknown>) => {
    setFeedback(undefined);
    try { const result = await mutation.mutateAsync({ action, body }); setFeedback({ kind: 'success', message: action === 'build' ? 'Construção iniciada.' : action === 'research' ? 'Programa de pesquisa iniciado.' : action === 'build-ship' ? 'Montagem da nave iniciada.' : action === 'travel' ? 'Frota despachada.' : 'Rota calculada.' }); return result; } catch (error) { const message = error instanceof Error ? error.message : 'Falha de comunicação.'; setFeedback({ kind: 'error', message }); throw error; }
  };
  if (catalogQuery.isPending || stateQuery.isPending || !catalog || !state) return <div className="boot"><div className="brand"><span>STAR</span><b>Z</b></div><div className="boot-orbit" /><p>Sincronizando centro de comando…</p></div>;
  if (catalogQuery.error || stateQuery.error) return <div className="fatal"><b>Centro de comando indisponível</b><p>{(catalogQuery.error ?? stateQuery.error)?.message}</p><button onClick={() => { void catalogQuery.refetch(); void stateQuery.refetch(); }}>Tentar novamente</button></div>;
  const context: ShellContext = { catalog, state, activePlanetId: state.active_planet?.id ?? activePlanetId, setActivePlanetId: id => { setActivePlanetId(id); navigate('/planet'); }, execute, busy: mutation.isPending, feedback, setFeedback };
  const isPlanet = location.pathname === '/planet';
  return <div className="app-root" aria-busy={mutation.isPending}><TopHud catalog={catalog} state={state} noticeOpen={noticeOpen} settingsOpen={settingsOpen} onNotice={() => { setNoticeOpen(value => !value); setSettingsOpen(false); }} onSettings={() => { setSettingsOpen(value => !value); setNoticeOpen(false); }} /><div className={`app-shell ${isPlanet ? 'planet-shell' : ''}`}><Sidebar state={state} /><main className={`main-content ${isPlanet ? 'main-content-planet' : ''}`}><Outlet context={context} /></main>{!isPlanet && <ContextPanel catalog={catalog} state={state} />}</div>{feedback && <div className={`toast ${feedback.kind}`} role="status"><i>{feedback.kind === 'success' ? '✓' : '!'}</i><span>{feedback.message}</span><button onClick={() => setFeedback(undefined)} aria-label="Fechar">×</button></div>}{mutation.isPending && <div className="loading-line" />}</div>;
}
