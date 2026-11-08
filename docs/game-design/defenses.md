# Defesas planetárias

## 1. Propósito e escopo

Registrar defesa local e munição atuais, sem implementar Defense 3.0. Separar proteção existente das camadas e contramedidas propostas no [GDD §7](STARZ-GDD-v1.md).

## 2. Comportamento implementado

`IMPLEMENTED`: seis categorias de estrutura, com unidades persistentes, HP e, quando aplicável, carga de escudo; três munições armazenadas por planeta.

| ID de estrutura | Função atual | Requisito científico de destaque; requisitos locais continuam aplicáveis |
|---|---|---|
| `point_defense` | Dano favorece alvos leves. | `naval_doctrine`. |
| `orbital_missile_battery` | Dispara munição antinavio por rodada e habilita lançamento estratégico. | `military_tier_2`, `sensor_array`, `weapons: 2`. |
| `heavy_em_cannon` | Dano favorece capitais. | `military_tier_3`, `metallurgy`, `weapons: 3`. |
| `planetary_shield` | Reserva coletiva de absorção. | `military_tier_3`, `shields: 2`, `energy_engineering: 2`. |
| `orbital_platform` | Plataforma armada avançada. | `military_tier_4`, `capital_architecture: 2`. |
| `missile_interceptor` | Intercepta mísseis estratégicos com munição própria. | `military_tier_3`, `computing: 2`, `shields: 1`. |

| ID de munição | Uso |
|---|---|
| `anti_ship_missile` | Disparo da bateria durante combate de frotas. |
| `interceptor_missile` | Consumo de uma unidade por interceptação estratégica. |
| `strategic_missile` | Ataque estratégico persistente lançado contra planeta. |

## 3. Decisões aprovadas

`APPROVED`: Stargrave deve poder ser derrotada por frotas convencionais e contramedidas especializadas. Isso não comprova que os seis tipos atuais já sejam suficientes nem aprova valores de novas estruturas.

## 4. Mudanças propostas

`PROPOSED`: três camadas defensivas — proximidade, pesada e estratégica. O GDD cita rede de detecção, interdição gravitacional, bateria de ruptura de contenção, matriz de escudos e comando defensivo. São conceitos sem novos IDs ou valores aprovados. Disponibilizar contrajogo antes da primeira Stargrave é proposta de progressão a simular.

## 4.1. Refinamento de contramedidas estelares

`APPROVED` como design: [C3.0-D03](combat-countermeasures.md) define uma zona de interdição sustentada e ataques dirigidos a subsistemas estelares; capacidade, dano, alcance e custos ainda precisam de cálculo. Uma eventual matriz de interdição gravitacional ou bateria de ruptura segue **sem ID, números ou regra de construção aprovados**. O `missile_interceptor` existente **somente** intercepta mísseis estratégicos; não é equivalente automático ao contrajogo da Stargrave.

## 4.2. C3.0-D06-C/D aprovada: plataforma em modo de interdição

`APPROVED` como design: depois de pesquisar `spatial_interdiction`, uma `orbital_platform` real, energizada e guarnecida pode alternar entre **defesa convencional** (dispara normalmente) e **interdição** (emite zona no sistema, **não dispara armamentos convencionais**). Uma missão `ATTACK` hostil elegível sofre, na chegada, **um atraso limitado por cadeia**, sem interdição de neutros ou de `RETURN`. A [C3.0-D07](combat-technical-contracts.md) aprovou como design o uso de ordens sucessoras e transações idempotentes; schema final e implementação continuam pendentes.

**Não implementado:** modo da plataforma, zona, parâmetros e armazenamento. A hipótese **25% do ETA, até 30 min** não é balanceamento final. Nenhuma nova estrutura defensiva é obrigatória na primeira versão. Interceptadores atuais continuam exclusivos contra mísseis estratégicos.

## 5. Dependências

[Pesquisa](research.md): tiers e níveis. [Economia](economy.md): capacidade industrial, energia, trabalhadores e reposição. [Combate](combat.md): seleção de alvo, dano, escudos e relatórios. [Stargrave](stargrave.md): contramedidas futuras, sem confundir munição atual com ruptura estelar.

## 6. Regras e contratos atuais

`IMPLEMENTED`: `defense_quote` verifica `requires`, `level_requires`, indústria local, energia, população, custos e duração. Quantidades por pedido: 1–50; limites de segurança: 1.000 estruturas por planeta e 10.000 munições por tipo. São limites atuais, não novas metas de balanceamento.

Construções defensivas compartilham slots com instalações; o servidor paga uma vez e registra trabalho, IDs de unidade e conclusão. Reconciliação por timestamp conclui offline sem duplicar unidades. Reparar estruturas sobreviventes não ressuscita unidades destruídas.

A antiga instalação `orbital_battery` migra uma vez para `point_defense`, com identidade determinística; o alias preserva o fluxo legado, sem somar uma segunda defesa abstrata.

Defesas pertencem ao planeta, não à frota nem a todos os planetas do sistema. Sua cobertura operacional limita dano e interceptação. `missile_interceptor` intercepta até duas munições estratégicas por estrutura, ajustado por cobertura e estoque; não intercepta genericamente armas de naves. Escudo planetário absorve antes do dano às unidades; carga consumida e perdas persistem.

## 7. Considerações de balanceamento

`PROPOSED`: avaliar defesa pelo custo total de infraestrutura, energia, munição, reposição e tecnologia. Medir ataques sem munição, planetas sem cobertura e forças mistas. Não tornar proteção absoluta nem usar o nome da estrutura como capacidade não implementada.

## 8. Questões abertas

`OPEN`: quais camadas suportarão bombardeio estelar? Como se obtém e interrompe uma solução de contenção? Qual janela de reação é justa para jogadores offline? Custos, coeficientes e eficácia de contramedidas estelares permanecem indefinidos.

## 9. Fontes

- [GDD §7–8](STARZ-GDD-v1.md), [catálogo defensivo](../../persistent_data/defenses/defenses.yaml).
- [Filas, requisitos e migração legada](../../starz/defenses.py), [integração à simulação](../../starz/simulation.py), [contratos de dados](../../starz/data.py).
- [Combate e alvos locais](../../starz/persistent/combat.py), [lançamento e resolução estratégica](../../starz/persistent/service.py).
- [Defesa 1.0](../planetary-defense.md), [inteligência e combate](../fleet-intelligence-2.md).
