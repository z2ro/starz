import { meetsRequirements } from '../app/format';
import type { Catalog, State, Technology } from '../types/game';

export type TechnologyState = 'completed' | 'active' | 'available' | 'locked';
export type TechnologyEdge = { from: string; to: string };
export type TechnologyGraph = { depth: Record<string, number>; edges: TechnologyEdge[]; hasCycle: boolean };

export function visibleColumnMap(depths: number[]): Map<number, number> {
  return new Map(depths.map((depth, index) => [depth, index]));
}

export function technologyState(catalog: Catalog, state: State, technology: Technology): TechnologyState {
  if (state.research.completed.includes(technology.id)) return 'completed';
  if (state.research.active === technology.id) return 'active';
  return meetsRequirements(catalog, state, technology) ? 'available' : 'locked';
}

export function technologyGraph(technologies: Technology[]): TechnologyGraph {
  const ids = new Set(technologies.map(technology => technology.id));
  const edges = technologies.flatMap(technology => technology.requires.filter(id => ids.has(id)).map(from => ({ from, to: technology.id })));
  const incoming = new Map(technologies.map(technology => [technology.id, edges.filter(edge => edge.to === technology.id).map(edge => edge.from)]));
  const depth: Record<string, number> = {};
  const visiting = new Set<string>();
  let hasCycle = false;
  const visit = (id: string): number => {
    if (depth[id] !== undefined) return depth[id];
    if (visiting.has(id)) { hasCycle = true; return 0; }
    visiting.add(id);
    depth[id] = Math.max(0, ...(incoming.get(id) ?? []).map(parent => visit(parent) + 1));
    visiting.delete(id);
    return depth[id];
  };
  technologies.forEach(technology => visit(technology.id));
  return { depth, edges, hasCycle };
}

export function defaultTechnologyId(catalog: Catalog, state: State): string | undefined {
  const technologies = catalog.technologies;
  return technologies.find(technology => technologyState(catalog, state, technology) === 'active')?.id
    ?? technologies.find(technology => technologyState(catalog, state, technology) === 'available')?.id
    ?? technologies.find(technology => technologyState(catalog, state, technology) === 'completed')?.id
    ?? technologies[0]?.id;
}
