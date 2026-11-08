# Combate, missões e PvP

## 1. Propósito e escopo

Descrever a resolução autoritativa atual e distinguir propostas de guerra planetária/estelar do [GDD §6–9 e §11](STARZ-GDD-v1.md). Não alterar coeficientes nem implementar combate tático 3D.

## 2. Comportamento implementado

`IMPLEMENTED`: missões persistentes, guerra bilateral, inteligência autorizada, combate com até seis salvos simultâneos, perdas reais, saque limitado e relatórios privados aos participantes. A chegada é resolvida por timestamp, inclusive offline.

Atacantes são naves reais da frota; defensores são naves vinculadas ao planeta-alvo e suas estruturas locais. Estar no mesmo sistema não basta para defender todos os planetas. Alvos são escolhidos deterministicamente por modificador contra classe, HP e ID, com distribuição prevista para evitar concentrar dano desnecessário em alvos já condenados.

## 3. Decisões aprovadas

`APPROVED`: preservar multiplayer persistente, servidor autoritativo e isolamento de propriedade. Stargrave deve ser poderosa, mas derrotável; pode bombardear devastadoramente, sem conceder vitória automática. Isso ainda não define algoritmo de combate para seus subsistemas.

## 4. Mudanças propostas

`PROPOSED`: sinergias específicas de classes; subsistemas da Stargrave; batalha orbital seguida de preparação de bombardeio, interrupção e contramedidas. GDD sugere proteger contas novas e criar janelas de reação/offline; essas proteções específicas não são presumidas existentes. A hipótese de 12–24 h não é regra atual.

## 5. Dependências

[Naves](ships.md) fornecem perfis; [pesquisa](research.md), modificadores; [defesas](defenses.md), proteção/munição; [economia](economy.md), custos e carga; [Stargrave](stargrave.md), contratos futuros. Inteligência tem qualidade e validade próprias, não equivale a acesso ao estado privado de outro império.

## 6. Regras e contratos atuais

`IMPLEMENTED`: dano naval parte de `(weapon_damage + carrier_capacity × 5 × (1 + carrier_bonus)) × (1 + weapons_bonus)`; modificadores de classe influenciam o ataque. Dano defensivo inclui `weapons`, `defense` e cobertura. Absorção passa pelo escudo planetário, escudo da unidade e casco com redução por armadura. Planos dos dois lados são calculados antes das perdas do salvo, permitindo disparo simultâneo.

Durabilidade de casco e perdas persistem; escudos de naves são preparados para o confronto, enquanto carga planetária é consumida e regenerada pela simulação. Vitória atacante exige sobreviventes e eliminação dos defensores; encerrar seis salvos não garante vitória. Saque exige vitória e respeita até 25% de cada estoque e a carga dos sobreviventes; a entrega ao atacante ocorre no retorno. Não há captura automática de colônia por `ATTACK`.

Missões: `MOVE`, `REINFORCE`, `SURVEY`, `COLONIZE`, `TRANSPORT`, `ATTACK`, `ESPIONAGE`, `RECON`, `EXPEDITION`. A operação avançada fica no payload da `UniverseOrder` e na projeção `fleet.operation`; não confundir com o enum histórico limitado de `fleet.mission`. Dispatch valida naves únicas, localidade, disponibilidade, combustível, slots e elegibilidade da missão; retorno/recall usam reserva real. `REINFORCE` exige planeta próprio.

Ataque exige guerra e propriedade adversária; a chegada revalida relações diplomáticas. Missões usam `(x,y)` autoritativos, nunca distância visual de mapa ou órbita. Ordens guardam `due_at` e resolução persistente. Transações serializadas por lock do universo impedem gasto/resultado duplicado; não atribuir ao frontend a resolução militar.

Mísseis estratégicos: munição real, bateria operacional, alcance `12 × (1 + sensors)` e viagem `max(30, ceil(distância × 45 / (1 + speed)))` segundos. Interceptação consome munição. Cada míssil não interceptado aplica `100 × (1 + weapons)` antes das proteções; dano excedente pode destruir níveis de instalações, exceto `civil_district`, conforme a resolução. Esse ataque já existe; não é bombardeio Stargrave.

Relatórios de batalha registram participantes, planeta, composição antes/depois, perdas, salvos, dano, absorção, munição, modificadores tecnológicos e saque. Relatórios de inteligência distinguem confirmado, estimado, desconhecido e desatualizado; expiram segundo qualidade. Não consultar estado privado alheio para preencher lacunas. Não há ataque humano conjunto multilateral implementado apenas porque existem alianças.

## 7. Considerações de balanceamento

`PROPOSED`: simular forças equivalentes por custo, tecnologia, munição e logística, incluindo retirada possível, recuperação e efeito de offline. Perdas econômicas no relatório não são reembolso. Não interpretar resultado determinístico como prova de equilíbrio.

## 8. Questões abertas

`OPEN`: modelos de targeting e absorção para subsistemas estelares; possibilidade de intervenção aliada; regras de interrupção e recuperação de destroços; limites de bombardeio e proteção de iniciantes. Não introduzir esses mecanismos por analogia com mísseis.

## 9. Fontes

- [GDD §6–11](STARZ-GDD-v1.md), [combate autoritativo](../../starz/persistent/combat.py).
- [Operações, PvP e mísseis](../../starz/persistent/service.py), [inteligência](../../starz/persistent/intelligence.py).
- [Persistência de ordens](../../starz/db/models.py), [viagem](../../starz/travel.py).
- [Combate e inteligência 2.0](../fleet-intelligence-2.md), [defesas](../planetary-defense.md).
