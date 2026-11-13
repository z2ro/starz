# STARZ 3.0 — implementação e evidências

Autorização de implementação: instrução do responsável em 08/11/2026, branch `experiment/persistent-universe`. `APPROVED` não significa `IMPLEMENTED`, `TESTED` ou `BALANCED`. Este registro descreve execução; os contratos canônicos continuam nas decisões de game design.

## P0 — baseline

`IMPLEMENTED` / `TESTED`: três catálogos carregados, 83 testes unitários e 32 PostgreSQL, sem falhas, 96,5 s. Banco temporário do runner, loopback/tmpfs, removido pelo próprio helper. Ver [baseline executável](starz-3-p0-baseline.md). Não houve reset ou acesso aos saves do ambiente existente.

## P1 — Research 3.0

`IMPLEMENTED` / `TESTED`: 60 pesquisas, 16 descobertas únicas sem efeitos percentuais fictícios, 44 IDs e dez hulls preservados. Gates Fundamental V e contenção corrigidos. Doze testes executam pesquisa e verificam débito, trabalho, conclusão única e caminho sem militarização obrigatória; 1,863 s. Checkpoint `56e05ee`. Automação logística civil não é apresentada como implementada. Custos/trabalho das novas descobertas usam bases do avanço de mesmo tier, explicitamente EXPERIMENTAIS.

## P2 — Combat 3.0

`IMPLEMENTED` / `TESTED` no backend:

- Doutrinas Equilibrada, Interceptação e Ruptura; perfil convencional/antiescudo independente; gates no despacho, escolhas congeladas em payload de contrato versão 1.
- Escoltas Vanguard/Sentinel/Aegis conforme D01, um redirecionamento por escolta/salva; modificador relativo ao alvo efetivo e seis salvas simultâneas.
- Odyssey física com HP positivo emite EW quando pesquisada; sensores + computação contestam deterministicamente, empate resiste. Múltiplas Odyssey só dão redundância. Contestar targeting não retira tiros. Novas observações podem cair um nível dentro de 0–3; histórico permanece intacto.
- Antiescudo usa orçamento único: eficiência de absorção real e penalidade do saldo contra casco, sem tiro ou munição adicionais. Perfis de ensaio D08 conservador/intermediário/elevado: escudo 1,10/1,25/1,40 e casco 0,90/0,80/0,70. O servidor usa o intermediário experimental; o cliente não envia coeficientes.
- Plataforma orbital alterna defesa/interdição. Exige pesquisa, estrutura real, energia e trabalhadores completos; não dispara armas convencionais em modo interdição. Uma zona efetiva por império/sistema na chegada hostil elegível; sem efeito em retorno ou comércio. Atraso experimental 10/25/40% do ETA, tetos 600/1800/3600 s.
- Sucessora tem ID determinístico derivado da chegada original; transação finaliza a anterior, mantém frota em trânsito, ETA e reserva de combustível. Paz é revalidada. Desativar emissor não desfaz atraso já comprometido.
- Relatórios entregam tecnologias apenas do próprio participante; retiram atributos privados derivados das unidades inimigas. Nenhum relatório revela identidade privada do emissor EW.

Evidência: `.qa/runs/starz3-p2-combat/unit-final.log` (31 testes); `.qa/runs/starz3-p2-intelligence/unittest.log` (3 testes); `.qa/runs/starz3-p2-orders/backend-db.log` (3 integrações PostgreSQL, 39,3 s). Zero falhas nesses escopos. Validação abrangente e interface são etapas separadas; não inferir aprovação visual nem balanceamento final.

## Decisão operacional adicional do responsável

`APPROVED`, recebida nesta implementação: montar a Stargrave **no sistema de captura**, com módulos enviados fisicamente de colônia própria, e retirar o astro da origem **somente ao concluir Estabilização**. Essa decisão fecha as duas lacunas de D06-F correspondentes; não aprova valores finais de custo/duração nem novas regras de bombardeio.

## Pendências funcionais delimitadas

O escopo orbital P3–P6 foi implementado; o fechamento e seus limites estão registrados adiante. Espaço profundo depende de presença/âncora e combate suportados pelo servidor; não será falsificado como alvo planetário. Extinção de império não existe como estado autoritativo; offline não habilita custódia órfã. Direitos especiais de terceiros neutros e os contratos civis não aprovados permanecem fora das operações habilitadas.

## P3 — captura, módulos e construção

