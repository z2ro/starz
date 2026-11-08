# Arquitetura de design do STARZ

## Autoridade e escopo

O [STARZ-GDD-v1.md](STARZ-GDD-v1.md) é a visão central. Seu status é **DRAFT**: contém decisões explícitas, propostas e dúvidas. Não é uma especificação integralmente aprovada nem uma descrição automática do jogo atual.

Esta auditoria documental usa o código de `experiment/persistent-universe`, base `e749fb9`, em 07/11/2026. Nenhuma regra executável foi alterada. A aprovação explícita do responsável define intenção; código e catálogos efetivos comprovam implementação. Uma coisa não substitui a outra.

O GDD foi fornecido em `docs/game-desing/STARZ-GDD-v1.md`. O original foi preservado. A cópia canônica conserva as decisões e propostas do original; os artefatos da exportação Mermaid foram reconstruídos como diagramas Mermaid, e tabelas e títulos foram formatados em Markdown. O arquivo original permanece intacto. SHA-256 do original: `4d874146ed1722c7cc0ab267808d17e5eb0de76c0daa0d375ad610f2445b7a3c`.

## Estados de requisitos

| Estado | Significado |
|---|---|
| `IMPLEMENTED` | Comprovado no código autoritativo ou nos catálogos executáveis; não implica balanceamento aprovado. |
| `APPROVED` | Decisão explicitamente aceita; pode não estar implementada. |
| `PROPOSED` | Recomendação ou hipótese aguardando aprovação. |
| `OPEN` | Decisão ou parâmetro não resolvido. |
| `DEPRECATED` | Conceito proposto para aposentadoria; não autoriza removê-lo ou migrar saves. |

O estado aplica-se à afirmação identificada, não a todo o documento citado. Uma funcionalidade pode estar implementada e ainda divergir da intenção aprovada. Não há aposentadoria automática de IDs nesta arquitetura.

## Navegação

| Documento | Responsabilidade |
|---|---|
| [Visão central](STARZ-GDD-v1.md) | Identidade, objetivos e direção de evolução. |
| [Pesquisa](research.md) | Domínios, tiers, níveis, dependências e desbloqueios. |
| [Research 3.0 — R3.0-D01](research-3.md) | `APPROVED`: 16 descobertas únicas, IDs, tiers, dependências e capacidades; preservar 44 existentes. Não implementado. |
| [Research 3.0 — R3.0-D02](research-operational.md) | `PROPOSED`: contratos operacionais das 16 descobertas. |
| [Combat 3.0 — doutrinas e formações](combat-doctrines.md) | `PROPOSED`: contratos de targeting, escolta, guerra eletrônica e contramedidas. |
| [Combat 3.0 — C3.0-D01](combat-formations.md) | `APPROVED` como design: escolta, redirecionamento limitado, três doutrinas e guarnição. Não implementado. |
| [Combat 3.0 — C3.0-D02](combat-targeting.md) | `PROPOSED`: priorização determinística, fallback, sigilo e persistência da doutrina. |
| [Combat 3.0 — C3.0-D03](combat-countermeasures.md) | `PROPOSED`: interferência eletrônica, antiescudos, interdição e ataques de contenção estelar. |
| [Combat 3.0 — C3.0-D04](combat-balance-plan.md) | `PROPOSED`: matriz de 18 cenários, métricas e gates de validação, sem simulador executado. |
| [Economia](economy.md) | Estoques locais, cadeias, população, energia e logística. |
| [Naves](ships.md) | Hulls, funções, composição e limites dos modelos visuais. |
| [Defesas](defenses.md) | Estruturas locais, munição e contramedidas. |
| [Combate](combat.md) | Missões, resolução, perdas, inteligência e PvP. |
| [Stargrave](stargrave.md) | Contrato aprovado e propostas de captura/construção/operação. |
| [Balanceamento](balance.md) | Fórmulas atuais, hipóteses e simulações necessárias. |
| [Progressão](progression.md) | Caminhos de desenvolvimento e fases propostas. |

## Como verificar comportamento

`IMPLEMENTED`: [API](../../starz/api.py) seleciona o modo. [Catalog.load](../../starz/data.py) carrega `game_data/` e, no universo persistente, aplica `persistent_data/`. A entrada do overlay substitui a definição de mesmo tipo e ID; não é uma fusão campo a campo. Não auditar o universo persistente apenas pelos YAML da base.

Inventário efetivo: 32 pesquisas repetíveis, 12 avanços de tier, três domínios, cinco tiers, dez hulls convencionais, seis estruturas defensivas e três tipos de munição. Onze designs visuais não equivalem a onze hulls construíveis.

