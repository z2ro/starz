import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,Outlet,Routes,Route} from 'react-router-dom';
import {planetIdentity,systemPlanetSummary,knownPlanetValue} from '../frontend/src/galaxy/planetIdentity';
import {identityFixtures as fixtures,identityRoster as roster} from './fixtures/galaxyIdentity';
import {planetSnapshot,planetCatalog} from './fixtures/planetIntegration';
import {GalaxyView} from '../frontend/src/views/GalaxyView';
import type {GalaxySystem} from '../frontend/src/types/game';
const query=vi.hoisted(()=>({data:undefined as unknown,isPending:false,isError:false}));
vi.mock('../frontend/src/api/queries',()=>({useGalaxyQuery:()=>query}));
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>({data:{players:[]}})}));
vi.mock('../frontend/src/galaxy/OrbitalSystemScene',()=>({OrbitalSystemScene:()=>null}));
afterEach(cleanup);
it('uses the exact coordinates/index roster entry for home, never system.home or planet zero',()=>{
 expect(planetIdentity(fixtures.two,fixtures.two.planets![0],roster).kind).toBe('unclaimed');
 expect(planetIdentity(fixtures.two,fixtures.two.planets![1],roster)).toMatchObject({kind:'home',index:1,ordinal:2,ownedId:roster[0].id});
 expect(planetIdentity(fixtures.multiple,fixtures.multiple.planets![2],roster).kind).toBe('owned');
 expect(planetIdentity({...fixtures.two,x:9},fixtures.two.planets![1],roster)).toMatchObject({kind:'owned',ownedId:undefined});
});
it.each(Object.entries(fixtures))('provides an authoritative status for %s',(_,system)=>{
 for(const planet of system.planets!){const result=planetIdentity(system,planet,roster);expect(result.label).toBeTruthy();expect(result.ordinal).toBe(planet.planet_index+1);}
});
it('does not confuse occupancy, eligibility and missing information',()=>{
 expect(planetIdentity(fixtures.occupied,fixtures.occupied.planets![0],roster)).toMatchObject({kind:'occupied',canColonize:false});
 expect(planetIdentity(fixtures.unknown,fixtures.unknown.planets![0],roster)).toMatchObject({kind:'unknown',canColonize:false});
 const own=fixtures.two.planets![1];expect(planetIdentity(fixtures.two,{...own,ownership:'UNCLAIMED'},roster).kind).toBe('unknown');
});
it('counts only known planets, preserving partial ownership uncertainty and fog of war',()=>{
 expect(systemPlanetSummary(fixtures.multiple,roster)).toEqual({known:3,owned:2,confirmedOwned:2});
 expect(systemPlanetSummary(fixtures.unknown,roster)).toEqual({known:1,owned:null,confirmedOwned:0});
 expect(systemPlanetSummary({...fixtures.two,knowledge_level:'UNKNOWN'},roster)).toEqual({known:null,owned:null,confirmedOwned:null});
});
function mount(system:GalaxySystem){
 query.data={systems:[system],home:[-2,-1],center:[-2,-1],radius:2};const state=planetSnapshot();state.persistent=true;state.planets=roster;
 const execute=vi.fn(),setActivePlanetId=vi.fn();
 render(<MemoryRouter><Routes><Route element={<Outlet context={{state,catalog:planetCatalog,execute,setActivePlanetId}}/>}><Route path="/" element={<GalaxyView/>}/><Route path="/planet" element={<p>Existing planet inspector</p>}/></Route></Routes></MemoryRouter>);return{execute,setActivePlanetId};
}
it('shows system identity separately and manages the correct homeworld',()=>{
 const {setActivePlanetId}=mount(fixtures.two),inspector=screen.getByRole('complementary',{name:'Inspetor do sistema'});
 expect(within(inspector).getByText(/Estrela classe K.*2 planetas conhecidos.*1 próprio/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/P2 · Nativa/}));
 expect(within(inspector).getByText('Mundo natal',{exact:true})).toBeTruthy();
 expect(within(inspector).getByText('P2 · Nativa')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Planejar missão para -2:-1'})).toHaveAttribute('href',`#/fleets?plan=1&x=-2&y=-1&mission=REINFORCE&target=${roster[0].id}`);
 fireEvent.click(screen.getByRole('link',{name:'Abrir planeta e instalações'}));expect(setActivePlanetId).toHaveBeenCalledWith(roster[0].id);expect(screen.getByText('Existing planet inspector')).toBeTruthy();
});
it('exposes only read-only colonization requirements and preserves the real destination',()=>{
 const {execute}=mount(fixtures.one);fireEvent.click(screen.getByRole('button',{name:/P1 · Pelagos/}));
 expect(screen.getByRole('link',{name:'Planejar missão para -2:-1'})).toHaveAttribute('href','#/fleets?plan=1&x=-2&y=-1&mission=COLONIZE&planet_index=0');
 fireEvent.click(screen.getByRole('button',{name:'Ver requisitos de colonização'}));
 expect(screen.getByRole('dialog',{name:'Colonização · Pelagos'})).toBeTruthy();expect(execute).not.toHaveBeenCalled();
});
it.each(['occupied','unknown'] as const)('never offers colonization for %s',kind=>{
 mount(fixtures[kind]);fireEvent.click(screen.getByRole('button',{name:kind==='occupied'?/P1 · Fortaleza/:/P1 · Enigmático/}));
 expect(screen.queryByRole('button',{name:'Ver requisitos de colonização'})).toBeNull();
 expect(screen.getByRole('link',{name:'Planejar missão para -2:-1'})).toHaveAttribute('href','#/fleets?plan=1&x=-2&y=-1&mission=MOVE&planet_index=0');
});

it('never formats missing physical properties as measured zero',()=>{expect(knownPlanetValue(undefined,'K')).toBe('Não informado');expect(knownPlanetValue(null,'%')).toBe('Não informado');expect(knownPlanetValue(NaN,'g')).toBe('Não informado');expect(knownPlanetValue(0,'%')).toBe('0 %');});
