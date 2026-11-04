# Revisão UX — primeira sessão do universo persistente

## Auditoria anterior à implementação

Captura Chromium real em 1440×900 e 390×844, conta nova `ux_audit_5113077`.
Evidências locais: `tmp/ux-review/before/01-login.png` a `07-mobile.png` e DOM em
`observations.json`. Nenhum save existente foi alterado.

1. **Entrada / orientação — fraca:** registro funciona, mas o jogador cai no nome
   da conta e em uma grande ilustração sem objetivo imediato. Recursos só no HUD.
2. **Dashboard / construção — crítica:** página reúne quatro sistemas e fórmulas,
   obra inicial fica abaixo da dobra. “Ampliar” não explica o ganho; bloqueios de
   tecnologia, energia e trabalhadores só aparecem após tentativa na API.
3. **Pesquisa — crítica:** 32 seções extensas, categorias/effects em inglês,
   valores 0,08 sem tradução do resultado. Falta seleção + inspector e próxima ação.
4. **Estaleiro — regular:** preview forte e configuração real, mas mensagem diz
   que não há combate mesmo no universo persistente; duração ignora bônus orbital.
5. **Frotas — fraca:** inventário vazio acompanha “Modelo desconhecido”; link de
   missão aponta para a página longa. Missões usam códigos SURVEY/MOVE etc.
6. **Mapa — regular:** conhecimento e destinos reais, mas escolha não se conecta
   claramente à seleção de naves, combustível e confirmação da missão.
7. **Mobile — crítica:** sem nomes nas abas, estoques invisíveis e ações relevantes
   fora do primeiro viewport. Botões desabilitados com pouca explicação.

Riscos de acessibilidade observados: ícones sem texto visual no mobile, estados
explicados só por estilo/opacidade e longas listas sem um foco de decisão. Capturas
não comprovam contraste WCAG completo nem uso com leitor de tela; validar teclado,
labels, foco, mensagens vivas e erros no fluxo implementado.

## Direção implementada

Preservar navy/cyan, tipografia e renderers Imperial Command. O centro de comando
responde “o que tenho / o que está acontecendo / o que faço agora”. Construção,
pesquisa, missões e relações passam a ter destinos próprios. Guia contextual
executa os endpoints atuais, identifica ações no State e permite pular/retomar.
Progresso e resumo de retorno ficam no navegador, separados por ID real do império;
não são regras ou dados novos de gameplay e não sincronizam entre dispositivos.

## Fluxo entregue

1. **Entrada e orientação — guiada.** Após autenticar, Central de comando apresenta
   recursos/uso nominal/energia do planeta atual, capacidades, próximos passos e
   atividades. Guia em destaque no início e compacto nas telas de ação.
2. **Recursos e construção — decisão explicada.** Recursos continua com a cadeia
   real do catálogo. Construir separa produção, capacidade e ciência/órbita, mostra
   benefício nominal incremental, custos locais, duração e bloqueios. Não muda a
   validação da engine; o servidor confirma todos os gastos e pré-requisitos.
3. **Pesquisa — seleção + detalhe.** Lista navegável com estados textuais, áreas em
   português, dependências reais clicáveis, níveis exigidos, benefícios, orçamento,
   duração e progresso. Fórmulas avançadas ficam em expansão opcional.
4. **Estaleiro — ação e apresentação juntas.** Modelos disponíveis aparecem primeiro;
   no desktop, catálogo/preview/configuração usam três colunas. Especificações
   secundárias são recolhíveis, custo e tempo usam os dados reais. No mobile a
   configuração vem antes do preview. Nenhuma geometria/asset foi alterada.
5. **Frotas e exploração — sequência completa.** Vazio orienta construir Horizon;
   mapa transfere coordenadas para a tela de missões. Escolher naves → escolher
   objetivo/destino → calcular custo → confirmar. Preview obrigatório, carga e
   combustível insuficientes têm explicação. Códigos de missão viram nomes legíveis.
