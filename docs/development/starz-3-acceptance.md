# STARZ 3.0 — rastreabilidade da aceitação técnica

Registro de evidências: 2026-11-08. **O gate final `full` do agente principal está pendente. Este documento não aprova o lançamento.** Nenhum teste foi executado para produzir este documento.

Esta matriz relaciona os critérios aprovados [D07 T01–T16](../game-design/combat-technical-contracts.md), [D09 T17–T32](../game-design/combat-stellar-custody.md), [D10 T33–T48](../game-design/combat-custody-adjudication.md), [D11 T49–T64](../game-design/combat-custody-transfer.md) e [D04 B01–B18](../game-design/combat-balance-plan.md) aos testes executáveis e resultados preservados. Aprovações posteriores do responsável autorizam implementação, coeficientes experimentais, custódia orbital, encerramento de reivindicações contestadas com nova tentativa manual, cessão bilateral, retirada física e repatriação do núcleo. As antigas proibições de execução restritas à etapa documental são históricas; não constituem evidência de testes.

## Significado dos estados e limites

- **PASS:** um teste identificado e executado comprova diretamente o comportamento delimitado, na revisão de código daquela execução. Não significa aprovação de todo o subsistema, de todos os modos de falha ou da versão final atual.
- **PARTIAL:** existe cobertura executada relacionada, mas falta o cenário exato, a camada de integração ou a reexecução necessária. O nome de um teste, por si só, nunca comprova aceitação.
- **BLOCKED:** o cenário completo depende de um contrato funcional deliberadamente não suportado. Um teste que comprova a recusa segura não torna a operação indisponível implementada.
- **WAIVED:** a compatibilidade com saves obsoletos de desenvolvimento descartável foi expressamente dispensada. Persistência, identidade e reprocessamento correto durante a execução continuam obrigatórios.

As fixtures de CPU exercitam funções reais das regras com fronteiras sintéticas de ORM e sessão. Não comprovam bloqueios do PostgreSQL nem durabilidade após queda do processo. As fixtures PG são isoladas e sintéticas. O teste de derrota real constrói, comissiona, movimenta e derrota uma Stargrave por ordens reais; os demais testes que posicionam um destroço sintético comprovam custódia ou transporte, não derrota em combate.

## Evidências de execução

Os artefatos em `.qa/` são evidências locais ignoradas pelo Git, não fixtures versionadas. Preserve suas assinaturas de código ao usar resultados em cache. Resultados históricos de escopos reduzidos não são somados para declarar aprovação da suíte completa atual.