O [cenário Concordat](../complete-game.md) usa `campaign_data/` e regras próprias. Turnos, prazos e vitória de campanha não são regras do universo persistente. Documentos históricos como [fundação do jogo](../game-design.md), [persistência inicial](../persistence.md) e [primeira integração de frotas](../fleet-gameplay-integration.md) devem ser lidos no contexto de sua versão.

## Diferenças registradas

| ID | Evidência atual | Intenção ou proposta diferente | Tratamento |
|---|---|---|---|
| D01 | `stellar_containment` exige `carrier_operations: 3` e concede energia. | GDD §4 propõe separar ciência estelar da linha de porta-naves. | `APPROVED`: remover requisito de `carrier_operations` em futura implementação; `PROPOSED`: detalhes de migração e operação. Ver [R3.0-D01](research-3.md). |
| D02 | Roles e coeficientes existem; várias habilidades de classe não existem. | GDD §6 propõe escolta, interceptação, ciência e comando especializados. | `PROPOSED`: não apresentar o rótulo como habilidade executável. Ver [naves](ships.md). |
| D03 | Indústria habilita construções; não há projeto estelar multietapas. | GDD §5/9 propõe cadeias de megaengenharia e logística estelar. | `PROPOSED`: contratos ainda a definir. Ver [economia](economy.md). |
| D04 | Stargrave visual e pesquisa preliminar; Concordat tem projeto de vitória próprio. | Contrato aprovado: unidade militar móvel, derrotável, sem vitória automática no multiplayer. | `APPROVED` não implementado no persistente. Ver [Stargrave](stargrave.md). |
| D05 | Mísseis estratégicos já danificam defesas e níveis de instalações. | GDD §8 propõe bombardeio estelar preparado, interrompível e com contrajogo. | Mecanismos distintos; não atribuir o míssil à Stargrave. Ver [combate](combat.md). |
| D06 | Custos/tempos atuais são os YAML e fórmulas do motor. | Semanas de progressão, 12–24 h de preparo e equivalência de 30–50 Dominion são hipóteses do GDD. | `PROPOSED`, não metas verificadas. Ver [balanceamento](balance.md). |
| D07 | Sessões independentes, missões persistentes e frotas multinave existem. | Documentos iniciais ainda descrevem limitações anteriores. | Diferença de versão, não autorização para regredir sistemas. |

## Uso em tarefas futuras

1. Ler o GDD e o documento do subsistema.
2. Conferir modo ativo, código e catálogos; registrar diferenças antes de implementar.
3. Obter autorização explícita para nova mecânica ou ajuste de balanceamento. `PROPOSED` e `OPEN` não autorizam mudanças.
4. Preservar IDs, propriedade, persistência e compatibilidade; planejar migração quando necessária.
5. Atualizar a documentação após implementar uma mudança aprovada, sem transformar Markdown em configuração executável.

Referências complementares: [pesquisa 2.0](../research-2.md), [universo persistente](../persistent-universe.md), [defesa planetária](../planetary-defense.md), [inteligência e combate](../fleet-intelligence-2.md). Relatos de testes nesses documentos são históricos; não constituem validação executada nesta auditoria.

## Aprovações posteriores à auditoria inicial (08/11/2026)

`APPROVED` — [R3.0-D01](research-3.md): 44 IDs legados preservados, 16 novos IDs de descoberta `breakthrough` únicos aprovados com nomes/domínios/tiers/dependências/capacidades; remover gate Militar IV de Fundamental V e vínculo `carrier_operations` de `stellar_containment`; contramedidas especializadas em Tier IV; não revogar hulls nem bloquear especializações mutuamente.

`APPROVED` — [C3.0-D01](combat-formations.md): sete decisões de escolta e formação, três doutrinas e limite inicial de um redirecionamento por escolta/salva, sujeito a simulação. `PROPOSED` — [R3.0-D02](research-operational.md): contratos operacionais restantes; [C3.0-D02](combat-targeting.md): seleção determinística de alvos; [C3.0-D03](combat-countermeasures.md): contramedidas e guerra eletrônica; [C3.0-D04](combat-balance-plan.md): matriz de cenários e validação; [Combat 3.0](combat-doctrines.md): visão geral. Nenhuma destas propostas está implementada. Essas propostas não autorizam implementação. O inventário *executável* permanece 32 repetíveis e 12 avanços, total de 44; 60 é quantidade *planejada*, não instalada. O histórico de auditoria de 07/11 permanece preservado.
