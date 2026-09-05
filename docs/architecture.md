# Architecture

StarZ usa um monólito modular:

```text
FastAPI (api.py)
  -> simulation.py (state, timestamps, rules)
      -> universe.py (seed + coordinates)
      -> data.py (YAML + Pydantic)
      -> economy.py (cobertura, receitas e esgotamento de insumos)
      -> travel.py (origem explícita, distância, ETA e consumo)
      -> effects.py (handler de unlock e requirements)
  -> state.json (MVP persistence)
frontend/ (static TypeScript source + browser artifact)
```

O núcleo não depende de FastAPI nem de banco. A engine recebe `now` explicitamente, usa timestamps para trabalho de longa duração e avança estado de forma lazy quando consultado.

O JSON é um adaptador deliberadamente pequeno para o slice local. A fronteira de persistência permite trocar isso por banco relacional e migrations sem mover as regras de simulação.

## Limites

- A geração de sistemas é determinística e sob demanda.
- Só o sistema do jogador fica materializado no estado inicial.
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
`population_demand` permanece como alias de `workforce_demand` por compatibilidade.
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

O estoque de combustível continua global ao jogador neste slice; não representa
reabastecimento local ou logística interplanetária. Não houve expansão desse sistema.
O save continua atomicamente substituindo o JSON por arquivo temporário. A API usa
um lock de processo para serializar leitura/avanço/ação/save entre requisições locais.
Executar apenas um processo servidor. Nenhuma migração de schema JSON é necessária.

## Contrato HTTP

`/api/travel` e `/api/travel-preview` aceitam `fleet_id` ou `ship_id` opcional,
mutuamente exclusivos. Sem ambos: primeira fleet ARRIVED por ID; caso não exista,
primeira nave pronta unattached. Ambos usam o mesmo resolvedor de origem/ownership.
IDs inválidos, frota em trânsito, motor incompatível e destino igual à origem dão 400.
Coordenadas fora dos limites dão 422. Preview retorna todos os regimes do catálogo,
com origem/destino/distância; não debita combustível.

`/api/state` inclui naves, todos os campos de cobertura, `travel_modes` e
`unlocked_content`. O frontend envia a seleção explícita e mostra erros da API.
