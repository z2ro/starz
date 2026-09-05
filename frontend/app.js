"use strict";
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (value) => typeof value === 'number' ? value.toFixed(value % 1 ? 1 : 0) : esc(value);
const app = document.querySelector('#app');
let current;
let selectedSubject = '';
let selectedMode = '';
let destination;
function routeControls(s) {
    const attached = new Set(s.fleets.flatMap(f => f.ship_ids));
    const subjects = [
        ...s.fleets.map(f => ({ value: `fleet:${f.id}`, label: `${f.name} · ${f.x}:${f.y} · ${f.status}`, disabled: f.status === 'TRANSIT' })),
        ...s.ships.filter(ship => !attached.has(ship.id)).map(ship => ({ value: `ship:${ship.id}`, label: `Nave ${ship.id.slice(0, 8)} · ${s.system.x}:${s.system.y}`, disabled: false })),
    ];
    if (!subjects.some(subject => subject.value === selectedSubject && !subject.disabled))
        selectedSubject = subjects.find(subject => !subject.disabled)?.value ?? '';
    if (!s.travel_modes.some(mode => mode.id === selectedMode))
        selectedMode = s.travel_modes[0]?.id ?? '';
    destination ??= { x: s.system.x + 1, y: s.system.y };
    return `<label>Frota / nave <select id="travel-subject">${subjects.map(subject => `<option value="${esc(subject.value)}" ${subject.disabled ? 'disabled' : ''} ${subject.value === selectedSubject ? 'selected' : ''}>${esc(subject.label)}</option>`).join('')}</select></label>
    <label>Destino X <input id="target-x" type="number" min="-100" max="100" step="1" value="${destination.x}"></label>
    <label>Destino Y <input id="target-y" type="number" min="-100" max="100" step="1" value="${destination.y}"></label>
    <label>Regime <select id="travel-mode">${s.travel_modes.map(mode => `<option value="${esc(mode.id)}" ${mode.id === selectedMode ? 'selected' : ''}>${esc(mode.name)}</option>`).join('')}</select></label>
    <button data-action="preview" ${selectedSubject ? '' : 'disabled'}>Comparar regimes</button><button data-action="travel" ${selectedSubject ? '' : 'disabled'}>Enviar frota</button>`;
}
function planet(s) {
    const p = s.system.planet;
    const markers = Object.entries(s.districts).map(([id, level]) => `<span class="marker ${id}" title="${esc(id)}">${level}</span>`).join('');
    return `<section class="planet-stage"><div class="star-orb"></div><div class="planet-orb">${markers}</div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><p>${esc(s.system.name)} / ${esc(p.name)}</p></section>`;
}
function render(s) {
    current = s;
    const energy = s.capacities.energy_generation - s.capacities.energy_consumption;
    app.innerHTML = `<header><div class="brand">STAR<span>Z</span></div><div class="hud"><b>MATÉRIA</b> ${fmt(s.stocks.raw_ore)} <b>LIGA</b> ${fmt(s.stocks.refined_alloy)} <b>COMP</b> ${fmt(s.stocks.components)} <b>ENERGIA</b> ${fmt(energy)} / ${fmt(s.capacities.energy_generation)} <b>POP</b> ${fmt(s.population.total)}</div></header>
    <main><nav><button data-view="overview">Overview</button><button data-view="planet">Planet</button><button data-view="research">Research</button><button data-view="shipyard">Shipyard</button><button data-view="fleets">Fleets</button><button data-view="galaxy">Galaxy</button></nav>
    <article><div class="eyebrow">OBSERVATÓRIO // SISTEMA INICIAL</div><h1>${esc(s.system.name)}</h1><div class="grid">${planet(s)}<section class="panel facts"><h2>Planeta observado</h2><div class="facts-grid"><span>Classe estelar <b>${esc(s.system.star.stellar_class)}</b></span><span>Luminosidade <b>${fmt(s.system.star.luminosity)}x</b></span><span>Gravidade <b>${fmt(s.system.planet.gravity)}g</b></span><span>Temperatura <b>${fmt(s.system.planet.temperature)} K</b></span><span>Água <b>${fmt(s.system.planet.water)}%</b></span><span>Campo magnético <b>${fmt(s.system.planet.magnetic_field)}</b></span></div></section></div>
    <div class="columns"><section class="panel"><h2>Desenvolvimento</h2><p>Indústria nominal: ${fmt(s.capacities.industrial_capacity)} · Construções livres: ${s.capacities.construction_slots_available}/${s.capacities.construction_slots}</p><div class="rows">${Object.entries(s.districts).map(([id, level]) => `<div><span>${esc(id.replaceAll('_', ' '))}</span><b>nível ${level}</b></div>`).join('')}</div><button class="primary" data-action="build" data-id="processor">Construir processador</button><button data-action="build" data-id="orbital_shipyard">Construir estaleiro orbital</button></section><section class="panel"><h2>Pesquisa</h2><p>Taxa efetiva: ${fmt(s.capacities.effective_research_rate)} trabalho/s${s.research.active ? ` · Restante: ${fmt(s.research.remaining_work)} · ${s.research.complete_at === null ? "Pausada" : "ETA estimado: " + new Date(s.research.complete_at * 1000).toLocaleTimeString()}` : ""}</p><p>${s.research.active ? `Em andamento: <b>${esc(s.research.active)}</b>` : 'Nenhuma pesquisa em andamento.'}</p><button class="primary" data-action="research" data-id="orbital_engineering">Iniciar engenharia orbital</button></section><section class="panel"><h2>Frotas</h2><p>Estaleiro livre: ${s.capacities.shipyard_slots_available}/${s.capacities.shipyard_slots}</p>${s.fleets.length ? s.fleets.map((f) => `<div class="fleet"><b>${esc(f.name)}</b><span>${esc(f.status)} · ${f.status === 'TRANSIT' ? 'Origem' : 'Posição'} ${f.x}:${f.y} → ${f.destination_x}:${f.destination_y} · ETA ${f.eta}s</span></div>`).join('') : '<p class="muted">Nenhuma frota em trânsito.</p>'}<button class="primary" data-action="build-ship">Montar scout</button><button data-action="refresh">Atualizar estado</button></section></div>
    <section class="panel route"><h2>Galaxy / rota local</h2><p class="muted">A viagem parte da posição da frota selecionada. Uma frota chegada pode receber nova ordem.</p>${routeControls(s)}<div id="route-preview" class="route-preview" aria-live="polite">Compare ETA, combustível, calor e assinatura antes de enviar.</div></section><p id="action-error" role="alert"></p><div class="notices">${s.notices.map((n) => `<span>${esc(n)}</span>`).join('')}</div></article></main>`;
    app.querySelectorAll('[data-action]').forEach((button) => button.onclick = () => { void act(button.dataset.action, button.dataset.id); });
    app.querySelectorAll('#travel-subject, #travel-mode, #target-x, #target-y').forEach(control => control.onchange = () => {
        selectedSubject = document.querySelector('#travel-subject').value;
        selectedMode = document.querySelector('#travel-mode').value;
        destination = { x: document.querySelector('#target-x').valueAsNumber, y: document.querySelector('#target-y').valueAsNumber };
        document.querySelector('#route-preview').textContent = 'Rota alterada. Compare novamente antes de enviar.';
    });
}
async function act(action, id) {
    try {
        if (action === 'refresh') {
            await load();
            return;
        }
        let body = action === 'build' || action === 'research' ? { id } : {};
        if (action === 'travel' || action === 'preview') {
            if (!destination || !Number.isInteger(destination.x) || !Number.isInteger(destination.y))
                throw new Error('Informe coordenadas inteiras.');
            const [kind, subjectId] = selectedSubject.split(':');
            const fleet = current.fleets.find(f => f.id === subjectId);
            const ship = current.ships.find(s => s.id === subjectId);
            if (!subjectId)
                throw new Error('Selecione uma frota ou nave.');
            body = { target_x: destination.x, target_y: destination.y, propulsion_id: kind === 'fleet' ? fleet?.propulsion : ship?.propulsion_id, mode: selectedMode, [kind === 'fleet' ? 'fleet_id' : 'ship_id']: subjectId };
        }
        const response = await fetch(`/api/${action === 'preview' ? 'travel-preview' : action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok)
            throw new Error(typeof result.detail === 'string' ? result.detail : 'Pedido inválido. Verifique os campos.');
        document.querySelector('#action-error').textContent = '';
        if (action === 'preview') {
            document.querySelector('#route-preview').innerHTML = Object.entries(result).map(([name, value]) => `<span><b>${esc(name)}</b> origem ${value.origin.join(':')} · distância ${fmt(value.distance)} · ETA ${value.eta_seconds}s · combustível ${value.fuel_cost} · calor ${value.heat} · assinatura ${value.signature}</span>`).join('');
            return;
        }
        await load();
    }
    catch (error) {
        document.querySelector('#action-error').textContent = error instanceof Error ? error.message : 'Falha de comunicação.';
    }
}
async function load() {
    const response = await fetch('/api/state');
    if (!response.ok)
        throw new Error('Não foi possível carregar o estado.');
    render(await response.json());
}
void load().catch(() => { app.textContent = 'Não foi possível carregar o estado. Recarregue a página.'; });
