# STARZ — C3.0-D12: proposta de schema mínimo e plano de implementação

**Estado:** `PROPOSED` — documentação técnica para decisão, não implementada.  
**Base:** [C3.0-D01–D11 aprovadas](combat-3-decisions.md), incluindo [D11](combat-custody-transfer.md), [R3.0-D01](research-3.md) e as partes aprovadas da [D06](combat-operational-closures.md).  
**Nova decisão de escopo do responsável (08/11/2026):** **não é necessário preservar compatibilidade ou migrar saves legados de desenvolvimento**; o STARZ ainda está em desenvolvimento. Essa dispensa **não** autoriza eliminar identidades científicas/hulls já aprovadas, corromper estado em execução, apagar dados reais ou resetar ambientes compartilhados sem permissão específica.  
**Objetivo:** sair da expansão indefinida de propostas e entrar em um **plano implementável, sequenciado e verificável**. Não aprova por si só alterações de gameplay, migration, deploy, PR ou merge.

## 1. O que muda com a dispensa de retrocompatibilidade de saves

| Aspecto | Política anterior | Política autorizada agora |
|---|---|---|
| Saves de jogadores **somente em ambiente descartável de desenvolvimento** | Compatibilidade/backfill com todos os formatos antigos | **Dispensada**; a implementação futura pode exigir um banco/fixture novo, **após** verificar que ambiente e dados são descartáveis |
| Missões `UniverseOrder` legadas em ambiente descartável | Regras de fallback e transição entre versões | A primeira versão da nova regra pode exigir **contrato único limpo**, sem caminho de suporte a payload histórico |
| Schema inicial de Stargrave | Migração aditiva com leitura dual-version e backfill | **Schema alvo limpo** recomendado; migração ou recriação **somente** em instância de teste isolada e autorizada |
| 44 IDs de pesquisa, identidades de hulls e decisões funcionais | Preservar | **Continuam aprovados** em Research 3.0 e Combat 3.0; não reescrever decisões funcionais porque saves foram dispensados |
| Estado **em execução** (conflito de ordens, custódia, recursos e estrela) | Transações, dedupe, integridade | **Mantido integralmente**: requisitos de correção do multiplayer persistente continuam obrigatórios |
| Produção, serviços compartilhados e dados de terceiros | Não resetar sem autorização | **Continua proibido** resetar, descartar, migrar destrutivamente ou copiar dados sem permissão clara e escopo validado |

**Regra de precedência:** o GDD, D07–D11 e documentos anteriores contêm instruções históricas para preservar saves. Elas continuam úteis como contexto, mas **não são mais requisito de compatibilidade para saves descartáveis de desenvolvimento**. D12 substitui apenas essa obrigação; não revoga salvaguardas de propriedade, autenticação, integridade, idempotência ou segurança.

Nenhum reset é solicitado ou realizado nesta etapa. **Mesmo em desenvolvimento**, operações destrutivas só poderão ocorrer depois de identificar explicitamente o banco-alvo isolado e receber autorização para a ação sobre ele.

## 2. Fotografia do sistema executável — não confundir com design aprovado

- `starz/db/models.py`: `StarSystem.id` é UUID com `universe_id` e coordenadas `x,y`; `Planet` referencia `system_id`; não existe tabela de fonte estelar capturada ou Stargrave.
- `starz/persistent/service.py`: `UniverseOrder` guarda `kind`, `payload` JSONB, `due_at`, `resolved`; `settle` resolve ordens vencidas em ordem de `due_at,id` e marca evento finalizado.
- `dispatch` valida missão, dono, localização da frota, combustível, status de guerra e target `Planet`. Um objeto livre no espaço ainda não é alvo validado por esse contrato.
- `starz/persistent/combat.py`: seis salvas com planejamento dos dois lados antes das perdas; `plans` e `apply_hits` compartilham invariantes de tiro e reservas, mas não possuem Stargrave persistente.
- O catálogo de Research ainda possui **44 IDs executáveis**, não 60, e a nova dependência de Fundamental V **não foi aplicada** ao YAML.

**Bloqueio necessário antes do schema final:** auditar como o gerador determina se um sistema possui uma estrela e como representar ausência de estrela para não criar um segundo astro procedural depois da captura. Em **V1**, só sistemas de estrela única são elegíveis — ver [D08-D](combat-stellar-disposition.md).

## 3. D12-A — modelo físico inicial, mínimo e normalizado (`PROPOSED`)

