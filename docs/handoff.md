# STARZ — Handoff atualizado

Atualizado em **15/11/2026** (terceira atualização do dia). Branch: `experiment/persistent-universe`.
Checkpoint de implementação mais recente: **`432ebc8`** (Instalações unificada, demolição, loading e Galáxia; ver seção 5). Este documento resume o trabalho acumulado e o ponto de retomada; não substitui contratos, código ou evidências de execução.

## 1. Orientação para a próxima sessão

- STARZ é um jogo multiplayer persistente de estratégia espacial, inspirado na experiência de administração de império do OGame. Não é mais uma campanha de turnos.
- Ler [AGENTS.md](../AGENTS.md), [design system](design/starz-master-design-system.md) e [política de QA](development/local-qa.md).
- Para gameplay, ler o [GDD](game-design/STARZ-GDD-v1.md), o [índice de decisões](game-design/README.md) e o contrato do subsistema. `APPROVED`, `IMPLEMENTED`, `TESTED` e `BALANCED` não são equivalentes.
- Não reconstruir Research, Combat, Stargrave, shell ou renderizadores que já funcionam. Preservar autoridade Python/PostgreSQL, autenticação, isolamento e idempotência.
- Não resetar saves, volumes ou bancos existentes. A dispensa de compatibilidade com saves antigos descartáveis não autoriza apagar dados.
- Não executar `qa:full` automaticamente. Classificar risco e usar o menor escopo suficiente; não repetir testes aprovados sem alteração relevante.
- Não fazer merge, deploy, force push ou abrir PR automaticamente. Push exige autorização; o responsável autorizou publicar este handoff e os commits locais atuais.

## 2. Sistemas acumulados

| Área | Estado e referência |
|---|---|
| Universo persistente | Contas/sessões independentes, colônias, produção, pesquisa, construção e missões por timestamps; autoridade no servidor. [Universo persistente](persistent-universe.md). |
| Economia e logística | Recursos, energia, trabalhadores, produção, transporte e entregas integrados ao estado dos planetas. Não foram alterados nas últimas tarefas visuais. |
| Navegação e UX | Shell/HUD/sidebar compartilhados; organização por Planeta, Tecnologia, Espaço e Império; ações contextuais e layouts compactos. [Contrato UX](ux/design-contract.md), [primeira sessão](ux/persistent-first-session.md). |
| Design system | Identidade industrial pixel art, componentes e tokens compartilhados, referência Overview. [Contrato visual](design/starz-master-design-system.md). |
| Research | Research 2.0 estabeleceu três domínios, cinco tiers, infraestrutura científica e filas independentes. Research 3.0 adicionou 16 descobertas, preservando os 44 IDs anteriores: 60 pesquisas. [Research 3](game-design/research-3.md). |
| Defesa e inteligência | Defesas locais, munição, combate planetário, reconhecimento, espionagem e relatórios persistentes já integrados. Não inferir conhecimento inimigo nem expor snapshots privados. |
| Combat 3.0 | Doutrinas, escoltas reais, guerra eletrônica, perfil antiescudo e interdição integrados ao resolvedor de seis salvas. Coeficientes experimentais. |
| Stargrave | Entidade excepcional, captura estelar, módulos físicos, cinco fases de construção, subsistemas, energia, movimento orbital, combate, destroço selado, custódia e destinos implementados no escopo suportado. Não é um hull convencional. |
| Galáxia | Mapa espacial e cena orbital; identidade de sistemas/planetas, propriedade autorizada, câmera, escala estelar, seleção e destinos. Coordenadas e mecânicas do servidor preservadas. [Galaxy 2](galaxy-2.md). |
| Temperaturas | Apresentação em Celsius por utilitário compartilhado; armazenamento e contratos científicos mantêm suas unidades originais. |
| Máquinas de estado | Inventário de fluxos e correção de tratamento de erros de sessão. Não foi introduzido um novo motor global de estados. [Inventário](development/state-machines.md), commit `ffd94bc`. |
| Infraestrutura de agentes | Skills locais selecionadas/auditadas, skill própria STARZ, contratos visuais e QA local com seleção/cache. [QA](development/local-qa.md), [auditoria upstream](../.agents/skills/UPSTREAM.md). |

### Research, Combat e Stargrave: limites reais

A execução P0–P6 está detalhada em [implementação STARZ 3.0](development/starz-3-implementation.md); os resultados por critério estão na [matriz de aceitação](development/starz-3-acceptance.md).

