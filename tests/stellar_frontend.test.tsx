import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,Outlet,Route,Routes} from 'react-router-dom';
import {StellarView} from '../frontend/src/universe/StellarView';
import {custodyAttempts,type StellarSnapshot,type StellarUnit} from '../frontend/src/universe/stellar';
import {confirmedSubsystems,IntelligenceReport,type IntelligenceReportData} from '../frontend/src/universe/IntelligenceReport';
import {readMissionDraft,saveMissionDraft} from '../frontend/src/universe/missionDraft';
import {planetSnapshot} from './fixtures/planetIntegration';
import catalog from './fixtures/fleet-api-catalog.json';
const mock=vi.hoisted(()=>({api:vi.fn(),stellar:{} as StellarSnapshot,custody:{units:[] as StellarUnit[],operations:[]},invalidate:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../frontend/src/universe/stellar',async importOriginal=>({...await importOriginal<typeof import('../frontend/src/universe/stellar')>(),useStellar:()=>({data:mock.stellar}),useCustody:()=>({data:mock.custody})}));
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>({data:{empire_id:'self',players:[{id:'self',name:'Meu império',self:true,planets:[{id:'home',x:0,y:0,index:0}]},{id:'other',name:'Outro império',self:false,planets:[{id:'target',x:1,y:0,index:0}]}],intelligence:[]}})}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:mock.invalidate})}));
vi.mock('../frontend/src/api/client',()=>({apiRequest:mock.api}));
vi.mock('../frontend/src/components/ships/ShipPreviewScene',()=>({default:()=> <p>Modelo aprovado</p>}));
beforeEach(()=>{mock.api.mockReset().mockResolvedValue({});const unit:StellarUnit={id:'unit',source_id:'source',system_id:'system',planet_id:'home',state:'operational',roles:{operational_owner:true,historical_owner:true,custodian:false,controller:true},payload:{hp:100,shield:50,energy:1000,subsystems:{containment:100,shielding:100,control:100,propulsion:100,weapons:100}}};mock.stellar={projects:[],modules:[],units:[unit],contacts:[],profile:'experimental',experimental:true,module_cargo:50,module_cost:{components:100},module_work:600,phase_seconds:600,phases:[]};mock.custody={units:[unit],operations:[]};});
afterEach(()=>{cleanup();sessionStorage.clear();vi.clearAllMocks();});
function mount(tab='projects',shipCount=0){const state=planetSnapshot();state.persistent=true;if(shipCount)state.ships=Array.from({length:shipCount},(_,i)=>({id:`ship-${i}`,hull_id:'scout_hull',propulsion_id:'chemical_drive',fuel_id:'ion_fuel',crew:1,mass:1,ready_at:0}));state.fleets=[];state.empire_levels={stellar_extraction:1,megastructure_engineering:1,precision_manufacturing:1};return render(<MemoryRouter initialEntries={[`/stellar?tab=${tab}`]}><Routes><Route element={<Outlet context={{state,catalog,activePlanetId:'home',setFeedback:vi.fn()}}/>}><Route path='/stellar' element={<StellarView/>}/></Route></Routes></MemoryRouter>);}
it('keeps the UUID idempotency key on retry and surfaces the exact server blocker',async()=>{mock.api.mockRejectedValueOnce(new Error('Estrela já reservada.'));mount();fireEvent.click(screen.getByRole('button',{name:'Reservar estrela'}));expect(await screen.findByRole('alert')).toHaveTextContent('Estrela já reservada.');fireEvent.click(screen.getByRole('button',{name:'Reservar estrela'}));await waitFor(()=>expect(mock.api).toHaveBeenCalledTimes(2));const first=JSON.parse(mock.api.mock.calls[0][1].body),second=JSON.parse(mock.api.mock.calls[1][1].body);expect(first.planet_id).toBe('home');expect(first.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);expect(second.idempotency_key).toBe(first.idempotency_key);expect(mock.api.mock.calls[0][0]).toBe('/api/universe/stellar/reserve');});
it('manufactures a real selected module at the selected planet',async()=>{mount('modules');fireEvent.change(screen.getByLabelText('Tipo de módulo'),{target:{value:'propulsion'}});fireEvent.click(screen.getByRole('button',{name:'Fabricar módulo'}));await waitFor(()=>expect(mock.api).toHaveBeenCalled());expect(JSON.parse(mock.api.mock.calls[0][1].body)).toMatchObject({planet_id:'home',kind:'propulsion'});});
it('requires a fresh server preview when unit order input changes',async()=>{mock.api.mockResolvedValue({departure_at:100,arrival_at:200,energy_cost:20});mount('units');fireEvent.click(screen.getByRole('tab',{name:'Operação',exact:true}));fireEvent.change(screen.getByLabelText('Planeta de destino'),{target:{value:'home'}});expect(screen.getByRole('button',{name:'Confirmar operação estelar'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Calcular operação estelar'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Confirmar operação estelar'})).toBeEnabled());expect(JSON.parse(mock.api.mock.calls[0][1].body)).toMatchObject({unit_id:'unit',target_planet_id:'home',action:'move',preview:true});fireEvent.change(screen.getByLabelText('Operação'),{target:{value:'attack'}});expect(screen.getByRole('button',{name:'Confirmar operação estelar'})).toBeDisabled();});
it('does not turn a historical ownership role or terminal relic into operational rights',()=>{const sealed={...mock.stellar.units[0],state:'sealed_wreck',roles:{operational_owner:false,historical_owner:true,custodian:false,controller:false}};expect(custodyAttempts(sealed,[],'self')).toEqual([]);expect(custodyAttempts({...sealed,state:'sealed_relic',roles:{...sealed.roles,custodian:true}},[],'self')).toEqual([]);expect(custodyAttempts({...sealed,roles:{...sealed.roles,custodian:true}},[],'self')).toEqual(['offer','rebuild','repatriate','withdraw','decommission']);});
it('offers only received active transfers for acceptance',()=>{const op={operation_id:'offer',unit_id:'unit',kind:'offer',status:'offered',complete_at:null,actor_id:'other',recipient_id:'self'};expect(custodyAttempts(mock.stellar.units[0],[op],'self')).toContain('accept');expect(custodyAttempts(mock.stellar.units[0],[{...op,status:'cancelled'}],'self')).not.toContain('accept');});
it('preserves all new mission fields in planet-specific drafts',()=>{saveMissionDraft('home',{ids:['ship'],mission:'ATTACK',target:'home',x:0,y:0,index:0,resource:'components',amount:0,doctrine:'rupture',weapon_profile:'anti_shield',target_stellar_id:'enemy',target_subsystem:'control',stellar_project_id:'project',module_ids:['module']});expect(readMissionDraft('home')).toMatchObject({doctrine:'rupture',weapon_profile:'anti_shield',target_stellar_id:'enemy',target_subsystem:'control',stellar_project_id:'project',module_ids:['module']});expect(readMissionDraft('other')).toEqual({});});
const unknown={status:'UNKNOWN' as const,value:null};
function intelligence():IntelligenceReportData{return {id:'intel',planet_id:'home',planet_name:'Órbita própria',coordinates:[0,0,0],scope:'stellar',at:100,expires_at:200,status:'CURRENT',quality:3,detected:false,stellar_units:{status:'CONFIRMED',value:{enemy:{state:'damaged',hp:20,shield:0,subsystems:{control:10}}}},ships:unknown,defenses:unknown,stocks:{status:'CONFIRMED',value:{components:999999}},ammunition:unknown,infrastructure:unknown,technology:unknown};}
it('requires current confirmed quality-three intelligence for subsystem aim',()=>{const report=intelligence();expect(confirmedSubsystems([report],'enemy','home',150)).toEqual(['control']);for(const changed of [{...report,status:'OUTDATED' as const},{...report,quality:2},{...report,expires_at:150},{...report,planet_id:'elsewhere'}])expect(confirmedSubsystems([changed],'enemy','home',150)).toEqual([]);});
it('hides unrelated inventories in a stellar-scoped intelligence report',()=>{render(<IntelligenceReport report={intelligence()} catalog={catalog}/>);fireEvent.click(screen.getByRole('button'));expect(screen.getByText(/Unidade enemy/)).toBeTruthy();expect(screen.queryByText('Estoques')).toBeNull();expect(screen.queryByText(/999/)).toBeNull();});

