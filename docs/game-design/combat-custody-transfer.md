# STARZ — C3.0-D11: transferência legítima de custódia e localização de destroços

**Estado:** `APPROVED` como **contrato de design** (08/11/2026); **D11-A–H** e **T49–T64** aprovados expressamente. **Não implementado; critérios de QA não executados.**  
**Base aprovada:** [C3.0-D10 A–H e T33–T48](combat-custody-adjudication.md), [C3.0-D09 A–H](combat-stellar-custody.md), [C3.0-D08 A–H](combat-stellar-disposition.md), [C3.0-D07](combat-technical-contracts.md).  
**Objetivo:** fechar as lacunas de **transferência de custódia já confirmada**, localização física de destroços, extinção de impérios e proteção contra captura automática/infinita.  
**Restrições:** não criar transferência de planeta por analogia, alianças inexistentes, soberania de sistema ou segunda fonte de verdade. Somente documentação; nenhum código, migration, YAML, teste executado, PR, merge ou deploy.

## 1. Princípios herdados (`APPROVED`)

- Vencer uma batalha, ocupar uma região ou interromper um claim **não** transfere automaticamente o núcleo, a estrela nem a Stargrave pronta.
- Custódia confirmada é um fato histórico persistente; perder controle militar do local impede ações ilegítimas mas **não apaga** a titularidade retrospectivamente.
- A estrela mantém vínculo **único** e um dos destinos de D08: reconstrução com a mesma estrela, repatriação física ou relíquia selada.
- Claim, contestação, custódia e liquidação dependem de **presença militar real**, regras de hostilidade do servidor, locks e idempotência; um claim pendente não é propriedade.
- Destroço selado não se autodestrói por ausência de login, não produz energia/armas, não cria segundo astro.
- Batalhas, ordens e planetas atuais **não** fornecem por si só controle de regiões de espaço profundo. A proposta não autoriza inventar isso silenciosamente.

## 2. D11-A — transferência de custódia por conquista (`APPROVED` como design)

**Escolha recomendada:** permitir transferência coercitiva **somente após uma nova operação de adjudicação**, iniciada por império militarmente habilitado no local, com uma janela contestável e revalidação no commit.

1. O custodiante anterior perde a possibilidade de operar o núcleo no local por derrota/retirada, porém permanece registrado como custodiante até uma transição válida.
2. O novo controlador, quando elegível, solicita **transferência contestada**, informando núcleo, local e cadeia da operação — não recebe armamentos, estrela nem material imediatamente.
3. O servidor registra a operação, abre janela de contestação e bloqueia disposições incompatíveis no mesmo núcleo.
4. A conclusão exige confirmar que o requerente ainda controla legitimamente o local e que não há combate/contestação elegível não resolvida. Retornar ou vencer uma batalha isolada **não** basta se outra força hostil ainda estiver disputando o local.
5. Se ocorrer contestação válida, a transferência pausa/falha de forma determinística; a custódia anterior não é removida. Após a disputa, o requerente poderá retomar ou solicitar novamente conforme futura política de janela (ainda `OPEN`).
6. Com commit de transferência, atualizar o **custodiante**, registrar o dono anterior no histórico, impedir dupla adjudicação e exigir nova validação dos requisitos para qualquer destino.

**Regras de compatibilidade:** não transferir propriedade do planeta, recursos alheios ou pesquisa científica do custodiante anterior; não entregar uma Stargrave operacional. Um adversário que captura o núcleo precisa cumprir os requisitos técnicos para reconstruí-lo.

**Trade-off:** recapturar a região pode interromper a transferência; a posse do núcleo não é um saque instantâneo. A ausência do antigo custodiante não impede para sempre uma transferência legítima, desde que o processo completo de contenda e as regras multiplayer sejam respeitados.

## 3. D11-B — cessão voluntária, com aceitação bilateral (`APPROVED` como design)

**Escolha recomendada:** aceitar cessão somente entre **dois impérios existentes e autenticados**, mediante oferta persistente e aceitação expressa no servidor.