| Etapa | Resultado observado | Evidência e ressalva |
|---|---|---|
| P0 referência inicial | Conteúdo PASS; CPU 83 PASS; PG 32 PASS | [Resumo](../../.qa/runs/starz3-p0/summary.json). Referência anterior à nova implementação. |
| P1 | 12 testes direcionados PASS | [Log](../../.qa/runs/starz3-p1/unittest.log). Catálogo e progressão, não ativação de operações. |
| P2 regras | 31 testes CPU PASS | [Log](../../.qa/runs/starz3-p2-combat/unit-final.log). |
| P2 ordens | 3 testes PG PASS | [Log](../../.qa/runs/starz3-p2-orders/backend-db.log). |
| P3 inicial | 5 PG PASS, 2 ERROR | [Log original](../../.qa/runs/starz3-p3-db/backend-db.log). Falha de autoflush no comissionamento; esta execução não foi aprovada. |
| P3 reexecução do comissionamento | Os 2 casos PG que falharam obtiveram PASS | [Log direcionado](../../.qa/runs/starz3-p3-commission/backend-db.log). Correção verificada de forma direcionada, não reexecução dos sete casos. |
| P3 concorrência | 2 corridas PG PASS | [Log](../../.qa/runs/starz3-p3-concurrency/backend-db.log). Corrida de reserva estelar e colonização. |
| P4 regras | 54 testes CPU PASS | [Log](../../.qa/runs/starz3-p4-combat/cpu-final.log). Inclui testes de regressão relacionados. |
| P4 operações | 2 + 2 casos PG PASS | [Viagem e derrota](../../.qa/runs/starz3-p4-db/backend-db.log), [órbita e bombardeio](../../.qa/runs/starz3-p4-orbital/backend-db.log). |
| P4 inteligência | 4 testes CPU PASS | [Log](../../.qa/runs/starz3-p4-intelligence/unit.log). |
| P5 integração inicial | 7 casos PG PASS; tempo do unittest: 335.546 s | [Log](../../.qa/runs/starz3-p5-db/backend-db.log), [resumo do executor](../../.qa/runs/starz3-p5-db/summary.json). O tempo de 339.092 s do executor inclui preparação e encerramento. Cobre cinco casos de custódia e dois de transporte físico do núcleo. |
| P5 transporte de módulos | 2 testes CPU PASS | [Log](../../.qa/runs/starz3-p5-modules/unit.log). |
| P5 transporte inicial do núcleo | 10 testes CPU PASS | [Log](../../.qa/runs/starz3-p5-transport/cpu-initial.log). As correções posteriores de segurança do transporte exigem evidência mais recente. |
| P5 correções de segurança e privacidade da custódia | 20 testes CPU PASS, 0.189 s | Executados na sessão de implementação; não foi criado log separado. Incluem chegadas hostis vencidas, substituição de ofertas e privacidade da localização para o proprietário histórico. **Os casos PG novos ou alterados não foram reexecutados nas evidências acima.** |
| P6 amostras experimentais do resolvedor | 327 linhas; 288 registradas como verificadas por repetição; `balanced: false` | [Resultados](../../.qa/runs/starz3-balance/results.json), [gerador](../../scripts/starz3-balance.py). As amostras não certificam taxa de vitória ou equilíbrio econômico. |

O resultado PG dos sete casos P5 antecede as correções de desempate temporal de custódia, imunidade por oferta, localização do proprietário histórico e segurança do transportador retido. Portanto, esse resultado histórico não valida o código final. O agente principal deve registrar separadamente a reexecução direcionada e o gate final.

## Chave das referências de testes

As referências abaixo usam `alias.method` e apontam para a classe exata de unittest nesta tabela. Os identificadores dos métodos são nomes de testes executáveis, não novos IDs de aceitação.

| Alias | Origem / classe |
|---|---|
| C3 | [test_combat3.py](../../tests/test_combat3.py), `Combat3` |
| CO | [test_combat3_orders.py](../../tests/test_combat3_orders.py), `CombatOrders` |
| CI | [test_combat3_intelligence.py](../../tests/test_combat3_intelligence.py), `ElectronicIntelligence` |
| SP | [test_stellar_projects.py](../../tests/test_stellar_projects.py), `StellarProjects` |
| SR | [test_stellar_projects.py](../../tests/test_stellar_projects.py), `StellarRules` |
| SD | [test_stellar_delivery.py](../../tests/test_stellar_delivery.py), `StellarDelivery` |
| SG | [test_stargrave.py](../../tests/test_stargrave.py), `Stargrave` |
| SO | [test_stargrave_operations.py](../../tests/test_stargrave_operations.py), `StargraveOperations` |
| CR | [test_stellar_custody.py](../../tests/test_stellar_custody.py), `CustodyRules` |
| CP | [test_stellar_custody.py](../../tests/test_stellar_custody.py), `CustodyPersistence` |
| TR | [test_stellar_transport.py](../../tests/test_stellar_transport.py), `StellarTransport` |
| TP | [test_stellar_transport.py](../../tests/test_stellar_transport.py), `CoreTransportPersistence` |

## T01–T16 — combate, eventos e identidade estelar

