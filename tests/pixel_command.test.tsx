import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { PixelShell } from '../frontend/src/pixel-command/PixelShell';
import { PixelCommand } from '../frontend/src/pixel-command/PixelCommand';
import { planetSnapshot } from './fixtures/planetIntegration';
import rawCatalog from './fixtures/fleet-api-catalog.json';
import type { State } from '../frontend/src/types/game';
import { GUIDE_STEPS, initialGuide } from '../frontend/src/universe/experience';
vi.mock('../frontend/src/components/planet/PlanetProceduralView',()=>({PlanetProceduralView:({onFailure}:{onFailure:(s:string)=>void})=><button onClick={()=>onFailure('WebGL unavailable')}>Simular perda de WebGL</button>}));
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>({data:{empire_id:'pixel-qa',name:'Civilização QA',colony_limit:2}})}));
afterEach(()=>{cleanup();localStorage.clear();});
function mount(s:State=planetSnapshot()){
 return render(<MemoryRouter initialEntries={['/universe']}><Routes><Route element={<Outlet context={{state:s,catalog:rawCatalog,snapshotReady:true,setActivePlanetId:vi.fn()}}/>}><Route path="/universe" element={<PixelShell state={s} catalog={rawCatalog}><PixelCommand/></PixelShell>}/></Route></Routes></MemoryRouter>);
}
it('shows local resources once, with nominal rates and real planet identity',()=>{
 const s=planetSnapshot();s.stocks.raw_ore=1234;mount(s);
 expect(screen.getByRole('region',{name:`Estoque local de ${s.system.planet.name}`}).textContent).toContain('1.234');
 expect(screen.getByRole('region',{name:'Planeta atual'}).textContent).toContain(s.system.planet.name);
 expect(screen.getAllByText(/\/min nom\./).length).toBeGreaterThan(0);
});
it('keeps completed tutorial inside help without discarding saved progress',()=>{
 const s=planetSnapshot();const saved={...initialGuide(s),done:GUIDE_STEPS.map(s=>s.id)};
 localStorage.setItem('starz.guide.v1.pixel-qa',JSON.stringify(saved));mount(s);
 expect(screen.queryByRole('region',{name:'Guia de primeiros passos'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Ajuda'}));
 expect(screen.getByText('Sua civilização está em movimento')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Fechar ajuda'}));
 expect(screen.queryByRole('region',{name:'Ajuda de comando'})).toBeNull();
 expect(JSON.parse(localStorage.getItem('starz.guide.v1.pixel-qa')!).done).toEqual(saved.done);
});
it('falls back explicitly to image when WebGL fails',()=>{
 mount();fireEvent.click(screen.getByRole('button',{name:'Simular perda de WebGL'}));
 expect(screen.getByRole('button',{name:'Procedural'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Imagem'})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByText(/Visualização procedural indisponível/)).toBeTruthy();
});
it('uses real construction progress and routes orders to existing gameplay',()=>{
 const s=planetSnapshot();s.observed_at=200;s.construction=[{id:'ore_extractor',started_at:100,complete_at:300}];mount(s);
 const activities=screen.getByRole('region',{name:'Atividades em andamento'});
 expect(within(activities).getAllByRole('progressbar')[0]).toHaveAttribute('aria-valuenow','50');
 expect(screen.getByRole('navigation',{name:'Ordens rápidas'}).querySelector('a')?.getAttribute('href')).toBe('/development');
});
it('recommends capacity repair from the real shortage and exposes actual notices',()=>{
 const s=planetSnapshot();s.capacities.energy_coverage=.5;s.notices=['Carga entregue.'];mount(s);
 expect(screen.getByText('Restabeleça a produção')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/Registros/}));
 expect(within(screen.getByRole('region',{name:'Registros recentes'})).getByText('Carga entregue.')).toBeTruthy();
});
