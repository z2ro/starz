import { PlanetRenderer } from './planet3d/PlanetRenderer';
import type { PlanetVisualState } from './planet3d/types';

type Content = { id: string; name: string; description: string; category: string; cost: Record<string, number>; requires: string[] };
type District = Content & { duration: number; workforce: number; energy_generation: number; energy_consumption: number; production: Record<string, number>; processing: Record<string, number>; research_rate: number; population_capacity: number; industrial_capacity: number; construction_slots: number; shipyard_slots: number };
type Technology = Content & { duration: number; unlocks: string[] };
type Hull = Content & { classification: string; role: string; mass: number; crew: number; duration: number; compatible_propulsion: string[] };
type Propulsion = Content & { compatible_fuels: string[]; speed_factor: number; fuel_efficiency: number; thermal_load: number; signature: number };
type Fuel = Content & { energy_density: number; storage_factor: number };
type TravelMode = Content & { travel_time_modifier: number; fuel_modifier: number; thermal_modifier: number; signature_modifier: number };
type Catalog = { resources: Content[]; districts: District[]; technologies: Technology[]; ships: Hull[]; propulsion: Propulsion[]; fuels: Fuel[]; travel_modes: TravelMode[] };
type Planet = { name: string; mass: number; radius: number; gravity: number; orbital_distance: number; temperature: number; atmosphere: string; radiation: number; magnetic_field: number; water: number; geological_activity: number; mineral_profile: Record<string, number>; usable_surface: number };
type State = {
  system: { name: string; x: number; y: number; star: { stellar_class: string; mass: number; luminosity: number; age: number; activity: number }; planet: Planet };
  stocks: Record<string, number>;
  capacities: Record<string, number> & { energy_generation: number; energy_consumption: number; energy_coverage: number; industrial_capacity: number; construction_slots: number; construction_slots_available: number; shipyard_slots: number; shipyard_slots_available: number; effective_research_rate: number; workforce_supply: number; workforce_demand: number; workforce_coverage: number; crew_committed: number };
  population: { total: number; available: number; capacity: number };
  districts: Record<string, number>;
  construction: Array<{ id: string; started_at: number; complete_at: number }>;
  research: { active: string | null; complete_at: number | null; completed: string[]; remaining_work: number };
  active_planet?: { id: string | null; planet_index: number; home: boolean };
  planets?: Array<{ id: string; name: string; x: number; y: number; planet_index: number; population_total: number; home: boolean; stocks?: Record<string, number> }>;
  fleets: Array<{ id: string; name: string; status: 'ARRIVED' | 'TRANSIT'; mission: 'MOVE' | 'SURVEY' | 'COLONIZE'; target_planet_index?: number | null; x: number; y: number; destination_x: number; destination_y: number; ship_ids: string[]; eta: number; propulsion: string; mode: string; fuel_cost: number; departure_at: number; arrival_at: number }>;
  ships: Array<{ id: string; hull_id: string; propulsion_id: string; fuel_id: string; crew: number; mass: number; ready_at: number }>;
  travel_modes: TravelMode[]; notices: string[]; unlocked_content: string[];
};
type GalaxyPlanet = { planet_index: number; name: string; gravity: number; temperature: number; water: number; radiation: number; viability: 'VIABLE' | 'HOSTILE' | 'UNINHABITABLE'; ownership: 'OWNED' | 'OCCUPIED' | 'UNCLAIMED'; colonization: { eligible: boolean; reason: string | null; population: number; cost: Record<string, number> } };
type GalaxySystem = { id: string; name?: string; x: number; y: number; distance: number; home: boolean; knowledge_level: 'UNKNOWN' | 'SURVEYED'; star?: { stellar_class: string; luminosity: number; activity: number }; planet?: { name: string; gravity: number; temperature: number; water: number; radiation: number }; planets?: GalaxyPlanet[] };
type Galaxy = { center: number[]; home: number[]; radius: number; systems: GalaxySystem[] };
type TravelPreview = { origin: number[]; destination: number[]; distance: number; eta_seconds: number; fuel_cost: number; heat: number; signature: number };
type View = 'overview' | 'planet' | 'economy' | 'research' | 'shipyard' | 'fleets' | 'galaxy';

const app = document.querySelector<HTMLDivElement>('#app')!;
const views: Array<{ id: View; label: string; icon: string }> = [
  { id: 'overview', label: 'Visão geral', icon: '◈' }, { id: 'planet', label: 'Planeta', icon: '●' },
  { id: 'economy', label: 'Economia', icon: '▥' }, { id: 'research', label: 'Pesquisa', icon: '⌬' },
  { id: 'shipyard', label: 'Estaleiro', icon: '△' }, { id: 'fleets', label: 'Frotas', icon: '≋' },
  { id: 'galaxy', label: 'Galáxia', icon: '✦' },
];
let current: State;
let content: Catalog;
let galaxyData: Galaxy;
let selectedSystem: GalaxySystem;
let selectedSubject = '';
let selectedMode = '';
let selectedHull = '';
let selectedPropulsion = '';
let selectedFuel = '';
let previews: Record<string, TravelPreview> | undefined;
let selectedPlanetIndex: number | undefined;
let busy = false;
let feedback: { kind: 'success' | 'error'; message: string } | undefined;
let planetRenderer: PlanetRenderer | undefined;

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const fmt = (value: number | undefined, digits = 0) => Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });
const label = (id: string) => [...(content?.resources ?? []), ...(content?.fuels ?? []), ...(content?.districts ?? []), ...(content?.technologies ?? []), ...(content?.ships ?? []), ...(content?.propulsion ?? []), ...(content?.travel_modes ?? [])].find(item => item.id === id)?.name ?? id.replaceAll('_', ' ');
const term = (id: string) => ({ corvette: 'Corveta', exploration: 'Exploração', MOVE: 'Movimento', SURVEY: 'Levantamento', COLONIZE: 'Colonização', VIABLE: 'Viável', HOSTILE: 'Hostil', UNINHABITABLE: 'Inabitável' } as Record<string, string>)[id] ?? id.replaceAll('_', ' ');
const hullRole = (hull: Hull) => `${term(hull.classification)} · ${term(hull.role)}`;
const duration = (seconds: number) => seconds < 60 ? `${Math.max(0, Math.ceil(seconds))}s` : seconds < 3600 ? `${Math.ceil(seconds / 60)}min` : `${Math.floor(seconds / 3600)}h ${Math.ceil(seconds % 3600 / 60)}min`;
const remaining = (stamp: number | null) => stamp === null ? 'Pausada' : duration(stamp - Date.now() / 1000);
const percent = (value: number) => Math.max(0, Math.min(100, value));
const route = (): View => { const candidate = (typeof location === 'undefined' ? '' : location.hash.replace('#/', '')) as View; return views.some(view => view.id === candidate) ? candidate : 'overview'; };
const cost = (items: Record<string, number>) => Object.keys(items).length ? Object.entries(items).map(([id, amount]) => `<span>${esc(label(id))} <b>${fmt(amount, 1)}</b></span>`).join('') : '<span>Sem custo</span>';
const badge = (text: string, tone = 'neutral') => `<span class="badge ${tone}">${esc(text)}</span>`;
const progress = (value: number, text: string) => `<div class="progress" aria-label="${esc(text)}"><i style="width:${percent(value)}%"></i></div><small>${esc(text)}</small>`;
const panel = (title: string, body: string, eyebrow = '') => `<section class="panel">${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h2>${esc(title)}</h2>${body}</section>`;
const stat = (name: string, value: string, note = '') => `<div class="stat"><span>${esc(name)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
const empty = (title: string, text: string, action = '') => `<div class="empty"><div class="empty-symbol">◇</div><strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;

