import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanetLabRenderer } from './PlanetLabRenderer';
import { adjacentTestSeed, CAMERA_PRESETS, DEFAULT_PLANET_LAB_SETTINGS, PIXEL_SIZES, PLANET_FAMILIES, PLANET_PRESETS, TEST_SEEDS, type CameraPreset, type PlanetLabSettings, type PlanetLabStats } from './planetLabTypes';
import './planet-lab.css';

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch { return false; }
}

function RangeControl({ label, value, min, max, step, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; suffix?: string }) {
  return <label className="planet-lab-control"><span>{label}<output>{value}{suffix}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

function ToggleControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="planet-lab-toggle"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function PlanetCanvas({ settings, onStats, onError, cameraPreset, cameraReset }: { settings: PlanetLabSettings; onStats: (stats: PlanetLabStats) => void; onError: (error: string) => void; cameraPreset: CameraPreset; cameraReset: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PlanetLabRenderer | undefined>(undefined);
  useEffect(() => {
    if (!supportsWebGL()) { onError('WebGL não disponível neste navegador.'); return undefined; }
    if (!hostRef.current) return undefined;
    try {
      const renderer = new PlanetLabRenderer(hostRef.current, settings, onStats);
      rendererRef.current = renderer;
      renderer.start();
      return () => { renderer.dispose(); rendererRef.current = undefined; };
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Falha ao iniciar o Planet Lab.');
      return undefined;
    }
  }, []);
  useEffect(() => { rendererRef.current?.setSettings(settings); }, [settings]);
  useEffect(() => { rendererRef.current?.setCameraPreset(cameraPreset); }, [cameraPreset, cameraReset]);
  return <div ref={hostRef} className="planet-lab-stage" aria-label="Cena procedural do Planet Lab" />;
}

export function PlanetLabView() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PlanetLabSettings>(() => ({ ...DEFAULT_PLANET_LAB_SETTINGS, paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches }));
  const [cameraReset, setCameraReset] = useState(0);
  const [draftSeed, setDraftSeed] = useState(DEFAULT_PLANET_LAB_SETTINGS.seed);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('cinematic');
  const [stats, setStats] = useState<PlanetLabStats>({ fps: 0, frameTime: 0, triangles: 0, drawCalls: 0, seed: settings.seed, renderResolution: '—' });
  const [error, setError] = useState<string>();
  const update = <K extends keyof PlanetLabSettings>(key: K, value: PlanetLabSettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const regenerate = () => update('regeneration', settings.regeneration + 1);
  const selectSeed = (seed: string) => { setDraftSeed(seed); update('seed', seed); };
  const diagnostics = stats.generation;
  const percent = (value: number | undefined) => value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
  return <main className="planet-lab-shell">
    <header className="planet-lab-header">
      <div><p className="planet-lab-kicker">STARZ // EXPERIMENTAL GRAPHICS</p><h1>Planet Lab 02</h1><p className="planet-lab-subtitle">Procedural planet diversity · One generator, four families</p></div>
      <button className="planet-lab-back" onClick={() => navigate('/overview')}>← Voltar ao STARZ</button>
    </header>
    <div className="planet-lab-layout">
      <section className="planet-lab-viewport">
        <PlanetCanvas settings={settings} onStats={setStats} onError={setError} cameraPreset={cameraPreset} cameraReset={cameraReset} />
        {error && <div className="planet-lab-error" role="alert"><strong>Planet Lab indisponível</strong><span>{error}</span></div>}
        <div className="planet-lab-overlay"><span>{settings.family.toUpperCase()} · SEED {settings.seed}</span><span>{settings.raw3d ? 'RAW 3D' : `PIXEL ${settings.pixelSize}px`}</span></div>
      </section>
      <aside className="planet-lab-panel">
        <section><h2>Camera</h2><div className="planet-lab-button-grid">{CAMERA_PRESETS.map(preset => <button key={preset} aria-pressed={cameraPreset === preset} className={cameraPreset === preset ? 'is-active' : ''} onClick={() => { setCameraPreset(preset); setCameraReset(value => value + 1); }}>{preset.replace('-', ' ')}</button>)}<button onClick={() => { setCameraPreset('cinematic'); setCameraReset(value => value + 1); }}>reset</button></div></section>
        <section aria-label="Planet family"><h2>Planet family</h2><div className="planet-lab-button-grid">{PLANET_FAMILIES.map(family => <button key={family} aria-pressed={settings.family === family} className={settings.family === family ? 'is-active' : ''} onClick={() => setSettings(current => ({ ...current, ...PLANET_PRESETS[family].parameters, family }))}>{family.toUpperCase()}</button>)}</div></section>
        <section aria-label="Seed gallery"><h2>Seed gallery</h2>
          <div className="planet-lab-button-grid">{TEST_SEEDS.map(seed => <button key={seed} aria-pressed={settings.seed === seed} className={settings.seed === seed ? 'is-active' : ''} onClick={() => selectSeed(seed)}>{seed}</button>)}</div>
          <div className="planet-lab-button-grid planet-lab-seed-navigation"><button onClick={() => selectSeed(adjacentTestSeed(settings.seed, -1))}>Previous seed</button><button onClick={() => selectSeed(adjacentTestSeed(settings.seed, 1))}>Next seed</button></div>
        </section>
        <section><h2>Planet</h2>
          <div className="planet-lab-seed"><label htmlFor="planet-lab-seed">Seed</label><input id="planet-lab-seed" value={draftSeed} onChange={event => setDraftSeed(event.target.value)} /><button onClick={() => { selectSeed(draftSeed.trim() || 'aurelia-01'); regenerate(); }}>regenerate</button></div>
          <RangeControl label="Water level" value={settings.waterCoverage} min={0} max={1} step={0.01} onChange={value => update('waterCoverage', value)} />
          <RangeControl label="Temperature" value={settings.temperature} min={0.1} max={0.95} step={0.01} onChange={value => update('temperature', value)} />
          <RangeControl label="Mountain intensity" value={settings.mountainIntensity} min={0.1} max={1} step={0.01} onChange={value => update('mountainIntensity', value)} />
          <RangeControl label="Cloud coverage" value={settings.cloudCoverage} min={0} max={0.9} step={0.01} onChange={value => update('cloudCoverage', value)} />
          <RangeControl label="Continent scale" value={settings.continentScale} min={0.8} max={3.5} step={0.05} onChange={value => update('continentScale', value)} />
          <RangeControl label="Domain warp" value={settings.warpStrength} min={0} max={0.8} step={0.01} onChange={value => update('warpStrength', value)} />
          <RangeControl label="Moisture bias" value={settings.moistureBias} min={-0.5} max={0.4} step={0.01} onChange={value => update('moistureBias', value)} />
          <RangeControl label="Axial tilt" value={settings.axialTilt} min={0} max={35} step={1} suffix="°" onChange={value => update('axialTilt', value)} />
        </section>
        <section><h2>Lighting</h2><RangeControl label="Star azimuth" value={settings.starAzimuth} min={0} max={360} step={1} suffix="°" onChange={value => update('starAzimuth', value)} /><RangeControl label="Star elevation" value={settings.starElevation} min={5} max={80} step={1} suffix="°" onChange={value => update('starElevation', value)} /><RangeControl label="Light intensity" value={settings.lightIntensity} min={0.4} max={3.5} step={0.05} onChange={value => update('lightIntensity', value)} /></section>
        <section><h2>Animation</h2><RangeControl label="Planet rotation" value={settings.planetRotationSpeed} min={0} max={0.12} step={0.005} onChange={value => update('planetRotationSpeed', value)} /><RangeControl label="Ship orbit" value={settings.shipOrbitSpeed} min={0} max={0.8} step={0.01} onChange={value => update('shipOrbitSpeed', value)} /><button className="planet-lab-wide-button" onClick={() => update('paused', !settings.paused)}>{settings.paused ? 'Resume' : 'Pause'}</button></section>
        <section><h2>Rendering</h2><label className="planet-lab-select"><span>Pixel size</span><select value={settings.pixelSize} onChange={event => update('pixelSize', Number(event.target.value) as PlanetLabSettings['pixelSize'])}>{PIXEL_SIZES.map(size => <option key={size} value={size}>{size}px</option>)}</select></label><ToggleControl label="Depth outlines" checked={settings.outline} onChange={value => update('outline', value)} /><ToggleControl label="Bayer dither" checked={settings.dither} onChange={value => update('dither', value)} /><ToggleControl label="RAW 3D" checked={settings.raw3d} onChange={value => update('raw3d', value)} /></section>
        <section className="planet-lab-stats"><h2>Debug</h2><dl><div><dt>FPS</dt><dd>{stats.fps || '—'}</dd></div><div><dt>Frame</dt><dd>{stats.frameTime ? `${stats.frameTime.toFixed(1)}ms` : '—'}</dd></div><div><dt>Triangles</dt><dd>{stats.triangles || '—'}</dd></div><div><dt>Draw calls</dt><dd>{stats.drawCalls || '—'}</dd></div><div><dt>Resolution</dt><dd>{stats.renderResolution}</dd></div></dl></section>
        <section className="planet-lab-stats" aria-label="Planet generation diagnostics"><h2>Planet generation diagnostics</h2><p className="planet-lab-diagnostic-note">Area-weighted surface samples. Water includes frozen ocean basins.</p><dl>
          <div><dt>Actual water</dt><dd>{percent(diagnostics?.waterCoverage)}</dd></div>
          <div><dt>Open water</dt><dd>{percent(diagnostics?.openWaterCoverage)}</dd></div>
          <div><dt>Ice coverage</dt><dd>{percent(diagnostics?.iceCoverage)}</dd></div>
          <div><dt>Coastal band</dt><dd>{percent(diagnostics?.coastalCoverage)}</dd></div>
          <div><dt>Biomes &gt;0.1%</dt><dd>{diagnostics?.biomeCount ?? '—'}</dd></div>
          <div><dt>Elevation (relative)</dt><dd>{diagnostics ? `${diagnostics.elevationMin.toFixed(2)}–${diagnostics.elevationMax.toFixed(2)}` : '—'}</dd></div>
          <div><dt>Temperature (relative)</dt><dd>{diagnostics ? `${diagnostics.temperatureMin.toFixed(2)}–${diagnostics.temperatureMax.toFixed(2)}` : '—'}</dd></div>
          <div><dt>Generation (CPU raster)</dt><dd>{diagnostics ? `${diagnostics.generationMs.toFixed(0)}ms` : '—'}</dd></div>
          <div><dt>Surface grid</dt><dd>{diagnostics ? `${diagnostics.width} × ${diagnostics.height}` : '—'}</dd></div>
        </dl></section>
      </aside>
    </div>
  </main>;
}
