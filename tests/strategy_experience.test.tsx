import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,Outlet,Routes,Route} from 'react-router-dom';
import {Activities,activityJobs} from '../frontend/src/universe/ExperienceUI';
import {PixelShell} from '../frontend/src/pixel-command/PixelShell';
import {PixelCommand} from '../frontend/src/pixel-command/PixelCommand';
import {GalaxyView} from '../frontend/src/views/GalaxyView';
import {OperationsView} from '../frontend/src/universe/OperationsView';
import {planetSnapshot} from './fixtures/planetIntegration';
import catalog from './fixtures/fleet-api-catalog.json';
vi.mock('../frontend/src/components/planet/PlanetProceduralView',()=>({PlanetProceduralView:()=>null}));
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>({data:{empire_id:'strategy-test',name:'Teste',colony_limit:2}})}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:{empire_id:'strategy-test',players:[],missions:[],market:[],reports:[],fleet_limit:2}}),useQueryClient:()=>({invalidateQueries:vi.fn()})}));
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();});
it('orders real activities by completion and never invents an assembly progress',()=>{
 const s=planetSnapshot();s.observed_at=100;s.research.active=null;s.fleets=[];s.construction=[{id:'ore_extractor',started_at:50,complete_at:200}];s.ships=[{id:'ship',hull_id:'scout_hull',propulsion_id:'chemical_drive',fuel_id:'ion_fuel',crew:3,mass:2,ready_at:150}];
 const jobs=activityJobs(catalog,s);expect(jobs.map(j=>j.end)).toEqual([150,200]);expect(jobs[0].progress).toBeUndefined();
 render(<MemoryRouter><Activities catalog={catalog} state={s} compact/></MemoryRouter>);expect(screen.getAllByRole('progressbar')).toHaveLength(1);
});
it('keeps empty operations compact and discloses extra actual operations',()=>{
 const s=planetSnapshot();s.construction=[];s.research.active=null;s.ships=[];s.fleets=[];
 const view=render(<MemoryRouter><Activities catalog={catalog} state={s} compact/></MemoryRouter>);expect(screen.getByRole('region')).toHaveAttribute('data-active','false');expect(screen.queryByRole('progressbar')).toBeNull();
 s.construction=Array.from({length:5},(_,i)=>({id:'ore_extractor',started_at:i,complete_at:100+i}));view.rerender(<MemoryRouter><Activities catalog={catalog} state={s} compact/></MemoryRouter>);expect(screen.getByText('Mais 2 operações')).toBeTruthy();
});
it('persists optional recommendations separately from tutorial progress',()=>{
 const s=planetSnapshot();const mount=()=>render(<MemoryRouter><Routes><Route element={<Outlet context={{state:s,catalog,snapshotReady:true,setActivePlanetId:vi.fn()}}/>}><Route path="/" element={<PixelCommand/>}/></Route></Routes></MemoryRouter>);
 let view=mount();fireEvent.click(screen.getByText(/Transmissão/));fireEvent.click(screen.getByRole('button',{name:'Ocultar recomendações'}));view.unmount();view=mount();expect(screen.queryByRole('complementary',{name:'Missão recomendada'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Ativar recomendações contextuais'}));expect(screen.getByRole('complementary',{name:'Missão recomendada'})).toBeTruthy();
});
it('groups navigation and exposes planet selection without issuing an order',()=>{
 const s=planetSnapshot();s.planets=[{id:'a',name:'A',x:0,y:0,planet_index:0,population_total:100,home:true},{id:'b',name:'B',x:1,y:0,planet_index:0,population_total:10,home:false}];s.active_planet={id:'a',planet_index:0,home:true};const select=vi.fn();
 render(<MemoryRouter><PixelShell state={s} catalog={catalog} onPlanet={select}>Setor</PixelShell></MemoryRouter>);fireEvent.change(screen.getByRole('combobox',{name:'Planeta atual'}),{target:{value:'b'}});expect(select).toHaveBeenCalledWith('b');
 const nav=screen.getByRole('navigation',{name:'Navegação principal'});for(const name of ['Planeta','Tecnologia','Espaço','Império'])expect(within(nav).getByRole('heading',{name,exact:true})).toBeTruthy();
});
it('retains the exact selected destination and planet index in the colonization form',()=>{
 const s=planetSnapshot();s.persistent=true;
 render(<MemoryRouter initialEntries={['/missions?mission=COLONIZE&x=3&y=-2&planet_index=4']}><Routes><Route element={<Outlet context={{state:s,catalog,activePlanetId:s.active_planet?.id,execute:vi.fn(),setFeedback:vi.fn()}}/>}><Route path="/missions" element={<OperationsView/>}/></Route></Routes></MemoryRouter>);
 expect(screen.getByLabelText('Missão')).toHaveValue('COLONIZE');expect(screen.getByLabelText('Coordenada X')).toHaveValue(3);expect(screen.getByLabelText('Coordenada Y')).toHaveValue(-2);expect(screen.getByLabelText('Índice')).toHaveValue(4);fireEvent.click(screen.getByRole('tab',{name:'3 · Lançamento'}));expect(screen.getByRole('button',{name:/Confirmar envio/})).toBeDisabled();
});
it('blocks an offer that cannot be reserved from local stock',()=>{
 const s=planetSnapshot();s.persistent=true;s.stocks.raw_ore=10;
 render(<MemoryRouter initialEntries={['/relations?tab=market']}><Routes><Route element={<Outlet context={{state:s,catalog,activePlanetId:s.active_planet?.id,execute:vi.fn(),setFeedback:vi.fn()}}/>}><Route path="/relations" element={<OperationsView/>}/></Route></Routes></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Publicar oferta'})).toBeDisabled();expect(screen.getByText('Estoque insuficiente para reservar esta oferta.')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Quantidade oferecida'),{target:{value:'5'}});expect(screen.getByRole('button',{name:'Publicar oferta'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Quantidade desejada'),{target:{value:'0'}});expect(screen.getByRole('button',{name:'Publicar oferta'})).toBeDisabled();
});
it('keeps the arrived fleet selected when opening its mission planner',()=>{
 const s=planetSnapshot();s.persistent=true;s.ships=[{id:'ready',hull_id:'scout_hull',propulsion_id:'chemical_drive',fuel_id:'ion_fuel',crew:3,mass:2,ready_at:0}];s.fleets=[{...s.fleets[0],id:'selected-fleet',status:'ARRIVED',ship_ids:['ready'],x:0,y:0}];
 render(<MemoryRouter initialEntries={['/missions?fleet=selected-fleet&x=2&y=0']}><Routes><Route element={<Outlet context={{state:s,catalog,activePlanetId:s.active_planet?.id,execute:vi.fn(),setFeedback:vi.fn()}}/>}><Route path="/missions" element={<OperationsView/>}/></Route></Routes></MemoryRouter>);
 expect(screen.getByRole('checkbox')).toBeChecked();fireEvent.click(screen.getByRole('tab',{name:'3 · Lançamento'}));expect(screen.getByRole('button',{name:'Calcular missão'})).toBeEnabled();expect(screen.getByRole('button',{name:/Confirmar envio/})).toBeDisabled();
});
vi.mock('../frontend/src/api/queries',()=>({useGalaxyQuery:()=>({isPending:false,data:{radius:2,home:[0,0],center:[0,0],systems:[{id:'home',name:'Sistema natal',x:0,y:0,distance:0,home:true,knowledge_level:'SURVEYED',planets:[{planet_index:1,name:'Mundo livre',gravity:1,temperature:290,water:50,radiation:0,viability:'VIABLE',ownership:'UNCLAIMED',colonization:{eligible:true,reason:null,population:20,cost:{}}}]}]}})}));
it('exposes surveyed home-system planets and retains their index in the mission link',()=>{
 const s=planetSnapshot();s.persistent=true;
 render(<MemoryRouter><Routes><Route element={<Outlet context={{state:s,catalog,execute:vi.fn()}}/>}><Route path="/" element={<GalaxyView/>}/></Route></Routes></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:/Mundo livre/}));expect(screen.getByRole('link',{name:'Planejar missão para 0:0'})).toHaveAttribute('href','#/fleets?plan=1&x=0&y=0&mission=COLONIZE&planet_index=1');
});
it('restores a mission draft while explicit galaxy coordinates replace its target',()=>{
 const s=planetSnapshot();s.persistent=true;const id=s.active_planet!.id;
 sessionStorage.setItem(`starz.mission.${id}`,JSON.stringify({ids:[],mission:'TRANSPORT',target:'old-target',x:5,y:6,index:2,resource:'components',amount:7}));
 render(<MemoryRouter initialEntries={['/fleets?plan=1&x=3&y=4']}><Routes><Route element={<Outlet context={{state:s,catalog,activePlanetId:id,execute:vi.fn(),setFeedback:vi.fn()}}/>}><Route path="/fleets" element={<OperationsView/>}/></Route></Routes></MemoryRouter>);
 expect(screen.getByLabelText('Missão')).toHaveValue('TRANSPORT');expect(screen.getByLabelText('Coordenada X')).toHaveValue(3);expect(screen.getByLabelText('Coordenada Y')).toHaveValue(4);expect(screen.getByLabelText('Planeta de destino')).toHaveValue('');expect(screen.getByLabelText('Recurso')).toHaveValue('components');expect(screen.getByLabelText('Quantidade')).toHaveValue(7);
});
