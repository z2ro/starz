# STARZ — Handoff atualizado

Atualizado em **15/11/2026**. Branch: `experiment/persistent-universe`.
Checkpoint de implementação mais recente: **`b3fa7c3`**. Este documento resume o trabalho acumulado e o ponto de retomada; não substitui contratos, código ou evidências de execução.

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

## 5. Três visualizações coexistem

| Seletor | Implementação | Comportamento |
|---|---|---|
| Instalações | `DevelopmentView.tsx` | Grade, filtros, paginação, detalhes e construção com dados/ações existentes. |
| Superfície 2.5D | `PlanetDiorama.tsx` + `ColonyBuilding.ts` | Cena Three.js agora com geometria 3D procedural, câmera ortográfica fixa, pan/zoom/reset, seleção e fallback para grade. O rótulo histórico foi mantido. |
| Colônia 2D | `LivingColonyScene.tsx` | Fundo ilustrado sem prédios permanentes, três PNGs independentes e efeitos CSS; seleção retorna à grade com instalação escolhida. |

Todas usam `state.districts`: `civil_district`, `ore_extractor`, `fuel_refinery` só aparecem com nível positivo. Não expandimos automaticamente para as demais instalações.

### Colônia 2D aprovada

- Estrutura em camadas (`34384fd`) e ambiente ilustrado vazio com edifícios dinâmicos (`931487a`).
- Assets em `frontend/assets/buildings/living-colony/`; `environment.png` não foi alterado nas tarefas 3D recentes.
- Microefeitos de iluminação, partículas e vapor (`1766456`), com isolamento e pausa ao ocultar (`a12c360`).
- Não foi inventado um recorte grosseiro da perfuratriz para movimentar a imagem achatada. A cena 2D e a grade continuam disponíveis.

### Cena 3D: trabalho mais recente

Histórico: MVP (`be037a7`), ambientação (`0d6aa04`), direção artística (`e94b1be`), organização em setores (`7f9fb46`), edifícios geométricos animados (`52fa446`), cores/ambiente (`0fe938b`) e última passagem (`b3fa7c3`).

O responsável rejeitou a aparência de demonstração técnica e autorizou reinvenção artística, pedindo inspiração em `referencias/Water Polo.html`. A referência foi aberta no Chromium; não foi copiada como aplicação nem foram adicionadas dependências.

Última passagem:

- Distrito civil: torre escalonada, cúpula nervurada, janelas, acessos e antena móvel.
- Extrator: pórtico contraventado, perfuratriz localizada e esteira; estrutura principal imóvel.
- Refinaria: tanques, coluna de processamento, tubulações, escada e vapor ocasional.
- Terreno claro com detalhe fino determinístico, vegetação em grupos, bancos rochosos baixos e vias com bordas/marcações.
- Pequena bacia de água **decorativa** apenas para famílias planetárias temperadas/oceânicas derivadas dos dados existentes. Não é depósito, recurso, instalação ou nova mecânica.
- Renderização reduzida no desktop e ampliação nítida por CSS; sem novo pipeline de efeitos pesado.
- Movimento reduzido e documento oculto interrompem animação contínua; geometrias/materiais são liberados ao desmontar.
- Posições continuam estáveis por planeta/ID. Atualizar nível não redistribui as instalações.

**A qualidade artística ainda não recebeu aprovação final.** O usuário aprovou a composição 2D anterior, não a equivalência da cena 3D à referência Water Polo. A última entrega mostra melhoria, sem declarar essa equivalência.

## 6. Validação recente e evidências locais

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

## 8. Arquivos para retomar o trabalho visual

- [DevelopmentView](../frontend/src/universe/DevelopmentView.tsx): alternância das três apresentações e construção existente.
- [PlanetDiorama](../frontend/src/universe/PlanetDiorama.tsx): terreno, ambiente, câmera, seleção, render loop e descarte.
- [ColonyBuilding](../frontend/src/universe/ColonyBuilding.ts): modelos e animações dos três edifícios.
- [LivingColonyScene](../frontend/src/universe/LivingColonyScene.tsx): composição ilustrada independente.
- [Estilos compactos](../frontend/src/pixel-command/compact-workspace.css).
- [Testes do diorama](../tests/planet_diorama.test.tsx) e [testes dos modelos](../tests/colony_building.test.tsx).

A pasta `referencias/` está **não rastreada** e pertence ao responsável. Não foi adicionada ao commit/push. Não apagá-la nem presumir que estará disponível em outro clone.

## 9. Próximo passo recomendado, sem autorização implícita

Abrir a cena local com o responsável e colher avaliação artística da versão `b3fa7c3`, comparando com Water Polo. Se houver nova solicitação, trabalhar problemas visíveis específicos de composição, materiais ou movimento. Não expandir catálogo, gameplay ou arquitetura para compensar direção artística ainda insatisfatória.

A tarefa deste handoff é somente documentação e publicação dos commits locais autorizados. Não inicia outra fase de desenvolvimento ou migração do ambiente persistente.
