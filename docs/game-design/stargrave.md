# Stargrave — contrato de design

## 1. Propósito e escopo

Consolidar a decisão do responsável e o [GDD §8–9 e §14](STARZ-GDD-v1.md), sem implementar captura estelar, projetos ou combate Stargrave. Sua existência visual não autoriza gameplay.

## 2. Comportamento implementado

`IMPLEMENTED`: design procedural `stargrave`, sem hull convencional no registro visual; pesquisa preliminar `stellar_containment` com bônus energético no catálogo persistente. Não há no universo persistente entidade de estrela capturada, construção multietapas, mobilidade estelar ou bombardeio Stargrave.

`IMPLEMENTED`, **apenas Concordat**: cenário opcional possui projeto de quatro segmentos associado à vitória de campanha e regras por turnos. Isso não representa a unidade militar móvel nem autoriza vitória automática no multiplayer. D04 é uma diferença de escopo que precisa permanecer explícita.

## 3. Decisões aprovadas

| Estado | Contrato |
|---|---|
| `APPROVED` | Stargrave é uma nave de guerra estelar móvel. |
| `APPROVED` | Contém exatamente uma estrela cativa. |
| `APPROVED` | É unidade militar excepcional de endgame, não um hull convencional. |
| `APPROVED` | Pode executar bombardeio orbital devastador. |
| `APPROVED` | É poderosa, mas não invulnerável. |
| `APPROVED` | Frotas convencionais e contramedidas especializadas devem conseguir derrotá-la. |
| `APPROVED` | Não concede vitória automática multiplayer. |
| `APPROVED` | Construção exige ciência, indústria, logística e engenharia estelar avançadas. |
| `APPROVED` | O modelo visual não comprova nem autoriza mecânicas. |

A aprovação desses requisitos não aprova custos, duração, dano, limites operacionais ou eficácia das contramedidas.

## 4. Mudanças propostas

`PROPOSED`: cinco fases — infraestrutura de captura, estabilização, montagem Dyson, integração móvel e comissionamento armado. O GDD sugere captura em sistema conhecido/controlado, sem colônias hostis, exclusão da estrela natal e evacuação ou suporte artificial a colônias próprias. Soberania sobre um planeta não comprova controle sobre sua estrela.

`PROPOSED`: núcleo de contenção, escudos estelares, arma principal, propulsão gravitacional e controle como subsistemas; capacidade energética compartilhada entre defesa, arma e movimento; reserva protegida e desligamento emergencial seguro. Não há HP, consumo ou ordem de dano aprovados para esses módulos.

`PROPOSED`: batalha orbital antes do bombardeio; preparação detectável e interrompível; dano a infraestrutura, defesas e produção sem apagar instantaneamente planeta, colônia ou conta. Recuperação de destroços e ataques ao núcleo após ruptura externa dependem de regras futuras. A preparação de 12–24 h é hipótese de balanceamento.

`PROPOSED`: sistema que perde a estrela conserva identidades e coordenadas de planetas; transformação climática/energética gradual e habitats artificiais precisam de contratos próprios. Não alterar geração determinística atual para fingir captura.

## 4.1. Contramedidas da C3.0-D03

`APPROVED` como design: [C3.0-D03](combat-countermeasures.md) fixa funções de contenção, propulsão, armamentos, escudos e controle como subsistemas degradáveis; seus IDs, HP e modelo de persistência ainda não existem. `containment_warfare` no Tier IV concede uma forma de ataque dirigido, mas não exclusividade de dano: frotas convencionais preparadas continuam aptas a derrotar Stargrave. Interdição não pode paralisar jogadores indefinidamente; escudos e blindagem não são ultrapassados apenas pela conclusão científica. A identidade da estrela cativa e a construção multietapas seguem sem implementação.

## 4.2. Aprovação operacional C3.0-D06-F/G (08/11/2026)

`APPROVED`: [C3.0-D06](combat-operational-closures.md) define captura de estrela em **sistema descoberto, desabitado e não natal**, com reserva exclusiva, bloqueio de colonização posterior à captura comprometida e **cinco fases**: captura, estabilização, montagem, integração e comissionamento. Módulos industriais precisam ser fabricados e transportados fisicamente. Uma Stargrave contém **uma única estrela cativa**, nunca é hull convencional e não concede vitória automática.

`APPROVED`: subsistemas Contenção, Propulsão, Armamentos, Escudos e Controle podem perder capacidades; destroços não movem nem atacam e preservam o vínculo com a estrela até resolução segura. Derrota não apaga planetas, IDs ou coordenadas nem explode automaticamente a estrela.

`PROPOSED`: [C3.0-D07](combat-technical-contracts.md) apresenta fonte estelar, projeto, unidade excepcional, unicidade transacional e ordem de transições. **Ainda não aprovado:** esquema executável, fórmula de dano, estados exatos, destino físico da estrela, recuperação/reparo e efeitos no sistema. A meta de **uma Stargrave em obra ou operacional por império** é limite inicial sujeito a simulação, não hard cap final.

## 5. Dependências

[Pesquisa](research.md): separar ciência estelar e comissionamento militar. [Economia](economy.md): indústria/logística estelar. [Naves](ships.md): escoltas e contrajogo convencional. [Defesas](defenses.md) e [combate](combat.md): interação com módulos e bombardeio. [Balanceamento](balance.md): validar custo de oportunidade, vulnerabilidades e recuperação.

## 6. Regras e contratos relevantes

`IMPLEMENTED`: `stellar_containment` ainda depende de `carrier_operations: 3`; sua conclusão não captura uma estrela nem cria uma unidade. `future_unlocks` não é endpoint de construção. Não cadastrar Stargrave como combustível/propulsão convencional ou usar um design visual como entidade persistente.

`PROPOSED`: `StellarProjectDefinition` e `StargraveState` são nomes conceituais do GDD §12, não classes/tabelas existentes. Captura, vínculo único estrela–unidade, etapas, estabilidade, mobilidade, propriedade e perda exigirão contratos persistentes e migrações explicitamente autorizados. Reconciliar etapas offline com idempotência é requisito de uma futura implementação, não funcionalidade comprovada agora.

## 7. Considerações de balanceamento

`PROPOSED`: equivalência industrial de 30–50 Dominion, primeira unidade em 8–12 semanas e uma Stargrave operacional por império são hipóteses, não regras aprovadas. Frotas preparadas e contramedidas precisam vencer em cenários reproduzíveis; forças fracas isoladas podem perder. Escoltas, abastecimento e custo de reposição devem importar sem tornar aquisição vitória inevitável.

## 8. Questões abertas

`OPEN`: elegibilidade e soberania estelar, evacuação, custos, durações, estabilidade, alcance/velocidade, recuperação, limites por império e ciclo de substituição. Quais perdas são reversíveis? Quais contramedidas são acessíveis antes da primeira unidade? Qual janela respeita jogadores offline? Não há valores finais a preencher nesta documentação.

## 9. Fontes

- Contrato explicitamente aprovado pelo responsável nesta tarefa; [GDD §8–14](STARZ-GDD-v1.md).
- [Referência visual Stargrave-class](../design/imperial-command-v2/frotas/STARGRAVE-CLASS.md), [registro visual](../../frontend/src/visual/ShipDesignRegistry.ts).
- [Pesquisa persistente](../../persistent_data/technologies/levels.yaml), [projeto do cenário opcional](../../starz/campaign.py), [Concordat](../complete-game.md).