- O custodiante inicia proposta citando exatamente um núcleo, destinatário e condições suportadas; não basta o frontend alterar `custodian_empire_id`.
- O destinatário deve aceitar; um império não recebe estrela ou obrigação logística contra sua vontade.
- **No commit**, ambos são revalidados: existência, autorização, estado não-terminal, nenhuma disputa militar ou disposição comprometida incompatível. Se houver conflito, a cessão é recusada sem efeitos parciais.
- Até o commit, custódia e vínculo permanecem com o cedente. Após o commit, o novo custodiante precisa de **infraestrutura e pesquisa próprias** para qualquer reconstrução.
- Não cria comércio/alianças/mercados em geral; é um fluxo **exclusivo para núcleo selado**, com histórico auditável e mesma identidade estelar.
- `OPEN`: exigir proximidade, autorização diplomática, taxa, permissões de paz ou presença do cedente no local. Não presumir tais regras como já implementadas.

**Vantagem:** possibilita recuperação negociada sem exigir uma guerra artificial para transferir um destroço.

## 4. D11-C — custodiante extinto ou indisponível (`APPROVED` como design)

**Escolha recomendada:** distinguir **inatividade/offline** de **extinção autoritativa do império**.

- Jogador offline, conta inativa ou ausência temporária de naves **não** remove custódia, não gera decadência automática nem libera estrela.
- Apenas um estado **real e persistido** de extinção/eliminação de império, se essa mecânica existir e for autoritativa, pode tornar a custódia **órfã** para a próxima reivindicação. Não inferir extinção por tempo de login.
- O estado órfão **não** torna o núcleo livre instantaneamente; um novo controlador ainda cumpre estabilização/claim/revalidação e contestação aplicáveis.
- Enquanto a transferência não ocorre, o núcleo selado permanece seguro e sem recursos gerados.
- `OPEN`: STARZ deve definir o que significa extinção definitiva, suas regras de dados e recuperação de contas; se não existir mecanismo, **não habilitar** automaticamente essa via no rollout.

## 5. D11-D — localização autoritativa do destroço (`APPROVED` como design)

**Escolha recomendada:** localização como **âncora persistente de combate** com chave de universo/sistema e modalidade, sem usar coordenadas apenas visuais.

| Localidade | Identidade mínima candidata | Presença militar válida |
|---|---|---|
| **Órbita de planeta** | `universe_id`, `system_id`, `planet_id`, `location_kind=planet_orbit` | Naves efetivamente presentes nessa órbita/guarnição, conforme regra implementada e validada |
| **Espaço profundo do sistema** | `universe_id`, `system_id`, `encounter_anchor_id`, `location_kind=deep_space` | Naves efetivamente atribuídas à **mesma âncora** por operações autoritativas futuras, não apenas ao mesmo sistema |
| **Em trânsito** | Identidade de operação, rota/ETA e vínculo do núcleo | Nenhuma reivindicação por proximidade; ações restritas a operação e interceptação futura explicitamente especificada |

**Não inventar `encounter_anchor_id` na UI:** sua existência exige contrato de movimento/combatimento fora de planetas que ainda não está implementado. A primeira entrega técnica poderá limitar claims a destroços na órbita de planeta; **o combate/destruição de Stargrave em espaço profundo não deverá ser liberado até existir persistência de âncora e presença naval equivalentes**. Caso um estado legado/administrativo represente destroço fora da órbita antes disso, mantê-lo `sealed_wreck`, sem resolver custódia incorretamente.

- A posição é persistente, vinculada à nave e ao evento de derrota; não se calcula pela posição de câmera, sprite ou próximo planeta.
- Um núcleo não é simultaneamente reivindicável em órbita, espaço profundo e trânsito.
- Deslocamentos futuros do núcleo são operações reais, com vínculo e ETA, sem teleporte e sem gerar cópias.

## 6. D11-E — arbitragem, janelas e proteção offline (`APPROVED` como design)

**Escolha recomendada:** janela finita e explícita de disputa **sem cronômetro de autodestruição**, integrada ao reconciliador de eventos.

- A estabilização D08-F precede a abertura do claim; tempo **12/24/48 h** continua **apenas experimental**.
- A adjudicação de transferência terá uma **janela adicional configurável**, cujo número ainda `OPEN`; ela permite contestação militar mesmo quando o antigo custodiante estiver offline.
- O término da janela **não** decide sozinho uma disputa militar ainda legítima. Nesses casos, a operação permanece bloqueada e recebe estado terminal/pausado definido, sem loops de adiamento infinito.
- O núcleo permanece seguro indefinidamente enquanto nenhuma operação válida conclui, mas o **claim** não recebe extensão infinita automática: a próxima tentativa exige revalidação.
- Ordenação determinística por evento/ID pode arbitrar qual transação entra primeiro no banco, **nunca** qual império ganha militarmente.
- Não usar horários do cliente ou do navegador como fonte de verdade.