Preferir **cinco agregados persistentes** em vez de replicar o universo inteiro em JSONB. Nomes de tabelas/colunas abaixo são **candidatos**, não decisões de schema final.

| Agregado candidato | Chave | Dados relevantes | Constraint funcional |
|---|---|---|---|
| `stellar_source` | `id` + `universe_id` + `origin_system_id` | origem, identidade da estrela, estado, vínculo atual, versão | **Uma estrela capturável por sistema de estrela única**; uma fonte ativa por identidade |
| `stellar_project` | `id` + `universe_id` | império, fonte, fase 1–5, entregas, progresso e status | Uma fase/entrega aplicada por evento; nenhuma segunda reserva da fonte |
| `stellar_unit` | `id` + `universe_id` | fonte vinculada, posição física, estado da Stargrave/destroço/relíquia, integridade e cinco módulos | Uma unidade com estrela, um vínculo ativo por estrela |
| `stellar_operation` | `id` + `universe_id` | tipo `claim/transfer/rebuild/repatriate/decommission`, requerente, estado, idempotency key, ETA, versão | Uma operação incompatível ativa por núcleo, um resultado final por transição |
| `stellar_ledger` | `id` + `universe_id` + referência de evento | material/fuel debitado ou creditado, estoque de origem/destino, custódia | Um efeito material por chave de evento; proibir recursos negativos |

**Decisão arquitetural recomendada:** manter o mesmo `stellar_unit.id` enquanto a unidade transita por `operational → incapacitated → sealed_wreck → rebuilding/repatriating/sealed_relic`. Se o destino for reinstalação, conservar registro histórico da unidade em estado terminal em vez de apagá-la e criar Stargrave duplicada. O cadastro `stellar_source` é a fonte da verdade para origem e ausência/reinstalação; `stellar_unit` guarda posição e estado do invólucro físico.

**Risco:** uma tabela `stellar_operation` polimórfica pode ficar complexa; alternativa é separar claims/disposições de pagamentos. A escolha final será orientada pelos índices/locks e consultas reais, não pela aparência do diagrama.

## 4. D12-B — integridade e política de concorrência (`PROPOSED`)

**Exigências para migrations futuras:**
- Constraints de FK dentro do **mesmo universo** para fonte, projeto, artefato, operação e jogador. Um `empire_id` estrangeiro ao `universe_id` não pode receber custódia.
- Uma fonte estelar **não pode** ter duas unidades, projetos ou destinos ativos. Índices únicos condicionais e check constraints onde fizer sentido; linha de histórico preservada, sem falsos conflitos.
- Uma operação não pode ter dois commits finais, nem dois débitos/créditos no ledger. Identificador de operação e chave idempotente estáveis e escopados.
- Marcar destino, alterar custódia, debitar recursos e escrever resultado do evento **dentro da mesma transação**. Reprocessamento retorna o resultado registrado.
- Ordenação de locks determinística para reduzir deadlocks: fonte → unidade → operação → estoques; validar isolamento e comportamento real do PostgreSQL no ambiente de teste.
- Não permitir `sealed_wreck` atacar/mover ou `sealed_relic` ser capturada como nova estrela.
- Captura estelar e colonização concorrente precisam bloquear mutuamente o compromisso, não somente consultar UI.
- Garantir presença militar na **âncora persistida** de destroço orbital; espaço profundo depende de modelo próprio de presença/movimento antes de ativação.

**Não equivaler “sem saves legados” a “sem transações de segurança”.** Mesmo em um banco novo, todo estado gerado após o primeiro tick precisa permanecer íntegro.

## 5. D12-C — ordem e evento autoritativos (`PROPOSED`)

Usar `UniverseOrder` e a transação de `PersistentStore` como integração inicial; **não** criar novo serviço paralelo de tick.

