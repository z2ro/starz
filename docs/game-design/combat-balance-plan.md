# STARZ — C3.0-D04: matriz de cenários e gates de balanceamento

**Estado:** `APPROVED` como plano de validação (08/11/2026); **nenhum cenário executado** e nenhum coeficiente aprovado. Ver [registro consolidado](combat-3-decisions.md).  
**Autoridade:** [C3.0-D01](combat-formations.md), [C3.0-D02](combat-targeting.md) e [C3.0-D03](combat-countermeasures.md) estão `APPROVED` como design. A matriz B01–B18 e seus gates foram aprovados como metodologia, não como resultados.  
**Escopo:** critérios de decisão, cenários, métricas, parâmetros a simular, riscos de balanceamento e critérios de saída. **Não implementar mecânicas, novos testes, scripts, YAML ou migrations por este documento.**

## 1. Objetivo

Impedir que escolhas de formação, doutrina, guerra eletrônica, ruptura de escudos ou contrajogo Stargrave sejam aprovadas apenas porque parecem fortes em um único confronto. Medir efetividade por **custo industrial, composição, tecnologia, munição, cobertura energética, tempo de reposição e logística**, preservando as regras autoritativas.

**Não** declarar win rate equilibrado a partir de fórmulas literais ou prévias. Os sistemas C3.0-D02, C3.0-D03 e Stargrave ainda não existem no motor; este é um **roteiro de experimentos futuros**, não um relatório de resultados.

## 2. Base verificável no repositório (`IMPLEMENTED`)

- Em `starz/persistent/combat.py`, frotas persistentes lutam em até **seis salvas**; planos de ambos os lados são calculados antes da aplicação de perdas da salva.
- `plans` escolhe o maior termo ordenado `(weapon_modifiers[target.class], -target.hp, target.id)`; os alvos considerados usam projeção de HP e escudo. Doutrinas e escoltas **não são implementadas**.
- `apply_hits` consome pool compartilhado de escudo planetário, escudos próprios e HP mitigados por armadura. Não somar escudos projetados fictícios.
- `intelligence.py` já usa observações com qualidade 0–3, estado e expiração; `service.py` usa missões/ordens persistentes e revalida guerra no destino.
- `persistent_data/ships/functions.yaml` define custo de `refined_alloy`, `components`, tripulação, HP, escudos e dano-base por hull.
- `starz/persistent/combat.py:resolve_missiles` é independente do resolvedor naval; mísseis interceptores atuais combatem **apenas** mísseis estratégicos.

Outros limites atuais — pesquisa, construção, transporte, saque e manutenção operacional — estão em [balance.md](balance.md). Nenhuma dessas observações é uma autorização para mudar fórmula.

## 3. Custos-base reais para ancorar cenários

Os números abaixo **apenas somam os custos do hull** no catálogo persistente atual. Não incluem ciência, tempo de estaleiro, propulsão, combustível, manutenção, infraestrutura, reposição ou upgrades. São **fixtures de comparação**, não parâmetros futuros nem provas de equilíbrio.

| Grupo | Composição | Liga refinada | Componentes | Tripulação |
|---|---|---:|---:|---:|
| L-A | 10 Horizon | 160 | 80 | 30 |
| L-B | 3 Vanguard | 162 | 84 | 30 |
| M-A | 6 Vanguard | 324 | 168 | 60 |
| M-B | 2 Aegis | 320 | 180 | 48 |
| H-A | 4 Sentinel | 360 | 192 | 64 |
| H-B | 1 Leviathan | 360 | 210 | 48 |
| E-A | 3 Vanguard + 1 Odyssey | 272 | 154 | 42 |
| E-B | 2 Sentinel + 1 Odyssey | 290 | 166 | 44 |

**Limites metodológicos:** diferentes tiers e requisitos de propulsão tornam confrontos economicamente semelhantes **não equivalentes em acesso tecnológico**. Comparar ainda equivalência de estágio científico, combustível, trabalhadores, tempo de produção e composição de defesa. Capturar resultados separados por recurso evita esconder restrição de um insumo atrás de uma única pontuação agregada.

## 4. Conjunto mínimo de cenários