`IMPLEMENTED` / `TESTED`: migration aditiva `d05e00000001`, fonte estelar canônica `uuid5(system_uuid, 'star:0')`, exclusividade por estrela, projetos e módulos identificados, cinco etapas por ordens do reconciliador atual. A origem só perde o astro ao concluir Estabilização; planetas e coordenadas são mantidos. Reserva rejeita sistema desconhecido, natal, habitado ou com colonização comprometida. O overlay autoritativo bloqueia colonização durante compromisso/ausência e só é exposto no mapa para sistemas conhecidos.

Fabricação consome `refined_alloy`/`components` na colônia, exige pesquisa e indústria efetiva; módulo pronto ocupa 50 unidades de carga EXPERIMENTAIS. `STELLAR_DELIVERY` reutiliza frotas, combustível, capacidade, ETA, retorno e recall. Cada módulo tem uma identidade, origem e estado; entrega/reentrada não duplica carga. Fases consomem módulos reais entregues; `stellar_armaments` é exigida no comissionamento. Unidade excepcional tem identidade própria, cinco subsistemas e estoque derivado de suprimentos físicos; não foi criado hull.

Perfil `experimental-stellar-v1`: módulo custa 200 ligas + 100 componentes; trabalho 600 dividido pela indústria efetiva; fase dura 600 s. Esses valores servem a execução/ensaios, não são balanceamento final. Cancelamento pré-compromisso libera reserva; após entregar/consumir módulos, cancelamento genérico é recusado em vez de fabricar reembolso.

Evidência: seis testes CPU; sete integrações PostgreSQL (`.qa/runs/starz3-p3-db/` e `.qa/runs/starz3-p3-commission/`). A primeira execução encontrou dois erros da mesma causa: autoflush de fase 5 antes do status `commissioned`; corrigida a escrita conjunta e reexecutados os dois casos, ambos PASS. Cinco casos não afetados já haviam passado. Jornadas incluem frota real de entrega, retirada no momento aprovado, fonte única, replay, recall de módulos e comissionamento único. Downgrade recusa apagar registros estelares/ordens pendentes; apenas schema estelar vazio pode ser revertido. Não houve migração do ambiente do responsável.

### Revisão concorrente P3

`TESTED`: T10/T11 executados com duas threads e sessões PostgreSQL reais: duas reservas da mesma fonte produzem um vencedor; reserva e despacho colonial são concorrentes mutuamente exclusivos. Dois testes PASS em 23,4 s, `.qa/runs/starz3-p3-concurrency/`. Esse resultado complementa os sete casos SQL anteriores; não é inferido de locks ou documentação.

## P4 — unidade excepcional operacional e combate

`IMPLEMENTED` / `TESTED` no backend: Stargrave sem hull convencional, integridade estrutural e cinco subsistemas persistentes; reserva energética limitada, piso de contenção e custos compartilhados de escudos, disparo e deslocamento. Movimento gravitacional usa a aritmética comum de distância/tempo, sem instalar motor convencional fictício. Trânsito registra origem, destino e ETA reais; só confirma órbita na chegada.

O mesmo resolvedor de seis salvas recebe unidades excepcionais reais. Dano convencional pode derrotar Stargrave; tiro dirigido exige pesquisa e reconhecimento confirmado vigente no despacho. Contenção exige escudo zerado e dano externo; proteções são reavaliadas no disparo, com fallback convencional explícito quando necessário, sem segundo orçamento de dano. Perder propulsão, controle, armamento ou contenção limita capacidades reais. Derrota produz `sealed_wreck` com identidade, origem e timestamp estável; sem autodestruição ou energia militar por offline.

`ATTACK` pode citar unidade estelar numa órbita real, inclusive invasora sobre planeta próprio. Guerra é contra o dono da unidade; não se altera propriedade do planeta. Quando o alvo está fora do planeta de seu dono, não se somam defesas nem estoques de seu mundo natal. Reconhecimento específico da unidade usa observação parcial: não revela o inventário do mundo natal remoto. Dado de sistema desconhecido continua oculto.

Bombardeio reutiliza absorção/dano estratégico, preserva `civil_district`, exige superioridade orbital e guerra no início/fim e cancela se perder capacidade/condições. Preparação experimental: 24/18/12 h. Uma operação ativa por unidade. Fonte continua ausente após derrota; o modelo visual não a recria.

