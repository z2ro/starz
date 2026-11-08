# Pesquisa

## 1. Propósito e escopo

Detalhar ciência imperial, progressão e dependências sem implementar Research 3.0. A visão está no [GDD, §4 e §12](STARZ-GDD-v1.md); os estados seguem o [índice](README.md).

## 2. Comportamento implementado

`IMPLEMENTED`: `civil`, `military` e `fundamental`, cada um com tiers I–V e um projeto ativo por domínio. São 32 linhas repetíveis, até nível 50, e 12 projetos `breakthrough`, de conclusão única. O planejamento calcula pré-requisitos sem comprar infraestrutura ou reservar recursos.

A tabela registra IDs e pré-requisitos explícitos do catálogo efetivo. Os requisitos gerais de tier, capacidade e infraestrutura também se aplicam; não estão repetidos em cada linha.

| Domínio / tier | ID estável | Nome | Dependências explícitas (tecnologia/instalação) |
|---|---|---|---|
| `civil` / 1 | `construction_engineering` | Engenharia de construção | — |
| `civil` / 1 | `extraction` | Extração mineral | — |
| `civil` / 1 | `habitation` | Habitação planetária | — |
| `civil` / 1 | `logistics` | Logística de carga | — |
| `civil` / 2 | `fuel_efficiency` | Economia de combustível | `logistics: 2` |
| `civil` / 2 | `industrial_automation` | Automação industrial | `extraction: 2` |
| `civil` / 2 | `storage` | Armazenamento modular | `logistics: 1` |
| `civil` / 3 | `advanced_manufacturing` | Manufatura avançada | `industrial_automation: 2`; `processor: 2` local |
| `civil` / 3 | `astrophysics` | Astrofísica colonial | `orbital_engineering: 1` |
| `civil` / 3 | `infrastructure` | Infraestrutura automatizada | `industrial_automation: 1` |
| `civil` / 3 | `recruitment` | Apoio populacional | `habitation: 1` |
| `civil` / 4 | `diplomatic_charter` | Carta interestelar | `computing: 1` |
| `civil` / 5 | `maintenance` | Manutenção naval | `industrial_automation: 1` |
| `military` / 1 | `naval_doctrine` | Doutrina naval | `orbital_engineering: 1` |
| `military` / 1 | `weapons` | Sistemas de armas | `naval_doctrine: 1` |
| `military` / 2 | `armor` | Blindagem estrutural | `metallurgy: 2` |
| `military` / 3 | `shields` | Escudos energéticos | `energy_engineering: 3`; `research_lab: 2` local |
| `military` / 4 | `capital_architecture` | Arquitetura capital | `naval_doctrine: 3`, `nuclear_propulsion: 2`; `orbital_shipyard: 2` local |
| `military` / 5 | `carrier_operations` | Operações embarcadas | `capital_architecture: 2`; `orbital_shipyard: 3` local |
| `fundamental` / 1 | `computing` | Computação de frotas | — |
| `fundamental` / 1 | `energy_engineering` | Engenharia energética | — |
| `fundamental` / 1 | `orbital_engineering` | Engenharia orbital | — |
| `fundamental` / 2 | `metallurgy` | Metalurgia | `extraction: 1` |
| `fundamental` / 2 | `navigation` | Navegação interestelar | `computing: 2` |
| `fundamental` / 2 | `nuclear_propulsion` | Propulsão nuclear | `orbital_engineering: 2` |
| `fundamental` / 2 | `sensor_array` | Sensores de longo alcance | `computing: 1` |
| `fundamental` / 3 | `counter_intelligence` | Contrainteligência | `computing: 2` |
| `fundamental` / 3 | `intelligence` | Inteligência e espionagem | `sensor_array: 2` |
| `fundamental` / 3 | `survey_network` | Rede científica | `sensor_array: 2` |
| `fundamental` / 4 | `expedition_science` | Ciência de expedições | `survey_network: 1` |
| `fundamental` / 4 | `science_infrastructure` | Infraestrutura científica | `survey_network: 2`; `research_lab: 3` local |
| `fundamental` / 5 | `stellar_containment` | Contenção estelar | `carrier_operations: 3`, `science_infrastructure: 3`; `research_lab: 4` local |

`IMPLEMENTED`: para cada domínio, os avanços são `<domain>_tier_2`, `<domain>_tier_3`, `<domain>_tier_4` e `<domain>_tier_5`. Isso preserva os 12 IDs: `civil_tier_2`, `civil_tier_3`, `civil_tier_4`, `civil_tier_5`, `military_tier_2`, `military_tier_3`, `military_tier_4`, `military_tier_5`, `fundamental_tier_2`, `fundamental_tier_3`, `fundamental_tier_4`, `fundamental_tier_5`.

| Avanço | Dependências atuais além da capacidade |
|---|---|
| II | Linha fundadora no nível 1; instalação especializada. |
| III | Avanço II e fundadora no nível 2. |
| IV | Avanço III e fundadora no nível 3; Civil/Militar exigem Fundamental III; Fundamental exige Civil III. |
| V | Avanço IV e fundadora no nível 4; Civil/Militar exigem Fundamental IV; Fundamental exige Militar IV. |

Fundadoras: `construction_engineering`, `naval_doctrine`, `energy_engineering`, respectivamente. Conferir também os `requires` de cada projeto no catálogo.

## 3. Decisões aprovadas

