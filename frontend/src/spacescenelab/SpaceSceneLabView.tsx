import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANET_FAMILIES } from '../planetlab/planetLabTypes';
import { SpaceSceneRenderer } from './SpaceSceneRenderer';
import { DEFAULT_SPACE_SETTINGS, SPACE_CAMERAS, type SpaceCamera, type SpaceSceneSettings, type SpaceSceneStats } from './spaceSceneTypes';
import '../shipgeometrylab/ship-geometry-lab.css';
import './space-scene-lab.css';

function SpaceCanvas({ settings, camera, onStats }: { settings: SpaceSceneSettings; camera: { preset: SpaceCamera; revision: number }; onStats: (stats: SpaceSceneStats) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<SpaceSceneRenderer | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!host.current) return;
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) throw new Error('WebGL 2 não disponível neste navegador.');
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      renderer.current = new SpaceSceneRenderer(host.current, settings, onStats);
      renderer.current.start();
    } catch (failure) {
      renderer.current?.dispose(); renderer.current = null;
      setError(failure instanceof Error ? failure.message : 'Falha ao iniciar laboratório.');
    }
    return () => { renderer.current?.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { renderer.current?.setSettings(settings); }, [settings]);
  useEffect(() => { renderer.current?.setCamera(camera.preset); }, [camera]);
  return <div className="ship-lab-stage" ref={host}>{error && <div className="ship-lab-error" role="alert">{error}</div>}</div>;
}

