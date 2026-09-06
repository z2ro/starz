# Architecture

StarZ usa um monólito modular:

```text
FastAPI (api.py)
  -> db/store.py (transação e mapper ORM ↔ GameState)
    -> simulation.py (state, timestamps, rules)
      -> universe.py (seed + coordinates)
      -> data.py (YAML + Pydantic)
      -> economy.py (cobertura, receitas e esgotamento de insumos)
      -> travel.py (origem explícita, distância, ETA e consumo)
      -> effects.py (handler de unlock e requirements)
    -> db/models.py (SQLAlchemy 2 / PostgreSQL)
alembic (schema) / bootstrap (dados iniciais)
frontend/ (SPA TypeScript sem framework + CSS + artefato browser gerado)
```

O Planet View adiciona `frontend/src/planet3d/PlanetRenderer.ts` como camada visual
isolada. Ele recebe dados já calculados pela API, usa Three.js apenas para renderizar
e nunca altera GameState. `planetVisual.ts` concentra configurações determinísticas,
paletas, posições, value noise/FBM e decisões visuais puras. O hero 3D fica no centro do command center;
overlays HTML mostram filas e o inspector HTML mostra dados físicos, desenvolvimento,
órbita e produção. O renderer mantém um canvas host enquanto a rota Planet está aberta,
atualiza a cena sem criar outro WebGLRenderer e faz `dispose()` ao sair. O bundle é
gerado localmente por esbuild; não há CDN nem assets 3D externos. Textura de superfície,
bump, atmosfera Fresnel, night lights, estação, naves e órbitas continuam sendo apenas
apresentação; não existe física orbital, terrain simulation ou gameplay no WebGL.

O núcleo não depende de FastAPI nem de banco. A engine recebe `now` explicitamente, usa timestamps para trabalho de longa duração e avança estado de forma lazy quando consultado.

O PostgreSQL é a única fonte de estado no runtime. `Store.run(empire_id, action,
planet_id=...)` abre transação, trava a linha do império, carrega o planeta explícito,
avança a engine e persiste o resultado.
O ORM não entra na engine. Relógio real é fornecido depois de obter o lock; testes
podem passar `now` explicitamente. Detalhes em [persistence.md](persistence.md).

## Limites

- A geração de sistemas é determinística e sob demanda.
- Só o sistema do jogador fica materializado no estado inicial.
- Um sistema pode ter muitos PlanetStates; um império pode possuir muitos PlanetStates.
- `Empire.home_planet_id` identifica o contexto planetário atual do slice.
- Construções, pesquisa e frotas usam `complete_at`/`arrival_at`.
- A API é uma camada fina; validação de conteúdo e regras ficam na engine.

## Tempo e economia

`advance(now)` rejeita tempo regressivo ou não finito, aceita zero e é idempotente.
Aplica eventos vencidos no cursor, encontra o próximo boundary, produz até ele e
aplica todos os eventos daquele instante. Empates são resolvidos por construção
(timestamp/ID), pesquisa e frotas (ID). Não existe scheduler ou tick global.

Energia: `coverage = 1` para consumo zero; caso contrário `min(1, geração/consumo)`.
Trabalho: `supply = max(0, total - crew_committed)`; cobertura é `min(1, supply/demand)`
ou 1 para demanda zero. Disponível/ociosa é `max(0, supply-demand)`.
`workforce_demand` é o único nome da demanda; o alias `population_demand` foi removido.
Tripulação é comprometida na montagem e continua comprometida nas frotas chegadas.

Cada receita possui uma taxa de batches proporcional ao nível e ao menor coverage.
Cada input é debitado uma vez; todos os outputs usam a mesma quantidade de batches.
O integrador resolve esgotamento de insumos analiticamente, sem atualização por segundo.
Extração precede processamento; processos concorrentes têm prioridade estável por ID.

## Frotas e persistência

`fleet.ship_ids` é a fonte de ownership. Naves sem referência em fleet são unattached;
uma nave attached continua na mesma entidade após ARRIVED e pode viajar novamente.
O slice mantém uma nave por frota. `x/y` representam a posição de partida durante
TRANSIT e o destino após ARRIVED; não há interpolação visual contínua nesta tarefa.
`travel.py` recebe origem e destino explicitamente, nunca consulta o home system.