`APPROVED`: preservar três domínios e a progressão da civilização. A infraestrutura científica, industrial e estelar deve sustentar a futura Stargrave; o modelo visual não desbloqueia essa unidade. A identidade das 16 novas descobertas, com IDs, domínios, tiers, dependências e capacidades, está `APPROVED` na [R3.0-D01](research-3.md); não está implementada. O contrato de execução [R3.0-D02](research-operational.md) continua `PROPOSED`.

## 4. Research 3.0 — decisões documentais posteriores

**`APPROVED` (08/11/2026):** preservar os 44 IDs, adicionar exatamente 16 descobertas `breakthrough` únicas, sem `advances_tier`, segundo a tabela canônica [R3.0-D01](research-3.md). Foram aprovados IDs, nomes, domínios, tiers, requisitos científicos e capacidades principais. Preservar as dez classes convencionais e o acesso de saves existentes; especializações não são mutuamente exclusivas.

**`APPROVED`:** remover a dependência de `military_tier_4` de `fundamental_tier_5` e desvincular `stellar_containment` de `carrier_operations`, sem alterar automaticamente trabalho pago ou níveis legados. Contramedidas especializadas de Tier IV não precisam de tecnologias exclusivas de Stargrave. Os valores e custos finais estão abertos.

**`APPROVED` pela [C3.0-D06-H](combat-operational-closures.md):** substituir o requisito Militar IV de Fundamental V por `science_infrastructure:2`, preservando `fundamental_tier_4`, `energy_engineering` e `energy_engineering:4`. **`PROPOSED`/`OPEN`:** detalhes restantes de migração, contratos civis e megaprojetos da [R3.0-D02](research-operational.md), custos e durações. As funções militares detalhadas foram aprovadas no design em [Combat 3.0](combat-3-decisions.md), mas não implementadas.

**`IMPLEMENTED`, apenas no estado atual:** `fundamental_tier_5` ainda exige `military_tier_4` no YAML; `stellar_containment` ainda exige `carrier_operations:3`, concede `energy:0.06` por nível, possui `future_unlocks:stellar_megastructures` apenas documental e participa do desbloqueio legado da Dominion. Esta seção não altera o YAML.

## 5. Dependências

[Economia](economy.md): materiais locais, energia e trabalhadores. [Naves](ships.md) e [defesas](defenses.md): desbloqueios reais. [Progressão](progression.md): capacidade de colonizar e operar frotas. [Stargrave](stargrave.md): ciência futura, sem inferir execução a partir de pesquisa concluída.

## 6. Regras e contratos atuais

`IMPLEMENTED`: capacidade mínima por tier: **1 / 3 / 6 / 10 / 15**. `research_lab` soma capacidade a todos os domínios e divide sua taxa-base entre três; `civil_lab`, `military_lab`, `fundamental_lab` somam capacidade e taxa ao domínio correspondente. Tiers superiores ao I exigem especialização; tecnologias comuns exigem o avanço do tier. Requisitos `infrastructure` são locais ao planeta selecionado, mesmo com capacidade científica imperial agregada.

O agregado de ciência soma as colônias; a taxa considera energia, trabalhadores e bônus `research`. Recursos são debitados no planeta da pesquisa. `universe.levels`, `research_domains`, `remaining_work` e `complete_at` preservam níveis e trabalhos offline; `EmpireProgress` persiste o estado imperial. A migração de pesquisa legada preserva projetos pagos e concede tiers implícitos aos níveis existentes.

Custo do próximo nível: `ceil(base_cost × level_cost_growth^nível_atual)`. Trabalho: `ceil(duration × level_work_growth^nível_atual)`. Crescimentos atuais: 1,7 e 1,55. Tempo depende da taxa efetiva, não apenas de `duration`. Efeito acumulado: bônus por nível × nível, mais cada marco atingido uma vez. Outros detalhes estão em [balanceamento](balance.md).

`requires`, `level_requires`, `infrastructure`, `unlocks`, `advances_tier` e gates implícitos compõem o contrato. A validação de catálogos verifica referências e ciclos; o plano topológico não executa pesquisas automaticamente.

## 7. Considerações de balanceamento

`IMPLEMENTED` não significa que crescimento exponencial e níveis máximos estejam calibrados para semanas. `PROPOSED`: medir custo de caminhos completos, tempo científico e competitividade de especializações. Não acrescentar linhas apenas para preencher tiers.

## 8. Questões abertas

`APPROVED`: 16 novos IDs, requisitos e propósitos estão registrados em [R3.0-D01](research-3.md). `OPEN`: requisitos substitutos exatos de Fundamental V, limites e números de balanceamento, custos, tempos, implementação de políticas e projetos. `PROPOSED`: contratos em [R3.0-D02](research-operational.md). Nenhum novo ID ou valor foi cadastrado no catálogo executável.

## 9. Fontes

- [GDD §4, §10 e §12](STARZ-GDD-v1.md); [R3.0-D01 aprovada](research-3.md); [R3.0-D02 proposta](research-operational.md).
- [Catálogo efetivo](../../persistent_data/technologies/levels.yaml), [instalações científicas](../../persistent_data/districts/economy.yaml).
- [Fórmulas, gates e migração](../../starz/progression.py), [simulação e ciência](../../starz/simulation.py), [agregação/persistência](../../starz/db/store.py).
- [Planejamento](../../starz/persistent/research_planning.py), [validação de dados](../../starz/data.py), [documentação Research 2.0](../research-2.md).