| ID | Status | Evidência executável | Limite restante / escopo exato |
|---|---|---|---|
| T01 | PARTIAL | C3.test_b01_frozen_legacy_report_and_persistent_state; CO.test_T02_dispatch_validates_freezes_and_duplicate_cannot_spend | O resolvedor convencional reproduz os resumos congelados do comportamento anterior. A compatibilidade de payloads antigos de missões de desenvolvimento foi dispensada; isto não comprova todos os payloads históricos de ATTACK e retorno. |
| T02 | PASS | CO.test_T02_dispatch_validates_freezes_and_duplicate_cannot_spend | Payload de doutrina e perfil congelado, propriedade e recusa de despacho ou pagamento duplicado verificados em PG. |
| T03 | PASS | C3.test_b11_ew_source_lost_next_salvo_and_no_secret_telemetry | A perda do emissor passa a valer no snapshot da salva seguinte. |
| T04 | PASS | C3.test_b11_b12_pure_ew_presence_redundancy_and_resistance; CI.test_transit_remote_or_multiple_emitters_do_not_invent_protection | Múltiplos emissores reais não acumulam interferência indefinidamente. |
| T05 | PASS | C3.test_b11_b12_pure_ew_presence_redundancy_and_resistance | Resistência determinística e disparos preservados; os coeficientes continuam experimentais. |
| T06 | PASS | C3.test_b13_single_budget_planet_naval_shield_hull_and_armor; C3.test_b10_b13_actual_generator_charge_and_ammo_persist_once | Escudo compartilhado, escudo naval e casco usam um único orçamento, com carga e munição reais. |
| T07 | PASS | C3.test_interdiction_platform_targetable_without_conventional_fire; CO.test_T07_T08_T09_interdiction_once_then_peace_and_return | A plataforma em interdição continua sendo alvo válido, sem disparos convencionais. |
| T08 | PASS | CO.test_T07_T08_T09_interdiction_once_then_peace_and_return | Uma sucessora, sem nova compra de combustível, com trânsito preservado. |
| T09 | PASS | CO.test_T07_T08_T09_interdiction_once_then_peace_and_return | Sem novo atraso; a paz impede o combate e permite o retorno. |
| T10 | PASS | SD.test_T10_two_empires_cannot_reserve_same_star_concurrently | Corrida PG real de reserva entre dois impérios. |
| T11 | PASS | SD.test_T11_colonization_and_reservation_are_atomic_competitors | Corrida PG real entre captura e colonização; um único compromisso válido. |
| T12 | PARTIAL | SD.test_recall_returns_same_modules_and_cargo_without_delivering; SD.test_T12_all_phases_real_delivery_and_removal_at_stabilization | Entrega física, recall e reprocessamento cobertos. Não houve injeção de queda do worker durante o commit de uma remessa. |
| T13 | PASS | SO.test_conventional_fleet_can_defeat_real_commissioned_unit_without_containment; CP.test_paid_construction_real_move_conventional_defeat_claim_and_relic | Construção paga real e derrota por 48 Leviathans convencionais, sem substituir a Stargrave por um hull convencional ampliado. |
| T14 | PASS | SG.test_sealed_units_never_regenerate_or_move_and_view_keeps_defeat_time; CP.test_paid_construction_real_move_conventional_defeat_claim_and_relic | Destroço seguro, identidade estelar preservada, energia militar zerada e movimento bloqueado. |
| T15 | PARTIAL | SD.test_T12_all_phases_real_delivery_and_removal_at_stabilization; TP.test_physical_repatriation_native_dispatch_offline_ticks_reinstalls_once_and_returns_fleet | Ticks repetidos e novas sessões de banco cobertos; encerramento forçado do processo, reinício e perda de resposta não foram demonstrados. |
| T16 | PARTIAL | CO.test_interdiction_disable_does_not_refund_committed_delay_and_reports_private; CI.test_stellar_observation_never_exposes_unrelated_homeworld | Sigilo dos relatórios no servidor coberto; estas evidências não incluem auditoria abrangente de privacidade em logs e navegador. |

## T17–T32 — núcleo seguro e destinos