| ID | Situação experimental | Variáveis | Questão ou invariante |
|---|---|---|---|
| **B01** | Combate legado sem Research/Combat 3.0 | Mesmas unidades, tecnologias e recursos | Resultado idêntico ao legado, incluindo dano, munição, saque, salvas e persistência |
| **B02** | 10 Horizon vs. 3 Vanguard | Atacante/defensor invertidos; sem escolta | Classificação e `weapon_modifiers` continuam significativos sem doutrina |
| **B03** | 6 Vanguard vs. 2 Aegis | Equilibrada / Interceptação / Ruptura como hipóteses | Identificar foco ineficaz, vantagem por concentração e custo de oportunidade |
| **B04** | 4 Sentinel vs. 1 Leviathan | Doutrinas e lado invertidos | Penalizar ou premiar classes conforme composição, não por nome visual |
| **B05** | 3 Vanguard + Odyssey vs. 2 Sentinel + Odyssey | `fleet_coordination` ligada/desligada | Sobrevivência de unidade científica, perdas das escoltas e dano total |
| **B06** | Uma Odyssey sob dois ataques e uma escolta | Um/two shooters, IDs distintos | No máximo um redirecionamento por escolta por salva; dano vai ao alvo efetivo |
| **B07** | Escolta destruída durante salva simultânea | Ordem de processamento e lado do combate | Tiro e redirecionamento já planejados não são cancelados na mesma salva |
| **B08** | Guarnição de duas frotas no mesmo planeta | Status ARRIVED/TRANSIT e mundos diferentes | Cobertura combina somente navios da própria guarnição no planeta atacado |
| **B09** | Alvos leves e capitais com modificadores diferentes | Interceptação e Ruptura `PROPOSED` | Preferências previsíveis, sem bônus implícito, `fallback` Equilibrada |
| **B10** | Guarnição com bateria sem munição e escudo planetário carregado | Escudos alto/baixo, munição zero/positiva | Sem disparos fictícios; escudo compartilhado é consumido uma vez |
| **B11** | Guerra eletrônica em atacante e defensor | Emissor apto, resistência por sensores, doutrina | Degradação contestável, nunca perda total dos ataques |
| **B12** | Reconhecimento sob guerra eletrônica | Qualidade 0–3, relatórios expirados/não expirados | Afeta observações novas; não reescreve observações históricas |
| **B13** | Perfil antiescudo vs. frota com e sem escudos | Escudos próprios/planetários, casco, armadura | Ganho situacional versus escudo implica custo de oportunidade contra casco |
| **B14** | Interdição em rota de ataque e retorno | Guerra, ativação, desligamento, offline, ETA | Sem bloqueio infinito, ordens duplicadas ou chegada retroativamente alterada |
| **B15** | Stargrave contra frota convencional preparada | Sem `containment_warfare`; preparação/custo | Derrota Stargrave possível por atrito em cenários apropriados, sem exclusividade de dano |
| **B16** | Stargrave com/sem contramedidas de contenção | Vulnerabilidades reveladas, energia, módulos | Ataques de módulo alteram capacidades sem morte automática do sistema |
| **B17** | Stargrave defendida por escoltas convencionais | Retirada, sinergia, origem e presença | Proteção especial não herda automaticamente regras de hulls comuns |
| **B18** | Resultados offline e ordens concorrentes | Reexecução, empate temporal, save legado | Idempotência, ownership, sem duplicação de custos, danos ou relatórios |

Para **B11–B17**, execução fica **bloqueada** até existirem contratos executáveis próprios e aprovação dos parâmetros. Não simular uma Stargrave falsa como Dominion ampliada.

## 5. Matriz de variação controlada

Para cada cenário aplicável, variar:

1. **Lado:** inverter atacante/defensor e repetir contra defesa planetária, quando pertinente.
2. **Tecnologia:** níveis fixados e documentados; ativar uma capacidade por vez antes de combinar duas ou três.
3. **Composição:** número de unidades e classes, preservando custos-base comparáveis e registrando diferença de tier.
4. **Estado:** HP íntegro ou danificado, escudos carregados ou esgotados, munição/cobertura suficiente ou faltante.
5. **Estratégia:** doutrina Equilibrada, Interceptação ou Ruptura; sem doutrina nova no baseline.
6. **Informação:** inteligência inexistente, válida, estimada ou expirada; sem vazamento de estado inimigo no cliente.
7. **Persistência:** tick online, reconciliação offline, chamada idempotente; eventos com timestamp ordenado.
8. **Ordem e identificação:** permutar IDs e ordem de inserção onde possível para revelar viés de desempate.

