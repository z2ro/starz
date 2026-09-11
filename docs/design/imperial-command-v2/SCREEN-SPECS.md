# STARZ Screen Specs V2

## Regra de dados

As telas abaixo definem intenção visual, hierarquia e componentes. Os nomes, valores, estados e contagens exibidos nas imagens são placeholders conceituais. A implementação deve consumir o estado real da API do STARZ e deixar ausente/indisponível quando o domínio não tiver um equivalente.

## Shell compartilhado

### Desktop

- Top HUD fixo no topo; altura alvo `54 px`.
- Navigation rail esquerda; largura alvo `112 px`.
- Content region central fluida.
- Inspector direito entre `360–420 px` quando presente.
- Bottom operations ancorado no content region; não cobrir informações essenciais.
- Header de tela: título, contexto de sistema/planeta e seletor real.

### Mobile

- Top bar compacta: identidade, contexto selecionado e notificações.
- Hero com `aspect-ratio` visual dominante, sem HUD de recursos completo.
- Inspector como bottom sheet arrastável.
- Bottom nav: Overview, Planet, Fleets, Galaxy; Economy, Research e Shipyard ficam em More.
- Operações em trilho horizontal ou drawer; cada item mantém ação touch-friendly.

## 01 — Planet / Command Center

### Objetivo

Responder rapidamente: “qual é o estado deste planeta e qual decisão operacional exige minha atenção?”.

### Hierarquia

1. Planeta e contexto selecionado.
2. Estado geral e características físicas.
3. Desenvolvimento e produção.
4. Construção, pesquisa e frotas em operação.

### Componentes

- `PlanetHeader`: nome real, sistema real, seletor real e estado.
- `PlanetHero`: artwork e layers; marcadores só para objetos disponíveis no domínio.
- `PlanetInspector`: header, thumbnail opcional, summary, Physical, Development, Production, Orbit, actions.
- `OperationsDeck`: Construction Queue, Active Research, Fleet Operations.
- `QueueItem`, `Progress`, `DataRow`, `Badge`, `Button`, `Drawer`.

### Estados do hero

- **Early colony:** aplicar a base planet surface + atmosphere + clouds + sparse city lights; station e military ships ausentes quando não existirem.
- **Developed world:** ativar city lights maiores, station/shipyard e tráfego local conforme dados reais.
- **Major imperial world:** adicionar infraestrutura, fleets e atividade industrial reais; não usar “densidade” como dado inventado.

### Ações

- Selecionar planeta/sistema.
- Abrir detalhes físicos.
- Gerenciar planeta.
- Abrir construção, pesquisa e frotas a partir do deck.
- Preservar polling/refresh e feedback de operação.

## 02 — Overview / Empire Command

### Objetivo

Mostrar o estado geral da civilização e orientar a próxima decisão estratégica, sem repetir o Planet hero em escala menor.

### Composição

- Hero editorial menor: mundo ou sistema atual, com texto de contexto.
- Empire summary: mundos, população, produção, pesquisa e frotas, apenas se existirem no estado real.
- Activity stream: construções, pesquisas, chegadas e descobertas reais.
- Strategic decisions: próximos objetivos que o domínio realmente suporta.
- Inspector ou side summary para o contexto selecionado.

### Prioridade

Decisão e mudança recente têm mais peso que contagem decorativa.

## 03 — Economy / Industrial Command Network

### Objetivo

Entender estoque, produção, consumo, energia, workforce e capacidade como uma rede industrial operável.

### Composição

- Stock strip com Resource Metrics.
- Production flow visual: inputs → processamento → outputs, baseado nas receitas do jogo.
- Energy/workforce/capacity em linhas comparáveis.
- Construction/production queue ligada à origem real do recurso.
- Inspector para uma cadeia, planeta ou estrutura selecionada.

### Regra

Não usar tabela gigante. Filtrar e agrupar por cadeia, planeta e estado operacional. Toda seta representa uma relação real ou fica explicitamente conceitual.

## 04 — Research / Scientific Systems Map

### Objetivo

Ler dependências e escolher pesquisa, com precisão científica e destaque violet pontual.

### Composição

- Mapa de technology nodes com connectors e níveis de disponibilidade.
- Categorias e filtros do domínio real.
- Inspector do technology node: descrição, pré-requisitos, custo/tempo se disponíveis, ação.
- Active Research e próxima fila em um deck inferior.