Decisões operacionais adicionais autorizadas durante a implementação:

- Montagem no sistema de captura, módulos enviados fisicamente de colônia própria e retirada da estrela apenas ao concluir Estabilização.
- Tiro dirigido condicionado a reconhecimento confirmado vigente; Contenção protegida até escudo zerado e dano externo elegível.
- Bombardeio com preparação, verificações de guerra/superioridade e cancelamento por incapacidade; sem apagar planeta, colônia ou conta.
- Reserva energética persistente e limitada, com piso de contenção; unidades seladas não regeneram energia militar.
- Custódia orbital baseada em presença real, janela e revalidação; cessão bilateral não transfere estoques alheios nem teleporta o núcleo.
- Retirada logística física de núcleo cedido como parte da reconstrução, não um quarto destino final.

Continuam delimitados: presença/combate geral em espaço profundo, extinção autoritativa de império e contratos civis ainda não aprovados. Offline não significa império extinto. Não inventar regras para desbloquear esses casos. Balanceamento permanece experimental, não definitivo.

O `full` histórico retornou **1**; houve complementos direcionados e correções posteriores. Não apresentar a evidência composta como uma nova execução integral aprovada. A matriz ainda contém critérios parciais/bloqueados além dos quatro fechamentos abaixo.

## 3. Hardening e migrations já concluídos

Estes resultados são históricos, registrados em testes e na matriz; não foram reexecutados na tarefa visual/documental atual.

| Critério | Estado registrado | Evidência/checkpoint |
|---|---|---|
| T39 — alteração de custódia por terceiro | PASS | Teste sintético `f7fcb4b`; integração PostgreSQL com nova sessão e invariantes `1d4bda4`. |
| T47 — privacidade HTTP | PASS | Três sessões autenticadas, PostgreSQL descartável, snapshots/IDs privados e ausência de efeitos indevidos; `8229826`. |
| T64 — privacidade da cessão no navegador | PASS | Chromium, três contextos autenticados, backend real e PostgreSQL temporário; `644b958`. |
| T63 — isolamento entre universos | PASS | Caminhos autoritativos e constraints SQL; correção `06df41b`. |

Falha concreta T63: FKs independentes em `universe_order` permitiam combinar império e universo incompatíveis. A FK composta `fk_universe_order_empire_universe` liga `(empire_id, universe_id)` a `empire(id, universe_id)`.

Migration incremental `d07000000001`, após `d06f00000001`: verifica inconsistências e recusa aplicação sem remapear/apagar registros; preserva ordens válidas; downgrade remove apenas a nova FK. Houve também ajuste na migration histórica `d02b00000001`.

O checkpoint `0ea9156` adicionou [testes do histórico de migrations](../tests/test_order_migration_history.py), para instalação limpa e upgrade incremental. Consultar esses testes e os de custódia antes de repetir validações. **Isso não significa que a migration foi aplicada ao ambiente local do responsável.**

## 4. Instalações: evolução entregue

A rota é `#/development`, em **Planeta → Instalações**.

1. Informações reais de nível atual/próximo, ganho incremental e disponibilidade (`ef4207f`).
2. Detalhes compactados: ganho sem duplicação, energia/trabalhadores/tempo e custos destacados (`58dbcb4`, `412e088`).
3. Lista substituída por grade ilustrada, painel com arte ampliada, filtros e seleção preservados (`acabd59`).
4. Dez WebPs individuais de 224×224 integrados, sem ampliar o antigo atlas de 64×64 (`a5b7f33`, `d3ed670`).
5. Microanimação localizada no detalhe do extrator (`88ee6f2`); não confundir esse caminho legado com a nova animação geométrica 3D.

Assets usados pela interface ficam em `frontend/assets/buildings/concepts/`, importados pelo Vite. A branch de arte foi utilizada como fonte seletiva, sem merge integral.

| Instalação | Arquivo WebP |
|---|---|
| Extrator de ferrita | `ferrite_extractor.webp` |
| Distrito civil | `civil_district.webp` |
| Centro de Pesquisa Planetário | `planetary_research_center.webp` |
| Estaleiro orbital | `orbital_shipyard.webp` |
| Laboratório de Engenharia Civil | `civil_engineering_lab.webp` |
| Refinaria de combustível | `fuel_refinery.webp` |
| Instituto de Ciência Fundamental | `fundamental_science_institute.webp` |
| Manufatura avançada | `advanced_manufacturing.webp` |
| Complexo de Pesquisa Militar | `military_research_complex.webp` |
| Processador de materiais | `materials_processor.webp` |

