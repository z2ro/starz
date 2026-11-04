# STARZ — Concordat / Complete Game Experiment

Branch `experiment/complete-game`, baseada em `c011ab5936c8c1b7505d6e54cf496be0712a9985`.
Single-player local, por turnos, com autosave PostgreSQL. Não é uma migração do save
original nem uma instalação pública. O conteúdo-base e os laboratórios permanecem
acessíveis; a campanha usa o overlay `campaign_data/`.

## Começar de um checkout limpo

Requisitos: Docker + Compose. Nenhum Python/Node local é necessário para jogar.

```bash
git switch experiment/complete-game
docker compose -f compose.experiment.yaml up -d --build --wait
```

Abra **http://localhost:8020/#/campaign**.
O projeto Compose `starz-complete-game` possui serviços `campaign-app` e `campaign-db`,
porta PostgreSQL 5544 e volume próprio `starz-complete-game_campaign-save`. Não usa
os containers, portas 8000/8010 ou volumes do STARZ original. As portas são vinculadas
a 127.0.0.1. A senha de desenvolvimento não serve para hospedagem pública.

```bash
docker compose -f compose.experiment.yaml down          # preserva partidas
docker compose -f compose.experiment.yaml up -d --wait  # retoma a última selecionada
```

**Não use `down -v`** se quiser preservar os saves experimentais. Nenhum comando de
reset é necessário. Nova campanha cria outro universo; o seletor de partidas permite
retomar uma anterior. A seleção persiste no banco. Existe um save ativo por servidor;
carregar outra partida muda o contexto de todas as abas. Não há autenticação/multiplayer.

## Como jogar

O relógio para enquanto você decide ou fecha o navegador. Cada turno avança cinco
minutos da engine econômica existente e restaura **quatro ordens**. Construir,
pesquisar, montar, viajar, negociar, atacar, reparar e transportar custam uma ordem.
Consultar rotas, inspecionar e decidir eventos não custam ordens. Resolver um evento
é obrigatório antes do próximo turno; sempre existe uma alternativa sem custo material.

A abertura guiada mostra o próximo passo e as instruções:

1. Construa um **processador**, **poço de voláteis** e **refinaria**; encerre turnos
   para concluir obras. Mineração → processamento → manufatura gera insumos renováveis.
2. Pesquise **Engenharia orbital**, construa estaleiro e uma **Horizon**. As outras
   views continuam úteis para construção, pesquisa, catálogo naval e mapa completo.
3. Faça levantamentos dos sinais do setor. **Volte ao HOME antes de lançar a missão
   colonial**: pessoas e pacote saem de uma colônia de origem real. Três sinais
   habitáveis são selecionados deterministicamente; o índice do planeta só aparece
   depois do levantamento. As regras físicas de viabilidade continuam valendo.
4. Habitação aumenta slots e o teto populacional; população cresce a cada turno.
   Energia e workforce limitam a produção. Manufatura compete por ligas: não consuma
   toda sua produção sem ampliar extração/processamento. Desmonte níveis dispensáveis
   para recuperar metade dos materiais e liberar trabalhadores; a infraestrutura
   básica de recuperação não pode ser totalmente removida.
5. **Wayfarer** transporta um recurso por entrega (mínimo 20, máximo declarado no
   casco), entre mundos próprios. A carga sai do estoque local no lançamento e só
   entra no destino quando a frota chega. Uma nave não aceita dois serviços simultâneos.
6. Contate as potências com uma exploradora. Envie emissários e firme alianças, ou
   leve uma força-tarefa às capitais e ataque. O jogo não cria órbitas/posições fictícias.
7. Avance na árvore científica, preserve descobertas e inicie a contenção Stargrave.

A interface informa ordens restantes, prazo, integridade, custos, requisitos e eventos.
O turno pode ser encerrado de qualquer view; a ação global usa o homeworld, mesmo
quando uma colônia está selecionada. Todos os mundos avançam na mesma transação.

## Regras da campanha

### Economia, tecnologia e funções navais

- Extratores de minério e voláteis, processadores, refinarias e manufatura são
  receitas YAML executadas por `economy.produce`, não contadores do frontend.