- Despacho `ATTACK`: registrar doutrina (Equilibrada/Interceptação/Ruptura), perfil de arma (standard/antiescudo) e versão no payload **limpo de desenvolvimento**. Novos campos/enum exatos ainda precisam ser definidos.
- Interdição: `orbital_platform` em modo EW gravitacional aplica atraso **uma vez** na chegada hostil elegível; a ordem A vencida é concluída e cria B sucessora na **mesma transação**, sem recomprar combustível ou recompensar duas vezes.
- Guerra eletrônica: Odyssey real e operacional por salva; no máximo uma fonte efetiva determinística por lado/escopo, sem empilhamento infinito; prioridade efetiva pode degradar sem editar a doutrina persistida.
- Tiros: alvo pretendido → escolta elegível → alvo efetivo → **um** orçamento de munição/dano → escudo planetário, naval e casco reais.
- Custódia/disposição: requerem ordem/evento versionado com localização e custódia revalidadas no commit; nenhum destino concorrente, nenhuma transferência de propriedade por relatório de combate.
- Não usar um `target_planet_id` falso para atingir Stargrave móvel em espaço livre. Para V1, impedir reivindicações fora de âncora orbital suportada até existir contrato de combate/movimento em espaço profundo.

**Sem fallback obrigatório para ordens de desenvolvimento antigas:** a implantação pode inicializar ambiente de teste com dados novos, depois de aprovação do alvo; ainda assim, toda ordem gerada pelo novo build deve ter replay consistente.

## 6. D12-D — pipeline de implementação proposto e decisões de fase

| Fase | Mudança futura | Critério de saída | Risco |
|---|---|---|---|
| **P0: referência/ambiente** | Catalogar tests e baseline atual, definir DB de QA isolado e como se cria fixture do zero | Sem reset de ambiente compartilhado; fixture nova reproduz baseline | Médio |
| **P1: Research 3.0** | Adicionar 16 pesquisas ao catálogo e ajustar gates D06-H/R3.0-D01; validar requisitos e efeitos existentes | 60 IDs, sem ciclos, dados válidos; sem desbloqueios fantasmas | Médio |
| **P2: Combat 3.0** | Doutrinas, escolta, Odyssey EW, antiescudo e `orbital_platform` em modo interdição | Salvas e munição consistentes, replay determinístico, T01–T09/B01–B14 | Alto |
| **P3: estrela/projeto** | Fonte única de estrela, cinco etapas de projeto e módulos industriais entregues | Sem captura/colonização concorrentes, sem dupla estrela; T10–T12/T28–T29 | Muito alto |
| **P4: unidade Stargrave** | Entidade excepcional e subsistemas, combate naval/operacional e destroço selado | Frotas convencionais podem derrotar Stargrave; T13–T16/T17–T19 | Muito alto |
| **P5: custódia/destinos** | Claims, contestações, transferências legítimas, reconstrução, repatriação e relíquia | Um custodiante/um destino/um ledger; T20–T64 | Muito alto |
| **P6: balanceamento/release** | Executar matriz conservador/intermediário/elevado, auditar UX e métricas, deliberar parâmetros | Balanceamento embasado, testes relevantes e decisão separada de release | Alto |

**Obrigação:** o P5 com transferência coercitiva de núcleo fora de órbita **não** deve avançar até o servidor representar a localização de combate de espaço profundo. Permitido implementar primeiro a variante orbital sem fingir um alvo planetário.

**Nada na aprovação de D11 nem nesta proposta autoriza executar P0–P6.** A escolha de dividir PRs, de iniciar implementação e de expor gameplay exigirá instrução independente.

## 7. D12-E — protocolo de dados de desenvolvimento (`PROPOSED`)

- **Dispensa de migração de saves:** desenvolver versão nova a partir de banco/fixture **descartável e identificada**. Não escrever compatibilidades custosas só para salvar dados experimentais que o responsável dispensou.
- **Antes de qualquer reset real**: identificar host, database, ambiente, usuários afetados e dependências; separar explicitamente `local/CI fixture disposable` de shared/staging/prod; não fazer ação destrutiva por presunção. O reset dependerá de autorização específica para aquele alvo.
- Usar migrations versionadas ou criação de schema reprodutível a partir de zero: o que importa é ter **um caminho verificável de instalação limpa**. Não manipular manualmente banco persistente fora do fluxo testado.
- Não copiar secrets, credenciais, sessões ou PII para fixtures. Usar contas sintéticas e dados falsos.
- Se existir uma base compartilhada que não possa ser recriada, **suspender o reset** e apresentar opção de banco isolado, sem tentar adaptar autorização de dev para dados de terceiros.
- Rollback de código/schema deve preservar integridade de **operações que ocorreram no novo contrato** se o banco não foi descartado; compatibilidade entre versões antigas de development saves não é objetivo.

## 8. D12-F — especificação da identidade estelar e localização (`PROPOSED`)

A V1 só captura um astro de sistema de **estrela única**. `StarSystem.id` identifica o sistema, mas **não prova** por si só que é um astro ou quantas estrelas ele tem. Exigir:

