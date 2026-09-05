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
duplicar permissões no JSON. Remover `effects` e `modify_production` sem implementação
fecha o contrato sem inventar um framework de efeitos. Requirements aceitam apenas
tecnologias concluídas e distritos construídos.

## D009 — Migração do catálogo procedural

Quatro arquétipos estelares e um planetário preservam os ranges do slice; os perfis
não pretendem ser classificações astrofísicas rigorosas. Ordem estável por ID e
catálogo explícito substituem conteúdo hardcoded. Não prometemos o mesmo mundo da
versão anterior: a nova seleção e precisão alteram propriedades geradas. JSON mantém
o schema e pode ser carregado; novos testes de balanceamento devem usar partida nova.

## D010 — Compilação frontend e serialização local

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

Manter `Technology.duration` como trabalho à taxa nominal 1 evita renomear conteúdo
desnecessariamente. `remaining_work` é autoritativo, `complete_at` é previsão dinâmica.
Pesquisa pode ser iniciada com laboratório sem cobertura e permanecer pausada.
Estado legado converte prazo restante em trabalho usando a taxa nominal no último
estado salvo; não reconstrói mudanças históricas não registradas. Slots antigos
excedentes são preservados até terminar e impedem novos inícios enquanto ocupados.
