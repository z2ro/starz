# STARZ — Research 3.0: decisões canônicas (R3.0-D01)

**Estado das decisões de identidade:** `APPROVED` (08/11/2026).  
**Estado no universo persistente:** `IMPLEMENTED` e testado para as 16 identidades pesquisáveis e os dois gates redesenhados (P1, 08/11/2026). Capacidades operacionais têm implementação separada; pesquisa não executa ações por si só.
**Escopo:** ciência, descobertas, dependências e compatibilidade; não autoriza implementar gameplay ou modificar catálogos.

## 1. Autoridade e fronteiras

Este registro consolida a aprovação expressa do responsável: preservar os 44 IDs existentes; adicionar 16 descobertas únicas; remover o requisito Militar IV de Fundamental V; desvincular `stellar_containment` de `carrier_operations`; disponibilizar contramedidas estelares no Tier IV; conceder novas habilidades sem revogar hulls; e não impor especializações mutuamente exclusivas.

Também foram aprovados nominalmente os 16 IDs, nomes, domínios, tiers, dependências e propósitos de gameplay desta especificação, com `kind: breakthrough` e **sem** `advances_tier`. Novas pesquisas são de conclusão única, mas continuam sujeitas ao avanço de tier e à capacidade/especialização do respectivo domínio. O contrato operacional detalhado está em [R3.0-D02](research-operational.md) e permanece `PROPOSED`.

**Estado implementado:** 32 pesquisas `repeatable` (até nível 50), 12 avanços de tier e 16 novas descobertas `breakthrough`, três domínios, cinco tiers e um programa ativo por domínio: **60 entradas**. Operações dependentes são verificadas separadamente no [registro de implementação](../development/starz-3-implementation.md). Nenhum ID antigo é removido.

## 2. Descobertas únicas aprovadas

Os requisitos são científicos; o gate implícito do avanço correspondente (`<domain>_tier_<tier>`) permanece aplicável. `ID:n` significa nível mínimo `n`. Nenhum número de custo, duração ou coeficiente é aprovado aqui.

### Civil — 4

| Tier | ID canônico | Nome | Requisitos explícitos | Capacidade aprovada |
|---|---|---|---|---|
| III | `automated_logistics` | Logística Automatizada | `logistics:3`, `industrial_automation:1` | Políticas de reabastecimento e rotas automatizadas, com transporte real |
| IV | `megastructure_engineering` | Engenharia de Megaestruturas | `advanced_manufacturing:2`, `orbital_engineering:3` | Habilitar início de megaprojetos orbitais |
| V | `precision_manufacturing` | Manufatura de Precisão Extrema | `megastructure_engineering`, `advanced_manufacturing:3` | Fabricar módulos industriais extremos |
| V | `stellar_logistics` | Logística Estelar | `automated_logistics`, `megastructure_engineering`, `logistics:3` | Transporte e suprimento físico de módulos estelares |

### Militar — 7

| Tier | ID canônico | Nome | Requisitos explícitos | Capacidade aprovada |
|---|---|---|---|---|
| II | `fire_control_doctrine` | Doutrina de Controle de Tiro | `weapons:2`, `naval_doctrine:2` | Políticas de prioridade de alvos |
| III | `fleet_coordination` | Coordenação de Frotas | `naval_doctrine:3`, `computing:2` | Escolta e proteção funcional de formação |
| III | `electronic_warfare` | Guerra Eletrônica | `sensor_array:2`, `computing:2` | Interferência em sensores e aquisição de alvos |
| IV | `spatial_interdiction` | Interdição Espacial | `electronic_warfare`, `gravitational_physics` | Interdição de operações estratégicas hostis |
| IV | `shield_disruption` | Ruptura de Escudos | `weapons:3`, `shields:2` | Ataques especializados contra escudos |
| IV | `containment_warfare` | Guerra de Contenção | `shield_disruption`, `gravitational_physics`, `sensor_array:3` | Identificação e ataque a subsistemas de contenção |
| V | `stellar_armaments` | Armamentos Estelares | `capital_architecture:2`, `mobile_stellar_confinement`, `weapons:4` | Integração do armamento estelar da Stargrave |

### Fundamental — 5

| Tier | ID canônico | Nome | Requisitos explícitos | Capacidade aprovada |
|---|---|---|---|---|
| IV | `gravitational_physics` | Física Gravitacional Avançada | `navigation:2`, `sensor_array:2` | Base científica de interdição, gravitação e propulsão |
| IV | `extreme_materials` | Materiais Extremos | `metallurgy:3`, `energy_engineering:3` | Materiais para condições energéticas extremas |
| V | `stellar_extraction` | Extração Estelar | `gravitational_physics`, `megastructure_engineering`, `science_infrastructure:2` | Iniciar infraestrutura/operações de captura estelar |
| V | `mobile_stellar_confinement` | Confinamento Estelar Móvel | `stellar_extraction`, `extreme_materials`, `stellar_containment:3` | Habilitar núcleo estelar móvel |
| V | `gravitational_propulsion` | Propulsão Gravitacional | `gravitational_physics`, `extreme_materials`, `nuclear_propulsion:3` | Habilitar propulsão de megaprojetos móveis |

## 3. Gates e legados — decisão versus detalhe