Não há registro de aprovação de uma normalização pixel-perfect de todo o catálogo. Não assumir que o tamanho 224×224 garante uma grade de pixels artisticamente consistente.

## 5. Instalações e superfície unificadas

Desde `ce9f547` a rota `#/development` tem **uma única tela**, no formato pedido pelo responsável (referência: tela de Recursos do OGame):

| Região | Implementação | Comportamento |
|---|---|---|
| Superfície | `PlanetDiorama.tsx` + `ColonyBuilding.ts` | Cena 2.5D no topo da coluna principal; clicar numa construção seleciona a instalação. |
| Faixa de itens | `DevelopmentView.tsx` (`installation-strip`) | Miniaturas de tudo que pode ser construído, respeitando os filtros: nível em âmbar, canto verde quando pronto, cinza quando falta requisito. |
| Detalhe | `DevelopmentView.tsx` (`ux-inspector`) | Painel à direita com arte emoldurada, etiqueta de nível, ganhos, blocos de demanda, custos, construir e demolir. |

- O seletor de visualização e a **Colônia 2D foram removidos** a pedido do responsável. `LivingColonyScene.tsx` e seu teste foram apagados; a arte em `frontend/assets/buildings/living-colony/` continua no repositório, sem uso.
- A grade de cartões antiga permanece apenas como **fallback automático sem WebGL** (é também o caminho exercitado pelos testes em jsdom).
- `solar_field` e `volatile_well` não têm arte de conceito e aparecem com ícone genérico na faixa.

### Superfície 2.5D: reescrita em 15/11/2026 (`d6a6cdc`)

A versão `b3fa7c3` foi rejeitada pelo responsável ("muito feio"). Uma primeira tentativa de ilha flutuante com céu, inspirada diretamente em `referencias/Water-Polo.html`, também foi rejeitada ("não parece mais o planeta") e não foi commitada. O responsável então entregou um briefing de direção artística ("Planetary Surface 2.5D — A Civilization Taking Shape") e aprovou a proposta resultante. O briefing não está no repositório.

Direção aprovada, em resumo: o planeta é o protagonista; nada de ilha flutuante, tabuleiro, sprites "adesivo" ou demonstração técnica; setores reconhecíveis; progresso visual derivado apenas de dados reais; sem novo gameplay, backend ou persistência.

O que está implementado:

- **Terreno do planeta real.** `DevelopmentView` deriva semente, família e parâmetros com `createVisualDescriptor` e passa `generation` ao diorama. O chão é amostrado com `samplePlanet`/`planetSurfaceColor`, os mesmos do globo da Visão geral. Sem identidade ou família, usa o preset da família derivada (ou `terran`) com o ID do planeta como semente.
- **Local de pouso determinístico**: primeira planície de terra firme entre candidatos semeados. A pegada da colônia é sempre terra; fora dela valem costa, oceano e biomas do gerador.
- **Relevo em colunas de 0,25**, plano sob a colônia, em terraços ao fundo e limitado entre a câmera e os edifícios. As bordas escurecem até o fundo `#020711`.
- **Pipeline de pixel aprovado** (`ShipPixelPipeline`, paleta padrão, contorno e dither), mirando cerca de 240 linhas de baixa resolução.
- **Câmera dimétrica 2:1** (azimute 45°, elevação 30°), sem rotação; zoom contínuo de 0,6× a 3×.
- **Natureza por bioma da célula** (árvores, arbustos, rochas, formações minerais, gelo), nunca sobre setores, vias ou à frente dos edifícios.
- **Doze instalações com modelo procedural e microanimação**: as três anteriores mais `solar_field`, `processor`, `volatile_well`, `manufacturing`, `orbital_shipyard` (terminal em solo), `research_lab`, `civil_lab`, `military_lab` e `fundamental_lab`. `orbital_battery` não tem modelo, pois Instalações a oculta no modo persistente.
- **Setores fixos** (`sites`): indústria na fileira da frente, núcleo civil, refinaria, energia e terminal orbital no meio, ciência ao fundo. As três posições originais foram preservadas.
- **Vias só entre o que existe**: via principal, via de fundo para a fileira científica, ligação entre elas e praça com mastro de sinal.
- **Seleção**: controlada por `DevelopmentView`; moldura ciano no solo para a instalação aberta no painel, quando construída.

