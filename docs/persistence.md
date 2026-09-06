# Persistência relacional

## Fluxo transacional

`Store.run` usa `Session.begin()` e `SELECT empire ... FOR UPDATE`. Apenas depois de
obter o lock lê stocks, planeta, jobs, pesquisa, naves e frotas. Converte para GameState,
executa `advance(now)` e a ação e grava os resultados antes do commit. Uma exceção em
qualquer ponto causa rollback, inclusive quando houve débito no objeto de domínio.
GET state e preview também avançam lazy dentro de transação. Não existe scheduler.

READ COMMITTED é suficiente porque todas as operações do império respeitam esse lock.
Não há proteção apenas em memória, distributed lock ou SERIALIZABLE. As consultas
posteriores ao lock veem o commit da requisição anterior. O relógio real é lido após
esperar o lock, evitando timestamps anteriores ao estado recém-carregado.

Essa estratégia segue o contrato de [row locks do PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html)
e o escopo de [transações SQLAlchemy](https://docs.sqlalchemy.org/en/20/core/connections.html).

## Modelo

| Tabela | Estado persistido |
| --- | --- |
| universe | UUID, seed, nome único, criação |
| star_system | UUID, universo, coordenadas únicas; só sistema inicial |
| empire | UUID, universo, sistema inicial, home_planet_id, nome placeholder, last_updated |
| planet_state | UUID, owner opcional, sistema, planet_index e população mutável |
| planet_stock | PK planet/resource_id, amount finito não negativo |
| planet_district | PK planet/district_id, nível não negativo |
| construction_job | UUID, planeta, content ID, início e conclusão |
| research_state | PK empire, active ID, remaining_work, ETA, atualização |
| completed_technology | PK empire/technology_id, instante de conclusão |
| ship | UUID, owner, IDs de conteúdo, massa/crew snapshot, ready_at/criação |
| fleet | UUID, owner, origem/posição, destino, missão e alvo planetário colonial opcional |
| fleet_ship | associação, ship_id único; FKs compostas garantem mesmo owner |
| system_knowledge | coordenada mapeada, nível SURVEYED e instante por império |
| notice | UUID, owner, sequência única, mensagem e criação |

`star_system` e `planet_state` são 1:N; `empire` e `planet_state` também são 1:N.
`planet_index` é a identidade procedural estável atual e é único dentro do sistema.
O homeworld é escolhido por `empire.home_planet_id`; a persistência verifica que ele
pertence ao próprio império e ao seu sistema inicial. Um PlanetState sem owner é
permitido no schema para futuros corpos não ocupados, mas não é criado pelo slice.

Nenhum GameState/definição YAML é armazenado como JSONB. Population e stocks estão no
planeta; pesquisa continua global ao império. A migration de economia move o antigo
`empire_stock` integralmente para o homeworld, sem copiar valores para colônias.
O downgrade soma os stocks planetários por império de forma determinística.
Visitar B ou C não duplica a física procedural. Um sistema remoto e seu PlanetState
só são materializados quando uma missão colonial chega.

Conhecimento usa chave primária `(empire_id, system_x, system_y)`. Ausência significa
`UNKNOWN`; uma linha significa `SURVEYED`. Não há snapshot físico nessa tabela: estrela
e planeta continuam derivados deterministicamente da seed e do catálogo. A migration
marca o homeworld de impérios existentes como mapeado e preenche missões antigas com
`MOVE`.

## Bootstrap e migrations

`alembic upgrade head` roda antes do servidor no container. Não se usa create_all.
Downgrade remove tabelas na ordem inversa das FKs. Bootstrap é separado e transacional:
upsert do universo de nome StarZ, lock dessa linha, lookup/criação do império Local Empire,
spawn determinístico, planeta índice 0, `home_planet_id`, stocks, distritos e pesquisa
vazia. Reinício não reseta seed.
O startup também valida as referências de conteúdo do império existente.

Compose espera `service_healthy` no banco, conforme a
[documentação de inicialização do Compose](https://docs.docker.com/compose/how-tos/startup-order/).
O volume nomeado sobrevive a `down`; `down -v` é reset destrutivo explícito do dev.

## Política de snapshots

Massa e crew da nave são snapshots; IDs de casco, motor e combustível permanecem.
Alterar balanceamento de motor/combustível/modo afeta previews e ordens futuras.
Viagens em andamento mantêm arrival_at/fuel_cost contratados; obras e ready_at também
permanecem fixos. Pesquisa mantém remaining_work, mas taxa efetiva usa infraestrutura
e cobertura atuais. IDs removidos ou incompatíveis falham em vez de substituir conteúdo.

Timestamps SQL são TIMESTAMPTZ, convertidos por datetime com timezone UTC. Epoch float
continua no domínio. PostgreSQL tem precisão de microssegundos; comparações numéricas
de produção fracionária consideram a precisão de ponto flutuante. Novos testes usam
relógio explícito e não dependem de sleeps para a simulação.

## Limites deliberados

Sem importação automática de state.json; começa uma partida nova. Helpers JSON vivem
apenas em tests/json_fixture.py. Não existem dois backends ativos. Um império local
é seleção temporária da API sem autenticação, não implementação de multiusuário.
Persistimos o movimento atual, não histórico de missões; notices não são event sourcing.
O mapper cobre as operações atuais: não há remoção/transferência de naves ou distritos.
Qualquer operação futura desse tipo deve acrescentar seu mapeamento e testes.

Fuel é um stock planetário como qualquer outro. Population, districts e construction
jobs também são por planeta; research permanece global. A UI seleciona um planeta pertencente ao império; ownership é
validado antes de carregar ou persistir. Uma fleet colonial em trânsito funciona como
reserva persistente, protegida por advisory lock por coordenada durante a ordem/chegada.
Cada PlanetState possui `last_updated`: trocar de mundo não descarta produção nem uma
obra pendente. Eventos globais continuam usando `Empire.last_updated` e o homeworld.

Produção e processamento usam somente o `stocks` do planeta ativo. Uma viagem usa
combustível local do planeta próprio no sistema de origem; uma frota remota sem esse
planeta é rejeitada até existir uma mecânica explícita de abastecimento/transporte.
Ships persistem `origin_planet_id` e coordenadas de criação para que crew e a primeira
posição física não sejam inferidas do homeworld.
