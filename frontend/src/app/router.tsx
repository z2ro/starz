import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
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

export function AppRouter() {
  return <HashRouter><Routes>
    <Route path="/ship-geometry-lab" element={<Suspense fallback={<div>Carregando Ship Geometry Lab…</div>}><ShipGeometryLabView /></Suspense>} />
    <Route path="/planet-lab" element={<Suspense fallback={<div className="planet-lab-loading">Carregando Planet Lab…</div>}><PlanetLabView /></Suspense>} />
    <Route element={<AppShell />}>
      <Route path="/overview" element={<OverviewView />} />
      <Route path="/planet" element={<PlanetView />} />
      <Route path="/economy" element={<EconomyView />} />
      <Route path="/research" element={<ResearchView />} />
      <Route path="/shipyard" element={<ShipyardView />} />
      <Route path="/fleets" element={<FleetsView />} />
      <Route path="/galaxy" element={<GalaxyView />} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Route>
  </Routes></HashRouter>;
}