Decisões assumidas por recomendação, sem resposta explícita do responsável: edifícios em geometria 3D em vez de sprites; estaleiro orbital como terminal em solo. O responsável viu o resultado e aprovou ("ficou muito bom").

Ainda **não** implementado da proposta aprovada: versões artísticas por faixa de nível (sugestão 1–3, 4–7, 8+, a confirmar; não foi encontrado nível máximo no código), estágios da colônia (posto, colônia, centro), zoom em três degraus, água animada, visual vulcânico derivado de `geological_activity` e modelo da bateria defensiva.

### Demolição de instalações (`ce9f547`)

Mecânica nova, pedida e parametrizada pelo responsável: **um nível por vez, imediata, sem reembolso**, com confirmação na tela. `Engine.demolish` e `POST /api/demolish`; contrato em [economy.md](game-design/economy.md).

Recusas no servidor (travas escolhidas na implementação, comunicadas ao responsável): instalação não construída; obra em andamento nela; último nível do Distrito civil; equipes de construção ou vagas de estaleiro fornecidas por ela em uso; habitação restante menor que a população. Energia e trabalhadores não bloqueiam. `orbital_battery` é recusada no modo persistente. Não há migration: o nível zero já era aceito pelo schema.

### Tela de loading (`ce9f547`)

`BootScreen` (planeta em pixel art com lua em órbita, logo, barra de varredura e fundo estrelado) substitui as duas telas de espera, em `SessionGate` e `AppShell`. Estilos em `frontend/styles.css`.

### Galáxia, abas e barra lateral (`432ebc8`)

Resultado de uma análise visual geral pedida pelo responsável, que aprovou começar pela Galáxia.

- Mapa: nebulosa gerada por código (`nebulaImage`), poeira com tons e cintilação, estrelas coloridas por classe com halo, anel pulsante no sistema natal e rota tracejada das frotas em trânsito.
- Inspetor do sistema: blocos de dados, linhas de planeta com miniatura (`PlanetThumb`, mesmo gerador e semente da cena orbital) e ação no rodapé.
- **Abas**: um estilo único para todo `.tabs[role=tablist]` em `master-ui.css`. Afeta todas as telas.
- Barra lateral: o selo "Universo persistente" é ocultado abaixo de 960 px de altura, onde cobria o item Mercado.

Recomendações da análise ainda não feitas: diagrama de cadeias em Produção; linhas, ícones e cores por domínio na árvore de Pesquisa; levar o padrão de painel de detalhe a Estaleiro e Pesquisa; estilo único para selects, campos e barras de rolagem; arte de `solar_field` e `volatile_well`.

## 6. Validação recente e evidências locais

### Sessão de 15/11/2026, noite (`ce9f547`, `432ebc8`)

- `tsc --noEmit`: aprovado após cada etapa.
- `tests/test_demolish.py`: 3 testes aprovados rodando só o motor (Python 3.13, fora do Docker). **A rota `/api/demolish` não foi exercitada com banco**, porque a imagem do app no Docker Desktop ainda não foi reconstruída; até lá o botão de demolir retorna erro.
- Revisão visual no navegador em 1456×900/960: Instalações, painel de detalhe, prévia da tela de loading, Galáxia e abas de Produção.
- **Vitest continua sem rodar** no ambiente do agente. Precisam rodar: `planet_diorama`, `colony_building`, `development_compact` (depende do fallback sem WebGL) e os testes `galaxy_*`.
- Não revisados: Frotas, Defesas, Diplomacia e Colônias com o novo estilo de abas; celular; painel de Instalações abaixo de 850 px de altura (conteúdo paginado); cores de estrela além da classe G; rotas de frota (sem frota em trânsito na conta de teste).

### Sessão de 15/11/2026 (`d6a6cdc`)

- `tsc --noEmit`: aprovado.
- Revisão visual no navegador, pelo servidor de desenvolvimento, com a conta de teste local: planeta Z457-2 com três instalações reais e, por um modo de pré-visualização temporário já removido, com as doze. Sem erros no console.
- **Vitest não foi executado**: o worker não iniciou no ambiente do agente. `tests/planet_diorama.test.tsx` foi alterado (o exemplo de instalação sem modelo passou de `processor` para `orbital_battery`) e precisa ser rodado, junto de `tests/colony_building.test.tsx`, que ainda cobre só os três modelos originais.
- Não houve `qa:full`, captura em 390×844, teste de movimento reduzido nem medição de desempenho nesta sessão. O terreno gera cerca de 26 mil células na criação da cena.