| ID | Status | Evidência executável | Limite restante / escopo exato |
|---|---|---|---|
| T17 | PASS | CP.test_paid_construction_real_move_conventional_defeat_claim_and_relic | Combate real produz o mesmo núcleo e fonte estelar selados, sem energia militar. |
| T18 | PARTIAL | SG.test_sealed_units_never_regenerate_or_move_and_view_keeps_defeat_time | Verificação sintética de tempo decorrido; não houve execução prolongada offline com reinício do servidor. |
| T19 | PASS | SG.test_sealed_units_never_regenerate_or_move_and_view_keeps_defeat_time; SG.test_owner_hostility_operation_conflict_and_due_time | Vitória ou propriedade não permite ativar uma unidade selada sem reconstrução. |
| T20 | PARTIAL | CP.test_same_actor_concurrent_claims_and_destinations_have_one_effect | Duas chaves do mesmo império elegível disputam em PG. A regra de planeta próprio não permite representar dois impérios estrangeiros simultaneamente elegíveis. |
| T21 | PASS | CR.test_loss_of_military_presence_does_not_leave_pending_claim | A perda de presença militar local encerra a tentativa sem transferir custódia; verificação em CPU. |
| T22 | PARTIAL | CP.test_same_actor_concurrent_claims_and_destinations_have_one_effect | Corrida real entre reconstrução e relíquia, não entre reconstrução e repatriação. |
| T23 | PASS | CR.test_rebuild_consumes_five_local_paid_modules_preserving_original_history_and_identity; CP.test_real_colony_transport_then_rebuild_uses_same_core_and_immutable_factory_origin | A conclusão reprocessada consome cinco módulos físicos de reposição uma única vez, preservando o histórico do projeto original. |
| T24 | PARTIAL | TR.test_recall_after_pickup_backtracks_then_tows_same_core_home_without_refund; TR.test_lost_custody_or_war_at_pickup_returns_tug_without_taking_core | Falhas e recall exercitados em CPU; a evidência PG original cobre viagens bem-sucedidas. A validação PG da nova segurança de transportador retido e de retomada está pendente. |
| T25 | PARTIAL | TP.test_physical_repatriation_native_dispatch_offline_ticks_reinstalls_once_and_returns_fleet | Mesma fonte estelar, unidade, sistema de origem e estoques preservados verificados. Falta comparação exaustiva de IDs de planetas, ambiente e inventário de instalações antes e depois. |
| T26 | PARTIAL | CP.test_paid_construction_real_move_conventional_defeat_claim_and_relic; CR.test_relic_recovery_uses_paid_original_modules_once_and_never_creates_fuel | Relíquia terminal, energia zerada e recuperação única limitada aos materiais pagos. Falta matriz completa de ações e recaptura de relíquias. A recuperação é salvamento aprovado, não geração contínua. |
| T27 | PASS | CR.test_cancel_rebuild_releases_unconsumed_modules_without_refund; TR.test_recall_after_pickup_backtracks_then_tows_same_core_home_without_refund | Sem reembolso da fabricação; o rebocador consumido permanece consumido; o núcleo embarcado retorna fisicamente. Verificações CPU não substituem durabilidade após queda. |
| T28 | BLOCKED | SR.test_canonical_identity_and_profile; gerador autoritativo em starz/universe.py | O gerador representa uma estrela central, sem fixture binária ou múltipla. Não existe caso executável de aceitação da recusa de sistemas com múltiplas estrelas. |
| T29 | PASS | SD.test_T12_all_phases_real_delivery_and_removal_at_stabilization | O snapshot real da galáxia indica ausência da estrela após a fase 2, preserva planetas e recusa colonização. |
| T30 | PARTIAL | CR.test_conquest_needs_war_and_its_own_window; TR.test_lost_custody_or_war_at_pickup_returns_tug_without_taking_core | Existem revalidações de hostilidade e coleta; a combinação exata de reivindicações concorrentes, paz e recall não foi demonstrada. |
| T31 | WAIVED | Política de saves descartáveis de desenvolvimento aprovada pelo responsável; verificações de instalação limpa nas fixtures PG | Sem promessa de suporte a saves antigos ou backfill. A correção durante a execução continua obrigatória. |
| T32 | PASS | CP.test_paid_construction_real_move_conventional_defeat_claim_and_relic; TP.test_physical_repatriation_native_dispatch_offline_ticks_reinstalls_once_and_returns_fleet | Ticks repetidos deixam um único efeito de recuperação da relíquia ou reinstalação. Alterações posteriores de código ainda exigem a reexecução final. |

## T33–T48 — adjudicação e persistência

