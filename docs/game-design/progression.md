# Progressão da civilização

## 1. Propósito e escopo

Relacionar começo, expansão e endgame à experiência persistente do STARZ, sem transformar as fases do [GDD §3](STARZ-GDD-v1.md) em turnos, campanha obrigatória ou prazos de derrota.

## 2. Comportamento implementado

`IMPLEMENTED`: contas independentes compartilham universo PostgreSQL; cada império possui colônias, pesquisa e frotas. Produção, construção, pesquisa e missões avançam por timestamps, inclusive offline. O universo persistente não impõe vitória final ou derrota por expiração de campanha. NPCs não substituem interação humana.

O desenvolvimento usa extração/processamento, energia e população locais; centros científicos, três filas por domínio e desbloqueios; dez classes convencionais; exploração, colonização, transporte, diplomacia, mercado, inteligência e guerra reais. A existência dessas peças não comprova caminhos igualmente competitivos ou tutorial completo.

## 3. Decisões aprovadas

`APPROVED`: preservar identidade de estratégia espacial multiplayer persistente e compatibilidade de saves. Stargrave é unidade excepcional de endgame, não botão de vitória multiplayer. O cenário Concordat permanece distinto; suas regras não definem o ritmo do universo aberto.

## 4. Mudanças propostas

| Fase do GDD | Intenção `PROPOSED` | Base atual / lacuna |
|---|---|---|
| Fundação | Sustentar planeta inicial e ciência básica. | Cadeias, energia, trabalhadores e tier I existem. |
| Industrialização | Aumentar processamento, manufatura e capacidade científica. | Instalações e bônus existem; especialização econômica precisa avaliação. |
| Expansão | Novas colônias, logística e projeção interestelar. | Missões, limites tecnológicos e colonização existem. |
| Supremacia | Forças especializadas, proteção e infraestrutura avançada. | Classes, defesas e tiers altos existem; várias habilidades ainda são propostas. |
| Engenharia Estelar | Captura, estabilização e operação de Stargrave. | Modelo e pesquisa preliminar; ciclo estelar ausente no persistente. |

As fases são uma estrutura de design, não flags existentes no save ou uma sequência obrigatória. GDD §15 recomenda planejar pesquisa, economia, frota/defesa, Stargrave e simulador antes da implementação; este conjunto de documentos não autoriza iniciar esses projetos.

## 5. Dependências

[Pesquisa](research.md) define capacidade e desbloqueios. [Economia](economy.md) sustenta expansão. [Naves](ships.md), [defesas](defenses.md) e [combate](combat.md) determinam risco. [Stargrave](stargrave.md) exige sistemas futuros. [Balanceamento](balance.md) separa ritmo pretendido de tempos medidos.

## 6. Regras e contratos atuais

`IMPLEMENTED`: tiers dependem de capacidade 1/3/6/10/15 e avanços por domínio. Pesquisa pertence ao império; recursos e requisitos industriais/científicos locais pertencem ao planeta. Níveis existentes e projetos pagos devem sobreviver a futuras migrações.

Colonização exige conhecimento `SURVEYED`, planeta viável e não ocupado/reivindicado, população e materiais, frota elegível e capacidade por `astrophysics`/`colonies`. Concluir o avanço de tier não coloniza nem concede uma nave automaticamente.

Frotas têm limite operacional derivado de `computing`/`fleet_slots`; propulsão, combustível e carga restringem missões reais. Diplomacia regula hostilidade; mercado reserva recursos e entrega depois. Não existe aliança que automaticamente agregue frotas em um único ataque conjunto.

`PROPOSED`: caminhos industrial, científico, logístico/comercial, militar e estelar devem oferecer alternativas estratégicas. São objetivos a validar, não especializações exclusivas já persistidas. A visualização de uma tecnologia futura ou design Stargrave não altera os gates.

## 7. Considerações de balanceamento

`PROPOSED`: progresso aberto com decisões de oportunidade, sem condenar quem fica offline e sem tornar supremacia militar inevitável. Medir acesso a recursos, recuperação, dependências cruzadas e vantagem acumulativa. Os intervalos de dias/semanas do GDD são hipóteses, não cronograma obrigatório.

## 8. Questões abertas

`OPEN`: como tornar rotas pacíficas competitivas em PvP? Quais proteções e avisos para iniciantes/offline? Quais metas intermediárias comunicam progresso sem campanha obrigatória? Como recuperar um império após perdas e impedir domínio estelar irreversível? Essas decisões exigem aprovação e simulação.

## 9. Fontes

- [GDD §1–3, §10–11 e §15](STARZ-GDD-v1.md), [universo persistente](../persistent-universe.md).
- [Capacidades e colonização](../../starz/simulation.py), [tiers e legado](../../starz/progression.py).
- [Multiplayer, missões e diplomacia](../../starz/persistent/service.py), [rotas e propriedade](../../starz/persistent/routes.py), [modelos persistentes](../../starz/db/models.py).
- [Concordat — cenário separado](../complete-game.md), [seleção de modo](../../starz/api.py).
