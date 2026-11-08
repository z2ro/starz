# Economia

## 1. Propósito e escopo

Descrever estoques, produção e logística atuais e separar a proposta Economy 3.0 do [GDD §5](STARZ-GDD-v1.md). Não redefinir receitas, custos ou população.

## 2. Comportamento implementado

`IMPLEMENTED`: produção contínua por timestamps, estoques por planeta, insumos consumidos e processamento limitado por disponibilidade. Energia e trabalhadores limitam operação. Não existe estoque imperial teleportável.

| ID | Identidade | Contrato atual |
|---|---|---|
| `raw_ore` | Ferrita bruta | Recurso extraído e insumo industrial. |
| `volatiles` | Voláteis | Recurso extraído, processamento, combustíveis e recrutamento. |
| `refined_alloy` | Liga refinada | Material processado e insumo de construções/manufatura. |
| `components` | Componentes | Material industrial e científico. |
| `ion_fuel` | Combustível iônico | Combustível compatível com `chemical_drive`. |
| `fusion_fuel` | Combustível de fusão | Combustível compatível com `nuclear_drive`. |
| Energia | Capacidade, não estoque | Geração e demanda operacionais. |

| Instalação | Taxa-base por minuto, antes dos modificadores |
|---|---|
| `ore_extractor` | Produz 12 `raw_ore`. |
| `volatile_well` | Produz 10 `volatiles`. |
| `processor` | Consome 6 `raw_ore` e 2 `volatiles`; produz 6 `refined_alloy` e 3 `components`. |
| `fuel_refinery` | Consome 3 `volatiles`; produz 10 `ion_fuel` e 4 `fusion_fuel`. |
| `manufacturing` | Consome 2 `refined_alloy`; produz 6 `components`. |

`IMPLEMENTED`: `solar_field` gera capacidade energética; `civil_district` amplia capacidade populacional e slots de construção. Pesquisa e estaleiro têm instalações próprias. Níveis geram custos e produção progressivos.

## 3. Decisões aprovadas

`APPROVED`: preservar economia localizada, persistência e logística real. A futura Stargrave exige ciência, indústria e logística avançadas; não basta exibir seu modelo. Isso não aprova novas receitas ou custos.

## 4. Mudanças propostas

`PROPOSED`: separar mais claramente extração, transformação industrial e logística; especialização econômica emergente das colônias; maior diferenciação operacional dos combustíveis. Captura estelar, módulos de contenção e estabilidade não existem como cadeia produtiva atual. O núcleo estelar como entidade única, em vez de recurso comum negociável, é proposta do GDD.

## 5. Dependências

[Pesquisa](research.md) fornece bônus e desbloqueios. [Naves](ships.md) transportam carga real e exigem tripulação. [Combate](combat.md) destrói ativos e pode saquear recursos. [Stargrave](stargrave.md) depende de contratos industriais futuros. Ver [balanceamento](balance.md) para fórmulas.

## 6. Regras e contratos atuais

`IMPLEMENTED`: a produção considera `elapsed / 60`, percorre instalações em ordem determinística e limita processamento pelo esgotamento dos insumos. Para nível `n ≥ 1`, outputs e inputs escalam com `n × 1.08^(n−1)`; outputs recebem bônus `mining` ou `processing` e, quando aplicáveis, `alloy` ou `components`. Cobertura operacional limita os resultados. Não interpretar a ordem de processamento como um mercado instantâneo de receitas.

Energia gerada recebe `1 + energy`; demanda divide por `1 + energy_efficiency`. Demanda de trabalhadores divide por `1 + workforce`; tripulações comprometidas reduzem população disponível. Cobertura combina oferta/demanda de energia e trabalhadores. Indústria é capacidade/requisito: não é um multiplicador universal de velocidade.

`building_quote` usa nível atual mais obras pendentes; custo cresce por 1,6 e duração por 1,4, com `build_speed`. Há limite de segurança de 50 níveis. Armazenamento por recurso usa teto `100000 × 1.7^(4 × storage_bonus)`, não um medidor fictício de capacidade fixa.

População tem recrutamento pago e limite influenciado por `civil_district` e `population`; não pressupor crescimento demográfico automático. Reparo em estaleiro distribui **orçamento compartilhado** de `2 HP/s × níveis locais de orbital_shipyard × cobertura` entre naves locais danificadas, em ordem de ID; não é essa taxa para cada nave.

`TRANSPORT` leva estoques reais a planeta colonizado. Mercado reserva a oferta e a contraparte; entregas recebem fator 0,9 e prazo logístico próprio. Esse courier não equivale a uma frota física interceptável. Não existe cobrança contínua geral de manutenção naval; combustível, tripulação, perdas e reparo já têm efeitos reais.

## 7. Considerações de balanceamento

`PROPOSED`: medir gargalos de energia, população e insumos, retorno de níveis industriais e custo efetivo de transporte. Não adicionar manutenção ou escassez permanente sem simular recuperação e expansão. As taxas acima descrevem implementação, não um novo balanceamento aprovado.

## 8. Questões abertas

`OPEN`: qual especialização permanece viável sem autossuficiência? Como suprir megaengenharia sem impasses de materiais? Qual será o custo operacional estelar? O courier do mercado deverá participar das regras de bloqueio? Nenhuma dessas respostas é inferida do motor atual.

## 9. Fontes

- [GDD §5 e §10](STARZ-GDD-v1.md), [universo persistente](../persistent-universe.md).
- [Recursos](../../game_data/resources/resources.yaml), [combustíveis](../../game_data/fuels/fuels.yaml), [instalações](../../persistent_data/districts/economy.yaml).
- [Produção](../../starz/economy.py), [capacidades e reparos](../../starz/simulation.py), [custos](../../starz/progression.py).
- [Mercado e transporte](../../starz/persistent/service.py), [recrutamento](../../starz/persistent/routes.py).