| ID | Status | Evidência executável | Limite restante / escopo exato |
|---|---|---|---|
| T33 | PARTIAL | CP.test_same_actor_concurrent_claims_and_destinations_have_one_effect | Corrida real de reserva para um mesmo império. A arbitragem completa entre dois impérios elegíveis está fora da entrega limitada a planeta próprio; não declarar T33 integralmente PASS. |
| T34 | PARTIAL | CR.test_due_real_hostile_fleet_or_stellar_arrival_contests_for_both_uuid_orders; CR.test_real_battle_before_or_after_claim_due_never_awards_custody_ahead_of_hostilities | As correções mais recentes em CPU cobrem ambas as ordens de UUID e funções reais de combate. CP.test_same_tick_real_hostile_attack_cannot_lose_contestation_to_claim_uuid foi adicionado, mas sua reexecução PG está pendente. |
| T35 | PASS | CR.test_claim_is_timed_replayed_once_and_conflicting_key_is_rejected; CP.test_actual_tick_claim_cession_private_views_and_cancel_replay | O mesmo pedido recebe resposta estável, sem segunda operação ou custo. |
| T36 | PASS | CR.test_claim_is_timed_replayed_once_and_conflicting_key_is_rejected; CR.test_ledger_provenance_is_once_and_rejects_conflicting_reuse | Reutilização conflitante recusada sem aplicar outro efeito. |
| T37 | PASS | CR.test_loss_of_military_presence_does_not_leave_pending_claim | Verificação CPU de ausência de transferência de custódia quando a presença é perdida antes do commit. |
| T38 | PARTIAL | CR.test_conquest_needs_war_and_its_own_window; CP.test_actual_tick_claim_cession_private_views_and_cancel_replay | A custódia existente permanece durante transferência pendente; a perda exata de controle militar após o commit não foi exercitada de forma independente. |
| T39 | PARTIAL | CR.test_cession_requires_acceptance_peace_and_grants_only_core_pickup | Aceitação não autorizada recusada. Falta teste específico de alteração arbitrária do custodiante por terceiro e do respectivo registro de auditoria. |
| T40 | PASS | CP.test_same_actor_concurrent_claims_and_destinations_have_one_effect | Um único destino ativo e um conjunto de efeitos na corrida PG real entre reconstrução e relíquia. |
| T41 | PARTIAL | CR.test_cancel_rebuild_releases_unconsumed_modules_without_refund; TR.test_recall_after_pickup_backtracks_then_tows_same_core_home_without_refund | A reconstrução consome todas as reposições na conclusão; o cancelamento após consumo parcial é representado pelo rebocador consumido no transporte, não por consumo gradual na reconstrução. |
| T42 | PARTIAL | CR.test_ledger_provenance_is_once_and_rejects_conflicting_reuse; TP.test_physical_repatriation_native_dispatch_offline_ticks_reinstalls_once_and_returns_fleet | Reentrada e ticks duplicados cobertos; não houve injeção de perda da resposta do worker após o commit SQL. |
| T43 | PARTIAL | SP.test_source_foreign_universe_fk_and_snapshot_privacy | Recusa real de FK de fonte estelar entre universos. Nem todas as combinações de FK de unidade, operação e ledger foram exercitadas individualmente. |
| T44 | PARTIAL | SG.test_sealed_units_never_regenerate_or_move_and_view_keeps_defeat_time; CP.test_paid_construction_real_move_conventional_defeat_claim_and_relic | Sessões e ticks recarregam o estado do banco; não houve caso prolongado com reinício real do processo do servidor. |
| T45 | PARTIAL | CP.test_same_actor_concurrent_claims_and_destinations_have_one_effect; TR.test_launch_detects_double_fuel_payment_and_requires_reserved_tug | Exclusividade de operação e proteções de transporte cobertas; falta o par exato de pedidos simultâneos de movimentação do núcleo em PG. |
| T46 | PARTIAL | TP.test_physical_repatriation_native_dispatch_offline_ticks_reinstalls_once_and_returns_fleet | Identidade original e remoção do indicador de ausência verificadas; a regeneração visual após a reinstalação não foi verificada diretamente aqui. |
| T47 | PARTIAL | CR.test_historical_non_custodian_cannot_track_unknown_recipient_orbit; CR.test_historical_owner_view_has_roles_but_no_private_payload_stocks_or_offers; CP.test_actual_tick_claim_cession_private_views_and_cancel_replay | O controle mais recente em CPU cobre órbita desconhecida ou levantada do destinatário; os testes PG de visualização anteriores antecedem esta correção. A aceitação de autorização e privacidade no navegador está pendente. |
| T48 | PARTIAL | SR.test_downgrade_refuses_stellar_records_or_active_orders_before_any_drop; CR.test_t48_downgrade_guard_and_empty_schema | Testes CPU executáveis de recusa de downgrade e caminho vazio; instalações limpas e verificações de schema PG aprovadas. Não houve tentativa real de downgrade com dados. |