### Sessão anterior (`b3fa7c3`), histórico

Risco médio, frontend localizado. Usamos ferramentas existentes com filtros direcionados porque o runner geral ampliaria desnecessariamente o escopo. Não houve `qa:full`, PostgreSQL, alteração de backend ou benchmark de GPU nesta passagem.

- `npm run build`: inclui `npm run typecheck`; aprovado após corrigir a tipagem da coleção de geometrias para `THREE.BufferGeometry[]`.
- `npx vitest run --config vitest.config.ts tests/planet_diorama.test.tsx tests/colony_building.test.tsx`: cinco testes passaram na primeira passagem. Após reforçar os testes dos modelos, um limite do vapor falhou; corrigido o deslocamento invisível e reexecutados os três testes de modelos, todos PASS. Os dois testes de determinismo/níveis não afetados não foram repetidos.
- Chromium 1440×900 e 390×844: seleção, zoom, reset, retorno à grade, fallback WebGL e ausência de erros JavaScript passaram.
- Verificação adicional: movimento reduzido permanece estático; seleção por teclado; ausência de overflow documental no caso desktop; nenhum edifício quando os níveis estão vazios.
- `git diff --check`: aprovado.
- Testes de modelos cobrem transformações determinísticas, limites, identificação selecionável e liberação de geometrias/materiais.

Artefatos **locais, ignorados pelo Git**, em `.qa/runs/colony-art/`:

- `before-desktop.png`, `before-mobile.png`, `reference.png`.
- `scene-1440.png`, `scene-390.png`, `animation.webm`.
- `build.log`, `tests.log`, `models.log`, `browser.log`, `accessibility.log`.
- Scripts locais `check.cjs` e `accessibility.cjs`, reaproveitando `scripts/visual-qa/browser.cjs` e fixtures existentes.

As capturas usam dados sintéticos e APIs interceptadas para validar apresentação. Não comprovam gameplay multiplayer real. O resumo `buildings=0` do script principal é impresso **depois de retornar à grade**, quando o diorama já desmontou; não significa ausência de prédios na captura. A presença/seleção é verificada antes.

Os artefatos não estarão disponíveis automaticamente em outro clone/GitHub. Não tratar seus caminhos como evidência pública anexada. Permanecem avisos de chunk grande no build e serialização de `workforce` nas fixtures; não foram corrigidos fora do escopo. Não houve teste em dispositivo móvel físico nem certificação de desempenho.

## 7. Ambiente local e segurança de retomada

URL: **http://localhost:8030/#/development**. Selecionar **Superfície 2.5D** para a nova cena ou **Colônia 2D** para a composição ilustrada.

Última verificação: containers existentes saudáveis; `/` e `/health` responderam HTTP 200.

- App: `starz-persistent-universe-universe-app-1`.
- PostgreSQL: `starz-persistent-universe-universe-db-1`.
- Compose existente: `compose.persistent.yaml`. Não criar outro projeto permanente.
- Revisão observada do banco local: **`d06f00000001`**.
- Head das migrations da imagem existente: **`d06f00000001`**.
- O checkout contém `d07000000001`; essa migration **não foi aplicada ao banco do responsável nesta sessão**.

A inicialização existente executa `alembic upgrade head` antes do servidor. Antes de reconstruir/recriar a imagem, verificar a diferença de schema e a autorização necessária. Não confundir iniciar os containers atuais com atualizar o backend ao HEAD.

Nesta retomada, iniciamos banco e app existentes após confirmar que a revisão da imagem coincidia com a do banco. Nenhum reset, novo volume ou migration adicional foi necessário.

Para atualizar apenas o frontend compilado, foi usado:

```bash
docker cp frontend/dist/. starz-persistent-universe-universe-app-1:/app/frontend/dist/
```

Isso preserva o backend existente, mas é uma atualização no filesystem do container: recriá-lo perde essa cópia. O código-fonte permanece versionado; reconstruir a imagem exige tratar migrations separadamente. Não afirmar que o backend local corresponde a todos os commits atuais apenas porque o frontend está atualizado.

### Ambiente no Windows (Docker Desktop), criado em 15/11/2026

