import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShipLabRenderer } from './ShipLabRenderer';
import { DEFAULT_SHIP_SETTINGS, SHIP_CAMERAS, STELLAR_CAMERA_LABELS, type ShipCamera, type ShipLabSettings, type ShipLabStats } from './shipLabTypes';
import './ship-geometry-lab.css';
import { FLEET_DESIGNS, type FleetDesign, type FleetSelection } from './FleetStudy';

function ShipCanvas({ settings, camera, selection, onStats }: { settings: ShipLabSettings; camera: { preset: ShipCamera; revision: number }; selection: FleetSelection; onStats: (stats: ShipLabStats) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<ShipLabRenderer | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!host.current) return;
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) throw new Error('WebGL 2 não disponível neste navegador.');
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      renderer.current = new ShipLabRenderer(host.current, settings, onStats);
      renderer.current.start();
    } catch (failure) {
      renderer.current?.dispose();
      renderer.current = null;
      setError(failure instanceof Error ? failure.message : 'Falha ao iniciar laboratório.');
    }
    return () => { renderer.current?.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { renderer.current?.setSettings(settings); }, [settings]);
  useEffect(() => { renderer.current?.setCamera(camera.preset); }, [camera]);
  useEffect(() => { renderer.current?.setSelection(selection); }, [selection]);
  return <div className="ship-lab-stage" ref={host}>{error && <div className="ship-lab-error" role="alert">{error}</div>}</div>;
}

