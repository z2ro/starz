import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Outlet,Route,Routes} from 'react-router-dom';
import {DefenseView} from '../frontend/src/universe/DefenseView';
import {planetSnapshot} from './fixtures/planetIntegration';
import catalogFixture from './fixtures/fleet-api-catalog.json';
import type {Catalog} from '../frontend/src/types/game';
import type {DefenseDesign,DefenseStatus} from '../frontend/src/universe/defenseTypes';
const mock=vi.hoisted(()=>({data:{} as {defenses?:DefenseStatus;players:[]},api:vi.fn().mockResolvedValue({}),invalidate:vi.fn().mockResolvedValue({})}));
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>({data:mock.data,isFetching:false})}));
vi.mock('../frontend/src/api/client',()=>({apiRequest:mock.api}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:mock.invalidate})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const names=['Canhão de defesa pontual','Bateria orbital de mísseis','Canhão eletromagnético pesado','Gerador de escudo planetário','Plataforma orbital de defesa','Sistema de interceptação de mísseis'];
function mount(blocked=false){const state=planetSnapshot();state.persistent=true;state.stocks={refined_alloy:1000,components:1000};const defs:DefenseDesign[]=names.map((name,i)=>({id:i===0?'point_defense':`defense_${i}`,name,description:'Defesa real',category:'Defense',cost:{refined_alloy:18,components:6},requires:['naval_doctrine'],kind:'structure',duration:30,industrial_requirement:1,level_requires:{},hull_points:100,damage:12,shield:0,energy_consumption:1,workforce:1,modifiers:{light:2},ammunition:null,missile_range:0}));const catalog:Catalog={...catalogFixture,defenses:defs};mock.data={players:[],defenses:{inventory:{units:[],queue:[],ammunition:{}},options:defs.map(d=>({id:d.id,count:1,cost:d.cost,duration:30,requirements:blocked?['Doutrina naval: nível 1']:[]})),repairs:[],operational:1,battles:[],strikes:[]}};
 render(<MemoryRouter><Routes><Route element={<Outlet context={{state,catalog,activePlanetId:'owned-planet',setFeedback:vi.fn()}}/>}><Route path="/" element={<DefenseView/>}/></Route></Routes></MemoryRouter>);}
it('shows all six structures and submits a real batch for the selected planet',async()=>{mount();for(const name of names)expect(screen.getAllByText(name).length).toBeGreaterThan(0);fireEvent.change(screen.getByLabelText('Quantidade'),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Construir defesa'}));await waitFor(()=>expect(mock.api).toHaveBeenCalled());expect(JSON.parse(mock.api.mock.calls[0][1].body)).toEqual({planet_id:'owned-planet',id:'point_defense',count:2});});
it('keeps unmet technology visible and blocks unauthorized construction at the UI',()=>{mount(true);expect(screen.getByText('Doutrina naval: nível 1')).toBeTruthy();expect(screen.getByRole('button',{name:'Construir defesa'})).toBeDisabled();expect(mock.api).not.toHaveBeenCalled();});
