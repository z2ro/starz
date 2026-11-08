vi.mock('../frontend/src/universe/stellar',async importOriginal=>({...await importOriginal<typeof import('../frontend/src/universe/stellar')>(),useStellar:()=>({data:{projects:[],modules:[],units:[],contacts:[],module_cargo:50}})}));
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Outlet,Route,Routes} from 'react-router-dom';
import {OperationsView} from '../frontend/src/universe/OperationsView';
import {planetSnapshot} from './fixtures/planetIntegration';
import catalog from './fixtures/fleet-api-catalog.json';
const mock=vi.hoisted(()=>({api:vi.fn().mockResolvedValue({}),players:[] as {id:string;name:string;self:boolean;planets:never[];relation:{status:string;proposal:string|null}}[]}));
vi.mock('../frontend/src/api/client',()=>({apiRequest:mock.api}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:{players:mock.players,market:[],reports:[],missions:[]}}),useQueryClient:()=>({invalidateQueries:vi.fn().mockResolvedValue({})})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function mount(players=1){mock.players=players?[{id:'other',name:'Outro império',self:false,planets:[],relation:{status:'neutral',proposal:null}}]:[];const state={...planetSnapshot(),persistent:true};render(<MemoryRouter initialEntries={['/relations']}><Routes><Route element={<Outlet context={{state,catalog,activePlanetId:'owned',setFeedback:vi.fn()}}/>}><Route path="/relations" element={<OperationsView/>}/></Route></Routes></MemoryRouter>);}
it('uses the existing diplomatic intent and ownership payload after explicit confirmation',async()=>{mount();fireEvent.change(screen.getByRole('combobox',{name:'Ordem para Outro império'}),{target:{value:'war'}});expect(mock.api).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Declarar guerra'}));await waitFor(()=>expect(mock.api).toHaveBeenCalled());expect(mock.api.mock.calls[0][0]).toBe('/api/universe/diplomacy');expect(JSON.parse(mock.api.mock.calls[0][1].body)).toEqual({planet_id:'owned',target:'other',intent:'war'});});
it('does not allow accepting a nonexistent proposal',()=>{mount();fireEvent.change(screen.getByRole('combobox',{name:'Ordem para Outro império'}),{target:{value:'accept'}});expect(screen.getByRole('button',{name:'Aceitar aliança'})).toBeDisabled();expect(mock.api).not.toHaveBeenCalled();});
it('explains an empty diplomatic universe',()=>{mount(0);expect(screen.getByText('Nenhum outro império conhecido neste universo.')).toBeTruthy();});
