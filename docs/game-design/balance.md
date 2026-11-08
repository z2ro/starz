# Balanceamento e validação de design

## 1. Propósito e escopo

Separar fórmulas executadas de hipóteses do [GDD §10 e §13](STARZ-GDD-v1.md). Registrar necessidades de simulação, sem alterar valores ou executar uma nova campanha de testes.

## 2. Comportamento implementado

`IMPLEMENTED`: custos, taxas e perfis vêm dos catálogos efetivos. Fórmulas compartilhadas geram previews e execução. Os números abaixo são observações do código atual, não novo balanceamento aprovado.

| Sistema | Fórmula atual / limite |
|---|---|
| Pesquisa | `ceil(base_cost × 1.7^nível)` e `ceil(base_work × 1.55^nível)` no catálogo atual; coeficientes pertencem à definição. |
| Efeitos | Bônus por nível × nível + marcos atingidos uma vez; efeitos somados entre tecnologias. |
| Construção | `ceil(base_cost × 1.6^n)`; `max(1, ceil(base_duration × 1.4^n / (1 + build_speed)))`; `n` inclui obras pendentes. |
| Produção de instalações | Base × `n × 1.08^(n−1)` × bônus aplicáveis × cobertura, limitada pelos insumos. |
| Ciência | Taxa-base dos centros/laboratórios × `(1 + research)` × cobertura; capacidade agregada por domínio. |
| Slots de frotas em trânsito | `2 + fleet_slots_bonus`. |
| Limite colonial | `1 + int(colonies_bonus)`, considerando missões coloniais comprometidas. |
| Carga | Soma das capacidades dos hulls × `(1 + cargo_bonus)`. |
| Saque | Vitória atacante, até 25% de cada estoque, limitado pela carga sobrevivente. |

`IMPLEMENTED`: no cálculo-base de viagem, combustível é `ceil(massa × distância × fator_do_modo / (eficiência_da_propulsão × densidade_do_combustível))`. Tempo-base: `max(1, round(distância × 180 × fator_do_modo / fator_de_velocidade))`. Movimento persistente usa modo `NORMAL`, aplica bônus `speed` ao ETA e `fuel` ao consumo; `TRANSPORT` também considera `transport`. Expedição acrescenta tempo próprio. Reserva de retorno é real; estes valores não vêm da geometria do mapa.

## 3. Decisões aprovadas

`APPROVED`: preservar regras existentes enquanto mudanças não forem autorizadas; Stargrave sem vitória automática e derrotável por preparação convencional e contramedidas. Nenhum dos novos parâmetros abaixo recebe aprovação por constar no GDD.

## 4. Mudanças propostas

| Hipótese do GDD | Estado | O que falta comprovar |
|---|---|---|
| Tier II em 1–3 dias; III em 4–10 dias; IV em 2–4 semanas; V em 4–8 semanas. | `PROPOSED` | Caminho completo, custos, infraestrutura e padrões de atividade. |
| Primeira Stargrave em 8–12 semanas. | `PROPOSED` | Cadeia estelar ainda não implementada. |
| Stargrave equivalente a 30–50 Dominion em indústria, mais captura/infraestrutura. | `PROPOSED` | Custo econômico completo e contrajogo. |
| Preparação de bombardeio em 12–24 h. | `PROPOSED` | Janela de resposta, interrupção e impacto offline. |
| Uma Stargrave operacional por império. | `PROPOSED` | Definição de operacional, perda, reconstrução e armazenamento. |

Não são prazos forçados, promessas de duração ou limites atuais do servidor.

## 4.1. Matriz de validação de Combat 3.0

`APPROVED` como plano sem execução: a [C3.0-D04 — matriz de cenários e gates de balanceamento](combat-balance-plan.md) organiza 18 casos de base, escolta, doutrina, interferência, escudo, interdição e Stargrave. Inclui composições de hulls com custos **atuais** de liga refinada/componentes e separa a comparação desses custos de ciência, combustível, tripulação, reposição, tempo e acesso por tier.

A [C3.0-D01 — escoltas](combat-formations.md) está `APPROVED` **como design**, inclusive o limite inicial de um redirecionamento por escolta/salva sujeito a simulação; [C3.0-D02 — targeting](combat-targeting.md) e [C3.0-D03 — contramedidas](combat-countermeasures.md) estão `APPROVED` como design. A C3.0-D04 **não** apresenta resultados de testes, win rates, metas aprovadas ou um simulador executado. Nenhuma implementação foi autorizada.

## 4.2. Hipóteses quantitativas C3.0-D06 — não são números aprovados