function unlocked(item: Content): boolean { const gated = content.technologies.some(technology => technology.unlocks.includes(item.id)); return !gated || current.unlocked_content.includes(item.id); }
function requirements(item: Content): boolean { return item.requires.every(id => current.research.completed.includes(id) || (current.districts[id] ?? 0) > 0) && unlocked(item); }
function strategicResources(): Content[] {
  const stocked = [...content.resources, ...content.fuels].filter(item => item.id in current.stocks);
  return ['natural', 'material', 'component', 'fuel'].map(category => stocked.find(item => item.category === category)).filter((item): item is Content => !!item);
}
function temporalActivityCount(): number {
  return current.construction.length + (current.research.active ? 1 : 0) + current.fleets.filter(fleet => fleet.status === 'TRANSIT').length + current.ships.filter(ship => ship.ready_at > Date.now() / 1000).length;
}

function planetVisual(large = false): string {
  const categories = content.districts.filter(item => (current.districts[item.id] ?? 0) > 0).map(item => item.category.toLowerCase());
  const markers = categories.map((category, index) => `<span class="surface-marker marker-${esc(category)} marker-${index % 6}" title="${esc(category)}"></span>`).join('');
  return `<div class="planet-stage ${large ? 'planet-large' : ''}" aria-label="Representação de ${esc(current.system.planet.name)}"><div class="distant-star"></div><div class="orbit-line orbit-a"></div><div class="orbit-line orbit-b"></div><div class="planet-sphere"><div class="planet-clouds"></div><div class="city-lights"></div>${markers}</div>${current.capacities.shipyard_slots > 0 ? '<div class="orbital-station" title="Estaleiro orbital"><i></i></div>' : ''}${current.fleets.length ? '<div class="fleet-marker" title="Presença de frota">▸</div>' : ''}<div class="visual-caption"><b>${esc(current.system.planet.name)}</b><span>${esc(current.system.name)} · ${current.system.x}:${current.system.y}</span></div></div>`;
}

function planetSelector(): string {
  const worlds = current.planets ?? [];
  if (!worlds.length) return '';
  return `<div class="planet-selector"><label>PLANETA ATIVO<select id="planet-select">${worlds.map(world => `<option value="${esc(world.id)}" ${world.id === current.active_planet?.id ? 'selected' : ''}>${world.home ? 'Homeworld' : 'Colônia'} · ${esc(world.name)}</option>`).join('')}</select></label><span>${worlds.length} ${worlds.length === 1 ? 'mundo imperial' : 'mundos imperiais'}</span></div>`;
}

function activeItems(): string {
  const items: string[] = [];
  current.construction.forEach(job => { const district = content.districts.find(item => item.id === job.id); const done = 100 * (Date.now() / 1000 - job.started_at) / (job.complete_at - job.started_at); items.push(`<div class="queue-item"><div><b>${esc(district?.name ?? job.id)}</b>${badge('CONSTRUÇÃO', 'blue')}</div>${progress(done, `${remaining(job.complete_at)} restantes`)}</div>`); });
  if (current.research.active) { const technology = content.technologies.find(item => item.id === current.research.active)!; items.push(`<div class="queue-item"><div><b>${esc(technology.name)}</b>${badge(current.research.complete_at ? 'PESQUISANDO' : 'PAUSADA', current.research.complete_at ? 'blue' : 'warn')}</div>${progress(100 * (1 - current.research.remaining_work / technology.duration), current.research.complete_at ? `${remaining(current.research.complete_at)} restantes` : 'Sem cobertura operacional')}</div>`); }
  current.ships.filter(ship => ship.ready_at > Date.now() / 1000).forEach(ship => items.push(`<div class="queue-item"><div><b>${esc(label(ship.hull_id))}</b>${badge('MONTAGEM', 'blue')}</div>${progress(100 * (1 - (ship.ready_at - Date.now() / 1000) / (content.ships.find(item => item.id === ship.hull_id)?.duration ?? 1)), `${remaining(ship.ready_at)} restantes`)}</div>`));
  current.fleets.filter(fleet => fleet.status === 'TRANSIT').forEach(fleet => items.push(`<div class="queue-item"><div><b>${esc(fleet.name)}</b>${badge('EM TRÂNSITO', 'blue')}</div>${progress(100 * (Date.now() / 1000 - fleet.departure_at) / (fleet.arrival_at - fleet.departure_at), `${remaining(fleet.arrival_at)} · ${fleet.destination_x}:${fleet.destination_y}`)}</div>`));
  return items.length ? items.join('') : empty('Operações estáveis', 'Nenhuma atividade temporal em andamento.');
}

function contextPanel(): string {
  const active = temporalActivityCount();
  return `<aside class="context-panel" aria-label="Contexto operacional"><div class="context-heading"><span>OPERAÇÕES</span><b>${active}</b></div>${activeItems()}<div class="context-heading context-alerts"><span>REGISTRO RECENTE</span></div><div class="notice-list">${current.notices.length ? current.notices.map(message => `<div class="notice"><i></i><span>${esc(message)}</span></div>`).join('') : '<span class="muted">Sem novos registros.</span>'}</div></aside>`;
}