| Item | `APPROVED` | `PROPOSED` ou `OPEN` |
|---|---|---|
| `fundamental_tier_5` | Remover `military_tier_4` e acrescentar `science_infrastructure:2` em `level_requires` — ambos `APPROVED` pela D06-H | Preservar `fundamental_tier_4`, `energy_engineering` e nível `energy_engineering:4`; custo/duração ainda `OPEN` |
| `stellar_containment` | Remover `carrier_operations` e respectivo requisito de nível | Preservar demais requisitos e bônus; função como precursora de confinamento; nível 3 como requisito da descoberta nova aprovado na D01, mas custo deve ser simulado |
| Dominion | Não revogar construção nem hulls existentes | Rever posteriormente o desbloqueio legado da Dominion por `stellar_containment` |
| Contramedidas | Disponibilidade de `containment_warfare` e `spatial_interdiction` no Tier IV | Eficácia, alcance, consumo e duração aguardam contrato/balanceamento |
| Stargrave | Unidade móvel excepcional, uma estrela, derrotável por frotas preparadas | Captura, construção, subsistemas, energia, ataque e persistência detalhada aguardam implementação/autorização |

**Não retroagir:** preservar níveis, marcos, trabalhos já pagos, direitos de construção existentes, frotas, saves e identidade da Stargrave fora do catálogo convencional de hulls. `APPROVED` indica decisão de design, não disponibilidade no jogo.

## 3.1. Atualização aprovada C3.0-D06-H (08/11/2026)

`APPROVED`: em `fundamental_tier_5`, substituir a dependência científica cruzada `military_tier_4` por `science_infrastructure:2`. **Não** remover `fundamental_tier_4`, `energy_engineering` nem `energy_engineering:4`. Esta decisão é design, não alteração do catálogo executável, que ainda mantém o gate antigo. O detalhamento está em [C3.0-D06](combat-operational-closures.md). As capacidades militares aprovadas nessa D06 não aprovam automaticamente o restante da [R3.0-D02](research-operational.md).

## 4. Acessos estratégicos

- Um império alcança Fundamental V sem exigir Militar IV; a pesquisa estelar avançada não equivale a construir Stargrave.
- `containment_warfare` tem caminho acessível em Militar IV + Fundamental IV; não exige projetos de captura, confinamento móvel ou armas estelares.
- Captura e mobilidade dependem de engenharia científica/industrial; armamento exige militarização adicional.
- As três disciplinas mantêm caminhos úteis por custo de oportunidade, sem escolhas permanentes mutuamente exclusivas.
- Descobertas autorizam capacidades, não executam viagens, ataques, captura ou construção automaticamente.
- A maioria das capacidades deve reutilizar efeitos, ordens e estados autoritativos existentes em vez de inventar recursos, subsistemas e inventários desnecessários.

## 5. Compatibilidade técnica e integração futura

O contrato implementado `Technology.kind` aceita `repeatable` ou `breakthrough`. `advances_tier` é reservado aos 12 projetos de avanço; descobertas não o preenchem. `requires` e `level_requires` constituem dependências, além de gates implícitos. `effects` aceita apenas as chaves reconhecidas em `starz/progression.py`; `future_unlocks` não executa gameplay.

O código precisa distinguir desbloqueio de objeto e nova habilidade operacional. A lista `unlocks` por si só não implementa uma política, uma arma ou um projeto estelar; dependências conjuntas devem ser verificadas explicitamente e não inferidas de desbloqueadores alternativos.

O grafo proposto foi verificado conceitualmente com 60 IDs, sem colisões, referências científicas ausentes ou ciclos. Isso **não é** validação do catálogo YAML nem teste de execução.

## 6. Próximas especificações e referências

- [Pesquisa canônica / estado implementado](research.md)
- [R3.0-D02 — Contratos operacionais (`PROPOSED`)](research-operational.md)
- [Combate e estado executável](combat.md)
- [Naves e funções atuais](ships.md)
- [Stargrave](stargrave.md)
- [Balanceamento](balance.md)
- [Tecnologias persistentes — fonte executável atual](../../persistent_data/technologies/levels.yaml)
- [Gates e migração](../../starz/progression.py)

**Não editar `persistent_data`, gameplay, banco, `AGENTS.md` ou outros arquivos executáveis com base somente neste documento.**

## 7. Checkpoint executável P1

Autorização: tarefa STARZ 3.0 de 08/11/2026. `persistent_data/technologies/discoveries.yaml` adiciona as 16 descobertas, `kind: breakthrough`, sem bônus fictícios nem `advances_tier`. Custos/trabalho são EXPERIMENTAIS, usando a base do avanço do mesmo domínio/tier. Os 44 IDs, 12 avanços e requisitos dos dez hulls foram preservados. Gate Fundamental V científico e desvinculação de `carrier_operations` aplicados sem mudar custo/tempo atuais.

Validação executada: 12 testes em `test_research3` + `test_research_domains`, PASS, 1,863 s (`.qa/runs/starz3-p1/unittest.log`). As novas pesquisas foram iniciadas/concluídas pelo `Engine`, com débito real, trabalho positivo e bloqueio de repetição. Grafo inclui gates implícitos; Fundamental V e contenção alcançados sem pesquisa Militar. Isso não comprova automação logística civil, Stargrave operacional ou balanceamento final. A árvore React já consome catálogo dinâmico; validação visual ocorrerá na integração P6.
