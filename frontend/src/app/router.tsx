import { UniverseView } from '../universe/UniverseView';
import type { ShellContext } from '../components/shell/AppShell';
import { CampaignView } from '../campaign/CampaignView';
import { HashRouter, Navigate, Route, Routes, useOutletContext } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { OverviewView } from '../views/OverviewView';
import { PlanetView } from '../views/PlanetView';
import { EconomyView } from '../views/EconomyView';
import { ResearchView } from '../views/ResearchView';
import { ShipyardView } from '../views/ShipyardView';
import { FleetsView } from '../views/FleetsView';
import { GalaxyView } from '../views/GalaxyView';
import { lazy, Suspense } from 'react';

const PlanetLabView = lazy(() => import('../planetlab/PlanetLabView').then(module => ({ default: module.PlanetLabView })));
const ShipGeometryLabView = lazy(() => import('../shipgeometrylab/ShipGeometryLabView').then(module => ({ default: module.ShipGeometryLabView })));
const SpaceSceneLabView = lazy(() => import('../spacescenelab/SpaceSceneLabView').then(module => ({ default: module.SpaceSceneLabView })));
const SpaceSceneLiveView = lazy(() => import('../space-scene-live/SpaceSceneLiveView').then(module => ({ default: module.SpaceSceneLiveView })));

export function AppRouter() {
  return <HashRouter><Routes>
    <Route path="/space-scene-live" element={<Suspense fallback={<div>Carregando cena procedural…</div>}><SpaceSceneLiveView /></Suspense>} />
    <Route path="/space-scene-lab" element={<Suspense fallback={<div>Carregando Space Scene Lab…</div>}><SpaceSceneLabView /></Suspense>} />
    <Route path="/ship-geometry-lab" element={<Suspense fallback={<div>Carregando Ship Geometry Lab…</div>}><ShipGeometryLabView /></Suspense>} />
    <Route path="/planet-lab" element={<Suspense fallback={<div className="planet-lab-loading">Carregando Planet Lab…</div>}><PlanetLabView /></Suspense>} />
    <Route element={<AppShell />}>
      <Route path="/universe" element={<UniverseView />} />
      <Route path="/campaign" element={<CampaignView />} />
      <Route path="/overview" element={<OverviewView />} />
      <Route path="/planet" element={<PlanetView />} />
      <Route path="/economy" element={<EconomyView />} />
      <Route path="/research" element={<ResearchView />} />
      <Route path="/shipyard" element={<ShipyardView />} />
      <Route path="/fleets" element={<FleetsView />} />
      <Route path="/galaxy" element={<GalaxyView />} />
      <Route path="*" element={<Landing />} />
    </Route>
  </Routes></HashRouter>;
}

function Landing(){const {state}=useOutletContext<ShellContext>();return <Navigate to={state.persistent?"/universe":state.campaign?"/campaign":"/overview"} replace/>;}