function overview(): string {
  const margin = current.capacities.energy_generation - current.capacities.energy_consumption;
  const moving = current.fleets.filter(fleet => fleet.status === 'TRANSIT').length;
  const orbitalReady = current.capacities.shipyard_slots > 0;
  const nextDecision = orbitalReady
    ? `<p>Capacidade orbital ativa. Monte uma nave e escolha uma rota local.</p><button class="action secondary" data-goto="galaxy">Abrir mapa estelar</button>`
    : `<p>Amplie o processamento e conclua pesquisas que liberam infraestrutura orbital.</p><button class="action primary" data-goto="research">Abrir pesquisa</button>`;
  return `<header class="page-header"><div><div class="eyebrow">CENTRO DE COMANDO // HOMEWORLD</div><h1>${esc(current.system.planet.name)}</h1><p>${esc(current.system.name)} · sistema ${current.system.x}:${current.system.y}</p></div>${badge('ONLINE', 'good')}</header><div class="overview-grid">${planetVisual(true)}<div class="command-summary">${panel('Situação estratégica', `<div class="stat-grid">${stat('Energia', `${margin >= 0 ? '+' : ''}${fmt(margin)}`, `${fmt(current.capacities.energy_generation)} geração / ${fmt(current.capacities.energy_consumption)} demanda`)}${stat('População', fmt(current.population.total), `${fmt(current.population.available)} disponível`)}${stat('Indústria', fmt(current.capacities.industrial_capacity), 'capacidade nominal')}${stat('Movimentos', fmt(moving), moving ? 'frotas em trânsito' : 'espaço local calmo')}</div>`, 'HOMEWORLD STATUS')}${panel('Próxima decisão', nextDecision)}</div></div><div class="three-columns">${panel('Recursos essenciais', `<div class="resource-list">${strategicResources().map(item => `<div><span>${esc(item.name)}</span><b>${fmt(current.stocks[item.id], 1)}</b></div>`).join('')}</div>`, 'STOCK')}${panel('Desenvolvimento', `<div class="metric-line"><span>Distritos ativos</span><b>${Object.values(current.districts).reduce((sum, level) => sum + level, 0)}</b></div><div class="metric-line"><span>Obras livres</span><b>${current.capacities.construction_slots_available}/${current.capacities.construction_slots}</b></div><div class="metric-line"><span>Estaleiro livre</span><b>${current.capacities.shipyard_slots_available}/${current.capacities.shipyard_slots}</b></div><button class="text-action" data-goto="planet">Gerenciar planeta →</button>`, 'INFRASTRUCTURE')}${panel('Pesquisa e frota', `<div class="metric-line"><span>Pesquisa</span><b>${current.research.active ? esc(label(current.research.active)) : 'Inativa'}</b></div><div class="metric-line"><span>Naves</span><b>${current.ships.length}</b></div><div class="metric-line"><span>Frotas</span><b>${current.fleets.length}</b></div><button class="text-action" data-goto="fleets">Ver forças orbitais →</button>`, 'OPERATIONS')}</div>`;
}

function districtImpact(district: District): string {
  const parts: string[] = [];
  if (district.energy_generation) parts.push(`+${fmt(district.energy_generation)} energia`); if (district.energy_consumption) parts.push(`−${fmt(district.energy_consumption)} energia`); if (district.industrial_capacity) parts.push(`+${fmt(district.industrial_capacity)} indústria`); if (district.research_rate) parts.push(`+${fmt(district.research_rate)} pesquisa/s`); if (district.construction_slots) parts.push(`+${district.construction_slots} obra`); if (district.shipyard_slots) parts.push(`+${district.shipyard_slots} estaleiro`); Object.entries(district.production).forEach(([id, value]) => parts.push(`+${fmt(value, 2)} ${label(id)}/min`));
  return parts.join(' · ') || 'Suporte civil';
}
function districtRow(district: District): string {
  const available = requirements(district); const level = current.districts[district.id] ?? 0;
  return `<div class="entity-row ${available ? '' : 'locked'}"><div><b>${esc(district.name)}</b><small>${esc(district.description)}</small>${badge(district.category)}</div><strong>${level}</strong><span>${esc(districtImpact(district))}<small>${district.workforce} workforce</small></span><div class="cost"><span>${duration(district.duration)}</span>${cost(district.cost)}</div><button class="action compact" data-action="build" data-id="${esc(district.id)}" ${available ? '' : 'disabled'}>${available ? 'Construir' : 'Bloqueado'}</button></div>`;
}

function planetView(): string {
  const p = current.system.planet;
  const orbitalDistricts = content.districts.filter(item => item.shipyard_slots > 0 && (current.districts[item.id] ?? 0) > 0);
  const physical = [['Classe estelar', `${current.system.star.stellar_class}-class`], ['Gravidade', `${fmt(p.gravity, 2)} g`], ['Temperatura', `${fmt(p.temperature)} K`], ['Água', `${fmt(p.water, 1)}%`], ['Radiação', fmt(p.radiation, 2)], ['Campo magnético', fmt(p.magnetic_field, 2)], ['Atmosfera', p.atmosphere], ['Superfície útil', `${fmt(p.usable_surface, 1)}%`], ['Atividade geológica', fmt(p.geological_activity, 2)], ['Distância orbital', `${fmt(p.orbital_distance, 2)} AU`]];
  const orbit = orbitalDistricts.length
    ? `${orbitalDistricts.map(item => `<div class="metric-line"><span>${esc(item.name)}</span><b>Nível ${current.districts[item.id]}</b></div>`).join('')}<div class="metric-line"><span>Slots disponíveis</span><b>${current.capacities.shipyard_slots_available}/${current.capacities.shipyard_slots}</b></div>`
    : empty('Órbita não industrializada', 'Conclua a pesquisa necessária para liberar infraestrutura orbital.');
  return `${planetSelector()}<header class="page-header"><div><div class="eyebrow">PLANETARY COMMAND</div><h1>${esc(p.name)}</h1><p>Ambiente físico, desenvolvimento e presença orbital.</p></div>${badge(`${Object.keys(current.districts).length} TIPOS DE DISTRITO`, 'blue')}</header><div class="planet-layout"><div id="planet-3d-stage" class="planet-3d-stage" aria-label="Visualização 3D de ${esc(p.name)}">${planetVisual(true)}</div>${panel('Perfil físico', `<div class="facts-grid">${physical.map(([name, value]) => stat(name, String(value))).join('')}</div>`, 'PHYSICAL')}</div>${panel('Desenvolvimento planetário', `<div class="entity-table"><div class="table-head"><span>Infraestrutura</span><span>Nível</span><span>Impacto</span><span>Custo / duração</span><span></span></div>${content.districts.map(district => districtRow(district)).join('')}</div>`, 'DEVELOPMENT')}<div class="two-columns">${panel('Órbita', orbit)}${panel('Perfil mineral', Object.entries(p.mineral_profile).map(([id, value]) => `<div class="metric-line"><span>${esc(label(id))}</span><b>${fmt(value, 2)}×</b></div>`).join(''))}</div>`;
}

