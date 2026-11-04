import { afterEach,expect,it } from 'vitest';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FirstSessionGuide } from '../frontend/src/universe/FirstSessionGuide';
import { changesSince,detectedGuideSteps,initialGuide,shortage,visitSnapshot } from '../frontend/src/universe/experience';
import { planetSnapshot } from './fixtures/planetIntegration';
import rawCatalog from './fixtures/fleet-api-catalog.json';
import type { Catalog,State } from '../frontend/src/types/game';
const state=()=>({...planetSnapshot(),persistent:true,empire_levels:{}} as State);
const catalog=rawCatalog as Catalog;
afterEach(()=>{cleanup();localStorage.clear();});
it('only recognizes real build/research/ship/mission state, not navigation',()=>{
 const s=state();s.ships=[];s.fleets=[];s.construction=[];s.research.active=null;
 const start=initialGuide(s);expect(detectedGuideSteps(s,start)).toEqual([]);
 s.construction.push({id:'ore_extractor',started_at:start.started,complete_at:start.started+28});s.research.active='energy_engineering';
 expect(detectedGuideSteps(s,start)).toEqual(['build','research']);
});
it('skipping persists per empire and does not execute a game action',()=>{
 const s=state();s.ships=[];s.fleets=[];s.research.active=null;
 const view=render(<MemoryRouter><FirstSessionGuide state={s} empireId="player-a"/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Pular esta etapa'}));
 expect(screen.getByRole('heading',{name:'Amplie a produção'})).toBeTruthy();
 expect(JSON.parse(localStorage.getItem('starz.guide.v1.player-a')!).skipped).toContain('resources');
 view.unmount();render(<MemoryRouter><FirstSessionGuide state={s} empireId="player-a"/></MemoryRouter>);
 expect(screen.getByRole('heading',{name:'Amplie a produção'})).toBeTruthy();
 cleanup();render(<MemoryRouter><FirstSessionGuide state={s} empireId="player-b"/></MemoryRouter>);
 expect(screen.getByRole('heading',{name:'Entenda seus recursos'})).toBeTruthy();
});
it('reports actual completions and does not mix planet development',()=>{
 const s=state();s.empire_levels={energy_engineering:0};const visit=visitSnapshot(s);
 s.empire_levels.energy_engineering=1;s.districts.ore_extractor=(s.districts.ore_extractor??0)+1;
 let changes=changesSince(visit,s,catalog);expect(changes.some(x=>x.includes('Pesquisa concluída'))).toBe(true);expect(changes.some(x=>x.includes('Instalação concluída'))).toBe(true);
 s.active_planet={id:'different-world',home:false,planet_index:0};changes=changesSince(visit,s,catalog);
 expect(changes.some(x=>x.includes('Instalação concluída'))).toBe(false);
});
it('shows precise shortages using local stock',()=>{expect(shortage({components:4},{components:10,raw_ore:2})).toEqual([{id:'components',missing:6},{id:'raw_ore',missing:2}]);});

it('reports real completed ship assembly and new private notices',()=>{const s=state();const now=Date.now()/1000;s.observed_at=now;s.ships=[{id:'ship-a',hull_id:'scout_hull',ready_at:now+5,crew:3,mass:10,propulsion_id:'chemical_drive',fuel_id:'ion_fuel'}];const before=visitSnapshot(s);s.observed_at=now+10;s.notices=['Uma carga foi entregue.'];const found=changesSince(before,s,catalog);expect(found.some(x=>x.startsWith('Nave pronta:'))).toBe(true);expect(found).toContain('Uma carga foi entregue.');});
it('announces actual unlocks without inventing a completed technology',()=>{const s=state();const before=visitSnapshot(s);s.unlocked_content.push('nuclear_drive');expect(changesSince(before,s,catalog).some(x=>x.startsWith('Novo desbloqueio:'))).toBe(true);expect(changesSince(before,s,catalog).some(x=>x.startsWith('Pesquisa concluída:'))).toBe(false);});
