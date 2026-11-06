import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Outlet,Route,Routes} from 'react-router-dom';
import {LevelResearch,researchDependencies} from '../frontend/src/universe/LevelResearch';
import {planetSnapshot} from './fixtures/planetIntegration';
import catalogFixture from './fixtures/fleet-api-catalog.json';
import type {Catalog,Technology} from '../frontend/src/types/game';
import type {Upgrade} from '../frontend/src/universe/types';
const data=vi.hoisted(()=>({research:[] as Upgrade[]}));
vi.mock('../frontend/src/universe/useUniverse',()=>({useUniverse:()=>({data,isFetching:false})}));
afterEach(cleanup);
const technologies:Technology[]=[['energy_engineering','Engenharia energética','fundamental'],['extraction','Extração mineral','civil'],['naval_doctrine','Doutrina naval','military'],['civil_tier_2','Avanço Civil 2','civil']].map(([id,name,domain])=>({id,name,domain:domain as Technology['domain'],description:'Pesquisa real',category:domain,cost:{components:2},requires:[],duration:60,tier:id==='civil_tier_2'?2:1,kind:id==='civil_tier_2'?'breakthrough':'repeatable',advances_tier:id==='civil_tier_2'?2:undefined,unlocks:[]}));
function mount(){const state=planetSnapshot();state.persistent=true;state.stocks.components=100;state.science={civil:{capacity:1,specialized:0,rate:1},military:{capacity:1,specialized:0,rate:1},fundamental:{capacity:1,specialized:0,rate:1}};state.research_domains={civil:{active:null,remaining_work:0,complete_at:null},military:{active:null,remaining_work:0,complete_at:null},fundamental:{active:'energy_engineering',remaining_work:30,total_work:60,complete_at:2000}};
 data.research=technologies.map(t=>({id:t.id,domain:t.domain,tier:t.tier,kind:t.kind,level:0,next_level:1,cost:t.cost,work:60,effects:{},requirements:t.tier===2?['Capacidade civil: 1/3']:[],cost_growth:1.7,work_growth:1.55}));const execute=vi.fn().mockResolvedValue({});const catalog:Catalog={...catalogFixture,technologies};
 render(<MemoryRouter><Routes><Route element={<Outlet context={{state,catalog,activePlanetId:'local',execute,busy:false}}/>}><Route path="/" element={<LevelResearch/>}/></Route></Routes></MemoryRouter>);return execute;
}
it('allows another domain while fundamental research is active and preserves the endpoint payload',()=>{const execute=mount();expect(screen.getByRole('button',{name:'Pesquisar Engenharia energética nível 1'})).toBeDisabled();fireEvent.click(screen.getByRole('navigation',{name:'Domínio científico'}).querySelector('button')!);fireEvent.click(screen.getByRole('button',{name:'Pesquisar Extração mineral nível 1'}));expect(execute).toHaveBeenCalledWith('research',{id:'extraction',planet_id:'local'});});
it('keeps advanced projects inspectable with capacity blockers and all five tiers',()=>{mount();fireEvent.click(screen.getByRole('navigation',{name:'Domínio científico'}).querySelector('button')!);fireEvent.click(screen.getByRole('button',{name:/Avanço Civil 2.*Bloqueado/}));expect(screen.getByText('Capacidade civil: 1/3')).toBeTruthy();expect(screen.getByRole('button',{name:'Pesquisar Avanço Civil 2 nível 1'})).toBeDisabled();expect(screen.getByText('V · Transcendência')).toBeTruthy();});
it('includes true cross-domain, level and tier prerequisites without duplicates',()=>{expect(researchDependencies({...technologies[1],tier:3,requires:['computing'],level_requires:{computing:2}})).toEqual(['computing','civil_tier_3']);});
