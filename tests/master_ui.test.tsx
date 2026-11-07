import {Icon} from '../frontend/src/components/ui/Icon';
import {PixelTheme,resourcePixelIcons} from '../frontend/src/pixel-command/PixelIcon';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {PixelShell} from '../frontend/src/pixel-command/PixelShell';
import {GameStatusBar} from '../frontend/src/pixel-command/master/GameStatusBar';
import {planetSnapshot} from './fixtures/planetIntegration';
import catalog from './fixtures/fleet-api-catalog.json';
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>({data:{name:'Test Empire',empire_id:'qa',colony_limit:2}})}));
afterEach(cleanup);
it.each(['/universe','/development','/economy','/defenses','/research','/shipyard','/fleets','/fleets?plan=1','/galaxy','/overview','/relations','/relations?tab=market','/relations?tab=reports','/planet','/campaign'])('uses one approved shell and one resource HUD on %s',route=>{
 const state=planetSnapshot();render(<MemoryRouter initialEntries={[route]}><PixelShell state={state} catalog={catalog}>Route content</PixelShell></MemoryRouter>);
 expect(document.querySelectorAll('.game-shell')).toHaveLength(1);expect(document.querySelectorAll('.resource-hud')).toHaveLength(1);expect(document.querySelectorAll('.sidebar-navigation')).toHaveLength(1);
 expect(document.querySelector('.px-masthead')).toBeNull();expect(screen.getAllByRole('region',{name:/Estoque local/})).toHaveLength(1);expect(screen.getByText('Route content')).toBeTruthy();
});
it('renders distinct resource identities and the selected-planet quantities without invented capacity',()=>{
 const state=planetSnapshot();state.stocks={components:10,raw_ore:20,refined_alloy:30,volatiles:40,fusion_fuel:50,ion_fuel:60};
 render(<MemoryRouter initialEntries={['/universe']}><PixelShell state={state} catalog={catalog}>Overview</PixelShell></MemoryRouter>);
 const hud=screen.getByRole('region',{name:/Estoque local/});expect([...hud.querySelectorAll('.resource-indicator strong')].slice(0,6).map(n=>n.textContent)).toEqual(['10','20','30','40','50','60']);
 expect(hud.querySelectorAll('.px-icon-gas,.px-icon-fusion,.px-icon-ion')).toHaveLength(3);expect(hud.textContent).not.toMatch(/capacidade|%/i);
});
it('keeps the top planet picker bound to the existing selection callback',()=>{
 const state=planetSnapshot(),onPlanet=vi.fn();state.planets=[...state.planets!,{id:'second',name:'Colony',x:1,y:2,planet_index:0,population_total:12,home:false}];
 render(<MemoryRouter initialEntries={['/universe']}><PixelShell state={state} catalog={catalog} onPlanet={onPlanet}>Overview</PixelShell></MemoryRouter>);
 fireEvent.change(screen.getByRole('combobox',{name:'Planeta atual'}),{target:{value:'second'}});expect(onPlanet).toHaveBeenCalledWith('second');
});
it('offers a finite colony selector and the original population-administration destination',()=>{
 const state=planetSnapshot(),onPlanet=vi.fn();state.planets=[...state.planets!,{id:'second',name:'Colony',x:1,y:2,planet_index:0,population_total:12,home:false}];
 render(<MemoryRouter><GameStatusBar state={state} limit={2} onPlanet={onPlanet}/></MemoryRouter>);
 expect(screen.getByText('2 / 2')).toBeTruthy();fireEvent.change(screen.getByRole('combobox',{name:'Selecionar colônia'}),{target:{value:'second'}});expect(onPlanet).toHaveBeenCalledWith('second');
 expect(screen.getByRole('link',{name:'Gerenciar população e trabalhadores'})).toHaveAttribute('href','/development?section=population');
 expect(within(screen.getByRole('combobox')).getAllByRole('option')).toHaveLength(2);
});

it('shares the approved resource identity between HUD, costs and resource inspectors',()=>{
 render(<PixelTheme.Provider value={true}>{Object.keys(resourcePixelIcons).map(id=><Icon key={id} name="economy" resourceId={id}/>)}</PixelTheme.Provider>);
 for(const name of ['chip','ore','ingots','gas','fusion','ion'])expect(document.querySelector('.px-icon-'+name)).toBeTruthy();
});
