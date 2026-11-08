import type { Catalog, State } from '../types/game';
export const missionNames: Record<string,string> = { STELLAR_DELIVERY:'Entregar módulos estelares', RECON:'Reconhecimento', REINFORCE:'Reforçar planeta', MOVE:'Reposicionar', SURVEY:'Explorar sistema', COLONIZE:'Fundar colônia', TRANSPORT:'Transportar recursos', ESPIONAGE:'Espionar', ATTACK:'Atacar', EXPEDITION:'Expedição científica', RETURN:'Retornar à origem' };
export const categoryNames: Record<string,string> = {all:'Todas',energy:'Energia',industry:'Indústria',expansion:'Expansão',science:'Ciência',military:'Defesa e combate'};
export const effectNames: Record<string,string> = {energy:'Geração de energia',mining:'Extração',processing:'Rendimento industrial',components:'Componentes',fleet_slots:'Frotas simultâneas',sensors:'Sensores',espionage:'Espionagem',counter_intelligence:'Proteção contra espionagem',speed:'Velocidade de viagem',weapons:'Poder militar',shields:'Escudos',armor:'Blindagem',cargo:'Carga',fuel:'Eficiência de combustível',colonies:'Mundos adicionais',workforce:'Eficiência dos trabalhadores',research:'Velocidade de pesquisa',ship_speed:'Velocidade de montagem',defense:'Defesa planetária',carrier:'Alas embarcadas',transport:'Eficiência de transporte',build_speed:'Velocidade de construção',alloy:'Produção de ligas',population:'Capacidade habitacional',expedition:'Coleta científica',storage:'Armazenamento',recruitment:'Acolhimento populacional'};
export function shortage(stocks:Record<string,number>,cost:Record<string,number>){return Object.entries(cost).filter(([r,n])=>(stocks[r]??0)<n).map(([id,n])=>({id,missing:n-(stocks[id]??0)}));}
export const GUIDE_STEPS = [
 {id:'resources',title:'Entenda seus recursos',text:'Ferrita e voláteis alimentam os processadores. Ligas e componentes pagam obras, pesquisas e naves. Os estoques pertencem ao planeta atual.',path:'/economy',cta:'Ver produção e recursos'},
 {id:'build',title:'Amplie a produção',text:'Construa um nível do Extrator de ferrita. Você paga ligas e componentes agora; a produção aumenta quando a obra terminar.',path:'/development?building=ore_extractor',cta:'Ampliar extrator'},
 {id:'research',title:'Inicie uma pesquisa',text:'Engenharia energética aumenta a energia produzida por seus campos solares. O laboratório trabalha enquanto você explora outras telas.',path:'/research?tech=energy_engineering',cta:'Pesquisar energia'},
 {id:'ship',title:'Construa sua exploradora',text:'A Horizon revela sistemas desconhecidos. Escolha o modelo no Estaleiro e confirme a construção; aguarde a montagem para despachá-la.',path:'/shipyard',cta:'Construir Horizon'},
 {id:'mission',title:'Explore outro sistema',text:'No mapa, selecione um sistema desconhecido. Planeje a missão, escolha a Horizon, confira combustível e duração e confirme o envio.',path:'/galaxy',cta:'Escolher destino no mapa'},
] as const;
export type GuideProgress = {started:number;ore:number;energy:number;done:string[];skipped?:string[];hidden:boolean};
export function initialGuide(state:State):GuideProgress{return {started:Date.now()/1000,ore:state.districts.ore_extractor??0,energy:state.empire_levels?.energy_engineering??0,done:[],hidden:false};}
export function detectedGuideSteps(state:State,p:GuideProgress):string[]{return [
 ((state.districts.ore_extractor??0)>p.ore||state.construction.some(j=>j.id==='ore_extractor'&&j.started_at>=p.started-2))?'build':'',
 (state.research.active==='energy_engineering'||(state.empire_levels?.energy_engineering??0)>p.energy)?'research':'',
 state.ships.some(s=>s.hull_id==='scout_hull')?'ship':'',
 state.fleets.some(f=>f.operation==='SURVEY'||f.mission==='SURVEY')?'mission':'',
].filter(Boolean);}
export function readLocal<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(key)??'null')??fallback;}catch{return fallback;}}
export function writeLocal(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing may disable storage; gameplay remains available. */}}
export type Visit = {at:number;planet:string;stocks:Record<string,number>;levels:Record<string,number>;districts:Record<string,number>;fleets:Record<string,string>;unlocks:string[]; ships?:Record<string,number>; notices?:string[]};
export function visitSnapshot(state:State):Visit{return {at:Date.now()/1000,planet:state.active_planet?.id??'',stocks:{...state.stocks},levels:{...state.empire_levels},districts:{...state.districts},fleets:Object.fromEntries(state.fleets.map(f=>[f.id,f.status])),ships:Object.fromEntries(state.ships.map(s=>[s.id,s.ready_at])),notices:[...state.notices],unlocks:[...state.unlocked_content]};}
export function changesSince(before:Visit,state:State,catalog:Catalog):string[]{
 const name=(id:string)=>[...catalog.technologies,...catalog.districts,...catalog.ships,...catalog.propulsion,...catalog.fuels].find(t=>t.id===id)?.name??id.replaceAll('_',' ');
 const changes:string[]=[];
 for(const [id,n] of Object.entries(state.empire_levels??{}))if(n>(before.levels?.[id]??0))changes.push(`Pesquisa concluída: ${name(id)} · nível ${n}.`);
 if(before.planet===state.active_planet?.id)for(const [id,n] of Object.entries(state.districts))if(n>(before.districts?.[id]??0))changes.push(`Instalação concluída: ${name(id)} · nível ${n}.`);
 for(const f of state.fleets)if(before.fleets?.[f.id]==='TRANSIT'&&f.status==='ARRIVED')changes.push(`Frota chegou: ${missionNames[f.operation??f.mission]??f.name} · ${f.x}:${f.y}.`);
 for(const id of state.unlocked_content)if(!(before.unlocks??[]).includes(id))changes.push(`Novo desbloqueio: ${name(id)}.`);
 for(const ship of state.ships)if((before.ships?.[ship.id]??0)>before.at&&ship.ready_at<=(state.observed_at??Date.now()/1000))changes.push(`Nave pronta: ${name(ship.hull_id)}.`);
 for(const notice of state.notices)if(!(before.notices??[]).includes(notice)&&!notice.startsWith('Pesquisa concluída:')&&!notice.startsWith('Construção concluída:'))changes.push(notice);
 return changes;
}
