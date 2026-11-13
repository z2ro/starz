import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {planetSnapshot} from './fixtures/planetIntegration';
import rawCatalog from './fixtures/fleet-api-catalog.json';
import type {Catalog} from '../frontend/src/types/game';

const mocks=vi.hoisted(()=>({context:{} as Record<string,unknown>,universe:{} as Record<string,unknown>}));
vi.mock('react-router-dom',async importOriginal=>({...await importOriginal<typeof import('react-router-dom')>(),useOutletContext:()=>mocks.context}));
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>mocks.universe}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:vi.fn()})}));
vi.mock('../frontend/src/pixel-command/ContentPages',()=>({ContentPages:({children}:{children:React.ReactNode})=><div>{children}</div>}));
import {DevelopmentView} from '../frontend/src/universe/DevelopmentView';

afterEach(cleanup);
it('selects an installation and preserves the build action and shortage blocking',()=>{
 const state=planetSnapshot();state.persistent=true;state.population.available=100;state.stocks={raw_ore:100};
 const source=rawCatalog as Catalog;
 const districts=source.districts.filter(d=>['ore_extractor','solar_field'].includes(d.id)).map(d=>({...d,requires:[],workforce:0,energy_consumption:0}));
 const catalog={...source,districts,technologies:[]};
 const execute=vi.fn().mockResolvedValue({});
 mocks.context={state,catalog,activePlanetId:'planet-test',execute,busy:false,setFeedback:vi.fn()};
 mocks.universe={data:{buildings:districts.map(d=>({id:d.id,level:0,next_level:1,cost:{raw_ore:10},duration:10,production_multiplier:1}))},isFetching:false};
 render(<MemoryRouter><DevelopmentView/></MemoryRouter>);
 fireEvent.click(within(screen.getByRole('region',{name:'Instalações disponíveis'})).getByRole('button',{name:/Campo solar/}));
 expect(screen.getByRole('heading',{name:'Campo solar'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Construir Campo solar'}));
 expect(execute).toHaveBeenCalledWith('build',{id:'solar_field',planet_id:'planet-test'});
 cleanup();state.stocks={raw_ore:0};execute.mockClear();
 render(<MemoryRouter><DevelopmentView/></MemoryRouter>);
 expect((screen.getByRole('button',{name:/Construir Extrator/}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getByText(/Recursos insuficientes:/)).toBeTruthy();
 expect(execute).not.toHaveBeenCalled();
});
it('shows the four concept artworks for the selected installation and keeps other icons',()=>{
 const state=planetSnapshot();state.persistent=true;state.population.available=100;state.stocks={raw_ore:100};
 const source=rawCatalog as Catalog;
 const districts=source.districts.map(d=>({...d,requires:[],workforce:0,energy_consumption:0}));
 mocks.context={state,catalog:{...source,districts,technologies:[]},activePlanetId:'planet-test',execute:vi.fn(),busy:false,setFeedback:vi.fn()};
 mocks.universe={data:{buildings:districts.map(d=>({id:d.id,level:0,next_level:1,cost:{},duration:10,production_multiplier:1}))},isFetching:false};
 render(<MemoryRouter><DevelopmentView/></MemoryRouter>);
 const list=screen.getByRole('region',{name:'Instalações disponíveis'});
 for(const id of ['ore_extractor','civil_district','research_lab','orbital_shipyard']){
  const item=districts.find(d=>d.id===id)!;
  const button=within(list).getByRole('button',{name:new RegExp(item.name)});
  expect(button.querySelector('.installation-art')?.getAttribute('data-building')).toBe(id);
  fireEvent.click(button);
  expect(screen.getByRole('region',{name:'Detalhe da instalação'}).querySelector('.installation-art')?.getAttribute('data-building')).toBe(id);
 }
 expect(within(list).getByRole('button',{name:/Campo solar/}).querySelector('.installation-art')).toBeNull();
});
