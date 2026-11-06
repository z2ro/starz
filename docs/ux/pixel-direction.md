# STARZ — direção visual pixel art (proposta 01)

Status histórico: proposta do Centro de Comando aprovada pelo usuário. A expansão implementada está descrita em [pixel-expansion.md](pixel-expansion.md). As seções abaixo registram a etapa de proposta, anterior à expansão. Branch existente preservada. Sem alteração de regras, API, saves ou autenticação.

## Auditoria antes de editar

Capturas novas em `tmp/pixel-direction/before/`, Chromium, conta de QA existente, 1440×900 e 390×844.

1. **Central** (`universe.png`): informações locais corretas, mas recursos duplicados no HUD e corpo; tutorial domina o primeiro viewport; planeta fica cortado abaixo da dobra. Links de navegação apresentam cor roxa padrão.
2. **Pesquisa** (`research.png`): seleção/dependências funcionais; listas e inspector são superfícies pouco diferenciadas. Títulos convencionais, ícones lineares e grandes faixas de texto não acompanham a linguagem dos renders.
3. **Estaleiro** (`shipyard.png`): nave pixel art legível e classe real; molduras finas, controles e metadados parecem pertencer a outro produto. Tutorial ocupa quase um terço da tela.
4. **Mapa** (`galaxy.png`): destinos e localização reconhecíveis; arredondamentos, halos e microlegendas divergem das superfícies de pesquisa/estaleiro.
5. **Mobile** (`mobile.png`): leitura possível e navegação com nomes; planeta muito abaixo da dobra, sequência vertical longa, taxas repetidas. Não é uma certificação de acessibilidade.

## Direção: console de bordo

Planeta como assunto principal; recursos uma única vez; dados locais em instrumentos adjacentes; missão contextual como faixa operacional; ordens em um registro contínuo. Nenhuma população, frota, taxa efetiva ou atividade simulada para decorar a proposta.

### Tokens e componentes

- Malha 4px; espaços 4/8/12/16/24/32. Controles de pelo menos 44px.
- Navy `#080f1c`, grafite `#172331`, superfície `#203346`, sombra `#030914`.
- Marfim `#eee9d5` para texto; ciano `#86d4d5` para interação; âmbar `#edb969` para prioridade/alerta; verde `#a5c5a0` para condição saudável.
- Silkscreen Regular local (SIL OFL), só títulos/rótulos curtos. Texto e números: system sans/tabular, 14px+, sem pixelizar fontes.
- PixelIcon: desenhos preenchidos em grade 16×16, sem strokes fracionários. Cada ícone acompanha texto; nunca único sinal de estado.
- Moldura de 2px, cantos ortogonais escalonados, luz superior/esquerda e sombra inferior/direita. Border-image 9-slice somente para molduras, sem distorcer centro/conteúdo.
- Botão: repouso elevado, hover claro, pressionado deslocado 2px, selected preenchido e marcador textual, disabled sem relevo. Foco externo 2px marfim.
- Progresso segmentado visualmente, valor real e texto acessível preservados. Abas/botões, tooltip por foco/hover, mensagens de estado e disclosure usam controles semânticos.
- Mobile: marca/ajuda, recursos compactos, navegação rolável com nomes, planeta, capacidade, ordens e missão. Nenhum carrossel obrigatório para dados principais.

## Escopo de aprovação

Abrir `#/universe?direction=pixel`. O modo normal fica intacto. Prévia reutiliza State/Catalog do AppShell, renderer procedural, Activities, guia e ReturnSummary; links levam às funcionalidades reais, ainda na identidade anterior. Não é um laboratório de gameplay nem um novo renderer.

Após aprovação: promover os tokens/primitivas ao shell; reconstruir composições de construção/pesquisa/estaleiro/frotas/mapa/recursos/relações/planeta/império com a mesma referência, verificando cada fluxo. Não considerar essa expansão concluída nesta etapa.

## Primeira verificação no navegador / refinamento

A primeira captura revelou um vazio sob o planeta em 1440px e margem externa herdada no mobile. Corrigidos: três setores simultâneos em desktop, altura do viewport preenchendo sua moldura, margens móveis específicas, energia em faixa compacta e título reduzido. Ícone de combustível de fusão explicitamente mapeado (sem usar minério como fallback).

## Validação técnica

- Typecheck aprovado; build Vite aprovado dentro do Docker isolado (sem sobrescrever `frontend/dist` servido por outros ambientes).
- 232 testes Vitest aprovados, execução serial; testes Node de planetas, registries, assets e ícones aprovados.
- Cinco testes novos: dados locais/nominais, guia concluído dentro de Ajuda e persistência, fallback WebGL, progresso real e navegação, recomendação por capacidade e registros.
- Browser QA com sessão de QA local existente; não envia ordens, não cria contas e não altera saves. Preferências do guia e último acesso continuam usando os mecanismos locais existentes.
- Script `scripts/pixel_command_qa.cjs`: usa `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` e `STARZ_QA_STORAGE` (storageState privado fora do repositório). Captura quatro viewports, testa Ajuda/teclado, registros, IMAGE/PROCEDURAL, taxas e navegação real para Pesquisa, além de confirmar interface original intacta.
- Primeiro teste de interação encontrou explicação de taxas sobrepondo atalho no mobile. Corrigida para expansão no fluxo do documento.

## Limites desta entrega

Não há aprovação artística do usuário ainda. Outras telas permanecem com a identidade anterior; links de ações são reais e abrem essas telas. Nenhum redesenho global foi declarado concluído. Fonte e moldura são locais; ícones da proposta não substituem o Stellar Atlas fora dela. Sem merge, PR ou alteração de backend. As capturas mostram o estado real da conta de QA (inclusive nenhuma atividade quando não há ordens pendentes). O tempo das taxas é nominal, não um cálculo de produção efetiva.

### Resultado final do browser QA

PASS funcional em Chromium: 1920×1080, 1440×900, 1366×768 e 390×844, sem overflow horizontal da página; font local carregada; sem erros JavaScript; zero POSTs de gameplay durante a verificação. Ajuda por teclado, progresso preservado, registros, comparação IMAGE/PROCEDURAL, disclosure de taxas, navegação para Pesquisa e retorno ao dashboard original confirmados. `tmp/pixel-direction/after/qa.json` contém as medidas e resultados. Capturas inspecionadas visualmente; aprovação artística final pendente.