function economyView(): string {
  const resources = [...content.resources, ...content.fuels].filter(item => item.id in current.stocks);
  const producers = content.districts.filter(district => (current.districts[district.id] ?? 0) > 0 && (Object.keys(district.production).length || Object.keys(district.processing).length));
  return `<header class="page-header"><div><div class="eyebrow">ECONOMY CONTROL</div><h1>Economia planetária</h1><p>Stocks armazenados, fluxos nominais e capacidades operacionais.</p></div>${badge(`${fmt(current.capacities.energy_coverage * 100)}% ENERGIA`, current.capacities.energy_coverage === 1 ? 'good' : 'warn')}</header><div class="resource-cards">${resources.map(item => `<article class="resource-card"><div class="resource-icon resource-${esc(item.category)}">${item.category === 'fuel' ? '◒' : '◆'}</div><div><span>${esc(item.category)}</span><h3>${esc(item.name)}</h3><strong>${fmt(current.stocks[item.id], 1)}</strong><small>em estoque</small></div></article>`).join('')}</div><div class="three-columns">${panel('Energia', `${stat('Geração', fmt(current.capacities.energy_generation), 'capacidade')}${stat('Demanda', fmt(current.capacities.energy_consumption), 'infraestrutura')}${progress(current.capacities.energy_coverage * 100, `${fmt(current.capacities.energy_coverage * 100)}% cobertura`)}`, 'CAPACITY')}${panel('Workforce', `${stat('Oferta', fmt(current.capacities.workforce_supply), `${fmt(current.capacities.crew_committed)} em tripulação`)}${stat('Demanda', fmt(current.capacities.workforce_demand), `${fmt(current.population.available)} disponível`)}${progress(current.capacities.workforce_coverage * 100, `${fmt(current.capacities.workforce_coverage * 100)}% cobertura`)}`, 'CAPACITY')}${panel('Indústria', `${stat('Capacidade nominal', fmt(current.capacities.industrial_capacity), 'não representa slots')}${stat('Obras', `${current.capacities.construction_slots_available}/${current.capacities.construction_slots}`, 'slots livres')}${stat('Estaleiro', `${current.capacities.shipyard_slots_available}/${current.capacities.shipyard_slots}`, 'slots livres')}`, 'CAPACITY')}</div>${panel('Fluxos produtivos', producers.length ? `<div class="flow-list">${producers.map(district => `<div><div><b>${esc(district.name)}</b><small>Nível ${current.districts[district.id]} · taxa nominal por minuto</small></div><div class="flow-input">${Object.entries(district.processing).map(([id, value]) => `−${fmt(value * current.districts[district.id], 2)} ${label(id)}`).join(' · ') || 'Extração'}</div><div class="flow-arrow">→</div><div class="flow-output">${Object.entries(district.production).map(([id, value]) => `+${fmt(value * current.districts[district.id], 2)} ${label(id)}`).join('')}</div></div>`).join('')}</div>` : empty('Sem fluxos produtivos', 'Construa infraestrutura de extração ou processamento.'), 'FLOW · sujeito a energia, workforce e inputs')}`;
}

function researchView(): string {
  return `<header class="page-header"><div><div class="eyebrow">SCIENCE DIRECTORATE</div><h1>Pesquisa</h1><p>Tecnologias desbloqueiam capacidades e novas decisões estratégicas.</p></div>${stat('Taxa efetiva', `${fmt(current.capacities.effective_research_rate, 2)} /s`, current.capacities.effective_research_rate < 1 ? 'cobertura reduzida' : 'operação nominal')}</header><div class="tech-grid">${content.technologies.map(technology => { const completed = current.research.completed.includes(technology.id); const active = current.research.active === technology.id; const available = requirements(technology) && !current.research.active && !completed; const status = completed ? ['CONCLUÍDA', 'good'] : active ? ['PESQUISANDO', 'blue'] : available ? ['DISPONÍVEL', 'neutral'] : ['BLOQUEADA', 'warn']; return `<article class="tech-card ${completed ? 'completed' : ''}"><div class="card-top"><span class="tech-symbol">⌬</span>${badge(status[0], status[1])}</div><div class="eyebrow">${esc(technology.category)}</div><h2>${esc(technology.name)}</h2><p>${esc(technology.description)}</p>${active ? progress(100 * (1 - current.research.remaining_work / technology.duration), current.research.complete_at ? `${remaining(current.research.complete_at)} restantes` : 'Pesquisa pausada') : ''}<div class="requirements"><span>Requisitos</span><b>${technology.requires.length ? technology.requires.map(label).join(', ') : 'Nenhum'}</b><span>Desbloqueia</span><b>${technology.unlocks.map(label).join(', ')}</b><span>Trabalho nominal</span><b>${duration(technology.duration)}</b></div><div class="card-footer"><div class="cost">${cost(technology.cost)}</div><button class="action ${available ? 'primary' : ''}" data-action="research" data-id="${esc(technology.id)}" ${available ? '' : 'disabled'}>${completed ? 'Concluída' : active ? 'Em andamento' : available ? 'Iniciar pesquisa' : 'Indisponível'}</button></div></article>`; }).join('')}</div>`;
}