## T49–T64 — custódia confirmada, transferências e limites espaciais

| ID | Status | Evidência executável | Limite restante / escopo exato |
|---|---|---|---|
| T49 | PARTIAL | SO.test_conventional_fleet_can_defeat_real_commissioned_unit_without_containment; CR.test_conquest_needs_war_and_its_own_window | A batalha não concede unidade operacional; falta testar a batalha exata sobre destroço com custódia previamente confirmada. |
| T50 | PARTIAL | CR.test_hostile_real_stellar_contest_terminates_without_transfer_and_allows_manual_retry | Reivindicação inicial contestada testada. O mesmo cenário com reivindicação coercitiva e contestação do antigo custodiante não foi executado de forma independente. |
| T51 | PASS | CR.test_conquest_needs_war_and_its_own_window | Nova janela e um único commit de custódia; fonte e unidade preservadas. Evidência CPU, não cenário PG separado e incondicional de conquista. |
| T52 | PARTIAL | CR.test_loss_of_military_presence_does_not_leave_pending_claim | Perda de presença coberta; reconquista planetária ou mudança exata de controle antes do commit não demonstrada. |
| T53 | PASS | CR.test_cession_requires_acceptance_peace_and_grants_only_core_pickup | Oferta não aceita mantém a custódia inalterada. |
| T54 | PARTIAL | CR.test_only_authorized_conquest_can_supersede_unaccepted_offer; CR.test_cession_requires_acceptance_peace_and_grants_only_core_pickup | Destinos em andamento não podem ser substituídos. Falta caso específico executado de aceitação desatualizada após início de um destino. |
| T55 | PARTIAL | CR.test_offer_cannot_immunize_core_from_authorized_conquest_in_either_order; CP.test_offer_and_conquest_after_cession_cannot_overwrite_each_other | CPU agora comprova que conquista autorizada substitui ofertas não aceitas em ambas as ordens. O teste PG foi atualizado; o PASS anterior de sete casos antecede a regra corrigida e não representa aceitação atual. |
| T56 | PARTIAL | SG.test_sealed_units_never_regenerate_or_move_and_view_keeps_defeat_time | Não foi introduzida expiração por inatividade; falta execução PG de muitos dias offline. |
| T57 | BLOCKED | Não existe contrato ou estado autoritativo de extinção de império | Offline ou perda de ativos nunca implica extinção. Nenhum fluxo automático de orfandade ou adjudicação é aceito como implementado. |
| T58 | PARTIAL | CR.test_stabilization_presence_deep_space_and_existing_claims_are_enforced; CR.test_factory_origin_does_not_authorize_remote_module_consumption | Ausência de naves locais e uso de módulos remotos recusados; o caso exato de frota em outro planeta impedindo custódia não foi executado separadamente. |
| T59 | BLOCKED | CR.test_stabilization_presence_deep_space_and_existing_claims_are_enforced | Existe recusa por falta de âncora. Presença, combate e custódia em espaço profundo continuam não suportados; recuperação de transportador retido é um estado de segurança, não gameplay em espaço profundo. |
| T60 | PARTIAL | TR.test_pickup_consumes_real_tug_once_then_reinstalls_original_source_and_native_return; TP.test_physical_repatriation_native_dispatch_offline_ticks_reinstalls_once_and_returns_fleet | Mesmo núcleo no transportador e na chegada, com uma fonte, verificados. Não houve injeção de evento corrompido com localização duplicada. |
| T61 | PASS | CR.test_hostile_real_stellar_contest_terminates_without_transfer_and_allows_manual_retry | Reivindicação vencida e contestada torna-se terminal sem conceder custódia; nova tentativa manual recebe nova janela. |
| T62 | PASS | CR.test_claim_is_timed_replayed_once_and_conflicting_key_is_rejected; CR.test_ledger_provenance_is_once_and_rejects_conflicting_reuse | Uma única custódia ou efeito sob reprocessamento; sem segunda titularidade ou recompensa. |
| T63 | PARTIAL | SP.test_source_foreign_universe_fk_and_snapshot_privacy | Existem constraints de mesmo universo, mas o caso PG negativo citado verifica vínculo da fonte, não todos os caminhos de transferência para destinatário de custódia. |
| T64 | PARTIAL | CR.test_historical_non_custodian_cannot_track_unknown_recipient_orbit; CR.test_historical_owner_view_has_roles_but_no_private_payload_stocks_or_offers; CP.test_actual_tick_claim_cession_private_views_and_cancel_replay | Operações restritas às partes e visualização histórica segura cobertas; falta teste específico no navegador de terceiro sem relação consultando cessão privada. |