- Combustíveis são estoques locais. Ao sair de um mundo abastecido, a frota paga
  a ida e carrega **duas viagens equivalentes de reserva**. Fora dos mundos próprios
  usa essa reserva. Manutenção estacionada custa `massa × 0,02` por turno; sem
  combustível, perde 15 de integridade. A nave é destruída ao chegar a zero.
- As nove tecnologias: Engenharia orbital, Propulsão nuclear, Automação industrial,
  Carta interestelar, Rede científica, Doutrina naval, Arquitetura capital,
  Operações embarcadas e Contenção estelar. Custos, trabalho, requisitos e desbloqueios
  são validados pelo catálogo. Descobertas podem reduzir 300 de trabalho de uma
  pesquisa ativa; são gastas de verdade e também necessárias ao objetivo final.
- Horizon é uma exploradora econômica. Wayfarer tem 180 de carga. Odyssey ganha
  duas descobertas extras em levantamentos novos e pode produzir duas por análise
  local (20 voláteis + 8 componentes). Classes militares têm poder distinto.
- Atlas combina carga com dez alas abstratas (+5 poder cada). Não há entidades
  Interceptor/Fighter/Bomber independentes, simulação de armamentos ou módulos.
- O combate é estratégico e determinístico: poder dos hulls + alas, multiplicado
  pela integridade individual e por 1,15 com Doutrina naval. A força selecionada
  deve estar pronta na capital inimiga; até doze naves podem lutar juntas.
  Poder >= defesa subjuga a potência. Dano por nave é `clamp(ceil(defesa/poder×45),12,100)`.
  Baixas são removidas das tabelas de naves/frotas/associações, liberando tripulação.
  Navegação mantém uma nave por entidade de frota; forças-tarefa agrupam várias
  dessas entidades apenas para a batalha. Reparos locais custam 15 ligas/5 componentes
  e recuperam 45 de integridade, até 100.

### Rivais e decisões

Liga Helion e Pacto Obsidian têm tesouro, indústria, força e territórios persistentes.
Recebem produção, investem em indústria/defesa e expandem a cada oito turnos quando
há fronteira livre. Evitam homeworld, colônias e sinais coloniais reservados.
São agentes estratégicos de orçamento/território; não duplicam a árvore de produção
planetária do jogador nem possuem modelos 3D de frotas individuais.

A partir do turno 16, potências não pacificadas atacam a capital a cada quatro turnos.
Dano = `max(0, ceil((força rival − defesa local)/6))`. Defesa local soma naves prontas
no homeworld e 12 por bateria. Aliados e potências subjugadas não fazem incursões.

Emissário: 15 componentes, +10 relação, ou +25 com Carta interestelar.
Aliança: Carta, relação 60 e 40 componentes. Rende 5 ligas/2 componentes por turno.
Comércio: relação 10 e cargueiro local operacional; 15 ligas por 45 voláteis/25 combustível
químico e +5 relação. A conquista é uma alternativa real aos tratados.

Eventos nos turnos 6, 12, 20 e 32 oferecem ciência vs materiais, refugiados vs reservas,
preparação vs danos e concessão vs escalada militar. A escolha é persistida e tem efeito
na engine. Nenhum ataque acontece offline.

### Vitória e derrota

**Vitória:** mantenha a cadeia industrial do homeworld; possua três mundos; pacifique
as duas potências por alianças ou conquista; conclua uma entrega colonial; preserve
três descobertas; pesquise Contenção estelar. No homeworld, invista 400 ligas e
150 componentes. Quatro turnos de estabilização consomem 25 ligas/10 componentes cada.
Falta de materiais pausa o projeto, mas não o prazo. Stargrave usa o modelo aprovado
como **megastrutura de contenção**, nunca como hull convencional com propulsor.

**Derrota:** integridade do homeworld chega a zero, população do homeworld chega a
zero ou o turno 60 termina sem estabilizar Stargrave. Não existe derrota artificial
por sair do navegador. Após o final, as ordens ficam bloqueadas e o save continua
inspecionável. Inicie outra campanha sem apagar o histórico.