Coeficientes de ensaio centralizados em `combat_rules.py`: HP estrutural 5000, módulo 1000, escudo 2000; energia máxima 10000, piso 1000, regeneração 1/s, disparo 100 e sustentação de escudo 20 por salva; dano naval 300, armadura 2; velocidade gravitacional 1, custo 100 de energia/distância; bombardeio custa 2000 de energia e aplica orçamento estratégico 1000. São parâmetros EXPERIMENTAIS, não balanceamento final ou escala física medida.

Evidência: 54 testes CPU direcionados (`.qa/runs/starz3-p4-combat/cpu-final.log`), quatro testes de inteligência/isolamento de observação (`.qa/runs/starz3-p4-intelligence/`), quatro cenários PostgreSQL em `.qa/runs/starz3-p4-db/` e `.qa/runs/starz3-p4-orbital/`. Os cenários SQL constroem a unidade pelas cinco fases e usam ordens reais; não inserem uma Stargrave pronta para fingir a jornada. Espaço profundo continua indisponível: sem combate/claim por proximidade visual ou planeta fictício. A integração de UI e as amostras numéricas estão registradas em P6.

## Amostras numéricas experimentais executadas

Comando reproduzível, sem rede ou banco: `.venv/bin/python scripts/starz3-balance.py --output .qa/runs/starz3-balance/results.json`. O script chama o resolvedor autoritativo; 327 amostras, incluindo 288 repetições idênticas verificadas por igualdade, três intensidades D08, doutrinas, perfis, escoltas, inversão de lado e presença/ausência de escudos. As amostras não substituem testes transacionais B14/B18 nem representam win rate de jogadores.

No cenário intermediário B15, tecnologias convencionais de armas/armadura/escudos nível 2 em ambos os lados, Stargrave inicialmente íntegra e energizada:

| Leviathan | Perfil | Resultado em até seis salvas | Casco Stargrave restante | Naves sobreviventes |
|---:|---|---|---:|---:|
| 4 | Convencional | Empate | 3198,60 | 3 |
| 4 | Antiescudo | Empate | 3398,88 | 3 |
| 8 | Convencional | Empate | 275,40 | 7 |
| 8 | Antiescudo | Empate | 1060,32 | 7 |
| 12 | Ambos, separadamente | Atacante vence na quinta salva | 0 | 11 |
| 24 | Ambos, separadamente | Atacante vence na terceira salva | 0 | 24 |
| 48 | Ambos, separadamente | Atacante vence na segunda salva | 0 | 48 |

Isso comprova vulnerabilidade convencional nestas condições, sem `containment_warfare`, e o custo do perfil antiescudo contra casco. Não prova equilíbrio econômico: custos do script somam unidades convencionais e defesas realmente participantes, sem construção da Stargrave; faltam combustível, propulsão, acesso científico e tempo de reposição na comparação econômica completa. Proposta quantitativa inicial: manter 1,25/0,80 apenas como baseline de ensaio, comparar variantes 1,10/0,90 e 1,40/0,70 antes de escolher valores finais; nenhuma promovida a `BALANCED`. Para ETA de 7200 s, os atrasos calculados são 600/1800/2880 s conforme os três perfis, respeitando os tetos.

## P5 — custódia, destinos e transporte do núcleo

`IMPLEMENTED` / `TESTED` no escopo orbital suportado: migration `d06f00000001`, operações exclusivas por núcleo, versão de custódia, ledger de efeitos com proveniência industrial e eventos idempotentes no reconciliador existente. Proprietário operacional/histórico, controlador militar e custodiante são papéis distintos. Vitória não cede custódia; presença militar no próprio planeta, estabilização e nova janela são exigidas. Contestação encerra o claim sem transferência automática; admite nova tentativa manual. Cessão exige oferta e aceite bilateral fora de guerra; snapshots privados só são entregues às partes autorizadas.

Reconstrução usa cinco módulos físicos, pesquisa e trabalho reais, mantendo unidade, estrela e projeto histórico. O transporte de módulos entre colônias usa `TRANSPORT`, capacidade e combustível nativos; conserva origem fabril e registra local atual. Destino que deixa de ser próprio provoca retorno do manifesto. Descomissionamento cria relíquia selada terminal; recuperação experimental de 25% incide somente sobre custos comprovadamente pagos dos módulos originais, uma vez, sem fabricar combustível.

