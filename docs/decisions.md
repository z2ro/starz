# Decisions

## D001 — Python + FastAPI + Pydantic

Escolhidos para manter a engine determinística, tipada e testável com poucas dependências. FastAPI é apenas adaptador HTTP.

## D002 — JSON local no vertical slice

O requisito é provar persistência offline, não infraestrutura de produção. `state.json` torna o fluxo local reproduzível; banco relacional entra quando houver múltiplos jogadores, concorrência e autenticação.

## D003 — CSS planetário antes de WebGL

Uma esfera estilizada com markers prova a relação entre desenvolvimento e visualização sem deixar renderização dominar a fundação. A API já entrega dados físicos e distritos para uma futura camada 3D.

## D004 — Sistema em coordenadas inteiras

Distância euclidiana em uma grade é suficiente para provar alcance, ETA e combustível. Rotas, hazards e ambientes entram quando existir conteúdo que use essas decisões.

## D005 — Estado persistente por timestamps

Construção, pesquisa e viagem não exigem tick exposto ou atualização por segundo. A engine resolve progresso no próximo acesso.