Não executar produto cartesiano indiscriminado. Usar pares de fatores e cenários de estresse deliberados; ampliar somente quando as diferenças forem significativas.

## 6. Métricas propostas para relatório

| Família | Medida | Cuidado |
|---|---|---|
| Eficiência militar | Resultado, perdas de naves por hull, sobrevivência, danos em HP/escudo, overkill e número de salvas | Vitória isolada não basta |
| Eficiência econômica | Liga, componentes, munição, combustível, tempo de estaleiro, ciência e custo de reposição por lado | Não converter recursos em moeda única sem justificativa |
| Valor da escolta | Disparos redirecionados, dano absorvido pela escolta, sobrevivência de apoio, perdas de escoltas | Não contar ataque direto como redirecionamento |
| Doutrina | Alvo pretendido/efetivo, distribuição por classe, queda de dano por targeting inadequado | Comparar sempre com Equilibrada |
| Guerra eletrônica | Salvas contestadas/degradadas, qualidade de relatórios novos, efeito da resistência por sensores | Nunca expor inteligência oculta |
| Escudos | Dano consumido por pool planetário, escudo próprio, casco e custo de perfil antiescudo | Um disparo não pode gastar pool duas vezes |
| Interdição | Tempo adicional, ETA, ações interrompidas, cancelamentos, estados de falha | Nunca criar bloqueio permanente |
| Stargrave | Perda de módulos/capacidades, custo total de captura/fabricação/suprimento, janelas de reação | Não comparar dano isolado com 30–50 Dominion como regra aprovada |
| Robustez | Diferença de resultado sob replay, falhas de ownership, duplicações, regressões de save | Tolerância zero para duplicação/corrupção |

**Futuros thresholds:** `OPEN`. Não escolher win rates, redução de perda, vantagem percentual, tempos ou multiplicadores agora. Thresholds só entram após observação dos baselines e discussão de ritmo do jogo.

## 7. Gate de qualidade e decisão

### Gate G0 — contratos de design

- `APPROVED`: C3.0-D01 e Research 3.0-D01, nos limites de seus documentos.
- `APPROVED` como design/metodologia: C3.0-D02, C3.0-D03 e esta C3.0-D04; parâmetros quantitativos ainda `OPEN`.
- **Bloqueio:** aprovações de design/metodologia não autorizam automaticamente o gameplay; fórmulas e contratos executáveis ainda não definidos devem ser resolvidos antes de implementação.

### Gate G1 — especificação técnica

Antes de codificar, fechar: seleção determinística, persistência da doutrina, emissores eletrônicos, aplicação de perfil antiescudo, momento de interdição, modelo dos subsistemas e regras de sigilo. Distinguir quais decisões adicionam schema e necessitam migração segura.

### Gate G2 — baseline e regressões

Somente quando execução for autorizada: coletar resultado do motor atual com fixtures isoladas. Reutilizar `resolve_battle` e os eventos persistentes como fonte de verdade; evitar duplicar as fórmulas em simulador paralelo. Comparar com motor estendido mantendo configuração legada e nenhuma capacidade nova.

### Gate G3 — eficácia e contrajogo

Ativar uma regra por vez nos cenários adequados, depois combinações. Demonstrar custo de oportunidade e caminhos de contrajogo, especialmente Tier IV versus Stargrave. Medir proteção contra jogadores offline e cenários de recuperação após perdas.

### Gate G4 — revisão de balanceamento

Somente após resultados reais: propor faixas quantitativas para aprovação, registrar divergência, revisar coeficientes e repetir cenários atingidos. Limites e parâmetros não podem ser aprovados implicitamente por tabelas de cenário.

## 8. Pontos de risco de design identificados