**`OPEN`:** duração final, reabertura automática versus manual de claims, tratamento de contestantes neutros e limites de tentativas. Os parâmetros serão calibrados pela C3.0-D04/D08-F.

## 7. D11-F — contrato de dados e transação de transferência (`APPROVED` como arquitetura conceitual)

**Nenhuma tabela final aprovada aqui.** Campos/entidades abaixo são semânticos para desenho da migração futura.

| Campo lógico | Finalidade |
|---|---|
| `stellar_source_id`, `artifact_id`, `universe_id` | Vincular a mesma estrela/núcleo ao mesmo universo |
| `location_kind`, `location_ref`, `location_version` | Garantir presença e controle no local certo |
| `current_custodian_id`, `previous_custodian_id` | Titularidade atual e trilha histórica |
| `transfer_kind` | Conquista, cessão bilateral ou extinção legitimada |
| `claim_id`, `transfer_id`, `idempotency_key` | Deduplicação, contestação e replay |
| `version`, `committed_at`, `settlement_event_id` | Evitar lost update e estado parcialmente aplicado |

**Invariantes:**
- FK/unicidade de `stellar_source` e artefato, um custodiante confirmado por núcleo, uma transferência ativa elegível e uma disposição ativa no máximo.
- O commit atualiza custódia e histórico/ledger **na mesma transação**. Falha anterior não transfere nada; retry posterior retorna o resultado já comprometido.
- Uma transferência comprometida **não apaga** operações passadas nem permite reprocessar recompensa ou carga; qualquer cancelamento/compensação deve respeitar material efetivamente consumido.
- Oferta de cessão e adjudicação coercitiva concorrentes são operações incompatíveis; somente uma pode concluir. A outra deve falhar ou voltar a estado elegível após revalidação.
- Mudança de localização durante operação invalida ou pausa claims que dependiam da âncora anterior; nunca transfere posse sobre uma localização desatualizada.
- Não persistir dois registros independentes que pretendam ser fonte de verdade da titularidade.

## 8. D11-G — critérios técnicos adicionais (`APPROVED` como plano de QA, não executados)

Complementam **T01–T48 já aprovados como critérios documentais**.

| ID | Cenário | Resultado esperado |
|---|---|---|
| **T49** | Força rival vence batalha sobre destroço sob custódia antiga | Novo império não recebe Stargrave nem estrela automaticamente |
| **T50** | Claim coercitivo com antigo custodiante contestando no prazo | Transferência suspensa e vínculo preservado |
| **T51** | Claim coercitivo válido termina sem contestação elegível | Um commit de novo custodiante, sem nova estrela |
| **T52** | Região é reconquistada antes de commit | Transferência coercitiva inválida ou pausada, sem título retroativo |
| **T53** | Cessão oferecida mas não aceita | Custódia permanece com ofertante |
| **T54** | Cessão aceita após início de outro destino | Rejeitar conflito de versão sem duplicar recursos |
| **T55** | Oferta de cessão e transferência por conquista simultâneas | Apenas uma pode concluir por transação |
| **T56** | Império apenas offline por muitos dias | Não vira órfão, núcleo não desaparece |
| **T57** | Império realmente extinto segundo estado autoritativo | Núcleo pode iniciar fluxo órfão, nunca transferência automática |
| **T58** | Destroço orbital e frota em outro planeta | Reivindicação recusada por falta de co-localização |
| **T59** | Destroço em espaço profundo sem âncora suportada | Manter seguro, não adjudicar por proximidade visual |
| **T60** | Mesmo núcleo localizado simultaneamente em duas âncoras por evento repetido | Recusar dupla posição, preservar origem e um vínculo |
| **T61** | Prazo de claim expira com combate ainda contestado | Nenhuma adjudicação automática, estado recuperável |
| **T62** | Retry após transferência concluída | Não realizar segunda mudança de custodiante, ledger ou recompensa |
| **T63** | Transferência para império de outro universo | Rejeitar por constraints de universo e ownership |
| **T64** | Relatório adversário sobre cessão privada | Não revelar identidade/tecnologia não legitimamente conhecida |

