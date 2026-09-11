# STARZ Visual Language V2

## Status

- Direção aprovada: **01 — Imperial Command**.
- Uso: fonte visual para todas as telas do STARZ.
- Escopo: linguagem visual, shell global, componentes e estados.
- Fora do escopo: regras de gameplay, valores canônicos, cópia de dados e implementação.

## Artefatos de referência

- [Planet View refinada](assets/planet-view-refined.png)
- [Hero states e layer stack](assets/hero-states-layer-stack.png)
- [Mobile Planet View](assets/planet-view-mobile.png)
- [Component library](assets/component-library.png)
- [Screen family board](assets/screen-family-board.png)

## Princípios

1. **O mundo vem antes da interface.** O hero é a expressão emocional do planeta; a UI enquadra, mede e opera esse mundo.
2. **Comando, não decoração.** Todo marcador, barra ou ação precisa representar uma informação ou decisão real.
3. **Densidade com ar.** A tela pode conter muita informação, mas grupos, alinhamento e ritmo devem permitir leitura imediata.
4. **Imperial e científico.** Escala monumental e luz cinematográfica convivem com precisão de observatório.
5. **Glow localizado.** Luz é sinal de foco, estado ou fonte luminosa do mundo; não é textura geral.
6. **Dados reais primeiro.** Placeholders dos conceitos nunca viram contrato de gameplay.

## Color tokens conceituais

| Token | Valor de referência | Uso |
|---|---|---|
| `background-primary` | `#030B14` | Fundo geral e espaço profundo |
| `background-secondary` | `#061522` | Shell, navegação e zonas de apoio |
| `surface-primary` | `#081B2B` | Painéis principais |
| `surface-raised` | `#0D2638` | Inspector, drawer e painel em foco |
| `surface-hover` | `#12344A` | Hover e área interativa |
| `border-subtle` | `#19394D` | Divisores e contornos discretos |
| `border-strong` | `#2C6C8A` | Foco, seleção e ação primária |
| `text-primary` | `#EDF7FF` | Títulos e valores principais |
| `text-secondary` | `#A9C1D2` | Labels e descrição curta |
| `text-muted` | `#718A9C` | Metadata, coordenadas e estados neutros |
| `accent-primary` | `#31D4FF` | Ação, seleção, links e progresso principal |
| `positive` | `#2ECC71` | Estável, positivo, concluído |
| `warning` | `#FFB845` | Energia baixa, atenção e risco reversível |
| `research` | `#B46CFF` | Pesquisa, ciência e tecnologia |
| `danger` | `#FF4B4B` | Crítico, falha e ação destrutiva |

Evitar `#000000` e `#FFFFFF` puros em superfícies. Cor funcional deve aparecer em um ponto de leitura claro, nunca como preenchimento de toda a tela.

## Tipografia

Uma família técnica sem sacrificar leitura. Se o produto usar uma família variável, manter o mesmo papel sem introduzir uma segunda família por tela.

| Papel | Tamanho desktop | Peso | Tratamento |
|---|---:|---:|---|
| Display | 32–40 px | 500–600 | Caixa alta opcional, tracking `0.12em` |
| Page title | 24–30 px | 600 | Natural ou caixa alta curta |
| Section title | 14–16 px | 600–700 | Caixa alta, tracking `0.12em` |
| Card / panel title | 13–15 px | 600 | Natural; caixa alta só em metadata |
| Data value | 18–24 px | 600–700 | Alto contraste, sem tracking exagerado |
| Data label | 11–12 px | 500 | Caixa alta, tracking `0.10em` |
| Body | 14–16 px | 400–500 | Natural, line-height confortável |
| Microcopy | 10–11 px | 500 | Caixa alta e uso pontual |
| Coordenadas | 10–12 px | 500–600 | Monoespaçada ou tabular, tracking `0.08em` |

Body text nunca deve virar microcopy apenas para caber. Números de estado precisam de alinhamento tabular e leitura em um relance.

## Spacing e grid

- Unidade base: `4 px`.
- Ritmo principal: `8 / 12 / 16 / 24 / 32 px`.
- Padding de shell: `16 px` em áreas compactas, `24 px` em painéis, `32 px` em hero/editorial.
- Raio: `0–4 px`; usar raio maior somente em bottom sheet mobile.
- Divisores: `1 px` e baixa opacidade.
- Altura de linha de dados: `32–40 px`.
- Alvo de toque: mínimo `44 × 44 px`.

