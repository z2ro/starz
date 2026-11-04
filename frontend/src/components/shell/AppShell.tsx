import { CampaignStrip } from '../../campaign/CampaignStrip';
import { useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCatalogQuery, useStateQuery } from '../../api/queries';
import { useGameMutation } from '../../api/mutations';
import { TopHud } from './TopHud';
import { Sidebar } from './Sidebar';
import { ContextPanel } from './ContextPanel';
import type { ActionName, Catalog, State } from '../../types/game';

export type ShellContext = { catalog: Catalog; state: State; activePlanetId?: string; snapshotReady?: boolean; setActivePlanetId: (id: string) => void; execute: (action: ActionName, body: Record<string, unknown>) => Promise<unknown>; busy: boolean; feedback?: { kind: 'success' | 'error'; message: string }; setFeedback: (feedback?: { kind: 'success' | 'error'; message: string }) => void };
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
  const isPlanet = location.pathname === '/planet';
  const retained = useRef<{ catalog: Catalog; state: State } | null>(null);
  const queryError = catalogQuery.error ?? stateQuery.error;
  const snapshotReady = !queryError && !!catalogQuery.data && !!stateQuery.data && (!activePlanetId || stateQuery.data.active_planet?.id === activePlanetId);
  if (snapshotReady) retained.current = { catalog: catalogQuery.data!, state: stateQuery.data! };
  const catalog = catalogQuery.data ?? (isPlanet ? retained.current?.catalog : undefined);
  const state = snapshotReady ? stateQuery.data : isPlanet ? retained.current?.state : stateQuery.data;
  const execute = async (action: ActionName, body: Record<string, unknown>) => {
    setFeedback(undefined);
    try { const result = await mutation.mutateAsync({ action, body }); setFeedback({ kind: 'success', message: action === 'campaign/order' ? 'Ordem de campanha executada.' : action === 'build' ? 'Construção iniciada.' : action === 'research' ? 'Programa de pesquisa iniciado.' : action === 'build-ship' ? 'Montagem da nave iniciada.' : action === 'travel' ? 'Frota despachada.' : 'Rota calculada.' }); return result; } catch (error) { const message = error instanceof Error ? error.message : 'Falha de comunicação.'; setFeedback({ kind: 'error', message }); throw error; }
  };
  if (queryError && (!isPlanet || !catalog || !state)) return <div className="fatal"><b>Centro de comando indisponível</b><p>{queryError.message}</p><button onClick={() => { void catalogQuery.refetch(); void stateQuery.refetch(); }}>Tentar novamente</button></div>;
  if (!catalog || !state) return <div className="boot"><div className="brand"><span>STAR</span><b>Z</b></div><div className="boot-orbit" /><p>Sincronizando centro de comando…</p></div>;
  const context: ShellContext = { catalog, state, activePlanetId: activePlanetId ?? state.active_planet?.id ?? undefined, snapshotReady, setActivePlanetId: id => { setActivePlanetId(id); navigate('/planet'); }, execute, busy: mutation.isPending, feedback, setFeedback };
  const blocked = isPlanet && !snapshotReady;
  return <div className="app-root" aria-busy={mutation.isPending || blocked}><div className="shell-snapshot-content" inert={blocked}>{state.persistent && <div className="universe-session-link"><a href="#/universe">UNIVERSO PERSISTENTE · progresso offline</a><a href="#/research">Pesquisa por níveis</a></div>}<TopHud catalog={catalog} state={state} noticeOpen={noticeOpen} settingsOpen={settingsOpen} onNotice={() => { setNoticeOpen(value => !value); setSettingsOpen(false); }} onSettings={() => { setSettingsOpen(value => !value); setNoticeOpen(false); }} />{state.campaign && <CampaignStrip campaign={state.campaign} busy={mutation.isPending} end={() => { void execute('campaign/order', { action: 'end_turn' }).catch(() => undefined); }} />}<div className={`app-shell ${isPlanet ? 'planet-shell' : ''}`}><Sidebar state={state} /><main className={`main-content ${isPlanet ? 'main-content-planet' : ''}`}><Outlet context={context} /></main>{!isPlanet && <ContextPanel catalog={catalog} state={state} />}</div></div>{blocked && <div className="planet-snapshot-cover" role={queryError ? 'alert' : 'status'}><p>{queryError ? 'Não foi possível sincronizar o planeta.' : 'Sincronizando planeta selecionado…'}</p>{queryError && <button className="button button-secondary" onClick={() => { void catalogQuery.refetch(); void stateQuery.refetch(); }}>Tentar novamente</button>}{!queryError && !stateQuery.isPending && <button className="button button-secondary" onClick={() => { void stateQuery.refetch(); }}>Recarregar planeta</button>}</div>}{feedback && <div className={`toast ${feedback.kind}`} role="status"><i>{feedback.kind === 'success' ? '✓' : '!'}</i><span>{feedback.message}</span><button onClick={() => setFeedback(undefined)} aria-label="Fechar">×</button></div>}{mutation.isPending && <div className="loading-line" />}</div>;
}
