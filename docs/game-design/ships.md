# Naves e composição de frotas

## 1. Propósito e escopo

Relacionar as classes existentes a seus efeitos reais e às funções propostas no [GDD §6](STARZ-GDD-v1.md). Preservar os hulls e designs; não implementar Fleet 3.0.

## 2. Comportamento implementado

`IMPLEMENTED`: dez hulls convencionais e onze designs procedurais. Cada nave persistente possui ID próprio, hull, propulsão, combustível, tripulação e durabilidade. Frotas agregam IDs reais, não quantidades visuais fictícias.

| Hull ID | Design / função atual | Evidência funcional atual | Habilidade do GDD ainda `PROPOSED` |
|---|---|---|---|
| `scout_hull` | Horizon / exploração | Role elegível para missões de exploração. | Reconhecer vulnerabilidades e rotas. |
| `wayfarer_hull` | Wayfarer / logística | Capacidade de carga 180, antes de bônus. | Reabastecimento e logística especializada. |
| `vanguard_hull` | Vanguard / escolta | Modificadores favorecem alvos leves. | Proteger aliados fracos por regra de escolta. |
| `sentinel_hull` | Sentinel / defesa | Modificadores favorecem alvos leves. | Interceptar mísseis com a nave. |
| `odyssey_hull` | Odyssey / ciência | `science_bonus: 2` em expedições, carga 30. | Anomalias e análise de subsistemas. |
| `aegis_hull` | Aegis / combate de linha | Escudos próprios e perfil intermediário. | Compartilhamento/coordenação de escudos. |
| `spearhead_hull` | Spearhead / projeção de poder | Modificadores favorecem capitais. | Penetração específica de blindagem ou módulos. |
| `leviathan_hull` | Leviathan / capital | Armamento, resistência e perfil contra capitais. | Novas regras de fogo pesado sustentado. |
| `atlas_hull` | Atlas / porta-naves | `carrier_capacity: 10` contribui ao dano abstrato. | Alas independentes de Interceptor, Fighter e Bomber. |
| `dominion_hull` | Dominion / comando | Perfil capital; sem bônus automático à frota aliada. | Comando combinado com efeitos próprios. |

`IMPLEMENTED`: Stargrave tem design `stargrave`, mas `hull_id: null`. Não é uma décima primeira nave construível. Seu [contrato próprio](stargrave.md) não pode ser substituído pelo de um hull convencional.

## 3. Decisões aprovadas

`APPROVED`: preservar os designs procedurais e suas silhuetas distintas. Stargrave é uma categoria excepcional, móvel e militar com uma estrela cativa. Aprovação visual não valida armamentos ou habilidades inexistentes.

## 4. Mudanças propostas

`PROPOSED`: funções de classe do GDD conforme a última coluna; composição com sinergias e contramedidas que preservem utilidade das classes menores. Não representar `role: escort` ou `role: command` como proteção/comando já executado.

## 4.1. Refinamento de formação

`APPROVED` (design): [C3.0-D01 — escolta e proteção](combat-formations.md) define proteção automática e redirecionamento para unidades reais, com especialização de Vanguard, Sentinel e Aegis, sujeita a um redirecionamento por escolta/salva inicialmente. `PROPOSED`: [C3.0-D02](combat-targeting.md) trata a escolha determinística dos alvos. **Não implementado**; Sentinel não intercepta mísseis estratégicos e Aegis não compartilha escudos no contrato aprovado.

## 4.2. Odyssey como emissora de guerra eletrônica

`APPROVED` pela [C3.0-D06-A/B](combat-operational-closures.md): a **Odyssey** é a unidade física emissora de `electronic_warfare`, exigindo nave real, presente/operacional e pesquisa concluída. Contribui para contestação de prioridade ofensiva e de novas observações hostis no planeta onde estiver estacionada. Múltiplas Odyssey não somam interferência sem limite; se a emissora cair, reavaliar no próximo snapshot da salva. **Não implementado**; fórmula, intensidade e alcance seguem `OPEN`. A [C3.0-D07](combat-technical-contracts.md) aprova como design técnico o contrato de snapshots, ainda não implementado.

## 5. Dependências

[Pesquisa](research.md): desbloqueio de classes e bônus. [Economia](economy.md): materiais, tripulação e combustível. [Combate](combat.md): perfis, danos e perdas. [Defesas](defenses.md): confrontos locais. [Balanceamento](balance.md): eficiência por custo, não só tamanho visual.

## 6. Regras e contratos atuais

`IMPLEMENTED`: todos os hulls exigem `orbital_shipyard`. O catálogo persistente acrescenta gates: Vanguard em Militar II; Sentinel com propulsão nuclear e Militar II; Odyssey com nuclear e Fundamental III; Aegis com nuclear e Militar III; Spearhead/Leviathan com nuclear e Militar IV; Atlas/Dominion com nuclear e Militar V. Horizon e Wayfarer usam requisitos iniciais do catálogo, sem retirar o gate geral do estaleiro.

A construção verifica desbloqueios, compatibilidade de propulsão/combustível, materiais locais, tripulação e slots. Duração naval recebe `ship_speed`. Propulsão e combustível não são intercambiáveis: `chemical_drive` usa `ion_fuel`; `nuclear_drive` usa `fusion_fuel`.

`fleet.ship_ids` contém a composição. O servidor valida propriedade, disponibilidade e co-localização. IDs não podem ser duplicados para inflar quantidade. Coordenadas e operações persistentes definem localização; órbitas dos renderers são apresentação, não novas posições militares.

O registro visual exige correspondência explícita do hull. Um design desconhecido não autoriza substituir a nave por Horizon. Atlas usa capacidade abstrata na fórmula de dano, não dez entidades subordinadas persistentes.

## 7. Considerações de balanceamento

`PROPOSED`: comparar funções em forças de custo equivalente, confrontos mistos e logística. O objetivo de manter classes úteis não comprova que todas as composições atuais sejam equilibradas. Não usar escala do modelo como massa ou alcance de combate.

## 8. Questões abertas

`OPEN`: custo e limites das habilidades de escolta, interdição, comando e alas? Quais contramedidas evitam uma classe dominante? Como representar perdas de unidades subordinadas sem falsificar a composição persistente? A tabela não atribui novos coeficientes.

## 9. Fontes

- [GDD §6](STARZ-GDD-v1.md), [catálogo persistente](../../persistent_data/ships/functions.yaml), [hulls base](../../game_data/ships).
- [Construção](../../starz/simulation.py), [missões](../../starz/persistent/service.py), [combate](../../starz/persistent/combat.py).
- [Registro visual](../../frontend/src/visual/ShipDesignRegistry.ts), [referências canônicas de design](../design/imperial-command-v2/frotas).
- [Integração inicial de frotas — contexto histórico](../fleet-gameplay-integration.md).
