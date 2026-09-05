# StarZ

StarZ é uma fundação jogável de estratégia espacial persistente: um sistema inicial, economia curta, pesquisa, estaleiro e viagem com regimes de propulsão. A interface organiza esse slice como um command center com HUD global, navegação por áreas e mapa estelar interativo.

## Rodar com Docker Compose

```bash
git clone git@github.com:z2ro/starz.git
cd starz
docker compose up --build
```

Abra `http://localhost:8000`. Compose espera o healthcheck do PostgreSQL 17,
aplica `alembic upgrade head` e inicia a aplicação sem reload. `/health` verifica o banco.
O estado fica no volume nomeado `starz_postgres_data` e avança lazy por timestamps.
O bootstrap transacional cria apenas um universo e um império local sem autenticação.
O schema permite vários PlanetStates por sistema e por império; o slice usa somente o
homeworld explícito (`Empire.home_planet_id`) como contexto ativo.

```bash
docker compose down       # para containers; preserva a partida
docker compose up -d --wait
docker compose restart app # preserva estado e seed
docker compose down -v    # APAGA o banco local/partida, sem recuperação sem backup
```

Copie `.env.example` para `.env` apenas para personalizar portas e defaults de
desenvolvimento. Não use essa senha fora do ambiente local. `.env` não é commitado.

## Executar app fora do Docker

Python 3.12+, Node 22 e PostgreSQL 17 acessível são necessários.

```bash
docker compose up -d postgres --wait
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.lock
python -m pip install --no-deps -e '.[test]'
npm ci
npm run build
export DATABASE_URL='postgresql+psycopg://starz:starz_dev_only@localhost:5432/starz'
alembic upgrade head
python -m starz
```

O Python lê `DATABASE_URL` do ambiente; não carrega `.env` automaticamente.
`STARZ_UNIVERSE_SEED` só define a seed no primeiro bootstrap. Reinícios usam a seed
persistida. Não rode a app local e o container na mesma porta.

## Estrutura

- `starz/`: engine determinística, catálogo data-driven, persistência e API.
- `game_data/`: conteúdo YAML validado; conteúdo comum novo não exige alteração da engine.
- `frontend/`: command center desktop, fonte TypeScript e saída browser mínima.
- `docs/`: arquitetura, regras de design, data-driven e decisões.

O slice deliberadamente para antes de combate, colonização avançada, diplomacia e logística entre planetas.

## Foundation correctness

Energia suficiente cobre 100% da produção. Workforce usa população menos tripulação;
população ociosa não é a oferta de trabalho. Cada receita consome seus inputs uma vez
e gera todos os outputs. O avanço offline integra a produção entre conclusões de
construção, pesquisa e chegada; esgotamento de insumos também delimita a produção.

Na interface: use **Planet** para construir o processador, **Research** para pesquisar
engenharia orbital e **Shipyard** para montar a nave. Em **Galaxy**, selecione um
sistema no mapa, uma nave/frota, compare os três regimes e envie. Depois da chegada,
a mesma frota aceita nova ordem partindo de sua posição atual. Filas em andamento são
sincronizadas a cada 15 segundos enquanto a página está visível; não existe tick no servidor.

Arquétipos estelares/planetários e regimes de viagem continuam em YAML. PostgreSQL
armazena referências por ID, não cópias das definições. IDs persistidos removidos ou
combinações incompatíveis causam erro explícito no startup e na leitura.
Veja [política de snapshots e transações](docs/persistence.md).

JSON persistence foi removida do runtime. O banco inicia uma partida nova; não há
importador de `state.json` nesta etapa. Arquivos antigos não são alterados nem lidos
automaticamente. Helpers JSON existem somente em fixtures de testes de regressão.

## Verificação

`industrial_capacity` é a capacidade industrial nominal do processador; não é uma
fila nem altera durações. `construction_slots` limita obras simultâneas (1 no distrito
civil inicial); `shipyard_slots` limita naves em montagem (1 por estaleiro).
Pesquisa consome `remaining_work` à taxa científica efetiva, afetada por energia e
workforce. Seu ETA é recalculado; com cobertura zero fica pausada. Obras e montagem
de naves mantêm duração fixa após a validação inicial.
Pesquisa pausada e `remaining_work` persistem no PostgreSQL.

```bash
python -m unittest discover -s tests -v
python -m compileall -q starz scripts tests
python scripts/validate_game_data.py
python scripts/check_frontend.py
npm run typecheck
npm run build
npm test
node --check frontend/app.js
ruff check starz scripts tests  # opcional, quando Ruff estiver instalado
```

Os testes unitários funcionam sem banco; a integração é ativada explicitamente:

```bash
export TEST_DATABASE_URL='postgresql+psycopg://starz:starz_dev_only@localhost:5432/starz'
python -m unittest discover -s tests -v
docker compose config --quiet
docker compose build
docker compose up -d --wait
docker compose exec app alembic upgrade head
python scripts/smoke_postgres.py
```

Integração cria schemas temporários `starz_test_<uuid>` e remove somente esses schemas;
o usuário do banco de teste precisa de permissão CREATE SCHEMA. Nunca use banco de
produção para testes. Sem `TEST_DATABASE_URL`, os testes PostgreSQL são marcados skipped.
O smoke HTTP exige partida nova, leva alguns minutos, para/reinicia a app durante
construção/viagem e recria o Compose sem apagar o volume. Deixa a frota em C para inspeção.
`tests/test_api.py` preserva o contrato HTTP sem banco; `tests/test_postgres.py` cobre
o adaptador real, rollback, constraints, concorrência e progresso offline.
O JavaScript publicado é gerado por TypeScript; não edite `frontend/app.js` manualmente.
Veja [frontend.md](docs/frontend.md) para views, atualização e princípios visuais.