6. **Retorno e conclusão — feedback por estado.** Resumo compara o último snapshot
   visto com o State atual: obras, pesquisa, naves prontas, chegadas, desbloqueios e
   avisos privados. Variação de estoque é identificada como variação, não atribuída
   artificialmente à produção. Trocar planeta não mistura estoques/obras locais.
7. **Mobile — navegação nomeada.** Recursos reaparecem na Central, navegação mantém
   nomes em texto e rolagem horizontal controlada; listas e inspectors empilham.
   Estados usam texto, foco visível, controles nativos e regiões de status/alerta.

Guia: recursos → obra real → pesquisa real → nave real → missão real. Detecta
progresso no State; não credita recursos, não termina jobs e não inventa frotas.
Cada etapa pode ser pulada (identificada como pulada), o guia pode ser dispensado
ou retomado. Armazenamento local é separado por UUID real do império. Não salva
credenciais/tokens e não sincroniza entre dispositivos; limpar o navegador remove
essas preferências, sem afetar o jogo persistente.

O painel global de operações anterior fica preservado para os modos antigos;
no universo persistente suas atividades passam a compor as telas relevantes,
evita-se duplicação e o espaço é usado pelas decisões do jogador. Diplomacia,
comércio, acolhimento populacional e relatórios anteriores foram mantidos.

## Verificação automatizada e no navegador

- `npm run typecheck`: passou.
- 227 testes Vitest passaram em execução serial (`npx vitest run --maxWorkers=1`).
  Uma execução concorrente com o browser/Docker atingiu o timeout de 5 segundos
  de um teste CPU-intensivo antigo do Space Scene; não foram alterados geradores
  nem o timeout para contornar isso. A execução serial passou sem esse problema.
- Testes Node de planeta, registry, arquivos de assets e ícones passaram.
- Últimas alterações de Estaleiro/guia: 22 testes focados passaram.
- Build dentro do Docker e healthchecks passaram. O `frontend/dist` do host,
  servido pelo aplicativo antigo, não foi sobrescrito.
- Backend, regras, conteúdo YAML, migrações e configuração de banco inalterados.

E2E reproduzível em `scripts/ux_first_session.cjs` (requer Playwright/Chromium
instalados como ferramentas de teste; nenhuma dependência de runtime adicionada):

```bash
docker compose -f compose.persistent.yaml up -d --build --wait
PLAYWRIGHT_MODULE=/caminho/node_modules/playwright \
CHROMIUM_PATH=/caminho/do/chromium \
node scripts/ux_first_session.cjs
```

O teste cria uma conta nova no ambiente isolado `localhost:8030`, registra requests
reais e percorre recursos → construir extrator → pesquisar energia → sair durante
pesquisa → retornar → montar Horizon → escolher sistema no mapa → revisar e enviar
exploração. Confere os resultados no State da API, sem modificar relógio/banco nem
injetar recursos. Também verifica reload do guia, pesquisa bloqueada, insuficiência
real após uma ampliação de campo solar, nomes visíveis na navegação mobile e ausência
de overflow horizontal. Não precisa esperar a missão de exploração inteira terminar.

Capturas atuais e evidência JSON: `tmp/ux-review/after/`. Relatório do E2E em
`e2e.json`; antes em `tmp/ux-review/before/`. São arquivos locais não versionados.
Contas `ux_audit_*`/`ux_play_*` são somente atores novos de QA no banco experimental;
nenhuma partida anterior foi apagada ou reinicializada.

## Limites da revisão

Foco na primeira sessão: desktop 1440×900 e mobile 390×844 em Chromium/SwiftShader.
Não é benchmark de GPU, certificação WCAG, auditoria de segurança ou estudo com
novos jogadores humanos. Diplomacia, comércio, combate e colonização conservaram
seus sistemas; não tiveram uma nova campanha end-to-end nesta revisão de UX.
A validação humana de clareza e direção visual continua necessária.