O ambiente descrito acima vive no Docker do WSL e não foi tocado. Com autorização do responsável, foi criado um segundo ambiente no Docker Desktop do Windows a partir de `C:\Users\zero\Documents\repos\starz`:

```powershell
docker compose -f compose.persistent.yaml up -d --build --wait
```

- Banco **novo e vazio** (volume `universe-save` do Docker Desktop), já na revisão `d07000000001`. Não contém a partida do WSL.
- Mesmas portas (8030 e 5545): os dois ambientes não sobem ao mesmo tempo.
- Conta de teste `qa_claude`; a senha está em `.qa/local-test-account.txt` (ignorado pelo Git).
- Servidor de desenvolvimento com hot reload, apontando para o app em 8030, em `http://localhost:5173/static/`:

```powershell
docker run --rm -it -p 5173:5173 -e STARZ_API=http://host.docker.internal:8030 -v "${PWD}:/app" -w /app node:22-bookworm-slim sh -c "npm ci && npx vite --config .qa/vite.dev.config.ts"
```

Mudanças de backend (por exemplo `/api/demolish`) só valem depois de reconstruir a imagem com o comando `docker compose ... up -d --build --wait` acima.

`.qa/vite.dev.config.ts` é local e ignorado pelo Git. O comando instala `node_modules` com binários Linux na pasta do repositório; rodar `npm` direto no Windows exige novo `npm ci`. A imagem do app não recebe as mudanças de frontend até ser reconstruída.

No checkout do Windows, usar `git -c core.autocrlf=true` (ou configurar `core.autocrlf`) quando o Git rodar em Linux sobre essa pasta; sem isso todos os arquivos aparecem modificados por fim de linha.

## 8. Arquivos para retomar o trabalho visual

- [DevelopmentView](../frontend/src/universe/DevelopmentView.tsx): alternância das três apresentações e construção existente.
- [PlanetDiorama](../frontend/src/universe/PlanetDiorama.tsx): terreno do planeta, setores (`sites`), vias, natureza, câmera, seleção, render loop e descarte.
- [ColonyBuilding](../frontend/src/universe/ColonyBuilding.ts): modelos e animações dos doze edifícios.
- [DevelopmentView](../frontend/src/universe/DevelopmentView.tsx) (tela unificada, faixa de itens, detalhe, demolição) e seus estilos no fim de [compact-workspace.css](../frontend/src/pixel-command/compact-workspace.css).
- [SpatialGalaxyMap](../frontend/src/galaxy/SpatialGalaxyMap.tsx), [galaxyVisuals](../frontend/src/galaxy/galaxyVisuals.ts), [PlanetThumb](../frontend/src/galaxy/PlanetThumb.tsx) e [galaxy.css](../frontend/src/galaxy/galaxy.css).
- [BootScreen](../frontend/src/components/shell/BootScreen.tsx).
- [planetGenerator](../frontend/src/planetlab/planetGenerator.ts) e [VisualStateAdapter](../frontend/src/visual-state/VisualStateAdapter.ts): fonte do terreno e da semente; não foram alterados.
- [LivingColonyScene](../frontend/src/universe/LivingColonyScene.tsx): composição ilustrada independente.
- [Estilos compactos](../frontend/src/pixel-command/compact-workspace.css).
- [Testes do diorama](../tests/planet_diorama.test.tsx) e [testes dos modelos](../tests/colony_building.test.tsx).

A pasta `referencias/` está **não rastreada** e pertence ao responsável. Não foi adicionada ao commit/push. Não apagá-la nem presumir que estará disponível em outro clone.

## 9. Próximo passo recomendado, sem autorização implícita

1. Reconstruir a imagem do app e testar a demolição de ponta a ponta na conta de teste.
2. Rodar os testes de frontend listados na seção 6 e corrigir o que aparecer.
3. Conferir as telas não revisadas com o novo estilo de abas.
4. Continuar a análise visual, uma tela por vez e com avaliação do responsável: Produção, Pesquisa, painéis de Estaleiro e Pesquisa.
5. Na Superfície 2.5D: versões por faixa de nível (confirmar faixas), estágios da colônia, obra em andamento visível no lote, zoom em degraus.

Decisões ainda sem resposta explícita do responsável: edifícios em geometria 3D; estaleiro como terminal em solo; visual vulcânico; bateria defensiva na superfície.

Os commits `d6a6cdc` e `0b51421` foram publicados pelo responsável. `ce9f547`, `432ebc8` e esta atualização do handoff são locais: **não houve push**.