- Auditoria da geração procedural e da fonte de dados visuais de astro/sistema antes de criar `stellar_source`.
- `canonical_star_id` estável derivado de sistema+identidade do astro, sem depender do nome ou do array renderizado.
- Estado de estrela `available/reserved/contained/repatriating/reinstalled/relic` representa **a mesma** entidade; não permitir que cliente regenere estrela disponível por ignorar estado persistente.
- `origin_system_id` é imutável durante toda a história; `current_location` e `location_kind` descrevem onde núcleo/Stargrave estão.
- Evento de derrota deve guardar local/ancora real da última batalha; não inferir uma órbita por proximidade visual.
- V1 só habilita custódia de destroços **em órbita confirmada**, enquanto espaço profundo for contrato futuro `OPEN`.
- Não alterar IDs e coordenadas de planetas existentes dentro do estado **novo** que já está em execução. A dispensa de *saves antigos* não autoriza criar identidade duplicada ou apagar entidades durante uma batalha.

## 9. D12-G — plano de QA rastreável (`PROPOSED`)

As matrizes **B01–B18**, **T01–T64** estão aprovadas como **planos**, não executadas. Nesta D12, usar quatro camadas:

1. **Dados:** integridade SQL de FK, unicidade, locks, reentrada de projeto, concorrência de colonização e desvinculação terminal.
2. **Regras:** seleção determinística e seis salvas; EW, antiescudo, interdição, derrota e reconstrução.
3. **Offline:** `settle` com ticks atrasados, retries, falha após commit, fila de retorno, operações de transporte e custódia em disputa.
4. **Multiplayer/UX:** ownership, guerra, sigilo, localização, interface contextual industrial/pixel e nenhum recurso duplicado.

Para saves de desenvolvimento antigos, substituir casos de **backfill legado** por testes de **instalação limpa** e reentrada do **estado gerado pelo novo schema**. **Não eliminar** os testes de replay, idempotência, integridade pós-restart nem isolamento multi-império. Quando execução for autorizada, seguir [QA local orientado a risco](../development/local-qa.md), usando `affected` ou checks de banco pertinentes e `full` somente quando o gate justificar.

## 10. D12-H — decisões e bloqueios finais (`PROPOSED`)

| ID | Deliberação para aprovação |
|---|---|
| **D12-A** | Cinco agregados de schema propostos com fontes únicas de estrela, projeto, unidade, operação e ledger; nomes exatos ficam em revisão |
| **D12-B** | Constraints/locks/uniqueness por universo e commits transacionais com resultado idempotente |
| **D12-C** | Integrar às ordens/ticks atuais, sem serviço paralelo; contratos de ataque, interdição e custódia |
| **D12-D** | Pipeline P0–P6 faseado, Research e combate antes de Stargrave, QA e balanceamento no fim |
| **D12-E** | Não manter retrocompatibilidade de saves **descartáveis de desenvolvimento**, mas nunca resetar ambiente compartilhado sem autorização |
| **D12-F** | Identidade estelar canônica + âncora de localização física; V1 não habilita custódia no espaço profundo sem contrato correspondente |
| **D12-G** | QA rastreável B01–B18 e T01–T64, substituindo backfill legado por instalação limpa sem perder integridade runtime |
| **D12-H** | Fechar schema/nomes, limites e lacunas antes de codificar; aprovação documental **não** autoriza implementação |

**`OPEN`:** schema SQL final e migrations exatas; gerador de estrelas e órbitas; adjudicação de espaço profundo; status de império extinto; regras de neutralidade; contratos civis R3.0-D02; métricas e coeficientes de balanceamento; autorização de implementação, fixture de testes e ambientes. Não presumir que `D12` resolveu esses pontos só por apresentá-los.

## 11. Links

- [Decisões aprovadas](combat-3-decisions.md), [D11](combat-custody-transfer.md), [D10](combat-custody-adjudication.md), [D07](combat-technical-contracts.md), [Research 3.0](research-3.md).
- [Index e política de desenvolvimento](README.md), [GDD histórico](STARZ-GDD-v1.md), [Local QA](../development/local-qa.md).
- [Modelos atuais](../../starz/db/models.py), [serviço persistente](../../starz/persistent/service.py), [motor de combate](../../starz/persistent/combat.py).

**Estado final: `PROPOSED`, sem modificação de gameplay ou dados.**
