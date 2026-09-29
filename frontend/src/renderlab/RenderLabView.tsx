import { useCallback, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { DataRow } from '../components/ui/DataRow';
import type { ShellContext } from '../components/shell/AppShell';
import { ShipRenderLab } from './ShipRenderLab';
import { CAMERA_PRESETS, DEFAULT_RENDER_LAB_OPTIONS, formatBounds, hasWebGPU, type CameraPreset, type RenderLabOptions } from './renderLabTypes';
import type { DebugStats } from './ShipRenderer';
import './render-lab.css';

export function RenderLabView() {
  useOutletContext<ShellContext>();
  const [options, setOptions] = useState<RenderLabOptions>(DEFAULT_RENDER_LAB_OPTIONS);
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<DebugStats>({ bounds: [0, 0, 0], meshCount: 0, materialCount: 0, cameraDistance: 0, fps: 0, frameTime: 0 });
  const update = <K extends keyof RenderLabOptions>(key: K, value: RenderLabOptions[K]) => setOptions(current => ({ ...current, [key]: value }));
  const onStats = useCallback((next: DebugStats) => setStats(next), []);

  return <main className="render-lab-page">
    <header className="render-lab-header">
      <div><span className="eyebrow">EXPERIMENTAL TOOL · RENDER LAB 01</span><h1>Horizon WebGPU Material Lab</h1><p>Three.js WebGPU · TSL / Node Materials · vgpu · WGSL modular</p></div>
      <div className="render-lab-header-meta"><span>ASSET</span><strong>HORIZON / scout_hull</strong><small>Somente visualização · não integrado ao gameplay</small></div>
    </header>
    <div className="render-lab-layout">
      <section className="render-lab-viewport panel" aria-label="Render Lab viewport">
        <div className="render-lab-viewport-title"><span>WEBGPU VIEWPORT</span><small>{options.materialMode === 'experimental' ? 'STARZ EXPERIMENTAL MATERIAL' : 'ORIGINAL GLB MATERIAL'}</small></div>
        <ShipRenderLab options={options} onStats={onStats} resetToken={resetToken} />
        <div className="render-lab-caption"><span>HORIZON · ORIGINAL GEOMETRY</span><span>+Z FORWARD · CENTERED BOUNDS</span></div>
      </section>
      <aside className="render-lab-controls panel" aria-label="Render Lab controls">
        <div className="render-lab-section"><span className="eyebrow">CAMERA</span><div className="render-lab-button-grid">{CAMERA_PRESETS.map(preset => <Button key={preset} variant={options.cameraPreset === preset ? 'primary' : 'secondary'} onClick={() => update('cameraPreset', preset)}>{preset}</Button>)}<Button variant="ghost" onClick={() => setResetToken(value => value + 1)}>RESET</Button></div></div>
        <LabRange label="Star azimuth" value={options.starAzimuth} min={0} max={360} step={1} onChange={value => update('starAzimuth', value)} unit="°" />
        <LabRange label="Star elevation" value={options.starElevation} min={-20} max={80} step={1} onChange={value => update('starElevation', value)} unit="°" />
        <LabRange label="Star intensity" value={options.starIntensity} min={0} max={7} step={0.1} onChange={value => update('starIntensity', value)} />
        <LabRange label="Exposure" value={options.exposure} min={0.4} max={1.8} step={0.01} onChange={value => update('exposure', value)} />
        <LabRange label="Environment" value={options.environmentIntensity} min={0} max={1.2} step={0.01} onChange={value => update('environmentIntensity', value)} />
        <div className="render-lab-section"><span className="eyebrow">MATERIAL</span><LabRange label="Base roughness" value={options.baseRoughness} min={0.2} max={0.85} step={0.01} onChange={value => update('baseRoughness', value)} /><LabRange label="Surface variation" value={options.surfaceVariation} min={0} max={0.2} step={0.005} onChange={value => update('surfaceVariation', value)} /><LabRange label="Metalness" value={options.metalness} min={0} max={1} step={0.01} onChange={value => update('metalness', value)} /><LabRange label="Engine emission" value={options.engineEmission} min={0} max={5} step={0.05} onChange={value => update('engineEmission', value)} /><label className="render-lab-toggle"><input type="checkbox" checked={options.materialMode === 'original'} onChange={event => update('materialMode', event.target.checked ? 'original' : 'experimental')} /> ORIGINAL MATERIAL</label></div>
        <div className="render-lab-section"><span className="eyebrow">DEBUG</span><label className="render-lab-toggle"><input type="checkbox" checked={options.showBounds} onChange={event => update('showBounds', event.target.checked)} /> BOUNDING BOX</label><label className="render-lab-toggle"><input type="checkbox" checked={options.showAxes} onChange={event => update('showAxes', event.target.checked)} /> AXES</label></div>
        <div className="render-lab-section"><span className="eyebrow">TELEMETRY</span><div className="render-lab-stats"><DataRow label="WEBGPU" value={hasWebGPU() ? 'SUPPORTED' : 'UNSUPPORTED'} /><DataRow label="BOUNDS" value={formatBounds(stats.bounds)} /><DataRow label="MESHES" value={String(stats.meshCount)} /><DataRow label="MATERIALS" value={String(stats.materialCount)} /><DataRow label="CAMERA DISTANCE" value={stats.cameraDistance.toFixed(2)} /><DataRow label="FPS / FRAME" value={`${stats.fps.toFixed(0)} / ${stats.frameTime.toFixed(1)} ms`} /></div></div>
      </aside>
    </div>
  </main>;
}

function LabRange({ label, value, min, max, step, unit = '', onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="render-lab-range"><span>{label}<output>{value.toFixed(step < 1 ? 2 : 0)}{unit}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

export type { CameraPreset };
