import { useEffect, useState, type RefObject } from 'react';

export type ResearchNodeBox = { x: number; y: number; width: number; height: number };
export type ResearchEdge = { from: string; to: string; className: string };

/** Route in tier gutters; long links use lanes below all cards, never through them. */
export function researchConnector(a: ResearchNodeBox, b: ResearchNodeBox, floor: number, lane: number) {
  const right = a.x + a.width, ay = a.y + a.height / 2, by = b.y + b.height / 2;
  const gutter = right + 8 + lane % 4 * 4;
  if (a.x === b.x) return `M${right},${ay} H${gutter} V${by} H${b.x + b.width}`;
  if (b.x > right && b.x - right <= 40) return `M${right},${ay} H${gutter} V${by} H${b.x}`;
  const entry = b.x - 8, bottom = floor + 16 + lane * 6;
  return `M${right},${ay} H${gutter} V${bottom} H${entry} V${by} H${b.x}`;
}

export function ResearchConnections({ container, edges }: { container: RefObject<HTMLDivElement | null>; edges: ResearchEdge[] }) {
  const [boxes, setBoxes] = useState<Record<string, ResearchNodeBox>>({});
  useEffect(() => {
    const map = container.current;
    if (!map) return;
    const nodes = Array.from(map.querySelectorAll<HTMLElement>('[data-tech-id]'));
    const measure = () => {
      const rect = map.getBoundingClientRect(), scale = rect.width / map.offsetWidth;
      if (!scale) return; // A mobile detail subview can temporarily hide the tree.
      const next: Record<string, ResearchNodeBox> = {};
      for (const node of nodes) {
        const box = node.getBoundingClientRect();
        next[node.dataset.techId!] = { x: (box.left - rect.left) / scale, y: (box.top - rect.top) / scale, width: box.width / scale, height: box.height / scale };
      }
      setBoxes(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(map); nodes.forEach(node => observer.observe(node)); measure();
    return () => observer.disconnect();
  }, [container, edges]);
  const floor = Math.max(0, ...Object.values(boxes).map(b => b.y + b.height));
  const height = floor + 32 + edges.length * 6;
  return <svg aria-hidden="true" className="research-edges" width="1200" height={height}>
    {edges.map((edge, lane) => boxes[edge.from] && boxes[edge.to] ? <path key={`${edge.from}-${edge.to}`} data-from={edge.from} data-to={edge.to} className={edge.className} d={researchConnector(boxes[edge.from], boxes[edge.to], floor, lane)} /> : null)}
  </svg>;
}
