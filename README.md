# StarZ

StarZ é uma fundação jogável de estratégia espacial persistente: um sistema inicial, economia curta, pesquisa, estaleiro e viagem com regimes de propulsão.

## Rodar

```bash
python -m unittest discover -s tests -v
python -m starz --reload
```

Abra `http://127.0.0.1:8000`. O estado fica em `state.json` e avança por timestamps quando a aplicação é consultada novamente.

## Estrutura

- `starz/`: engine determinística, catálogo data-driven, persistência e API.
- `game_data/`: conteúdo YAML validado; conteúdo comum novo não exige alteração da engine.
- `frontend/`: command center desktop, fonte TypeScript e saída browser mínima.
- `docs/`: arquitetura, regras de design, data-driven e decisões.

O slice deliberadamente para antes de combate, colonização avançada, diplomacia e logística entre planetas.