### Grid de referência — 1792 × 854

```text
top HUD       54 px
shell body    800 px
left nav      112 px
right inspect 420 px
hero/content  restante, com bottom deck ancorado
bottom deck   216–230 px
```

O hero ocupa a maior área útil e pode sangrar visualmente até as bordas do content region. O inspector é uma coluna estável; o deck inferior é uma única console dividida por regras finas.

### Breakpoints de validação

- `1792 × 854`: composição de referência e máxima expressão cinematográfica.
- `1536 × 1024`: manter hero grande; permitir mais altura para inspector e operações.
- `1366 × 768`: reduzir metadata e densidade do deck, nunca reduzir texto abaixo de 12 px.
- `390 × 844`: usar composição mobile dedicada, sem tentar preservar o grid desktop.

## Surfaces, borders, shadows e glow

- Surfaces são opacas ou quase opacas para manter contraste sobre o artwork.
- O hero usa imagem/raster como base; painéis de UI recebem navy sólido com transparência moderada apenas quando a leitura não for afetada.
- Sombra é curta e escura (`0 12px 32px`) para destacar drawer ou inspector, não para cada card.
- Glow cyan: fino, localizado em foco, active, seleção e borda de ação.
- Glow amber: nasce da estrela e pode contaminar levemente a superfície adjacente.
- Glow green/violet/red: somente em status, ícone ou progresso que precise chamar atenção.

## Iconografia

- Reutilizar o sistema **Stellar Atlas** existente para navegação, recursos, status e ações.
- Ícones de sistema: traço técnico, geometria simples, preenchimento somente quando o contexto exigir.
- Tamanho base: `16 px` em rows, `20 px` em métricas, `24 px` em navegação, `32–48 px` em estados vazios ou hero markers.
- Ícone acompanha label e estado; nunca é o único canal para erro, seleção ou disponibilidade.

## Data visualization

- Barras: espessura `6–8 px`, track navy, preenchimento funcional.
- Linhas e orbit paths: `1 px`, baixa opacidade; aumentar apenas a rota ou objeto selecionado.
- Status: ponto + label + cor; cor sozinha não comunica estado.
- Comparações: alinhar valor, unidade e barra na mesma linha.
- Mapas: separar mundo/cosmos, rotas e estado do sistema por camadas de contraste.
- Gráficos devem responder a uma pergunta operacional. Não adicionar chart para preencher espaço.

## Motion

- Entrada de shell: `180–240 ms`, ease-out, sem overshoot.
- Hover/focus: `120–160 ms`.
- Troca de view: `220–320 ms`, preservar posição do shell e trocar somente o contexto.
- Progresso: transição suave em mudanças reais; não animar indefinidamente sem mudança de dado.
- Hero: parallax ou deriva orbital sutil, opcional para futuro; imagem estática deve continuar completa sem motion.
- Respeitar `prefers-reduced-motion` e manter feedback de estado instantaneamente legível.

## Interaction states

- **Default:** borda sutil, contraste estável, nenhuma emissão forte.
- **Hover:** surface-hover, borda cyan discreta, ação secundária visível.
- **Selected / active:** barra ou regra cyan, label primário mais claro, glow localizado.
- **Disabled / future:** opacity reduzida, sem perder texto ou affordance; explicar indisponibilidade quando necessário.
- **Warning:** amber em ícone, label e indicador; manter restante neutro.
- **Critical:** red reservado para falha, risco alto ou ação destrutiva; exigir confirmação quando aplicável.
- **Loading / stale:** indicar atualização sem substituir o conteúdo por decoração; preservar último dado válido quando seguro.

## Shell global

- Top HUD horizontal, com grupos curtos: brand, recursos, energia, população, pesquisa, frotas, sistema, notificações e settings.
- Sidebar compacta, sete views, Stellar Atlas icons, estado ativo inequívoco e sem competir com o hero.
- Inspector direito reutilizável entre Planet, Galaxy system, Fleet, Ship e Technology.
- Bottom operations como uma console contínua: Construction, Research e Fleet Operations são colunas de um mesmo sistema.
