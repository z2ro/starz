# Architecture

StarZ usa um monólito modular:

```text
FastAPI (api.py)
  -> simulation.py (state, timestamps, rules)
      -> universe.py (seed + coordinates)
      -> data.py (YAML + Pydantic)
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
