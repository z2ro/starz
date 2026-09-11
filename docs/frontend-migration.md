# Migração React/Vite

O frontend ativo do StarZ é React + TypeScript, compilado por Vite. O backend continua
servindo o resultado em `/static` e mantém `/api/*` e `/health` inalterados.

## Organização

- `frontend/src/app`: `App`, `HashRouter` e `QueryClient`;
- `frontend/src/api`: client HTTP, queries e mutations;
- `frontend/src/components`: shell, inspector, hero, Three.js wrapper e UI;
- `frontend/src/views`: Overview, Planet, Economy, Research, Shipyard, Fleets e Galaxy;
- `frontend/src/planet3d`: renderer Three.js presentation-only.

`HashRouter` mantém as URLs `#/overview`, `#/planet`, `#/economy`, `#/research`,
`#/shipyard`, `#/fleets` e `#/galaxy`. Estado de servidor fica no TanStack Query; tabs,
seleções e controles são estado local.

## Desenvolvimento

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

O Vite dev server usa proxy para `/api` e `/health` em `localhost:8000`. Em produção,
`vite build` escreve `frontend/dist`; o FastAPI monta esse diretório em `/static`.
O Dockerfile usa build multi-stage e não copia `node_modules` para a imagem Python.

## Three.js e assets

`PlanetThreeView` cria um `PlanetRenderer` ao montar o modo 3D, chama `update` quando o
state muda e chama `dispose` ao desmontar. A arte local continua sendo o modo principal;
`?planet_visual=3d` ou falha da imagem ativa o fallback Three.js. Three.js não acessa API
nem decide regras de gameplay. Stellar Atlas e assets locais preservam `/static/assets/...`.

O antigo `main.ts` vanilla, o bundle manual `frontend/app.js` e o formatter legado foram
removidos; `frontend/src/main.tsx` é a única entrada do cliente.