## 9. D11-H — critérios de saída antes de schema e gameplay (`APPROVED` como planejamento)

1. D11-A–G foram aprovados como design; validar futuramente contratos reais de cessão bilateral, órbita/âncora e eventual fluxo de império extinto antes de implementar.
2. Projetar contratos de combate/movimento em espaço profundo **antes** de disponibilizar destroços disputáveis fora da órbita planetária. Não falsificar posição com um `target_planet_id` aleatório.
3. Definir regras jurídicas de jogo (war status, neutralidade, extinção, controle regional e transferência entre impérios) que realmente existam no servidor, com lacunas explícitas.
4. Escolher modelo mínimo de tabelas/constraints/versão com migração aditiva segura e rollback que preserve operações pendentes.
5. Planejar observabilidade e UI compacta: mostrar ação contextual de reclamar, contestar, ceder ou executar destino só quando autorizada.
6. T49–T64 estão aprovados como critérios de QA **não executados**; sua implementação e execução ainda requerem autorização separada.
7. Só depois parametrizar tempos/percentuais e comparar limites conservador, intermediário e elevado; não promover números hipotéticos de D08-F para produção.

**Se houver desacordo entre proposta e modelo executável, preservar o estado autoritativo atual e registrar a lacuna.** Não criar serviços paralelos de posse, claims ou Stargrave.

## 10. Registro das decisões D11 aprovadas

| ID | Decisão `APPROVED` como design |
|---|---|
| **D11-A** | Transferência por conquista requer novo claim contestável e commit de custódia, nunca saque imediato |
| **D11-B** | Cessão voluntária requer oferta e aceitação explícita de dois impérios, transacional |
| **D11-C** | Offline não equivale a extinção; núcleo órfão só quando eliminação for estado autoritativo |
| **D11-D** | Destroço tem âncora física persistente; espaço profundo precisa contrato de presença/combate antes de liberação |
| **D11-E** | Janelas finitas para claims sem autodestruição do núcleo e sem decidir guerra por timeout |
| **D11-F** | Transferências com unicidade, versionamento, histórico, idempotência e localização revalidada |
| **D11-G** | Cenários T49–T64 como critérios técnicos futuros, não executados |
| **D11-H** | Gates de aprovação, localização, schema, segurança, UX e QA antes de implementar |

**`APPROVED`:** D11-A–H e T49–T64 como contratos/QA futuros. **`OPEN`:** definição executável de espaço profundo, status autoritativo de extinção, neutralidade/alianças, prazos quantitativos, custódia de terceiros, resgate do proprietário histórico, propriedade da relíquia e colonização após repatriação. Nomes de enums, tabelas e campos não são definitivos.

### Atualização de escopo — desenvolvimento sem saves legados

O responsável dispensou retrocompatibilidade com **saves de desenvolvimento** enquanto o produto ainda não foi lançado. Isso **não** elimina as garantias de identidade, autoria, atomicidade, idempotência, exclusividade de estrela ou integridade **durante a execução**. Banco e ambientes compartilhados, contas e dados reais não ficam autorizados para limpeza por esta decisão. O plano seguinte de implementação e schema é a [C3.0-D12](combat-implementation-plan.md), **`PROPOSED`**, sem autorização de código.

## 11. Referências

- [C3.0-D10 aprovada](combat-custody-adjudication.md), [C3.0-D09 aprovada](combat-stellar-custody.md), [C3.0-D08 aprovada](combat-stellar-disposition.md), [C3.0-D07 aprovada](combat-technical-contracts.md).
- [Registro de decisões](combat-3-decisions.md), [Stargrave](stargrave.md), [índice](README.md), [QA e balanceamento](combat-balance-plan.md).
- [Modelos de dados](../../starz/db/models.py), [serviço persistente](../../starz/persistent/service.py), [motor de combate](../../starz/persistent/combat.py).

**Não há implementação, migration, testes de gameplay, PR ou merge decorrentes desta aprovação.** A dispensa de compatibilidade com **saves descartáveis de desenvolvimento**, aprovada posteriormente, está registrada no [plano D12](combat-implementation-plan.md) e no [índice](README.md); não autoriza apagar dados de ambientes compartilhados.
