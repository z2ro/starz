# STARZ — experiência de estratégia

## Auditoria antes da implementação (2026-11-05)

Base: `d5d97b1`, universo persistente isolado em localhost:8030. Capturas novas de 12 telas em 1440×900 e 390×844: `tmp/strategy-experience/before/`. Referência pública histórica do OGame: [visão geral](https://www.gamestar.de/galerien/ogame,92333.html), imagens `ogame_2182696.jpg` e `ogame_2182697.jpg`. Não equivale a testar a versão atual do OGame. As capturas específicas mencionadas pelo usuário não estavam identificadas no workspace.

| Etapa/evidência | Problema | Impacto | Prioridade/decisão |
|---|---|---|---|
| 1. Comando | Três colunas iguais, inclusive operações vazias; contexto do planeta dividido | Obriga combinar imagem, população, energia e vagas mentalmente | P0: um dossiê planetário protagonista; operações compactas no shell |
| 2. Construção | Catálogo obriga selecionar para descobrir custo/tempo; CTA abaixo da dobra | Vários cliques para comparar instalações | P0: benefício, custo, duração e bloqueio na seleção, inspector permanece para confirmar |
| 3. Pesquisa | 32 linhas em lista e faixa grande antes dos efeitos | Progresso científico fica escondido na rolagem | P0: categorias com progresso real, filtros de disponibilidade, dependências junto da seleção |
| 4. Estaleiro | Geometria legível, mas cabeçalho/recursos altos e pouco espaço para comparar | Montagem sai do primeiro viewport | P1: apresentação maior e resumo técnico por modelo, configuração compacta |
| 5. Mapa → missão | Nós só mostram coordenadas, contexto de frota não aparece; colonização perde índice na navegação | Memorização e redigitação de destino | P0: presença comprovada, identidade conhecida e continuidade de seleção para o planejador existente |
| 6. Frotas | Painéis repetem status/local; composição baseada em UUIDs | Comparação lenta de várias viagens | P1: manifesto por classe/quantidade e rota em primeiro plano |
| 7. Colônias | Troca acessível só em telas específicas | Interrompe ações locais recorrentes | P0: seletor planetário persistente, agrupamento explícito de colônias no menu |
| 8. Mercado/diplomacia | Explicações longas e ação com pouco contexto de reserva/entrega | Consequência financeira exige leitura dispersa | P1: distinção minhas ofertas/ofertas externas; reserva e regras junto da confirmação |
| 9. Mobile | Antes de ver planeta consome ~450px; navegação sem agrupamento | Rolagem obrigatória para compreender o mundo | P0: recursos compactos, navegação por setores, dados anexos ao planeta |

Na referência do OGame, recursos e troca de mundo são elementos estáveis; nome/posição/condições estão anexos ao mundo e trabalhos se agrupam por sistema. Essa proximidade é a orientação de UX. Não serão importados arte, texturas, monetização, estrutura rígida ou mecânicas do OGame.

## Arquitetura escolhida

Planeta (Comando, Construção, Recursos, Administração), Tecnologia (Pesquisa), Espaço (Estaleiro, Frotas, Mapa, Missões), Império (Colônias, Diplomacia, Mercado). Rotas existentes preservadas. Seleção de planeta disponível no shell; dados continuam locais. Recursos expandem por clique/toque/teclado. Operações ordenadas por conclusão, sem reservar coluna vazia. Recomendações opcionais persistem por império.

## Escopo técnico

Shell e PixelCommand; Activities compartilhado; DevelopmentView/LevelResearch e seus seletores; Shipyard/Fleets/Galaxy/Operations/Overview; testes e capturas. Sem alterações em engine, YAML, migrações, API, autenticação ou geradores. Nem geometria nem dados de gameplay novos.

## Resultado implementado

- **Comando:** dossiê único reúne planeta procedural (ou imagem), nome/coordenadas, população, energia, trabalhadores, vagas e quatro ações. Mundos e administração ficam anexos ao contexto. Transmissão opcional pode ser ocultada por império; tutorial continua no menu Ajuda.
- **Shell:** quatro grupos de navegação; seletor local não abandona a tela atual. Estoques permanecem visíveis; taxas nominais e consumo energético expandem por toque/clique. Explicação distingue produção nominal de produção efetiva. Operações reais aparecem em todas as telas, ordenadas por conclusão, com divulgação após três trabalhos.
- **Construção:** catálogo com benefício, custo e tempo antes da seleção; confirmação e bloqueios preservados. Mobile usa catálogo horizontal controlado e inspector abaixo.
- **Pesquisa:** áreas com linhas desenvolvidas/total, filtros de recursos/requisitos e linhas conhecidas. A categoria ativa fica visível no mobile. Dependências, efeitos e custo convivem no inspector. Pesquisa ativa determina a categoria inicial.
- **Estaleiro:** nave maior, apresentação fixa durante a leitura desktop, comparação expansível de atributos reais, tempo/tripulação/inventário no catálogo. Configuração e payload preservados.
- **Frotas e mapa:** manifesto por classe e quantidade, planejamento a partir da frota estacionada, presença real nos sistemas. Destino, missão e índice planetário seguem do mapa ao formulário. Planetas colonizáveis do sistema natal agora são acessíveis no universo persistente; o comportamento legado permanece.
- **Colônias:** lista de mundos primeiro, resumo compacto depois; removida repetição das operações globais. Não instancia outro renderer nessa tela persistente.
- **Mercado:** reserva local, resultado líquido da taxa, minhas ofertas versus ofertas externas, bloqueio por estoque/quantidade inválida, mensagens específicas de publicar/aceitar/cancelar e acesso a relatórios. Diplomacia mantém suas regras e ações na navegação agrupada.
- **Feedback:** notificações não ficam sobre os botões inferiores; mensagens antigas são limpas ao navegar. Erros continuam explícitos e dispensáveis. Troca de planeta bloqueia snapshots incompletos também fora do Planet View.

## Validação real — 2026-11-06

Ambiente isolado `compose.persistent.yaml`, porta **8030**. Sem reset de banco, avanço artificial do relógio, alteração de outro volume ou de contas do usuário. Foram usadas contas QA criadas por este trabalho e por revisões anteriores.

| Jornada | Evidência / resultado |
|---|---|
| Primeira sessão | Conta `ux_play_0076026`: tutorial, leitura de recursos, construção de extrator, pesquisa de energia, montagem de Horizon, mapa → missão SURVEY. Ações reais HTTP 200. |
| Offline e bloqueios | Navegador fechado até a conclusão real da pesquisa; aviso na volta. Tutorial persistiu. Contenção estelar bloqueada por requisitos e instalação bloqueada por estoque insuficiente. |
| Negociação | Duas contas QA: Logística pesquisada, oferta publicada/reservada, aceita pela outra conta, segunda oferta cancelada/devolvida. Relatório real confirmou entrega de 18 ferritas após a taxa sobre oferta de 20. |
| Colonização/administração | Astrofísica pesquisada; seleção do segundo planeta natal no mapa preservou índice 1 e COLONIZE. Confirmação real criou a colônia; troca pelo seletor global manteve `/development`, com contexto local correto em desktop e mobile. |
| Navegação/visual | Chromium: 12 rotas em 1440×900 e 390×844; Comando também 1920×1080 e 1366×768. Sem overflow horizontal da página ou erros JS na rodada automatizada. Inspeção visual e refinamento de mapa, seleção mobile, notificações e Colônias. |
| Testes | Typecheck; 243 testes Vitest; suítes Node de planeta/assets/ícones; build Vite no contêiner isolado; `git diff --check`. Um timeout de geometria ocorreu sob concorrência com Chromium; a suíte integral passou ao ser repetida sem essa carga, sem relaxar o teste. |

As capturas completas de página mostram a barra mobile fixa na altura da viewport original; ela não está inserida no meio do conteúdo da página. A rolagem e os alvos foram exercitados no navegador.

## Artefatos e reprodução

- [Comparativo antes/depois](../../tmp/strategy-experience/index.html): todas as 12 telas, desktop e mobile.
- [QA visual estruturado](../../tmp/strategy-experience/after/qa.json).
- [Primeira sessão](../../tmp/strategy-experience/journey/e2e.json), [mercado e colônia](../../tmp/strategy-experience/journey/extended-e2e.json).
- Capturas `journey/01` a `15`: ordens, retorno offline, bloqueios, reserva, aceitação, entrega e troca local de planeta.

`npm run typecheck`, `npm test`, `git diff --check`. Build: `docker compose -f compose.persistent.yaml build universe-app`; subir: `docker compose -f compose.persistent.yaml up -d --wait universe-app`. Não é necessário reconstruir o banco.

`scripts/strategy_visual_qa.cjs` captura a interface sem emitir ordens. Recebe `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `STARZ_QA_USER` e `STARZ_QA_PASSWORD` via ambiente. `scripts/ux_first_session.cjs` cria uma conta QA nova e executa a primeira sessão real somente em localhost:8030. Credenciais não são gravadas no relatório.

## Limites restantes

- A API não lista contratos comerciais pendentes com ETA; a interface confirma aceitação e mostra a entrega nos relatórios. Não foi criada uma previsão fictícia.
- Referência OGame histórica, não auditoria de uma sessão atual nem das capturas específicas não fornecidas. Nenhum asset OGame foi incorporado.
- Validação de responsividade em Chromium emulado; sem dispositivos físicos, Safari ou Firefox. Aprovação artística e teste com novos jogadores humanos ainda cabem ao responsável.
- Nenhuma alteração em custos, fórmulas, engine, endpoints, autenticação, YAML, migrações, shaders ou geometrias. Os dados QA evoluíram exclusivamente pelas ações existentes.
