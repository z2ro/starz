import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,Outlet,Route,Routes} from 'react-router-dom';
import {FleetsView} from '../frontend/src/views/FleetsView';
import {planetSnapshot} from './fixtures/planetIntegration';
import catalog from './fixtures/fleet-api-catalog.json';
const mock=vi.hoisted(()=>({api:vi.fn().mockResolvedValue({})}));
vi.mock('../frontend/src/api/client',()=>({apiRequest:mock.api}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:vi.fn().mockResolvedValue({})})}));
vi.mock('../frontend/src/components/ships/ShipPreview',()=>({ShipPreview:()=>null}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function mount(returning=false){const state={...planetSnapshot(),persistent:true};const first=state.ships[0]??{id:'one',hull_id:'scout_hull',propulsion_id:'chemical',fuel_id:'ion_fuel',crew:3,mass:1,ready_at:0};state.ships=[first,{...first,id:'two'}];state.fleets=['first','second'].map((id,i)=>({id,name:id,ship_ids:[state.ships[i].id],status:'TRANSIT' as const,mission:returning?'RETURN':'MOVE',x:i,y:0,destination_x:i+1,destination_y:0,arrival_at:2000,departure_at:1000,eta:1000,propulsion:first.propulsion_id,mode:'NORMAL',fuel_cost:2}));render(<MemoryRouter><Routes><Route element={<Outlet context={{state,catalog,activePlanetId:'owned',setFeedback:vi.fn()}}/>}><Route path="/" element={<FleetsView/>}/></Route></Routes></MemoryRouter>);}
it('recalls exactly the selected operation through the unchanged owned-planet endpoint',async()=>{mount();fireEvent.change(screen.getByRole('combobox',{name:'Selecionar operação de frota'}),{target:{value:'second'}});fireEvent.click(screen.getByRole('button',{name:'Recolher frota'}));await waitFor(()=>expect(mock.api).toHaveBeenCalled());expect(mock.api.mock.calls[0][0]).toBe('/api/universe/recall');expect(JSON.parse(mock.api.mock.calls[0][1].body)).toEqual({planet_id:'owned',fleet_id:'second'});});
it('offers a dedicated operational inspector without a second collection pager',()=>{mount();fireEvent.click(screen.getByRole('button',{name:'Detalhes da operação'}));const dialog=screen.getByRole('dialog',{name:'Operação da frota'});expect(within(dialog).getByText('Status')).toBeTruthy();fireEvent.click(within(dialog).getByRole('button',{name:'Fechar'}));expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('navigation',{name:'Paginação · Frotas e naves'})).toBeNull();});
it('keeps committed returns blocked',()=>{mount(true);expect(screen.getByRole('button',{name:'Recolher frota'})).toBeDisabled();expect(mock.api).not.toHaveBeenCalled();});