A [C3.0-D06-A–H](combat-operational-closures.md) foi aprovada como **design**, mas a confirmação explicitou que **os números continuam sujeitos a simulação**. Candidatos de ensaio: ruptura de escudos em **1,25×** de efetividade contra proteção energética e **0,80×** contra casco; interdição com atraso **até 25% do ETA original, limitado a 30 minutos**; máximo de **uma Stargrave em obra ou operacional por império** como regra inicial, não hard cap definitivo. Mesmo a degradação de um nível de qualidade EW demanda simulação e definição de contestação.

Não há dados de eficácia ou regressão executados. [C3.0-D07](combat-technical-contracts.md) aprovou como critérios de aceitação técnica os 16 cenários T01–T16, que complementam B01–B18, **sem execução**. Custos, duração, consumo, HP, alcance, blindagem e efeitos planetários continuam `OPEN`.

## 4.3. Matriz experimental C3.0-D08 aprovada como método

`APPROVED` apenas como metodologia: [C3.0-D08-F/G](combat-stellar-disposition.md) compara três cenários (conservador/intermediário/elevado) de antiescudo e casco, atraso de interdição, preparação de ataque estelar, rendimento de salvamento e janela de estabilização. **Nenhum número é constante aprovada** e **nenhuma simulação foi executada**. A recuperação segura, os três destinos e a ausência de autodestruição são **`APPROVED` como design**, não resultados medidos.

`APPROVED` como critérios de QA não executados: [C3.0-D09](combat-stellar-custody.md) adiciona contratos T17–T32 para claims, reconstrução, repatriação, relíquia selada e idempotência. `APPROVED` como critérios documentais (não executados): [C3.0-D10](combat-custody-adjudication.md) adiciona T33–T48 para controle militar concorrente, unicidade e retries. `APPROVED` como plano de QA: [C3.0-D11](combat-custody-transfer.md) adiciona T49–T64 para transferências, cessões, extinção e espaço profundo, **não executados**. Na nova política de desenvolvimento não é necessário testar retrocompatibilidade com saves descartáveis; persistência e idempotência sob o novo schema continuam obrigatórias. Ver [D12](combat-implementation-plan.md). Custos, limiares de equilíbrio, penalidades, percentuais e duração final permanecem `OPEN`.

## 5. Dependências

Todas as especificações: [pesquisa](research.md), [economia](economy.md), [naves](ships.md), [defesas](defenses.md), [combate](combat.md), [Stargrave](stargrave.md) e [progressão](progression.md). Valores visuais não são dados de balanceamento militar.

## 6. Regras e contratos de validação

`IMPLEMENTED`: catálogos validam identificadores, referências, dependências cíclicas e efeitos suportados. Há testes do motor; isso não equivale a um simulador econômico-militar de longo prazo.

`PROPOSED`: `BalanceScenario` deve reutilizar as regras autoritativas, com estado inicial, seed, ações e resultados reproduzíveis. Comparar custos de construção, operação, reposição e logística, sem uma segunda implementação de fórmulas. Design e executáveis permanecem separados; uma tabela Markdown não altera YAML.

## 7. Considerações de balanceamento

`PROPOSED`: cenários industrial, científico, militar, equilibrado, corrida estelar, coalizão de contramedidas, inatividade, recuperação e sistema sem estrela. Medir retorno de investimento, tempo até desbloqueios, gargalos, eficiência militar por custo e concentração de poder. Coalizões militares e sistemas sem estrela ainda exigem mecânicas próprias antes de testes de execução real.

Critérios a validar: nenhuma rota impossível, recuperação econômica viável, especializações competitivas e derrota possível da Stargrave com custo e preparo proporcionais. Os limiares quantitativos desses critérios estão `OPEN`.

## 8. Questões abertas

`OPEN`: metas de ritmo por perfil de jogador, pressão de manutenção, valor de contramedidas, recuperação pós-guerra e estabilidade de economia multi-colônia. Os coeficientes atuais precisam de medição antes de qualquer promessa de equilíbrio. Não preencher lacunas com equivalências de arte ou nomes de classes.

## 9. Fontes

- [GDD §10–13](STARZ-GDD-v1.md), [progressão executável](../../starz/progression.py).
- [Simulação econômica](../../starz/simulation.py), [produção](../../starz/economy.py), [viagem](../../starz/travel.py).
- [Dispatch e retorno persistentes](../../starz/persistent/service.py), [combate](../../starz/persistent/combat.py), [validação de catálogos](../../starz/data.py).
- [Catálogos persistentes](../../persistent_data), [catálogos base](../../game_data).