export function ShipGeometryLabView() {
  const [settings, setSettings] = useState<ShipLabSettings>(() => ({ ...DEFAULT_SHIP_SETTINGS, paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches }));
  const [camera, setCamera] = useState<{ preset: ShipCamera; revision: number }>({ preset: '3/4 Front', revision: 0 });
  const [stats, setStats] = useState<ShipLabStats | null>(null);
  const [selection, setSelection] = useState<FleetSelection>('horizon');
  const design = FLEET_DESIGNS.find(item => item.id === selection);
  const stellar = selection === 'stargrave', categoryStudy = selection === 'titan';
  const cameraLabel = (preset: ShipCamera) => stellar || categoryStudy ? STELLAR_CAMERA_LABELS[preset] : preset;
  const update = <K extends keyof ShipLabSettings>(key: K, value: ShipLabSettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const toggle = (key: 'hullOnly' | 'armor' | 'engines' | 'details' | 'boundingBox' | 'silhouette' | 'outlines' | 'dither' | 'raw', label: string) => <label className="ship-lab-toggle"><input type="checkbox" checked={settings[key]} onChange={event => update(key, event.target.checked)} /><span>{label}</span></label>;
  const range = (key: 'azimuth' | 'elevation' | 'intensity' | 'hullTone' | 'armorContrast' | 'engineEmission', label: string, min: number, max: number, step: number) => <label className="ship-lab-range"><span>{label}<output>{settings[key]}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => update(key, Number(event.target.value))} /></label>;
  const chooseCamera = (preset: ShipCamera) => setCamera(current => ({ preset, revision: current.revision + 1 }));
  const chooseDesign = (id: FleetDesign) => { setSelection(id); if (id === 'stargrave') chooseCamera('3/4 Front'); };
  return <main className="ship-lab-shell" data-design={selection}>
    <header className="ship-lab-header"><div><p>STARZ / EXPERIMENTAL NAVAL DESIGN</p><h1>Ship Geometry Lab 03 · Imperial Fleet</h1></div><Link to="/overview">Voltar ao STARZ</Link></header>
    <div className="ship-lab-layout">
      <section className="ship-lab-viewport" aria-label="Visualizador da nave">
        <ShipCanvas settings={settings} camera={camera} selection={selection} onStats={setStats} />
        <div className="ship-lab-identity"><span>{design?.role.toUpperCase() ?? (categoryStudy ? 'STELLAR MEGASTRUCTURE / CATEGORY STUDY' : selection === 'scale' ? 'VISUAL SCALE RELATIONSHIP ONLY' : 'COMPARATIVE FLEET STUDY')}</span><h2>{design?.name.toUpperCase() ?? (categoryStudy ? 'STARGRAVE' : 'FLEET')} <b>{design ? stellar ? 'MEGASTRUCTURE' : 'PROTOTYPE' : categoryStudy ? '/ DOMINION' : `/ ${selection === 'scale' ? FLEET_DESIGNS.length - 1 : FLEET_DESIGNS.length}`}</b></h2><p>{design?.summary ?? (categoryStudy ? 'Mudança de categoria ilustrativa · proporção física desconhecida' : selection === 'scale' ? 'Dez naves convencionais · progressão relativa · sem medidas físicas canônicas' : 'Dez naves + uma megaconstrução · silhuetas normalizadas, sem escala relativa')}</p><p>{stellar || categoryStudy ? 'Eixos de inspeção arbitrários · sem proa, popa ou motores convencionais na Stargrave' : 'Estudo experimental · não substitui os designs oficiais'}</p></div>
        {!design && <div className={`ship-lab-fleet-labels ${selection === 'scale' ? 'scale-labels' : ''}`} aria-label="Naves em comparação">{(stats?.selection === selection ? stats.labels ?? [] : []).map(anchor => { const item = FLEET_DESIGNS.find(d => d.id === anchor.id)!; return <button style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }} key={item.id} aria-label={`Inspecionar ${item.name}`} onClick={() => chooseDesign(item.id)}>{item.name}{item.id === 'stargrave' && <small>MEGASTRUCTURE</small>}</button>; })}</div>}
        <div className="ship-lab-caption"><span>{cameraLabel(camera.preset).toUpperCase()}</span><span>{settings.silhouette ? 'SILHOUETTE' : settings.raw ? 'RAW 3D' : `PIXEL / ${settings.pixelSize}px`}</span>{settings.hullOnly && <span>{stellar ? 'CONTAINMENT FRAME' : 'HULL ONLY'}</span>}<p>Arraste para orbitar · scroll para zoom</p></div>
      </section>
      <aside className="ship-lab-panel" aria-label="Controles do laboratório">
        <section><h2>Design gallery</h2><div className="ship-lab-designs">{FLEET_DESIGNS.map(item => <button key={item.id} aria-label={item.name} aria-pressed={selection === item.id} onClick={() => chooseDesign(item.id)}><strong>{item.name}</strong><span>{item.role}</span></button>)}</div><div className="ship-lab-comparisons"><button aria-pressed={selection === 'fleet'} onClick={() => { setSelection('fleet'); chooseCamera('Top'); }}>Comparar frota</button><button aria-pressed={selection === 'scale'} onClick={() => { setSelection('scale'); chooseCamera('Top'); }}>Comparar escala</button><button aria-pressed={categoryStudy} onClick={() => { setSelection('titan'); chooseCamera('3/4 Front'); }}>Stargrave / Categoria</button></div></section>
        <section><h2>Camera</h2><div className="ship-lab-camera-grid">{SHIP_CAMERAS.map(preset => <button key={preset} aria-pressed={camera.preset === preset} onClick={() => chooseCamera(preset)}>{cameraLabel(preset)}</button>)}<button onClick={() => chooseCamera('3/4 Front')}>Reset</button></div></section>
        <section><h2>Geometry</h2>{toggle('hullOnly', stellar ? 'Containment frame only' : 'Show hull only')}{toggle('armor', stellar ? 'Dyson segments' : 'Show armor')}{!stellar && toggle('engines', 'Show engines')}{toggle('details', stellar ? 'Military sectors' : 'Show details')}{toggle('boundingBox', 'Show bounding box')}{toggle('silhouette', 'SILHOUETTE')}</section>
        <section><h2>Lighting</h2>{range('azimuth', 'Star azimuth', 0, 360, 1)}{range('elevation', 'Star elevation', -20, 85, 1)}{range('intensity', 'Intensity', 0.2, 5, 0.1)}</section>
        <section><h2>Material</h2>{range('hullTone', 'Hull tone', 0.4, 1.5, 0.05)}{range('armorContrast', 'Armor contrast', 0.5, 1.5, 0.05)}{range('engineEmission', stellar ? 'Stellar core emission' : categoryStudy ? 'Emission' : 'Engine emission', 0, 3, 0.1)}<button className="ship-lab-pause" aria-pressed={settings.paused} onClick={() => update('paused', !settings.paused)}>{settings.paused ? 'Resume' : 'Pause'}</button></section>
        <section><h2>Render</h2><label className="ship-lab-select">Pixel size<select aria-label="Pixel size" value={settings.pixelSize} onChange={event => update('pixelSize', Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map(size => <option key={size} value={size}>{size}px</option>)}</select></label>{toggle('outlines', 'Outlines')}{toggle('dither', 'Dither')}{toggle('raw', 'RAW 3D')}</section>
        <section className="ship-lab-stats"><h2>Debug</h2><dl>
          <div><dt>FPS</dt><dd>{stats?.fps ?? '—'}</dd></div><div><dt>Frame time</dt><dd>{stats ? `${stats.frameTime.toFixed(1)}ms` : '—'}</dd></div>
          <div><dt>Triangles</dt><dd>{stats?.triangles ?? '—'}</dd></div><div><dt>Draw calls</dt><dd>{stats?.drawCalls ?? '—'}</dd></div>
          <div><dt>Mesh count</dt><dd>{stats?.meshes ?? '—'}</dd></div><div><dt>Bounds X/Y/Z</dt><dd>{stats ? stats.bounds.map(value => value.toFixed(2)).join(' / ') : '—'}</dd></div>
          <div><dt>Render resolution</dt><dd>{stats?.resolution ?? '—'}</dd></div>
        </dl><p>Dimensões em unidades do laboratório, sem escala física canônica.</p></section>
      </aside>
    </div>
  </main>;
}