Frotas persistem `MOVE`, `SURVEY` ou `COLONIZE`. A chegada colonial cria uma mudança
de domínio que o Store materializa como StarSystem/PlanetState; a engine não usa ORM.
A chegada `SURVEY` usa o mesmo boundary
temporal para registrar a coordenada em `GameState.system_knowledge`; inserção
idempotente em `(empire_id, system_x, system_y)` evita descoberta e notice duplicadas.
`MOVE` altera somente posição. Não há etapa adicional de scanning.

Stocks e combustível são persistidos por `planet_id` em `planet_stock`. O planeta ativo
usa `GameState.stocks`; `stocks_by_planet` mantém os demais estoques necessários para
persistência e origem física de viagens. Não existe transferência implícita entre
mundos. Pesquisa permanece global ao império e naves/frotas permanecem imperiais.
READ COMMITTED + SELECT FOR UPDATE na linha do império serializa ações mesmo entre
processos. Erro de domínio ou de constraint causa rollback de toda a transação,
incluindo avanço lazy. Não há RLock local nem escrita de state.json.
Trabalho restante salvo é preservado, inclusive quando a pesquisa está pausada.

Colonização reserva `(x, y, planet_index)` por uma fleet `COLONIZE` em trânsito.
Advisory lock transacional por alvo serializa a validação entre impérios; a unicidade
`(system_id, planet_index)` é a garantia final. Abrir Galaxy não materializa corpos.
`PlanetState.last_updated` mantém o cursor lazy local de produção/obras; eventos
globais usam `Empire.last_updated`, avançados no contexto do homeworld.

## Capacidades e pesquisa contínua

`industrial_capacity != construction_slots != shipyard_slots`.
Indústria nominal soma apenas a propriedade explícita do YAML, hoje no processador.
É um indicador de capacidade produtiva instalada, sem alterar receitas, prazos ou filas
nesta etapa. Não há gate industrial adicional.
Slots de obras vêm do distrito civil; slots de naves vêm do estaleiro. Somam por nível.
Obras na lista `construction` ocupam slots; naves com `ready_at > last_updated` ocupam
slots de estaleiro. Conclusão libera vaga; energia/workforce posteriores não mudam prazos.

Pesquisa tem trabalho total inicial igual a `Technology.duration` (unidades de trabalho).
`effective_research_rate = research_rate * min(energy_coverage, workforce_coverage)`.
Cada intervalo desconta taxa efetiva × segundos de `remaining_work`. A previsão de
conclusão entra como boundary; após cada boundary a taxa e o ETA são recalculados.
`complete_at` é somente previsão (null se pausada), não autoridade sobre progresso.
Mudanças de tripulação na montagem também atualizam o ETA. Sem cobertura, trabalho
é preservado. Não há tick global nem progresso por segundo persistido.

## Contrato HTTP

`/api/travel` e `/api/travel-preview` aceitam `fleet_id` ou `ship_id` opcional,
mutuamente exclusivos. Sem ambos: primeira fleet ARRIVED por ID; caso não exista,
primeira nave pronta unattached. Ambos usam o mesmo resolvedor de origem/ownership.
IDs inválidos, frota em trânsito, motor incompatível e destino igual à origem dão 400.
Coordenadas fora dos limites dão 422. Preview retorna todos os regimes do catálogo,
com origem/destino/distância; não debita combustível.

`/api/state` inclui naves, missão de frota, todos os campos de cobertura, `travel_modes` e
`unlocked_content`. `/api/catalog` projeta para a UI as definições YAML de recursos,
distritos, tecnologias, cascos, propulsões, combustíveis e regimes. `/api/galaxy`
gera uma vizinhança limitada (raio 1–3) sem materializar sistemas. Sistemas `UNKNOWN`
expõem somente navegação; `SURVEYED` deriva os detalhes da seed. O centro só pode ser
o homeworld ou a posição de uma frota `ARRIVED`. O frontend envia missão e seleção
explícitas e mostra erros da API.

O cliente usa rotas hash e re-renderização simples. Carrega state, catálogo e
vizinhança em paralelo; depois sincroniza `/api/state` a cada 15 segundos somente
quando há atividade temporal e a página está visível. Countdowns são visuais: o
backend continua avançando o universo apenas em requests. Detalhes em
[frontend.md](frontend.md).
