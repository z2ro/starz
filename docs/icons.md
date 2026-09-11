# STARZ Icon System — Stellar Atlas

O frontend usa a direção aprovada **Stellar Atlas** como fonte única para os
ícones de navegação, HUD, sistema e recursos.

## Localização

- Assets: `frontend/assets/icons/stellar-atlas/`
- Registry: `frontend/src/visual/IconRegistry.ts`
- Preview de origem: `outputs/starz-icon-system-stellar-atlas/`

Todos os 17 SVGs são independentes, monocromáticos, usam `viewBox="0 0 24 24"`,
stroke de `1.5px`, joins/caps arredondados e `currentColor`.

## Uso

O helper `icon('planet')` gera um `span.ui-icon` com a URL registrada como
custom property. O CSS aplica o SVG como `mask-image`, mantendo a cor sob
controle do estado do componente sem duplicar SVG inline ou fazer fetch manual.

```ts
import { icon } from './visual/IconRegistry';

const markup = icon('planet', 'ui-icon nav-icon');
```

O mesmo SVG é escalado por CSS: sidebar em `18px`, HUD em `18–20px`, recursos
em `22–25px` e botões em `20px`.

## Mapeamento semântico

| Domínio | IDs/uso | Ícone |
| --- | --- | --- |
| Navegação | `overview`, `planet`, `economy`, `research`, `shipyard`, `fleets`, `galaxy` | `icon-*.svg` correspondente |
| Sistema | energia, população, operações, sistema, registros, configurações | `icon-energy.svg`, `icon-population.svg`, `icon-operations.svg`, `icon-system.svg`, `icon-notifications.svg`, `icon-settings.svg` |
| Recursos | `raw_ore`, `refined_alloy`, `components`, `fusion_fuel` e fuels com sufixo `_fuel` | `resource-*.svg` correspondente |

O mapping de recursos é feito por ID do catálogo em `resourceIcon`, nunca pelo
texto localizado exibido na interface.

## Estados e acessibilidade

Default, hover, active e disabled usam `color`/`opacity` do componente. Ícones
decorativos recebem `aria-hidden="true"`; os botões de registros e configurações
mantêm `aria-label` e os atributos `data-action="notice"` e
`data-action="settings"`.

Para adicionar um ícone, primeiro inclua o SVG aprovado em
`frontend/assets/icons/stellar-atlas/`, depois registre a chave e o path em
`IconRegistry.ts`. Se o ícone representar um recurso, adicione o ID estável ao
mapping `resourceIcon`.
