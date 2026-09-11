# STARZ Asset Manifest V2

## Princípios

- Usar artwork existente como hero quando disponível.
- Não recriar o planeta com CSS.
- Não recriar o sistema Stellar Atlas de ícones; produzir somente lacunas.
- Preferir composição por layers para permitir Early Colony, Developed World e Major Imperial World.
- Toda imagem precisa declarar origem, licença, proporção, ponto focal, estado e fallback.

## Layer stack do Planet Hero

| Ordem | Layer | Formato preferido | Responsabilidade |
|---:|---|---|---|
| 01 | `background-space` | Raster/WebP | Campo estelar e nebula base |
| 02 | `star` | Raster/WebP ou CSS radial | Fonte de luz principal e flare controlado |
| 03 | `distant-objects` | Raster/WebP | Luas ou corpos distantes |
| 04 | `planet-surface` | Raster/WebP | Superfície planetária base |
| 05 | `atmosphere` | PNG/WebP transparente | Rim light e volume atmosférico |
| 06 | `clouds` | PNG/WebP transparente | Cobertura e movimento opcional |
| 07 | `city-lights` | PNG/WebP transparente | Atividade noturna por nível de desenvolvimento |
| 08 | `moon` | Raster/WebP | Lua principal, quando existir |
| 09 | `orbital-paths` | SVG/CSS | Órbitas e rotas selecionáveis |
| 10 | `station` | PNG/WebP transparente; futuro 3D | Estação/shipyard orbital |
| 11 | `civilian-ships` | PNG/WebP transparente; futuro 3D | Tráfego civil |
| 12 | `military-ships` | PNG/WebP transparente; futuro 3D | Frotas e patrulhas reais |
| 13 | `labels-markers` | SVG/CSS | Labels, nodes, status e seleção |
| 14 | `effects` | PNG/WebP transparente; CSS | Engine trails, selection glow, particles |

## SVG

### Existente / reutilizar

- Stellar Atlas navigation icons.
- Resource and status icons já registrados no frontend.

### Complementar necessário

- Planet/system selection marker.
- Orbit path variants e orbit anchor.
- Fleet route, destination, survey e colonization markers.
- System node states: home, controlled, surveyed, unknown, selected, fleet present, colonizable.
- Technology node states e dependency connectors.
- Shipyard schematic callouts.
- Empty, warning, error e loading symbols.

## Raster / WebP

- Space backgrounds por escala e região.
- Nebula/galaxy map backing plates.
- Planet surface base por classe ou planeta real.
- Station/orbital dock renders.
- Ship renders ou silhouettes de Horizon, Wayfarer e Vanguard.
- Small inspector thumbnails para planet, system, fleet, ship e technology.
- Economy/overview contextual art quando houver asset real.

## Transparent layers

- Atmosphere/rim light.
- Cloud banks.
- City lights em variantes de densidade.
- Station lights e windows.
- Ship engine trails.
- Selection ring/glow.
- Localized solar flare.

## Future 3D / Three.js

- Planet rotation and camera orbit.
- Station orbit and docking animation.
- Fleet/ship positioning.
- Galaxy camera, system nodes and route depth.
- Optional procedural atmosphere/cloud treatment.

O modo principal pode permanecer image-first. Three.js deve entrar como evolução incremental, sem bloquear a operação da tela.

## Naming and delivery

```text
assets/
  space/
  planet/
  station/
  ships/
  galaxy/
  overview/
  economy/
  research/
  shipyard/
  fleets/
  system/
  icons/
```

Convenção: `{domain}-{subject}-{state}-{scale}.{ext}`.

Exemplos:

- `planet-surface-terran-large.webp`
- `planet-city-lights-developed.webp`
- `planet-atmosphere-blue-rim.webp`
- `station-orbital-ring-neutral.webp`
- `ship-horizon-exploration-side.webp`
- `galaxy-system-node-unknown.svg`
- `fleet-route-survey-active.svg`

## Requirements por tela

| Tela | Obrigatórios | Fallback |
|---|---|---|
| Planet | planet surface, atmosphere, star, moon opcional, station/ships condicionais | background-space + planet placeholder neutro |
| Overview | world/system art, summary thumbnails | superfície do planeta selecionado |
| Economy | industrial art opcional, resource icons | surface-primary + flow SVG |
| Research | technology nodes, connectors, research iconography | nodes CSS/SVG sem imagem |
| Shipyard | ship/dock render ou schematic | silhouette SVG + callouts |
| Fleets | fleet/ship thumbnails, routes | ship silhouette + route SVG |
| Galaxy | galaxy background, system nodes, routes | starfield + vector map |

## Acceptance checklist

- Asset carrega em viewport desktop e mobile.
- Focal point não fica atrás do inspector ou bottom sheet.
- Contraste de labels passa sobre a imagem sem glow excessivo.
- Estado sem asset não quebra layout.
- SVG usa `currentColor` quando for ícone funcional.
- WebP/PNG transparente não contém moldura ou texto baked-in.
- Licença e origem registradas antes do merge.