function shipyardView(): string {
  const hull = content.ships.find(item => item.id === selectedHull) ?? content.ships[0]; selectedHull = hull.id; const motors = content.propulsion.filter(item => hull.compatible_propulsion.includes(item.id)); if (!motors.some(item => item.id === selectedPropulsion)) selectedPropulsion = motors[0]?.id ?? ''; const motor = content.propulsion.find(item => item.id === selectedPropulsion); const fuels = content.fuels.filter(item => motor?.compatible_fuels.includes(item.id)); if (!fuels.some(item => item.id === selectedFuel)) selectedFuel = fuels[0]?.id ?? ''; const operational = current.capacities.shipyard_slots > 0; const building = current.ships.filter(ship => ship.ready_at > Date.now() / 1000).length;
  return `<header class="page-header"><div><div class="eyebrow">ORBITAL ASSEMBLY</div><h1>Estaleiro</h1><p>Monte cascos existentes com propulsão e combustível compatíveis.</p></div>${badge(operational ? `${current.capacities.shipyard_slots_available} SLOT LIVRE` : 'NÃO CONSTRUÍDO', operational ? 'good' : 'warn')}</header><div class="shipyard-status">${stat('Slots totais', fmt(current.capacities.shipyard_slots))}${stat('Ocupados', fmt(building))}${stat('Disponíveis', fmt(current.capacities.shipyard_slots_available))}${stat('Naves prontas', fmt(current.ships.length - building))}</div>${operational ? `<div class="ship-builder">${panel('Configuração de montagem', `<label>Casco<select id="hull-select">${content.ships.map(item => `<option value="${esc(item.id)}" ${item.id === hull.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><label>Propulsão<select id="propulsion-select">${motors.map(item => `<option value="${esc(item.id)}" ${item.id === selectedPropulsion ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><label>Combustível<select id="fuel-select">${fuels.map(item => `<option value="${esc(item.id)}" ${item.id === selectedFuel ? 'selected' : ''}>${esc(item.name)} · estoque ${fmt(current.stocks[item.id], 1)}</option>`).join('')}</select></label><div class="cost assembly-cost">${cost(hull.cost)}</div><button class="action primary" data-action="build-ship" ${current.capacities.shipyard_slots_available ? '' : 'disabled'}>Iniciar montagem · ${duration(hull.duration)}</button>`, 'BUILD ORDER')}${panel(hull.name, `<div class="ship-role">${esc(hullRole(hull))}</div><p>${esc(hull.description)}</p><div class="facts-grid">${stat('Massa', fmt(hull.mass))}${stat('Tripulação', fmt(hull.crew))}${stat('Duração', duration(hull.duration))}${stat('Compatibilidade', motors.map(item => item.name).join(', '))}</div>`)}${motor ? panel(motor.name, `<p>${esc(motor.description)}</p><div class="facts-grid">${stat('Velocidade', `${fmt(motor.speed_factor, 2)}×`)}${stat('Eficiência', `${fmt(motor.fuel_efficiency, 2)}×`)}${stat('Calor', fmt(motor.thermal_load, 2))}${stat('Assinatura', fmt(motor.signature, 2))}</div>`, 'PROPULSION') : ''}</div>` : empty('Estaleiro orbital indisponível', 'Conclua Engenharia orbital e construa a instalação na tela Planeta.', '<button class="action primary" data-goto="research">Abrir pesquisa</button>')}${panel('Naves', current.ships.length ? `<div class="ship-list">${current.ships.map(ship => { const definition = content.ships.find(item => item.id === ship.hull_id); return `<div class="entity-simple"><span class="ship-glyph">△</span><div><b>${esc(label(ship.hull_id))}</b><small>${definition ? esc(hullRole(definition)) : ''} · ${esc(label(ship.propulsion_id))}</small></div>${badge(ship.ready_at > Date.now() / 1000 ? `MONTAGEM ${remaining(ship.ready_at)}` : 'PRONTA', ship.ready_at > Date.now() / 1000 ? 'blue' : 'good')}</div>`; }).join('')}</div>` : empty('Nenhuma nave', 'Inicie a primeira montagem quando houver um slot disponível.'), 'ASSETS')}`;
}

function fleetsView(): string {
  return `<header class="page-header"><div><div class="eyebrow">FLEET COMMAND</div><h1>Frotas</h1><p>Forças persistentes, posição atual e movimentos ativos.</p></div>${badge(`${current.fleets.filter(fleet => fleet.status === 'TRANSIT').length} EM MOVIMENTO`, 'blue')}</header>${current.fleets.length ? `<div class="fleet-list">${current.fleets.map(fleet => `<article class="fleet-card"><div class="fleet-heading"><div class="fleet-emblem">≋</div><div><div class="eyebrow">${esc(fleet.id.slice(0, 8))}</div><h2>${esc(fleet.name)}</h2></div>${badge(fleet.status === 'TRANSIT' ? 'EM TRÂNSITO' : 'PRONTA', fleet.status === 'TRANSIT' ? 'blue' : 'good')}</div><div class="fleet-route"><div><span>${fleet.status === 'TRANSIT' ? 'ORIGEM' : 'POSIÇÃO'}</span><b>${fleet.x}:${fleet.y}</b></div><i></i><div><span>DESTINO</span><b>${fleet.destination_x}:${fleet.destination_y}</b></div></div><div class="facts-grid">${stat('Naves', fmt(fleet.ship_ids.length))}${stat('Missão', term(fleet.mission ?? 'MOVE'))}${stat('Propulsão', label(fleet.propulsion))}${stat('Regime', fleet.mode ?? '—')}${stat('Combustível', fmt(fleet.fuel_cost, 1))}</div>${fleet.status === 'TRANSIT' ? progress(100 * (Date.now() / 1000 - fleet.departure_at) / (fleet.arrival_at - fleet.departure_at), `${remaining(fleet.arrival_at)} até chegada`) : `<button class="action primary" data-select-fleet="${esc(fleet.id)}" data-goto="galaxy">Planejar nova ordem</button>`}</article>`).join('')}</div>` : empty('Nenhuma frota formada', 'Monte uma nave no Estaleiro; a primeira ordem de viagem criará sua frota.', '<button class="action primary" data-goto="shipyard">Abrir estaleiro</button>')}${current.ships.some(ship => !current.fleets.some(fleet => fleet.ship_ids.includes(ship.id))) ? panel('Naves sem frota', `<p>Há naves disponíveis no homeworld. Selecione um destino no mapa para formar a primeira frota.</p><button class="action secondary" data-goto="galaxy">Abrir mapa estelar</button>`, 'READY ASSETS') : ''}`;
}

function travelSubjects(): Array<{ value: string; name: string; propulsion: string; disabled: boolean }> {
  const attached = new Set(current.fleets.flatMap(fleet => fleet.ship_ids));
  return [...current.fleets.map(fleet => ({ value: `fleet:${fleet.id}`, name: `${fleet.name} · ${fleet.x}:${fleet.y}`, propulsion: fleet.propulsion, disabled: fleet.status === 'TRANSIT' })), ...current.ships.filter(ship => !attached.has(ship.id)).map(ship => ({ value: `ship:${ship.id}`, name: `${label(ship.hull_id)} · homeworld`, propulsion: ship.propulsion_id, disabled: ship.ready_at > Date.now() / 1000 }))];
}
function travelPlanner(): string {
  const subjects = travelSubjects(); if (!subjects.some(item => item.value === selectedSubject && !item.disabled)) selectedSubject = subjects.find(item => !item.disabled)?.value ?? ''; if (!content.travel_modes.some(item => item.id === selectedMode)) selectedMode = content.travel_modes[0]?.id ?? '';
  const mission = selectedSystem.knowledge_level === 'UNKNOWN' ? 'SURVEY' : selectedPlanetIndex === undefined ? 'MOVE' : 'COLONIZE';
  const targetPlanet = selectedSystem.planets?.find(planet => planet.planet_index === selectedPlanetIndex);
  const destination = selectedSystem.name ?? `Sistema ${selectedSystem.x}:${selectedSystem.y}`;
  const allowed = mission !== 'COLONIZE' || (!!targetPlanet?.colonization.eligible && selectedSubject.startsWith('fleet:'));
  const order = targetPlanet ? `<div class="colony-order"><b>Pacote colonial · ${targetPlanet.colonization.population} população</b><div class="cost">${cost(targetPlanet.colonization.cost)}</div>${targetPlanet.colonization.reason ? `<small>${esc(targetPlanet.colonization.reason)}</small>` : ''}</div>` : '';
  return `<div class="travel-planner">${order}<div class="planner-controls"><label>Frota ou nave<select id="travel-subject"><option value="">Selecione</option>${subjects.map(item => `<option value="${esc(item.value)}" ${item.value === selectedSubject ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}>${esc(item.name)}${item.disabled ? ' · indisponível' : ''}</option>`).join('')}</select></label><label>Regime preferido<select id="travel-mode">${content.travel_modes.map(item => `<option value="${esc(item.id)}" ${item.id === selectedMode ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><button class="action secondary" data-action="preview" ${selectedSubject && !selectedSystem.home && allowed ? '' : 'disabled'}>Comparar regimes</button></div>${previews ? `<div class="mode-comparison">${content.travel_modes.map(mode => { const item = previews![mode.id]; return `<button class="mode-card ${selectedMode === mode.id ? 'selected' : ''}" data-mode="${esc(mode.id)}"><div><b>${esc(mode.name)}</b>${badge(selectedMode === mode.id ? 'SELECIONADO' : 'REGIME')}</div><span>ETA <strong>${duration(item.eta_seconds)}</strong></span><span>Combustível <strong>${fmt(item.fuel_cost, 1)}</strong></span><span>Calor <strong>${fmt(item.heat, 2)}</strong></span><span>Assinatura <strong>${fmt(item.signature, 2)}</strong></span></button>`; }).join('')}</div><button class="action primary dispatch" data-action="travel" ${allowed ? '' : 'disabled'}>${mission === 'SURVEY' ? 'Explorar sistema' : mission === 'COLONIZE' ? 'Colonizar planeta' : 'Mover frota'} · ${esc(destination)}</button>` : '<div class="planner-hint">Selecione uma força disponível e compare os regimes antes de enviar.</div>'}</div>`;
}
function mapCenters(): Array<{ x: number; y: number; label: string }> {
  const home = current.planets?.find(planet => planet.home);
  const centers = [{ x: home?.x ?? current.system.x, y: home?.y ?? current.system.y, label: 'Homeworld' }, ...current.fleets.filter(fleet => fleet.status === 'ARRIVED').map(fleet => ({ x: fleet.x, y: fleet.y, label: fleet.name }))];
  return [...new Map(centers.map(center => [`${center.x}:${center.y}`, center])).values()];
}
function galaxyView(): string {
  const minX = galaxyData.center[0] - galaxyData.radius; const minY = galaxyData.center[1] - galaxyData.radius;
  const surveyed = selectedSystem.knowledge_level === 'SURVEYED' && selectedSystem.star && selectedSystem.planet;
  const name = selectedSystem.name ?? `Sistema ${selectedSystem.x}:${selectedSystem.y}`;
  const details = surveyed
    ? `<div class="selected-star class-${selectedSystem.star!.stellar_class.toLowerCase()}"><i></i><span>${esc(selectedSystem.star!.stellar_class)}-class</span></div><div class="facts-grid">${stat('Luminosidade', `${fmt(selectedSystem.star!.luminosity, 2)}×`)}${stat('Atividade', fmt(selectedSystem.star!.activity, 2))}</div>${selectedSystem.planets?.length ? `<div class="galaxy-planets">${selectedSystem.planets.map(planet => `<button class="galaxy-planet ${selectedPlanetIndex === planet.planet_index ? 'selected' : ''}" data-planet-index="${planet.planet_index}"><div><b>${esc(planet.name)}</b>${badge(term(planet.viability), planet.viability === 'VIABLE' ? 'good' : 'warn')}</div><span>${fmt(planet.gravity, 2)} g · ${fmt(planet.temperature)} K · água ${fmt(planet.water)}%</span><small>${planet.ownership === 'UNCLAIMED' ? (planet.colonization.reason ?? 'Disponível para colonização') : planet.ownership === 'OWNED' ? 'Mundo do império' : 'Já ocupado'}</small></button>`).join('')}</div>` : `<div class="facts-grid">${stat('Planeta', selectedSystem.planet!.name)}${stat('Gravidade', `${fmt(selectedSystem.planet!.gravity, 2)} g`)}${stat('Temperatura', `${fmt(selectedSystem.planet!.temperature)} K`)}${stat('Radiação', fmt(selectedSystem.planet!.radiation, 2))}</div>`}`
    : `<div class="unknown-detail"><i>?</i><b>Sistema não mapeado</b><p>Envie uma frota em missão de levantamento para revelar estrela e planeta.</p></div>`;
  const controls = mapCenters().map(center => `<button class="map-center ${center.x === galaxyData.center[0] && center.y === galaxyData.center[1] ? 'active' : ''}" data-center="${center.x}:${center.y}">${esc(center.label)} · ${center.x}:${center.y}</button>`).join('');
  return `<header class="page-header"><div><div class="eyebrow">LOCAL STAR CHART</div><h1>Galáxia</h1><p>Conhecimento persistente por império. Sistemas desconhecidos ocultam detalhes físicos.</p></div>${badge(`RAIO ${galaxyData.radius}`, 'neutral')}</header><div class="map-centers" aria-label="Centralizar mapa">${controls}</div><div class="galaxy-layout"><section class="star-map" style="--map-size:${galaxyData.radius * 2 + 1}" aria-label="Mapa de sistemas próximos">${galaxyData.systems.map(system => `<button class="system-node ${system.star ? `class-${system.star.stellar_class.toLowerCase()}` : 'unknown'} ${system.home ? 'home' : ''} ${selectedSystem.x === system.x && selectedSystem.y === system.y ? 'selected' : ''}" style="grid-column:${system.x - minX + 1};grid-row:${system.y - minY + 1}" data-system="${esc(system.id)}" aria-label="${esc(system.name ?? 'Sistema desconhecido')}, coordenadas ${system.x}:${system.y}, ${system.knowledge_level}"><i></i><span>${system.home ? 'HOME' : `${system.x}:${system.y}`}</span></button>`).join('')}<div class="map-grid"></div></section><aside class="system-detail"><div class="eyebrow">SELECTED SYSTEM</div><div class="knowledge-heading"><h2>${esc(name)}</h2>${badge(selectedSystem.knowledge_level, surveyed ? 'good' : 'warn')}</div><p class="coordinates">${selectedSystem.x}:${selectedSystem.y} · ${fmt(selectedSystem.distance, 2)} unidades do centro</p>${details}${selectedSystem.home ? '<div class="home-note">Sistema natal mapeado · escolha outro nó para viajar.</div>' : travelPlanner()}</aside></div>`;
}

function viewContent(view: View): string { const body = ({ overview, planet: planetView, economy: economyView, research: researchView, shipyard: shipyardView, fleets: fleetsView, galaxy: galaxyView } as Record<View, () => string>)[view](); return view === 'overview' ? planetSelector() + body : body; }
function planetVisualState(): PlanetVisualState {
  return {
    seed: `${current.system.name}:${current.system.x}:${current.system.y}:${current.active_planet?.planet_index ?? 0}`,
    systemX: current.system.x,
    systemY: current.system.y,
    planetIndex: current.active_planet?.planet_index ?? 0,
    planet: current.system.planet,
    star: { stellar_class: current.system.star.stellar_class, luminosity: current.system.star.luminosity },
    districts: content.districts.filter(item => (current.districts[item.id] ?? 0) > 0).map(item => ({ id: item.id, category: item.category, level: current.districts[item.id] ?? 0 })),
    capacities: { shipyard_slots: current.capacities.shipyard_slots },
    fleets: current.fleets.map(fleet => ({ status: fleet.status, x: fleet.x, y: fleet.y })),
  };
}
function disposePlanetRenderer(): void { planetRenderer?.dispose(); planetRenderer = undefined; }
function syncPlanetRenderer(view: View): void {
  if (view !== 'planet') { disposePlanetRenderer(); return; }
  const stage = document.querySelector<HTMLElement>('#planet-3d-stage');
  if (!stage || stage === app) return;
  try {
    planetRenderer = new PlanetRenderer(stage);
    planetRenderer.update(planetVisualState());
  } catch (error) {
    disposePlanetRenderer();
    stage.innerHTML = planetVisual(true);
    stage.classList.add('planet-3d-fallback');
    feedback = { kind: 'error', message: error instanceof Error ? 'WebGL indisponível; visualização alternativa ativada.' : 'Visualização 3D indisponível.' };
  }
}
function topHud(): string {
  const active = temporalActivityCount();
  return `<header class="top-hud"><a class="brand" href="#/overview" aria-label="StarZ início"><span>STAR</span><b>Z</b><small>COMMAND</small></a><div class="hud-resources">${strategicResources().map(item => `<div><span>${esc(item.name)}</span><strong>${fmt(current.stocks[item.id], 1)}</strong></div>`).join('')}</div><div class="hud-status"><div title="Geração / demanda de energia"><span>ENERGIA</span><b class="${current.capacities.energy_coverage < 1 ? 'warning-text' : ''}">${fmt(current.capacities.energy_generation)} / ${fmt(current.capacities.energy_consumption)}</b></div><div><span>POPULAÇÃO</span><b>${fmt(current.population.total)} <small>/ ${fmt(current.population.available)} livre</small></b></div><div title="Pesquisa atual"><span>PESQUISA</span><b>${current.research.active ? esc(label(current.research.active)) : 'Inativa'}</b></div><div><span>OPERAÇÕES</span><b>${active}</b></div><button class="icon-button" data-action="refresh" aria-label="Sincronizar estado">↻</button></div></header>`;
}
function render(): void {
  const activeView = route(); disposePlanetRenderer(); app.setAttribute('aria-busy', String(busy));
  app.innerHTML = `${topHud()}<div class="app-shell"><nav class="sidebar" aria-label="Navegação principal"><div class="nav-label">IMPÉRIO</div>${views.map(view => `<a href="#/${view.id}" class="${view.id === activeView ? 'active' : ''}" aria-current="${view.id === activeView ? 'page' : 'false'}"><span>${view.icon}</span>${esc(view.label)}</a>`).join('')}<div class="sidebar-footer"><span>HOME SYSTEM</span><b>${current.system.x}:${current.system.y}</b><small>${esc(current.system.name)}</small></div></nav><main class="main-content">${viewContent(activeView)}</main>${contextPanel()}</div>${feedback ? `<div class="toast ${feedback.kind}" role="status"><i>${feedback.kind === 'success' ? '✓' : '!'}</i><span>${esc(feedback.message)}</span><button data-dismiss aria-label="Fechar">×</button></div>` : ''}${busy ? '<div class="loading-line"></div>' : ''}`;
  syncPlanetRenderer(activeView);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, init); const result = await response.json(); if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Não foi possível concluir a operação.'); return result as T; }
async function refreshGalaxy(center = galaxyData?.center): Promise<void> {
  const selected = selectedSystem && [selectedSystem.x, selectedSystem.y];
  const home = current.planets?.find(planet => planet.home); const homePosition = [home?.x ?? current.system.x, home?.y ?? current.system.y];
  const operational = center && ((center[0] === homePosition[0] && center[1] === homePosition[1]) || current.fleets.some(fleet => fleet.status === 'ARRIVED' && fleet.x === center[0] && fleet.y === center[1]));
  const [x, y] = operational ? center : homePosition;
  galaxyData = await request<Galaxy>(`/api/galaxy?radius=2&center_x=${x}&center_y=${y}`);
  selectedSystem = galaxyData.systems.find(system => selected && system.x === selected[0] && system.y === selected[1]) ?? galaxyData.systems.find(system => system.x === x && system.y === y) ?? galaxyData.systems[0];
}
async function recenter(x: number, y: number): Promise<void> {
  busy = true; render();
  try { await refreshGalaxy([x, y]); previews = undefined; busy = false; render(); }
  catch (error) { busy = false; feedback = { kind: 'error', message: error instanceof Error ? error.message : 'Falha ao centralizar mapa.' }; render(); }
}
async function load(showBusy = false, planetId = current?.active_planet?.id): Promise<void> { if (showBusy) { busy = true; if (current) render(); } current = await request<State>(planetId ? `/api/state?planet_id=${encodeURIComponent(planetId)}` : '/api/state'); if (route() === 'galaxy' && galaxyData) await refreshGalaxy(); busy = false; render(); }
function travelBody(): Record<string, unknown> { const [kind, id] = selectedSubject.split(':'); if (!id) throw new Error('Selecione uma frota ou nave disponível.'); const propulsion = kind === 'fleet' ? current.fleets.find(item => item.id === id)?.propulsion : current.ships.find(item => item.id === id)?.propulsion_id; const mission = selectedSystem.knowledge_level === 'UNKNOWN' ? 'SURVEY' : selectedPlanetIndex === undefined ? 'MOVE' : 'COLONIZE'; return { planet_id: current.active_planet?.id, target_x: selectedSystem.x, target_y: selectedSystem.y, target_planet_index: mission === 'COLONIZE' ? selectedPlanetIndex : undefined, propulsion_id: propulsion, mode: selectedMode, mission, [kind === 'fleet' ? 'fleet_id' : 'ship_id']: id }; }
async function perform(action: string, id?: string): Promise<void> {
  busy = true; feedback = undefined; render();
  try {
    let endpoint = action; let body: Record<string, unknown> = {};
    if (action === 'refresh') { await load(); feedback = { kind: 'success', message: 'Estado sincronizado.' }; render(); return; }
    if (action === 'build') body = { id, planet_id: current.active_planet?.id };
    if (action === 'research') body = { id };
    if (action === 'build-ship') body = { planet_id: current.active_planet?.id, hull_id: selectedHull, propulsion_id: selectedPropulsion, fuel_id: selectedFuel };
    if (action === 'preview' || action === 'travel') { endpoint = action === 'preview' ? 'travel-preview' : 'travel'; body = travelBody(); }
    const result = await request<Record<string, TravelPreview> | Record<string, unknown>>(`/api/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (action === 'preview') { previews = result as Record<string, TravelPreview>; feedback = { kind: 'success', message: 'Rota calculada. Compare tempo, combustível, calor e assinatura.' }; busy = false; render(); return; }
    const messages: Record<string, string> = { build: 'Construção iniciada.', research: 'Programa de pesquisa iniciado.', 'build-ship': 'Montagem da nave iniciada.', travel: 'Frota despachada.' };
    feedback = { kind: 'success', message: messages[action] ?? 'Ordem confirmada.' }; previews = undefined; await load();
  } catch (error) { busy = false; feedback = { kind: 'error', message: error instanceof Error ? error.message : 'Falha de comunicação.' }; render(); }
}

app.onclick = event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a'); if (!target) return;
  if (target.dataset.dismiss !== undefined) { feedback = undefined; render(); return; }
  if (target.dataset.goto) { if (target.dataset.selectFleet) selectedSubject = `fleet:${target.dataset.selectFleet}`; location.hash = `#/${target.dataset.goto}`; return; }
  if (target.dataset.center) { const [x, y] = target.dataset.center.split(':').map(Number); void recenter(x, y); return; }
  if (target.dataset.system) { selectedSystem = galaxyData.systems.find(system => system.id === target.dataset.system)!; selectedPlanetIndex = undefined; previews = undefined; render(); return; }
  if (target.dataset.planetIndex !== undefined) { selectedPlanetIndex = Number(target.dataset.planetIndex); previews = undefined; render(); return; }
  if (target.dataset.mode) { selectedMode = target.dataset.mode; render(); return; }
  if (target.dataset.action && !target.hasAttribute('disabled')) void perform(target.dataset.action, target.dataset.id);
};
app.onchange = event => {
  const target = event.target as HTMLSelectElement;
  if (target.id === 'planet-select') { void load(true, target.value); return; } if (target.id === 'travel-subject') { selectedSubject = target.value; previews = undefined; } if (target.id === 'travel-mode') selectedMode = target.value; if (target.id === 'hull-select') selectedHull = target.value; if (target.id === 'propulsion-select') { selectedPropulsion = target.value; selectedFuel = ''; } if (target.id === 'fuel-select') selectedFuel = target.value; render();
};
async function boot(): Promise<void> {
  app.innerHTML = '<div class="boot"><div class="brand"><span>STAR</span><b>Z</b></div><div class="boot-orbit"></div><p>Sincronizando centro de comando…</p></div>';
  try { [content, current, galaxyData] = await Promise.all([request<Catalog>('/api/catalog'), request<State>('/api/state'), request<Galaxy>('/api/galaxy?radius=2')]); selectedSystem = galaxyData.systems.find(system => system.home) ?? galaxyData.systems[0]; selectedMode = content.travel_modes[0]?.id ?? ''; render(); }
  catch (error) { app.innerHTML = `<div class="fatal"><b>Centro de comando indisponível</b><p>${esc(error instanceof Error ? error.message : 'Falha de comunicação.')}</p><button onclick="location.reload()">Tentar novamente</button></div>`; }
}
if (typeof window !== 'undefined') { window.addEventListener('hashchange', () => current && render()); window.setInterval(() => { if (current && !busy && document.visibilityState !== 'hidden' && (current.construction.length > 0 || !!current.research.active || current.fleets.some(fleet => fleet.status === 'TRANSIT') || current.ships.some(ship => ship.ready_at > Date.now() / 1000))) void load(); else if (current) render(); }, 15000); }
void boot();