## B01–B18 — invariantes funcionais e evidências de balanceamento

Um PASS nesta tabela aceita apenas a invariante técnica identificada. **Nenhuma linha certifica coeficientes de produção ou equilíbrio do endgame.** O artefato experimental contém B02=39, B03=39, B04=39, B05=36, B13=42, B15=60, B16=36 e B17=36 linhas. Apenas 288 são registradas como verificadas por repetição; as outras 39 são amostras complementares. Custos apenas de hull excluem pesquisa, combustível, infraestrutura, manutenção e tempo de reposição. As amostras B16 do resolvedor não comprovam autorização por inteligência; ela possui testes separados.

| ID | Status | Evidência executável / amostra | Escopo ainda não coberto |
|---|---|---|---|
| B01 | PASS | C3.test_b01_frozen_legacy_report_and_persistent_state | Quatro resumos congelados do resolvedor convencional e de seu estado. Sem promessa para formatos obsoletos de save. |
| B02 | PARTIAL | C3.test_b02_b04_class_matchups_and_replay; amostra B02 | Composição real de 10 Horizon e 3 Vanguard, inversão e repetição; falta análise completa de equivalência econômica e acesso. |
| B03 | PARTIAL | C3.test_b02_b04_class_matchups_and_replay; amostra B03 | Composição real de 6 Vanguard e 2 Aegis, com amostras de doutrina e perfil; julgamento econômico do custo de oportunidade pendente. |
| B04 | PARTIAL | C3.test_b02_b04_class_matchups_and_replay; amostra B04 | Composição real de 4 Sentinel e 1 Leviathan, com inversões; sem limiar de balanceamento aprovado. |
| B05 | PARTIAL | C3.test_b05_b06_exact_escort_hulls_and_attacker_class; amostra B05 | Elegibilidade exata e ambas as composições amostradas; análise completa de sobrevivência do apoio e custo de reposição pendente. |
| B06 | PASS | C3.test_b06_one_redirect_recalculates_class_and_no_recursion; C3.test_b06_projected_dead_escort_cannot_redirect | Um redirecionamento elegível, dano pela classe efetiva e ausência de recursão. |
| B07 | PASS | C3.test_b07_simultaneous_death_preserves_planned_fire; C3.test_b07_escort_dies_after_redirect_and_fires_only_current_salvo | Tiros já planejados são preservados na morte simultânea; a perda passa a valer nas salvas seguintes. |
| B08 | PASS | C3.test_b08_local_garrison_only_and_research_gate | Associação real ao planeta, exclusão de trânsito e requisito científico exercitados em fixtures CPU das regras. |
| B09 | PASS | C3.test_b09_doctrines_fallback_and_ties | Preferência de classe pretendida, classificação determinística e fallback convencional. |
| B10 | PASS | C3.test_b10_ammunition_once_and_empty_battery; C3.test_b10_b13_actual_generator_charge_and_ammo_persist_once | Sem disparos com munição vazia; um único gasto real de escudo e munição. |
| B11 | PASS | C3.test_b11_b12_pure_ew_presence_redundancy_and_resistance; C3.test_b11_ew_source_lost_next_salvo_and_no_secret_telemetry | Emissor físico, resistência, perda na salva seguinte e sigilo; sem aprovação de eficácia ou balanceamento. |
| B12 | PASS | CI.test_B12_new_observation_degraded_only_with_local_living_odyssey; CI.test_transit_remote_or_multiple_emitters_do_not_invent_protection | Apenas novas observações, relatório anterior inalterado e emissor local físico. |
| B13 | PARTIAL | C3.test_b13_single_budget_planet_naval_shield_hull_and_armor; C3.test_b13_unshielded_profile_has_hull_cost_in_real_battle; amostra B13 | Compensação entre escudo e casco demonstrada; dominância econômica entre composições ainda não decidida. |
| B14 | PASS | CO.test_T07_T08_T09_interdiction_once_then_peace_and_return; CO.test_interdiction_disable_does_not_refund_committed_delay_and_reports_private | Comportamento real de sucessora, paz, resolução offline, desativação e retorno; atrasos experimentais não representam balanceamento final. |
| B15 | PARTIAL | SO.test_conventional_fleet_can_defeat_real_commissioned_unit_without_containment; CP.test_paid_construction_real_move_conventional_defeat_claim_and_relic; amostra B15 | Derrota real demonstrada. As amostras também variam 4, 8, 12 e 24 capitais; falta equivalência industrial, logística e de reposição completa. |
| B16 | PARTIAL | SG.test_aimed_shot_reuses_one_budget_shield_armor_and_no_structural_double_hit; SG.test_current_confirmed_intelligence_for_directed_only_and_actual_foreign_anchor; amostra B16 | Seleção de alvo, proteção e autorização funcionais cobertas; eficácia econômica medida e coeficientes finais pendentes. |
| B17 | PARTIAL | C3.test_b05_b06_exact_escort_hulls_and_attacker_class; amostra B17 | Existem amostras com apoio convencional; falta comparação completa de apoio, retirada e logística da unidade excepcional. Não se infere direito automático de escolta especial para Stargrave. |
| B18 | PARTIAL | CO.test_T07_T08_T09_interdiction_once_then_peace_and_return; CP.test_same_actor_concurrent_claims_and_destinations_have_one_effect; TP.test_physical_repatriation_native_dispatch_offline_ticks_reinstalls_once_and_returns_fleet | Resolução offline, reprocessamento, propriedade e corridas direcionadas cobertos; reexecuções das novas proteções de empate temporal e retenção, além de injeção de queda e reinício, continuam pendentes. Compatibilidade de saves antigos dispensada. |

