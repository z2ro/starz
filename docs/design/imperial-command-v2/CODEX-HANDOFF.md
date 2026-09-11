# STARZ Codex Handoff V2

## O que está sendo entregue

Este pacote entrega **visual concept + sistema de UX** para a Direction 01 — Imperial Command. Ele não substitui o frontend, backend, game engine, API, dados ou modelos de domínio.

O trabalho de produção deve adaptar a linguagem ao código existente e conectar cada elemento aos dados reais. Não criar valores de gameplay para preencher a composição.

## Ordem recomendada de implementação

1. Tokens visuais e shell global.
2. Navigation rail e top HUD.
3. Inspector reutilizável.
4. Operations Deck com Construction, Research e Fleets.
5. Planet View image-first com layer stack.
6. Responsive mobile Planet View.
7. Overview.
8. Economy, Research, Shipyard, Fleets e Galaxy, uma tela por vez.
9. Three.js progressivo para movimento e profundidade futura.

## Separação concept/data

| Visual concept | Fonte obrigatória de implementação |
|---|---|
| HUD resource metric | estado real da economia/API |
| Planet title/system | planeta selecionado e sistema real |
| Physical rows | dados físicos disponíveis no domínio |
| Development bars | população, workforce, produção e capacidade reais |
| Construction queue | jobs/construction reais |
| Active research | research real e progresso persistido |
| Fleet operations | fleets, missão, rota e ETA reais |
| Hero state | combinação de entidades/assets reais, não uma contagem inventada |
| Galaxy node state | conhecimento/estado real do sistema |

Quando não houver equivalente, usar estado vazio ou indisponível documentado. Nunca converter placeholder em regra.

## Layout behavior

### 1792 × 854

- Expressão completa da Planet View.
- Hero dominante; inspector com largura estável.
- Operations Deck visível no rodapé sem sobrepor o centro do planeta.

### 1536 × 1024

- Preservar o mesmo eixo visual.
- Aumentar altura útil do inspector e reduzir somente metadata repetitiva.

### 1366 × 768

- Ocultar metadata secundária, nunca dados de ação.
- Reduzir altura de rows e deck dentro dos limites documentados.
- Manter título, seletor, estado, CTA e progressos legíveis.

### 390 × 844

- Top bar compacta.
- Hero em primeiro plano.
- Inspector convertido em bottom sheet com handle.
- Operations em carrossel/trilho ou drawer.
- Bottom nav com Overview, Planet, Fleets, Galaxy e More.
- Ações com alvo mínimo de `44 × 44 px`.

## Interaction requirements

- Planet/system selector deve alterar o contexto real e atualizar hero, inspector e operações.
- Navigation item deve manter rotas e troca de views existentes.
- Construção, pesquisa, estaleiro e ordens de frota precisam continuar acionáveis.
- Polling/refresh deve preservar o último estado válido e sinalizar atualização.
- Inspector deve ser abrível por clique/toque e fechável por back/close/swipe quando aplicável.
- Hover é enhancement; foco de teclado e ação touch são obrigatórios.
- Loading, empty, stale, warning, critical e error precisam de estados visuais explícitos.

## Component mapping

| Componente visual | Responsabilidade de UX |
|---|---|
| `Panel` | Agrupar conteúdo relacionado sem cardificar cada linha |
| `Inspector` | Contexto detalhado de planeta, sistema, frota, nave ou tecnologia |
| `NavigationItem` | Trocar view preservando estado global |
| `HUDMetric` | Resumo rápido, não substituto do detalhe |
| `ResourceMetric` | Valor + unidade + tendência/estado real |
| `DataRow` | Comparação estável de label, value, unit e status |
| `Progress` | Trabalho, capacidade ou cobertura real |
| `Badge` | Estado textual compacto |
| `QueueItem` | Job real, ETA, progresso e ação |
| `TechnologyNode` | Dependência e estado de pesquisa |
| `FleetRow` | Missão, posição, ETA e estado |
| `ShipRow` | Classe/modelo, função e disponibilidade |
| `SystemNode` | Estado do mapa e seleção |
| `Drawer` / `Modal` | Detalhe ou confirmação sem perder contexto |

## Planet hero implementation notes

- Começar com `background-space` até `effects` como composição image-first.
- Manter as camadas separáveis para trocar Early Colony / Developed World / Major Imperial World.
- Labels/markers ficam fora do raster para responder a seleção e dados reais.
- Station e ships aparecem somente quando há entidade ou asset correspondente.
- Não depender de CSS para simular planeta; não duplicar Three.js antes de existir necessidade operacional.
- Three.js futuro pode substituir camadas específicas, não precisa reescrever a tela.

## Quality bar

- O hero é reconhecível antes de qualquer painel.
- A seleção ativa é evidente em menos de um segundo.
- Um jogador consegue encontrar construção, pesquisa e frotas sem procurar em menus escondidos.
- Nenhum valor de exemplo aparece como verdade do jogo.
- Não há uma coleção de cards SaaS independentes; há um command center contínuo.
- O sistema funciona em desktop e mobile sem reduzir texto a uma escala ilegível.
- Cores funcionais têm redundância textual ou iconográfica.
- Movimento é sutil e desativável.

## Handoff checklist

- [ ] Tokens visuais registrados no sistema de UI.
- [ ] Stellar Atlas icons reutilizados; lacunas listadas em `ASSET-MANIFEST.md`.
- [ ] Planet API/state mapeado para `PlanetHeader`, `PlanetInspector` e `OperationsDeck`.
- [ ] Hero layers com fallback para asset ausente.
- [ ] Inspector testado para Planet, System, Fleet, Ship e Technology.
- [ ] Todas as ações preservam rotas e comportamento existente.
- [ ] Estados loading/empty/warning/error implementados.
- [ ] Desktop validado em 1792×854, 1536×1024 e 1366×768.
- [ ] Mobile validado em 390×844.
- [ ] Nenhum mock de design entrou em produção como dado de gameplay.
