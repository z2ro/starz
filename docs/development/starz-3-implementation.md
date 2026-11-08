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

P3–P6 continuam em implementação. Espaço profundo depende de presença/âncora e combate suportados pelo servidor; não será falsificado como alvo planetário. Extinção de império não existe como estado autoritativo; offline não habilita custódia órfã. Direitos especiais de terceiros neutros e os contratos civis não aprovados permanecem fora das operações habilitadas.

## P3 — captura, módulos e construção

`IMPLEMENTED` / `TESTED`: migration aditiva `d05e00000001`, fonte estelar canônica `uuid5(system_uuid, 'star:0')`, exclusividade por estrela, projetos e módulos identificados, cinco etapas por ordens do reconciliador atual. A origem só perde o astro ao concluir Estabilização; planetas e coordenadas são mantidos. Reserva rejeita sistema desconhecido, natal, habitado ou com colonização comprometida. O overlay autoritativo bloqueia colonização durante compromisso/ausência e só é exposto no mapa para sistemas conhecidos.

Fabricação consome `refined_alloy`/`components` na colônia, exige pesquisa e indústria efetiva; módulo pronto ocupa 50 unidades de carga EXPERIMENTAIS. `STELLAR_DELIVERY` reutiliza frotas, combustível, capacidade, ETA, retorno e recall. Cada módulo tem uma identidade, origem e estado; entrega/reentrada não duplica carga. Fases consomem módulos reais entregues; `stellar_armaments` é exigida no comissionamento. Unidade excepcional tem identidade própria, cinco subsistemas e estoque derivado de suprimentos físicos; não foi criado hull.

Perfil `experimental-stellar-v1`: módulo custa 200 ligas + 100 componentes; trabalho 600 dividido pela indústria efetiva; fase dura 600 s. Esses valores servem a execução/ensaios, não são balanceamento final. Cancelamento pré-compromisso libera reserva; após entregar/consumir módulos, cancelamento genérico é recusado em vez de fabricar reembolso.

Evidência: seis testes CPU; sete integrações PostgreSQL (`.qa/runs/starz3-p3-db/` e `.qa/runs/starz3-p3-commission/`). A primeira execução encontrou dois erros da mesma causa: autoflush de fase 5 antes do status `commissioned`; corrigida a escrita conjunta e reexecutados os dois casos, ambos PASS. Cinco casos não afetados já haviam passado. Jornadas incluem frota real de entrega, retirada no momento aprovado, fonte única, replay, recall de módulos e comissionamento único. Downgrade recusa apagar registros estelares/ordens pendentes; apenas schema estelar vazio pode ser revertido. Não houve migração do ambiente do responsável.