Repatriação e retirada cedida usam frota convencional real, módulo de propulsão consumido na coleta, capacidade de carga e custo de massa/combustível/tempo das pernas físicas. Cessão não move o núcleo nem dá acesso a estoques alheios. Recall anterior à coleta retorna o mesmo módulo; após coleta retorna fisicamente com o mesmo núcleo, sem devolver módulo consumido. Repatriação reinstala a mesma estrela na origem, mantém planetas e coordenadas e não repõe recursos. Núcleos selados não regeneram energia militar.

Perfil `experimental-custody-v1`: estabilização e claim 86400 s cada, reconstrução 86400 s, relíquia 3600 s. Transporte `experimental-core-transport-v1`: volume do núcleo 100 e massa adicional 250, fora estoques físicos. Todos são parâmetros experimentais, não balanceamento final.

Evidência: 13 testes CPU de custódia (0,122 s), dez de transporte (0,117 s), dois de módulos (0,001 s) e sete integrações PostgreSQL (`.qa/runs/starz3-p5-db/`, 339,1 s incluindo ambiente). Integração inclui construção paga→movimento→derrota convencional→claim→relíquia; claims/destinos concorrentes; cessão bilateral privada; colonização real→transporte de módulos→reconstrução; repatriação com retorno; retirada cedida até órbita própria. Os demais casos usam precondições sintéticas explicitamente declaradas, sem simular como prova uma transição não executada.

Espaço profundo, extinção de império e direitos especiais de terceiros permanecem condicionados. A regra inicial exige planeta próprio e forças locais, portanto não representa dois impérios simultaneamente elegíveis para posse numa soberania orbital fictícia.

## P6 — integração de interface e apresentação

Interface funcional em `#/stellar`, dentro do GameShell existente, com entrada contextual pela pesquisa e estaleiro. Projetos, fabricação, unidades e custódia usam subviews e paginação; seleção/revisão/confirmar são explícitas. As fases e módulos exibem somente prazos reais das ordens. Ações usam chaves UUID idempotentes e retornam os bloqueios autoritativos do servidor. Pesquisa distingue descoberta operacional de política civil ainda proposta. O planejador preserva doutrina, perfil, alvo/subsistema, projeto e manifesto nos drafts por planeta e invalida a prévia quando mudam.

A plataforma orbital oferece seus dois modos reais. Reconhecimento só habilita mira dirigida com observação confirmada e vigente. Relatórios mostram doutrina efetiva, redirecionamentos, fallback de mira, dano de subsistemas e snapshots próprios de unidades excepcionais, sem confundi-las com sobreviventes convencionais. O mapa e a órbita ocultam a estrela retirada e sua luz, mantendo identidade e planetas. O modelo aprovado da Stargrave foi reutilizado sem alterar geometria ou paleta.

No mobile, Lista/Detalhes e Ação/Módulos/Frota/Revisão substituem painéis simultâneos. Inspeção real em 390×650 identificou e corrigiu altura nula do conteúdo e botões interceptados; não foi usado clipping, scroll de leitura nem redução de fontes. Modelo, câmeras, navegação e canvas foram exercitados no Chromium local (SwiftShader; não é benchmark de GPU física).

## Gate abrangente e complemento direcionado

`node scripts/qa.cjs full --jobs 2`, com Chromium local explicitamente selecionado, executado em `.qa/runs/2026-11-08T14-33-32-097Z-128194/`: 183 testes CPU Python, 366 frontend, 198 cenários Chromium e demais checks aprovados; zero skips e zero eventos de segurança no navegador. Typecheck e build passaram. **O comando retornou 1**, não um PASS: um teste de paridade esperava rótulos obsoletos de Galáxia já divergentes no commit-base `651fd75`; o lote PostgreSQL atingiu 900 s após 44 aprovações, durante o cenário de chegada hostil simultânea.

Os 13 casos PG restantes foram selecionados por diferença entre descoberta de testes e resultados efetivamente concluídos, sem ocultar cenários nem repetir as 44 aprovações. `.qa/runs/starz3-final-db-remaining/` terminou com **13 PASS, zero falhas, 308,2 s**. O cenário interrompido passou isoladamente. Assim, os 57 casos PostgreSQL do lote foram executados com sucesso em dois escopos. Não confundir essa evidência composta com um `full` de saída zero.

A acumulação de impérios/ordens entre métodos do mesmo fixture tornava o lote estelar excessivamente lento. Os novos fixtures de custódia e transporte passam a usar schema descartável próprio por teste, sem alterar serviços, saves ou bancos existentes. Correções finais de paridade/visibilidade da oferta recebem verificações direcionadas separadas; seus resultados são registrados no fechamento abaixo.

