# Decisions

## D001 — Python + FastAPI + Pydantic

Escolhidos para manter a engine determinística, tipada e testável com poucas dependências. FastAPI é apenas adaptador HTTP.

## D002 — JSON local no vertical slice

Histórico: substituído por D013. JSON não é mais usado no runtime.

O requisito é provar persistência offline, não infraestrutura de produção. `state.json` torna o fluxo local reproduzível; banco relacional entra quando houver múltiplos jogadores, concorrência e autenticação.

## D003 — CSS planetário antes de WebGL

Uma esfera estilizada com markers prova a relação entre desenvolvimento e visualização sem deixar renderização dominar a fundação. A API já entrega dados físicos e distritos para uma futura camada 3D.

## D004 — Sistema em coordenadas inteiras

Distância euclidiana em uma grade é suficiente para provar alcance, ETA e combustível. Rotas, hazards e ambientes entram quando existir conteúdo que use essas decisões.

## D005 — Estado persistente por timestamps

Construção, pesquisa e viagem não exigem tick exposto ou atualização por segundo. A engine resolve progresso no próximo acesso.

## D006 — Cobertura e receitas

Energia/trabalho limitam a operação pelo menor coverage. Processamento usa taxa de
batches com débito único dos inputs e todos os outputs. Esgotamento de insumo divide
o intervalo de integração; isso evita que a frequência de consultas altere o saldo
na cadeia atual. Empates entre processos usam prioridade por ID, sem UI de alocação.

## D007 — Ciclo persistente da frota

A referência em `fleet.ship_ids` define ownership; ARRIVED pode receber novas ordens.
IDs opcionais no payload preservam chamadas anteriores. Seleção implícita prioriza
uma fleet ARRIVED por ID e, depois, nave pronta unattached. Destino igual à origem
é erro em vez de viagem fictícia de distância mínima 1. Estoque global de combustível
é mantido, sem introduzir reabastecimento local.

## D008 — Unlock derivado de pesquisa

Manter `Technology.unlocks` e executar seu handler ao resolver disponibilidade evita
duplicar permissões no estado persistido. Remover `effects` e `modify_production` sem implementação
fecha o contrato sem inventar um framework de efeitos. Requirements aceitam apenas
tecnologias concluídas e distritos construídos.

## D009 — Migração do catálogo procedural

Quatro arquétipos estelares e um planetário preservam os ranges do slice; os perfis
não pretendem ser classificações astrofísicas rigorosas. Ordem estável por ID e
catálogo explícito substituem conteúdo hardcoded. Não prometemos o mesmo mundo da
versão anterior: a nova seleção e precisão alteram propriedades geradas. JSON mantém
o schema e pode ser carregado; novos testes de balanceamento devem usar partida nova.

## D010 — Compilação frontend e serialização local

Histórico: o RLock/JSON abaixo foi substituído por transações PostgreSQL em D013.

TypeScript 5.9.3 como dependência de desenvolvimento gera o artefato JS antes mantido
manualmente. Sem troca de framework, navegação ou estilo. Testes Node usam o artefato
real para verificar payloads de viagem e mensagens de erro. Um RLock na API protege
operações locais concorrentes sobre o mesmo JSON; não suporta múltiplos processos.

## D011 — Capacidade sem filas implícitas

O distrito civil inicial representa também a coordenação de obras e fornece 1 slot
de construção, via YAML. Processador fornece 2 de indústria nominal; estaleiro fornece
1 slot naval por nível. Indústria é exposta como indicador de capacidade instalada;
não adicionamos gate ou fórmula de velocidade. O alias industrial foi removido da API.

## D012 — Trabalho científico e compatibilidade JSON

Histórico: a compatibilidade JSON abaixo saiu do runtime em D013; trabalho científico permanece.

Manter `Technology.duration` como trabalho à taxa nominal 1 evita renomear conteúdo
desnecessariamente. `remaining_work` é autoritativo, `complete_at` é previsão dinâmica.
Pesquisa pode ser iniciada com laboratório sem cobertura e permanecer pausada.
Estado legado converte prazo restante em trabalho usando a taxa nominal no último
estado salvo; não reconstrói mudanças históricas não registradas. Slots antigos
excedentes são preservados até terminar e impedem novos inícios enquanto ocupados.

## D013 — PostgreSQL e ownership local

SQLAlchemy 2 síncrono + psycopg 3 + Alembic. PostgreSQL 17, Python 3.12 e Node 22 no
Compose. Dependências Python resolvidas em requirements.lock; frontend usa npm ci.
Um império placeholder, um planeta mutável e um sistema materializado. O DB inicia
partida nova; não implementamos importador JSON para o estado descartável de dev.

Transação READ COMMITTED e lock da linha do império precedem leitura/avanço/ação/save.
Bootstrap usa upsert e lock na linha do universo antes de criar o império, sem seed nova
em reinícios. Alembic cria apenas schema. Gameplay inicial fica no bootstrap.

## D014 — Snapshots mínimos e timestamps

Naves mantêm massa e crew históricos; demais parâmetros são consultados por IDs no
catálogo. Jobs guardam UUID/started_at/complete_at; pesquisas guardam trabalho restante
e completions com timestamp real do boundary. Conversão epoch ↔ UTC só no mapper.
Movimento atual fica na própria fleet, sem tabela de histórico ou event sourcing.
Notices são uma tabela com ordem monotônica por império, consultando os últimos 100;
created_at registra a observação/persistência, não uma reconstrução histórica de eventos.

## D015 — Cardinalidade relacional e ownership explícito

`planet_state` usa `planet_index` e `UNIQUE(system_id, planet_index)`; não há unicidade
por sistema ou por império. `Empire.home_planet_id` identifica explicitamente o
homeworld. O owner do planeta pode ser nulo para preparar corpos não ocupados, embora o
bootstrap atual sempre atribua o planeta inicial ao império local.

`Store` não guarda império em estado mutável. `bootstrap()` retorna o ID do império
local e `run(empire_id, action)` recebe o owner da request. A API ainda passa um
`default_empire_id` no startup apenas como placeholder sem autenticação.