## Gate restante e exclusões deliberadas

1. O agente principal deve reexecutar os casos PG afetados de custódia e transporte após as correções de segurança e, depois, executar o gate final completo conforme o risco. Aprovações direcionadas anteriores não podem ser apresentadas como uma execução completa posterior.
2. Presença militar e custódia em espaço profundo, assim como extinção autoritativa de impérios, permanecem BLOCKED. Um núcleo selado retido em um transportador real é um estado de segurança com nova tentativa explícita de retorno físico, não um quarto destino final ou uma mecânica de extinção.
3. A exigência de planeta próprio limita a elegibilidade simultânea. Corridas SQL do mesmo império comprovam exclusividade, não adjudicação geral entre dois impérios em espaço não suportado.
4. Recarregar estados e repetir ticks não equivale a testar queda do processo ou perda da resposta. Os testes de proteção de downgrade simulam o acesso ao banco; nenhuma reversão destrutiva ou reset de dados reais foi tentado.
5. Custos, volume de módulos, HP, energia, prazos, recuperação de materiais e coeficientes de combate continuam experimentais. O artefato de amostras registra expressamente `balanced: false`; nenhuma meta de taxa de vitória em produção foi inferida.
6. Capturas de tela, acessibilidade, revisão de código e fixtures de frontend são evidências separadas. Esta matriz técnica não declara privacidade no navegador ou aceitação visual para lançamento a partir dos testes de backend.
