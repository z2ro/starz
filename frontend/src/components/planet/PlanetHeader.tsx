import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import type { State } from '../../types/game';

export function PlanetHeader({ state, onPlanetChange }: { state: State; onPlanetChange: (id: string) => void }) {
  const active = state.active_planet;
  return <header className="planet-header">
    <div className="hero-kicker"><Icon name="planet" className="ui-icon kicker-icon" /> COMANDO PLANETÁRIO</div>
    <div className="planet-header-title"><h1>{state.system.planet.name}</h1>{active?.home && <Badge tone="positive">HOMEWORLD</Badge>}</div>
    <label className="planet-picker">
      <span>{state.system.name} · {state.system.x}:{state.system.y} · Planeta {(active?.planet_index ?? 0) + 1}</span>
      <select aria-label="Selecionar planeta" value={active?.id ?? ''} onChange={event => onPlanetChange(event.target.value)}>
        {(state.planets ?? []).map(world => <option value={world.id} key={world.id}>{world.home ? 'Homeworld' : 'Colônia'} · {world.name}</option>)}
      </select>
      <i aria-hidden="true" />
    </label>
  </header>;
}
