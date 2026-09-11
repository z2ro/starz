import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { PlanetHero } from '../components/planet/PlanetHero';
import { PlanetInspector } from '../components/planet/PlanetInspector';
import type { PlanetTab } from '../types/game';
import type { ShellContext } from '../components/shell/AppShell';

export function PlanetView() {
  const { catalog, state, setActivePlanetId } = useOutletContext<ShellContext>();
  const [tab, setTab] = useState<PlanetTab>('overview');
  const navigate = useNavigate();
  return <div className="planet-command-view"><div className="planet-command-layout"><PlanetHero catalog={catalog} state={state} onPlanetChange={setActivePlanetId} onNavigate={navigate} /><PlanetInspector catalog={catalog} state={state} tab={tab} onTab={setTab} onNavigate={navigate} /></div></div>;
}