## Arquitetura e validação

`Campaign` é uma linha JSONB versionada por império (atores, objetivos, saúde, eventos,
entregas e histórico limitado), com seleção de save persistida. Estado econômico,
planetas, pesquisas, naves e frotas continuam nas tabelas relacionais existentes.
O lock do império serializa ordens; erro desfaz custo, orçamento e alterações juntos.
`campaign.py` não importa ORM, renderer, relógio real ou API. Só o chamador avança tempo.
`observed_at` informa o relógio do snapshot à UI e ao VisualStateAdapter.

Validação focada, sem benchmark de GPU ou matrizes de screenshots:

```bash
npm ci
npm run typecheck
npm run build
.venv/bin/python scripts/validate_game_data.py --campaign
.venv/bin/python -m unittest tests.test_campaign -v
npx vitest run tests/campaign_view.test.tsx tests/planet_procedural.test.tsx tests/fleet_gameplay.test.tsx tests/ship_preview.test.tsx
# Schema descartável SOMENTE no banco experimental:
CAMPAIGN_TEST_DATABASE_URL='postgresql+psycopg://concordat:concordat_local_only@localhost:5544/concordat' .venv/bin/python -m unittest tests.test_campaign_db -v
docker compose -f compose.experiment.yaml exec -T campaign-app alembic check
.venv/bin/python scripts/campaign_smoke.py --url http://localhost:8020
```

O smoke cria partidas novas, usando apenas os endpoints normais: não injeta estoques,
não conclui pesquisas instantaneamente e não modifica objetivos. Uma trajetória
completa alcançou **vitória no turno 48**, outra foi **derrotada no turno 32** por inação;
o teste recarregou a vitória do PostgreSQL. Ele registra comandos e checkpoints em
`tmp/complete-game-qa/`. Repeti-lo adiciona saves, sem apagar os anteriores.

## Limites conhecidos

Balanceamento experimental, não uma campanha comercial. Uma seed foi jogada de ponta
a ponta para vitória e outra para derrota; não houve cobertura exaustiva de seeds ou
do caminho militar até o final. Combate/baixas e migração têm testes focados em SQL.
Não há batalha tática 3D, unidades individuais embarcadas, rotas automáticas de frete,
multiplayer, autenticação ou hospedagem pública. Rivais usam simulação estratégica
abstrata, não a mesma microeconomia local do jogador. O frontend ainda apresenta o
aviso conhecido de bundle >500 kB. GPU física e balanceamento de longo prazo não foram
avaliados. A aprovação artística final permanece humana.

Em uma árvore usada por um servidor antigo, não sobrescreva seu `frontend/dist`: use
o build Docker isolado acima ou outro checkout para compilar a experiência.

## Resultado da entrega

- Typecheck e build Docker passaram; os dois serviços experimentais ficaram healthy.
- 46 itens de conteúdo validados; 11 testes de regras, 1 teste SQL/migração e 27 testes
  React focados passaram. `alembic check` não encontrou diferenças pendentes.
- O smoke HTTP do build final repetiu vitória no turno 48 e derrota no turno 32,
  com carregamento da vitória persistida, sem injetar estado ou recursos.
- Chromium/SwiftShader verificou os finais salvos, uma construção real, o avanço
  de turno, canvas estável e a página em 1920×1080 e 390×844. O overflow mobile do
  HUD foi corrigido na origem; nenhuma aprovação artística foi automatizada.
- Capturas: `tmp/complete-game-qa/campaign-opening.png`, `campaign-first-order.png`,
  `campaign-victory.png`, `campaign-defeat.png`, `campaign-stargrave.png` e
  `campaign-mobile.png`. `browser.json` e `commands.json` contêm a evidência local.
- A aplicação experimental fica pronta com um save novo no turno zero; os saves
  de vitória/derrota permanecem disponíveis para inspeção. A branch de origem,
  os stashes, o banco e os serviços antigos foram preservados; o frontend compilado
  do host foi restaurado a partir do commit de origem. O experimento roda no Docker.