export function SpaceSceneLabView() {
  const [settings, setSettings] = useState<SpaceSceneSettings>(() => ({ ...DEFAULT_SPACE_SETTINGS, paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches }));
  const [draftSeed, setDraftSeed] = useState(settings.seed);
  const [camera, setCamera] = useState<{ preset: SpaceCamera; revision: number }>({ preset: 'Cinematic', revision: 0 });
  const [stats, setStats] = useState<SpaceSceneStats | null>(null);
  const update = <K extends keyof SpaceSceneSettings>(key: K, value: SpaceSceneSettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const chooseCamera = (preset: SpaceCamera) => setCamera(current => ({ preset, revision: current.revision + 1 }));
  const toggle = (key: 'shipVisible' | 'moonVisible' | 'stationVisible' | 'cityVisible' | 'outlines' | 'dither' | 'raw', label: string) => <label className="ship-lab-toggle"><input type="checkbox" checked={settings[key]} onChange={event => update(key, event.target.checked)} /><span>{label}</span></label>;
  const range = (key: 'shipLength' | 'engineEmission' | 'moonSpeed' | 'moonScale' | 'stationSpeed' | 'stationScale' | 'cityIntensity' | 'orbitSpeed' | 'orbitInclination' | 'orbitRadius' | 'starAzimuth' | 'starElevation' | 'intensity', label: string, min: number, max: number, step: number) => <label className="ship-lab-range"><span>{label}<output>{settings[key]}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => update(key, Number(event.target.value))} /></label>;
  return <main className="ship-lab-shell space-scene-shell" data-orbit-phase={stats?.orbitPhase} data-ship-center-occluded={stats?.shipCenterOccluded} data-visual-time={stats?.visualTime}>
    <header className="ship-lab-header"><div><p>STARZ / EXPERIMENTAL SPACE COMPOSITION</p><h1>Space Scene Lab 02</h1></div><Link to="/overview">Voltar ao STARZ</Link></header>
    <div className="ship-lab-layout">
      <section className="ship-lab-viewport" aria-label="Cena integrada de planeta e nave">
        <SpaceCanvas settings={settings} camera={camera} onStats={setStats} />
        <div className="ship-lab-identity"><span>{settings.family.toUpperCase()} / PROCEDURAL WORLD</span><h2>SPACE SCENE <b>02</b></h2><p>Living Orbital World · simulação visual experimental</p></div>
        <div className="ship-lab-caption"><span>{camera.preset.toUpperCase()}</span><span>{settings.raw ? 'RAW 3D' : `PIXEL / ${settings.pixelSize}px`}</span><p>SEED {settings.seed} · Arraste para orbitar · scroll para zoom</p></div>
      </section>
      <aside className="ship-lab-panel" aria-label="Controles da cena espacial">
        <section><h2>Camera</h2><div className="ship-lab-camera-grid">{SPACE_CAMERAS.map(preset => <button key={preset} aria-pressed={camera.preset === preset} onClick={() => chooseCamera(preset)}>{preset}</button>)}<button onClick={() => chooseCamera('Cinematic')}>Reset</button></div></section>
        <section><h2>Planet</h2><div className="ship-lab-camera-grid">{PLANET_FAMILIES.map(family => <button key={family} aria-pressed={settings.family === family} onClick={() => update('family', family)}>{family.toUpperCase()}</button>)}</div><label className="space-scene-seed">Seed<input value={draftSeed} onChange={event => setDraftSeed(event.target.value)} /></label><button className="ship-lab-pause" onClick={() => setSettings(current => ({ ...current, seed: draftSeed.trim() || DEFAULT_SPACE_SETTINGS.seed, regeneration: current.regeneration + 1 }))}>Regenerate</button></section>
        <section><h2>Ship</h2>{toggle('shipVisible', 'Ship visibility')}{range('shipLength', 'Apparent ship size', 0.4, 1.2, 0.05)}{range('engineEmission', 'Engine emission', 0, 3, 0.1)}</section>
        <section><h2>Moon</h2>{toggle('moonVisible', 'Moon visibility')}{range('moonSpeed', 'Moon orbit speed', 0, 0.15, 0.005)}{range('moonScale', 'Moon scale', 0.12, 0.35, 0.01)}</section>
        <section><h2>Night lights</h2>{toggle('cityVisible', 'City light visibility')}{range('cityIntensity', 'City light intensity', 0, 3, 0.1)}<p className="space-scene-note">Civilização simulada: não representa população ou gameplay. Frozen sem assentamentos.</p></section>
        <section><h2>Orbital station</h2>{toggle('stationVisible', 'Station visibility')}{range('stationSpeed', 'Station orbit speed', 0, 0.2, 0.005)}{range('stationScale', 'Station scale', 0.1, 0.23, 0.01)}<button className="ship-lab-pause" onClick={() => { setSettings(current => ({ ...current, moonVisible: false, stationVisible: false, cityVisible: false })); chooseCamera('Cinematic'); }}>Compare Lab 01</button></section>
        <section><h2>Orbit</h2>{range('orbitSpeed', 'Orbit speed', 0, 1.2, 0.01)}{range('orbitInclination', 'Orbit inclination', 0, 80, 1)}{range('orbitRadius', 'Orbit radius', 1.9, 3.8, 0.05)}<p className="space-scene-note">Raio mínimo seguro aplicado automaticamente.</p><button className="ship-lab-pause" aria-pressed={settings.paused} onClick={() => update('paused', !settings.paused)}>{settings.paused ? 'Resume' : 'Pause'}</button></section>
        <section><h2>Lighting</h2>{range('starAzimuth', 'Star azimuth', 0, 360, 1)}{range('starElevation', 'Star elevation', 5, 80, 1)}{range('intensity', 'Light intensity', 0.4, 3.5, 0.05)}</section>
        <section><h2>Render</h2><label className="ship-lab-select">Pixel size<select aria-label="Pixel size" value={settings.pixelSize} onChange={event => update('pixelSize', Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map(size => <option key={size} value={size}>{size}px</option>)}</select></label>{toggle('outlines', 'Outline')}{toggle('dither', 'Dither')}{toggle('raw', 'RAW 3D')}</section>
        <section className="ship-lab-stats"><h2>Debug</h2><dl><div><dt>FPS</dt><dd>{stats?.fps ?? '—'}</dd></div><div><dt>Frame time</dt><dd>{stats ? `${stats.frameTime.toFixed(1)}ms` : '—'}</dd></div><div><dt>Triangles (passes)</dt><dd>{stats?.triangles ?? '—'}</dd></div><div><dt>Draw calls</dt><dd>{stats?.drawCalls ?? '—'}</dd></div><div><dt>Resolution</dt><dd>{stats?.resolution ?? '—'}</dd></div><div><dt>Safe orbit radius</dt><dd>{stats?.safeRadius.toFixed(2) ?? '—'}</dd></div></dl><p>Escala de apresentação, sem dimensões físicas canônicas.</p></section>
      </aside>
    </div>
  </main>;
}
