# StarZ

StarZ é uma fundação jogável de estratégia espacial persistente: um sistema inicial, economia curta, pesquisa, estaleiro e viagem com regimes de propulsão.

## Rodar

```bash
python -m pip install -e '.[test]'
npm ci
npm run build
python -m unittest discover -s tests -v
python -m starz
```

Abra `http://127.0.0.1:8000`. O estado fica em `state.json` e avança por timestamps quando a aplicação é consultada novamente.

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

No painel existente: construa o processador, pesquise engenharia orbital, construa
o estaleiro e monte a nave. Use **Atualizar estado** para acompanhar conclusões.
Selecione a nave/frota, informe o destino, compare regimes e envie. Depois da chegada,
a mesma frota aceita nova ordem partindo de sua posição atual.

Arquétipos estelares/planetários e regimes de viagem estão em YAML. O JSON anterior
continua carregável, incluindo frotas ARRIVED. A geração física mudou nesta migração:
sistemas antigos regenerados podem mudar de propriedades; uma partida nova é indicada
para comparar balanceamento, preservando uma cópia do estado anterior se necessário.

## Verificação

`industrial_capacity` é a capacidade industrial nominal do processador; não é uma
fila nem altera durações. `construction_slots` limita obras simultâneas (1 no distrito
civil inicial); `shipyard_slots` limita naves em montagem (1 por estaleiro).
Pesquisa consome `remaining_work` à taxa científica efetiva, afetada por energia e
workforce. Seu ETA é recalculado; com cobertura zero fica pausada. Obras e montagem
de naves mantêm duração fixa após a validação inicial.
JSON antigo com pesquisa ativa é convertido automaticamente no próximo avanço.

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

`tests/test_api.py` executa o fluxo HTTP até duas viagens e verifica o JSON restaurado.
O JavaScript publicado é gerado por TypeScript; não edite `frontend/app.js` manualmente.
