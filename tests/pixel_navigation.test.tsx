import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {TechnologyPath} from '../frontend/src/pixel-command/TechnologyPath';
import {PixelShell} from '../frontend/src/pixel-command/PixelShell';
import {planetSnapshot} from './fixtures/planetIntegration';
import rawCatalog from './fixtures/fleet-api-catalog.json';
import type {Technology} from '../frontend/src/types/game';
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>({})}));
afterEach(cleanup);
it('maps actual technology levels and infrastructure to navigable prerequisites',()=>{
 const state=planetSnapshot();state.empire_levels={energy_engineering:2};state.districts.research_lab=1;
 const tech:Technology={id:'advanced',name:'Pesquisa avançada',description:'',category:'science',cost:{},duration:10,requires:['energy_engineering'],level_requires:{energy_engineering:3},infrastructure:{research_lab:1},unlocks:['scout_hull']};
 const select=vi.fn();render(<MemoryRouter><TechnologyPath tech={tech} state={state} catalog={{...rawCatalog,technologies:[...rawCatalog.technologies,{...tech,id:'energy_engineering',name:'Engenharia energética'}]}} nextLevel={1} onSelect={select}/></MemoryRouter>);
 expect(screen.getByText('Nível 2 / 3 · Pendente')).toBeTruthy();expect(screen.getByText('Nível 1 / 1 · Atendido')).toBeTruthy();
 fireEvent.click(screen.getByRole('button'));expect(select).toHaveBeenCalledWith('energy_engineering');
 expect(screen.getByRole('link')).toHaveAttribute('href','/development?building=research_lab');expect(screen.getByText('Horizon')).toBeTruthy();
 expect(screen.getAllByRole('button')).toHaveLength(1);
});
it('distinguishes market from diplomacy and closes mobile navigation after navigation',()=>{
 render(<MemoryRouter initialEntries={['/relations?tab=market']}><PixelShell state={planetSnapshot()} catalog={rawCatalog}><h1>Setor</h1></PixelShell></MemoryRouter>);
 const nav=screen.getByRole('navigation',{name:'Navegação principal'});
 expect(within(nav).getByRole('link',{name:'Mercado',exact:true})).toHaveAttribute('aria-current','page');expect(within(nav).getByRole('link',{name:'Diplomacia',exact:true})).not.toHaveAttribute('aria-current');
 fireEvent.click(screen.getByRole('button',{name:'Todos os setores'}));expect(nav).toHaveAttribute('data-open','true');
 fireEvent.click(within(nav).getByRole('link',{name:'Diplomacia',exact:true}));expect(nav).toHaveAttribute('data-open','false');expect(within(nav).getByRole('link',{name:'Diplomacia',exact:true})).toHaveAttribute('aria-current','page');
});
it('discloses all local stocks without changing their values',()=>{
 render(<MemoryRouter><PixelShell state={planetSnapshot()} catalog={rawCatalog}>Setor</PixelShell></MemoryRouter>);
 const stocks=screen.getByRole('region',{name:/Estoque local/});const before=stocks.textContent;
 fireEvent.click(screen.getByRole('button',{name:/Produção e detalhes dos recursos/}));expect(stocks).toHaveAttribute('data-expanded','true');expect(stocks.textContent).toBe(before);
});