- **Foco rígido por classe:** Ruptura pode concentrar armas em `capital` com defesa planetária pesada, mesmo quando a nave de suporte inimiga oferece alvo mais vantajoso. Não modificar silenciosamente a C3.0-D02 para corrigir sem nova deliberação.
- **Identidade como desempate:** o ranking legado usa `target.id` como último termo e `-target.hp` como penúltimo; comparar permutações e concentrações de `overkill`.
- **Escudo compartilhado:** projeção de dano e aplicação real tratam absorções diferentemente. O novo targeting precisa validar consistência com escudos de guarnição e não reduzir o escudo duas vezes.
- **Screen spam:** muitas escoltas baratas podem redirecionar desproporcionalmente em comparação com capitais. Medir por material, tripulação, slots e efeito sobre objetivos da batalha.
- **EW sem emissor:** `electronic_warfare` não possui ainda um hull/instalação emissora executável; não atribuir capacidade a todos os navios sem decisão.
- **Interdição offline:** alterar `due_at` sem controle de estado pode causar loops, pedidos duplicados ou travamentos do universo.
- **Stargrave fora do modelo:** ainda não existem entidade, subsistemas nem custo operacional; qualquer número de vitória Stargrave obtido de uma simulação de casco fictício é inválido.
- **Assimetria de defesa:** guarnição composta de várias frotas coopera na escolta por decisão aprovada, mas doutrina defensiva Equilibrada é hipótese da C3.0-D02.

## 8.1. Integração e gates operacionais

`APPROVED` como contrato arquitetural: a [C3.0-D05](combat-integration.md) mapeia os riscos técnicos que devem ser resolvidos antes de executar B01–B18: seletor legado versus absorção real, fonte da doutrina, emissor de interferência, reprogramação offline e entidade Stargrave. Os algoritmos funcionais C3.0-D02/D03 estão aprovados como design, mas **nenhum teste foi iniciado** e os detalhes numéricos seguem `OPEN`.

## 9. Decisões aprovadas e lacunas restantes

| Documento | Questão não aprovada | Recomendação de próximo passo |
|---|---|---|
| **C3.0-D02 A–G** | `APPROVED` como design: ranking, redirecionamento, doutrina na ordem, sigilo e replay | Definir schema/valores e validar contra baseline |
| **C3.0-D03 A–G** | `APPROVED` como design: EW, observações novas, antiescudo, interdição, subsistemas | Definir emissor, parâmetros, gatilho e persistência |
| **R3.0-D01 detalhe** | Substituição de `military_tier_4` por `science_infrastructure:2` em Fundamental V | Aprovar ou substituir requisito alternativo |
| **Balanceamento** | Custo, duração, HP/eficácia, combustível, alcance e objetivos de win rate | Fixar somente depois de baselines autorizados |
| **Stargrave** | Elegibilidade da estrela, módulo persistente, estabilidade e bombardeio | Contrato próprio antes de qualquer teste executável |

### Política de aprovação

A aprovação explícita «aprovo tudo» em 08/11/2026 elevou C3.0-D02/D03 e este plano C3.0-D04 a `APPROVED` como design/metodologia. Ela não equivale a implementar gameplay, fixar parâmetros ausentes, criar PR ou fazer merge.

## 9.1. Continuidade D08/D09

`APPROVED` como metodologia: [C3.0-D08](combat-stellar-disposition.md) detalha os cenários numéricos de antiescudo, interdição, ataque estelar, salvamento e estabilização. **Não** são dados reais nem parâmetros finais. `PROPOSED`: [C3.0-D09](combat-stellar-custody.md) acrescenta cenários T17–T32 de custódia, destino, deduplicação e mundo procedural. Nenhum cenário B/T foi executado nesta etapa.

## 10. Referências

- [Design e revisão geral](README.md), [Balanceamento atual](balance.md).
- [C3.0-D01](combat-formations.md), [C3.0-D02](combat-targeting.md), [C3.0-D03](combat-countermeasures.md).
- [Research 3.0-D01](research-3.md), [Research 3.0-D02](research-operational.md).
- [Hulls atuais](../../persistent_data/ships/functions.yaml), [combate](../../starz/persistent/combat.py), [missões](../../starz/persistent/service.py), [inteligência](../../starz/persistent/intelligence.py).
- [QA local](../development/local-qa.md).

**Nenhum teste novo é executado com base neste documento.**