it('opens project detail after roster selection and keeps the main workspace tabs reachable',()=>{
 mock.stellar.projects=[{id:'project',project_id:'project',source_id:'source',status:'reserved',completed_phases:0,x:2,y:1,stocks:{},star_present:true,phase_records:[]}];
 const view=mount();
 fireEvent.click(screen.getByRole('button',{name:'Mostrar seleção de engenharia estelar'}));
 expect(view.container.querySelector('.stellar-command')).toHaveAttribute('data-stellar-panel','selection');
 fireEvent.click(screen.getByRole('button',{name:'Novo projeto estelar'}));
 expect(view.container.querySelector('.stellar-command')).toHaveAttribute('data-stellar-panel','detail');
 expect(screen.getByRole('button',{name:'Reservar estrela'})).toBeTruthy();
 fireEvent.click(within(screen.getByRole('tablist',{name:'Engenharia estelar'})).getByRole('tab',{name:'Módulos'}));
 expect(screen.getByRole('button',{name:'Fabricar módulo'})).toBeTruthy();
 expect(view.container.querySelector('.stellar-command')).toHaveAttribute('data-stellar-panel','detail');
});

it('retains physical module and fleet selections across custody preparation and review',async()=>{
 const unit=mock.stellar.units[0];unit.state='sealed_wreck';unit.roles={operational_owner:false,historical_owner:true,custodian:true,controller:true};
 mock.stellar.modules=[{id:'propulsion-module',kind:'propulsion',status:'ready',origin_planet_id:'home',current_planet_id:'home',project_id:null,fleet_id:null,consumed_phase:null}];
 mount('custody',30);
 fireEvent.change(screen.getByLabelText('Ação de custódia'),{target:{value:'withdraw'}});
 fireEvent.click(screen.getByRole('tab',{name:'Módulos (0)'}));
 fireEvent.click(screen.getByRole('checkbox',{name:/Propulsão/}));
 fireEvent.click(screen.getByRole('tab',{name:'Frota (0)'}));
 expect(screen.getAllByRole('checkbox')).toHaveLength(30);
 fireEvent.click(screen.getAllByRole('checkbox')[0]);
 fireEvent.click(screen.getByRole('tab',{name:'Módulos (1)'}));
 expect(screen.getByRole('checkbox',{name:/Propulsão/})).toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Revisar custódia'}));
 fireEvent.click(screen.getByRole('button',{name:'Confirmar retirar para órbita'}));
 await waitFor(()=>expect(mock.api).toHaveBeenCalled());
 expect(mock.api.mock.calls[0][0]).toBe('/api/universe/stellar/custody');
 expect(JSON.parse(mock.api.mock.calls[0][1].body)).toMatchObject({planet_id:'home',unit_id:'unit',action:'withdraw',module_ids:['propulsion-module'],ship_ids:['ship-0']});
});

it('shows only real fabrication and phase deadlines and blocks an already active phase',()=>{
 const complete=(planetSnapshot().observed_at??0)+60;
 mock.stellar.projects=[{id:'project',project_id:'project',source_id:'source',status:'building',completed_phases:1,x:2,y:1,stocks:{},star_present:false,phase_records:[],active_phase:{phase:2,complete_at:complete,completed:false}}];
 mock.stellar.modules=[{id:'manufacturing',kind:'control',status:'manufacturing',origin_planet_id:'home',current_planet_id:'home',project_id:null,fleet_id:null,consumed_phase:null,complete_at:complete},{id:'undated',kind:'shielding',status:'manufacturing',origin_planet_id:'home',current_planet_id:'home',project_id:null,fleet_id:null,consumed_phase:null,complete_at:null}];
 mount();expect(screen.getByRole('button',{name:'Iniciar próxima fase'})).toBeDisabled();
 expect(screen.getByText(/Fase 2 em andamento/)).toBeTruthy();
 fireEvent.click(within(screen.getByRole('tablist',{name:'Engenharia estelar'})).getByRole('tab',{name:'Módulos'}));
 expect(screen.getAllByText(/Fabricação ·/)).toHaveLength(1);
});