## Limites explícitos

- Nenhum combate, custódia ou presença naval geral em espaço profundo foi inventado; a construção tem o sistema real de captura e as operações militares suportadas usam âncoras planetárias reais.
- Offline não significa extinção. Custódia órfã, direitos de terceiros neutros e colonização após repatriação aguardam contratos próprios.
- Automação logística civil, variações operacionais propostas em R3.0-D02 e reparo genérico de unidades não derrotadas não são apresentados como implementados.
- Transporte retido sem âncora própria alcançável mantém núcleo e portador reais, sem travar a reconciliação nem permitir reaproveitar a frota. Cancelar pela custódia pode retomar retorno físico após regularizar âncora/reserva. Reabastecimento remoto e troca de portador não foram implementados.
- Custos, HP, energia, tempos, salvamento e contestação EW são experimentais. Reserva de captura não possui limite/expiração novos inventados; esses parâmetros exigem decisão e simulação.
- Captura não recalcula clima, geografia ou economia planetária por analogia. Não há vitória automática, planetocídio ou explosão estelar temporizada.
- Capturas são fixtures locais explicitamente identificadas; provam renderização/interação, não execução de partidas reais. O fluxo persistente foi verificado em PostgreSQL sintético descartável. O ambiente do responsável não foi migrado ou reiniciado.


## Fechamento da entrega (13/11/2026)

Retomada documental com checkout limpo em `15dc3c2`; esse commit já reúne a interface P6 e as correções finais preparadas em 08/11. Nenhuma suíte foi repetida nessa retomada, nenhum ambiente existente foi migrado e nenhum dado foi resetado.

O complemento final `.qa/runs/starz3-final-closures/` aprovou três casos PostgreSQL em 58,468 s: visualização mínima de oferta antes do aceite, retirada física após cessão e perda da origem sem travar o reconciliador. Também passaram os checks estáticos de skills e diff. Sua tentativa frontend ainda falhou por seletor ambíguo; a correção restrita ao badge foi validada depois em `.qa/runs/starz3-final-parity-fixed/`: quatro testes PASS, zero falhas, 1,992 s. Os 57 casos PG do lote foram cobertos pelo `full` interrompido e seu complemento; o `full` histórico continua com saída 1. Não somar reexecuções como testes distintos.

As correções de segurança incluem chegada hostil no mesmo timestamp independente da ordenação de UUID, conquista autorizada que invalida oferta ainda não aceita, ocultação de órbita desconhecida para o proprietário histórico e transporte retido com nova tentativa de retorno físico. O destinatário de oferta recebe somente o descritor mínimo necessário para selecionar o núcleo e aceitar; não recebe estoques, integridade privada ou localização desconhecida.

| Fase | Estado entregue | Checkpoints | Evidência principal |
|---|---|---|---|
| P0 | IMPLEMENTED | `e2c67a4` | Baseline reproduzível: CPU 83 / PG 32, ambiente descartável. |
| P1 | IMPLEMENTED para catálogo e gates aprovados | `56e05ee`, `5791735` | 60 IDs, grafo acíclico, dez hulls preservados; operações civis ainda propostas não são simuladas. |
| P2 | IMPLEMENTED no combate e missões suportados | `01a279e` | Seis salvas, doutrinas, escoltas, EW, perfil e interdição única; testes CPU e PG. |
| P3 | IMPLEMENTED | `f2d4aab` | Fonte exclusiva, reserva versus colonização concorrente, módulos entregues e cinco fases reais. |
| P4 | PARTIAL | `6197a09`, `15dc3c2` | Operação orbital, energia, subsistemas, derrota e bombardeio; espaço profundo bloqueado. |
| P5 | PARTIAL | `a32db4f`, `15dc3c2` | Custódia, cessão, reconstrução, repatriação e relíquia; extinção e adjudicação geral fora das âncoras suportadas bloqueadas. |
| P6 | IMPLEMENTED para as funções disponíveis | `15dc3c2` | Interface integrada, 198 cenários Chromium aprovados e capturas revisadas; isso não equivale a aprovação artística ou lançamento. |

R3.0-D01 e C3.0-D01–D11 são rastreadas na [matriz T01–T64/B01–B18](starz-3-acceptance.md). Os estados PARTIAL/BLOCKED/WAIVED permanecem explícitos; não houve promoção automática a PASS. O resumo de ensaios numéricos permanece experimental: `balanced: false`.