### Estados

- Completed: cyan/green neutro, sem glow excessivo.
- Available: borda cyan e ação clara.
- Active: violet localizado + progresso.
- Locked: neutro e requisito explícito.

Não tratar como árvore RPG; connectors devem explicar dependência, não pontuação de personagem.

## 05 — Shipyard / Ship Command

### Objetivo

Escolher uma classe de nave, entender sua função técnica e colocá-la em construção.

### Composição

- Lista esquerda com Ship Rows e filtros reais.
- Centro com render/silhouette/schematic grande da nave ou dock.
- Direita com especificações, função, capacidade e requisitos reais.
- Rodapé com construction queue e slots.

### Conceitos de display

- Design catalog visual oficial: Horizon, Wayfarer, Vanguard, Sentinel, Odyssey, Aegis, Spearhead, Leviathan, Atlas, Dominion e Stargrave.
- Horizon: exploration corvette; leitura leve, sensores e alcance.
- Wayfarer: freighter; volume, carga e logística.
- Vanguard: frigate; presença, defesa e capacidade militar.
- Sentinel: destroyer; defesa e escolta reforçada.
- Odyssey: science cruiser; sensores, observação e análise.
- Aegis: cruiser; presença de linha e combate sustentado.
- Spearhead: battlecruiser; ruptura e assalto frontal.
- Leviathan: battleship; linha pesada e cerco.
- Atlas: carrier; suporte de frota e strike craft.
- Dominion: dreadnought; comando estratégico e domínio militar.
- Stargrave: Titan / Stellar Siege Titan; megastructura militar móvel ao redor de uma estrela cativa.

Essa lista é o **DESIGN CATALOG** visual. Ela não afirma que todas as classes existem, estão desbloqueadas ou estão disponíveis no **CURRENT GAMEPLAY CATALOG**. A implementação deve mostrar apenas os modelos realmente presentes no catálogo e no estado real da API.

### Stargrave selected — tratamento visual futuro

Quando Stargrave estiver disponível e selecionada, usar presentation area maior, stellar core como elemento visual principal, megastructure schematic e o rótulo `TITAN / STELLAR MEGASTRUCTURE`. A escala deve ser tratada como categoria própria. Não inventar requirements ou alterar gameplay.

## 06 — Fleets / Fleet Operations

### Objetivo

Responder onde cada frota está, o que faz, quando chega e qual composição possui.

### Composição

- Fleet rows agrupadas por Arrived, Transit, Mission, Standby.
- Map/route context no centro.
- Inspector com location, mission, ETA, fuel, composition e destination reais.
- Ações de rota, ordem e detalhes preservando a API existente.

### Estados

Status textual + ícone + cor funcional. “Transit” não deve ser inferido de uma animação; vem do estado real da viagem.

## 07 — Galaxy / Strategic Star Map

### Objetivo

Explorar, comparar sistemas, acompanhar presença de frotas e iniciar ações permitidas pelo domínio.

### Composição

- Mapa astronômico grande com escala, rotas e regiões desconhecidas.
- System Nodes para home, controlled, surveyed, unknown, selected, fleet present e colonizable quando suportados.
- Inspector direito para o sistema selecionado.
- Filtros e busca sem aparência de mapa terrestre.

### Interação

- Pan/zoom acessíveis.
- Seleção de sistema e recentralização.
- Seleção de frota e comparação de regimes, conforme API existente.
- Ação de survey/colonize somente quando o domínio permitir.

## Reusable Inspector contract

```text
Header: subject identity + close/back
Summary: thumbnail/art + primary status
Sections: ordered data groups
Metrics: value + unit + label
Visualization: bar, sparkline, orbit or schematic
Actions: one primary + supporting actions
States: loading, empty, unavailable, warning, error
```

O contrato visual é estável; o conteúdo é contextual. Não preencher seções sem equivalente real.

## Operations Deck contract

- Header: ícone, título, contagem real e “view all”.
- Item: thumbnail opcional, título, meta, progress, ETA, status e ação.
- Empty slot: affordance de adicionar quando o slot existir no domínio.
- Empty state: explicar ausência e próximo passo possível.
- Error: explicar falha e permitir retry quando seguro.
- Ações não podem ser decorativas; cada botão deve chamar o fluxo correspondente.
