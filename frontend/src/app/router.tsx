import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { OverviewView } from '../views/OverviewView';
import { PlanetView } from '../views/PlanetView';
import { EconomyView } from '../views/EconomyView';
import { ResearchView } from '../views/ResearchView';
import { ShipyardView } from '../views/ShipyardView';
import { FleetsView } from '../views/FleetsView';
import { GalaxyView } from '../views/GalaxyView';

export function AppRouter() { return <HashRouter><Routes><Route element={<AppShell />}><Route path="/overview" element={<OverviewView />} /><Route path="/planet" element={<PlanetView />} /><Route path="/economy" element={<EconomyView />} /><Route path="/research" element={<ResearchView />} /><Route path="/shipyard" element={<ShipyardView />} /><Route path="/fleets" element={<FleetsView />} /><Route path="/galaxy" element={<GalaxyView />} /><Route path="*" element={<Navigate to="/overview" replace />} /></Route></Routes></HashRouter>; }
