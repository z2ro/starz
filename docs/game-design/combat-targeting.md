# STARZ — C3.0-D02: doutrinas e seleção determinística de alvos

**Estado:** `PROPOSED` — especificação para discussão; nenhuma prioridade algorítmica foi aprovada nesta D02.  
**Contratos aprovados:** [C3.0-D01 — escoltas e formações](combat-formations.md), [R3.0-D01 — identidades científicas](research-3.md).  
**Escopo:** doutrinas, seleção, redirecionamento, sigilo, replay e testes futuros; não implementar gameplay.

## 1. Resultado esperado

Um comandante escolhe no máximo **uma doutrina para uma frota**; o servidor seleciona os alvos por regras determinísticas. Escoltas funcionam automaticamente conforme a C3.0-D01, independentemente da doutrina ofensiva escolhida. Não há controles por nave ou por salva.

**`APPROVED` por C3.0-D01:** exatamente três opções, **Equilibrada, Interceptação e Ruptura**; sem quarta doutrina Proteção; proteção automática via `fleet_coordination`; até **um redirecionamento por escolta por salva** como limite inicial sujeito a simulação; funções distintas de Vanguard, Sentinel e Aegis; guarnição cooperativa por planeta; salvas simultâneas e fallback legado.

**`PROPOSED` nesta D02:** prioridade exata por classe, regra de desempate, momento de armazenamento da doutrina, tratamento das defesas, admissibilidade e telemetria.

## 2. Base autoritativa (`IMPLEMENTED`)

Em `starz/persistent/combat.py`:
- `fleet_units` cria unidades reais a partir de hull, ID, HP persistido, escudos, dano, armadura e modificadores de classe.
- `defense_units` cria unidades defensivas; sua `combat_class` é derivada de HP: `capital` se `hull_points >= 300`, senão `medium`.
- `plans` itera atiradores ordenados, filtra alvos com projeção de HP+escudo positiva e escolhe maior chave **(`source.modifiers[target.class]`, `-target.hp`, `target.id`)**. A seleção é determinística por estado, mas não possui doutrinas.
- `resolve_battle` calcula os dois planos de disparo da salva antes de aplicar qualquer um; a batalha tem no máximo seis salvas.
- `apply_hits` usa escudos planetários compartilhados quando aplicáveis, escudos do alvo, armadura e HP, sem uma reserva nova de formação.
- `resolve_missiles` é resolução separada; doutrinas navais e escoltas não a alteram automaticamente.
- `starz/persistent/service.py` usa `UniverseOrder` para a ordem `ATTACK` e realiza a batalha ao chegar; `local_defenders` pode reunir naves de várias frotas no mesmo planeta.
- `intelligence.py` registra observações privadas/expiráveis; a seleção de um alvo *presente na batalha* não implica revelar estoques ou tecnologias privadas.

## 3. Três doutrinas e desbloqueio

| Doutrina de UI | Disponibilidade | Prioridade proposta | Fallback |
|---|---|---|---|
| **Equilibrada** | Sempre, mesmo sem `fire_control_doctrine` | Manter **exatamente** o ranking legado de `plans` | Padrão para saves e ordens sem campo de doutrina |
| **Interceptação** | Exige `fire_control_doctrine` concluída | Se houver alvos elegíveis `light`, considerar primeiro apenas esses; nos demais casos aplicar Equilibrada | Equilibrada se não houver `light` elegível |
| **Ruptura** | Exige `fire_control_doctrine` concluída | Preferência de classe `capital` > `medium` > `light`; dentro da primeira classe elegível, usar ranking legado | Equilibrada caso não exista classe elegível para a política; nenhuma unidade ganha penetração especial |

**`PROPOSED`:** esse ranking não adiciona multiplicador de dano, bypass de escudo, bônus percentual, munição, novos tipos de arma ou licença para atacar subsistemas. O `weapon_modifiers` atual ainda determina o dano do atirador **contra o alvo efetivo**, e pode tornar uma doutrina menos eficiente. A classe `capital` também pode identificar uma plataforma defensiva pesada: comparar o impacto disso antes da aprovação.

**Atenção:** "Ruptura" (doutrina de alvo pesado) não equivale à pesquisa `shield_disruption` (perfil antiescudo), que exige contrato próprio.

## 4. Algoritmo conceitual proposto

1. **Validar** ordem, guerra, participantes reais, munição, posição e pesquisa, sem consultar dados privados do adversário fora do escopo de batalha.
2. **Criar snapshot por salva** de cada lado: atiradores, alvos, HP, escudos, classe, especializações e disponibilidade de escoltas.
3. **Selecionar candidato pretendido:** verificar alvo elegível e projeção positiva; aplicar a preferência da doutrina se válida; usar o ranking legado dentro do grupo escolhido.
4. **Avaliar redirecionamento**, no grupo defensor, se `fleet_coordination` estiver concluída: alvo pretendido protegível, escolta elegível/presente, capacidade ainda disponível nesta salva e proteção projetada suficiente.
5. **Determinar alvo efetivo** (pretendido ou escolta). Se redirecionado, recalcular o modificador da arma do atirador usando a classe do alvo efetivo; disparo e consumo de munição continuam únicos.
6. **Atualizar projeção local de planejamento** para o alvo efetivo, sem transformar projeção em dano persistido ou criar reserva extra de HP/escudos. Não conceder dano ou interceptação adicional.
7. **Repetir para atiradores restantes** em ordem estável e emitir plano completo, com alvo pretendido e efetivo.
8. **Planejar ambos os lados antes de aplicar qualquer dano da salva**, preservando simultaneidade: destruição de uma escolta por tiro da outra equipe na mesma salva não cancela interceptação já planejada.
9. **Aplicar danos reais** pela absorção existente; persistir resultados uma vez. Recalcular cobertura somente na próxima salva com sobreviventes.

### 4.1. Disparos sem alvos

- Nenhum disparo se não há alvo elegível ou `source.damage <= 0`.
- Armas que exigem munição só disparam se a munição real estiver disponível. Consumo corresponde ao disparo efetivo, não à tentativa de aquisição nem à interceptação da escolta.
- Alvo com proteção projetada esgotada deixa de ser candidato para novos disparos, sem remover prematuramente uma nave real da salva simultânea.
- Alvo pretendido já eliminado pela projeção pode provocar nova seleção de candidato; não há ataque fantasma.

### 4.2. Elegibilidade de escoltas aprovada

| Escolta | Protege | Limite já decidido |
|---|---|---|
| Vanguard | Horizon, Odyssey, Wayfarer | Um redirecionamento/salva inicialmente |
| Sentinel | Horizon, Odyssey, Wayfarer, Atlas, quando o **atirador inimigo é `light`** | Um redirecionamento/salva inicialmente; não intercepta mísseis estratégicos |
| Aegis | Atlas, Dominion | Um redirecionamento/salva inicialmente; absorção com HP e escudos próprios |

Na ofensiva, formar o grupo real da ordem `ATTACK`. Na defesa, todas as naves do mesmo império presentes **no planeta atacado** formam um grupo de guarnição; outras órbitas, planetas, aliados e frotas em trânsito não são incluídos.

**`PROPOSED` para a escolha entre duas escoltas elegíveis:** primeiro verificar capacidade e condição real, depois especialidade apropriada, depois ID estável como desempate. Não permitir proteger um ataque já direcionado à própria escolta nem cadeias recursivas de redirecionamento (a escolta que recebe o tiro não pode ser novamente escoltada no mesmo disparo).

## 5. Compatibilidade e persistência propostas

- Para qualquer save ou ordem sem doutrina nova: **Equilibrada**, com ranking legado. Não converter automaticamente todos os impérios para Interceptação ou Ruptura.
- Política especializada exige `fire_control_doctrine` no momento da configuração/partida, e não pode ser selecionada apenas no frontend.
- **Proposta:** a doutrina ofensiva selecionada é imutável após confirmar o despacho `ATTACK`, ficando no contexto persistente da ordem; assim, uma mudança posterior no estado da frota não altera retroativamente combate já contratado. O nome exato de campo de persistência está `OPEN`.
- **Proposta:** guarnições planetárias heterogêneas usam Equilibrada como doutrina de tiro em sua primeira versão. A **cobertura de escolta cooperativa** aprovada continua ativa nessa guarnição, independente da doutrina ofensiva. Não atribuir arbitrariamente doutrina de uma frota local às demais.
- Ao combinar/dividir frotas e carregar saves antigos, validar e manter um padrão seguro. Não exigir migração destrutiva ou preenchimento compulsório de novos campos.
- Missões `MOVE`/`TRANSPORT`/`RECON` não ganham disparos ou efeitos de doutrina sem definição própria.

## 6. Inteligência, sigilo e aquisição de alvos

**Distinção obrigatória:**
- **Alvo presente no combate:** a engine pode selecionar unidades efetivamente presentes e legalmente combatíveis, mesmo se o atacante não realizou espionagem prévia; é compatível com o combate atual.
- **Informação fora da batalha:** estoques, upgrades, tecnologias e localização de outras frotas não podem ser inferidos nem divulgados pela UI/relatório sem reconhecimento autorizado.
- **Subsistemas de Stargrave:** exigem descoberta e contrato especializado posteriores; não se tornam automaticamente elegíveis apenas porque Ruptura prioriza classe `capital`.
- **Guerra eletrônica:** poderá modificar a capacidade de aquisição em contrato separado; a D02 não inventa graus de precisão nem troca silenciosamente os alvos atuais por informação privada.

## 7. Invariantes e riscos

- O mesmo estado de combate, ordem de atiradores, doutrina e condições produzem o mesmo plano e resultado.
- Uma escolta não redireciona mais de um disparo por salva no limite inicial; disparos **diretos** sobre ela não contam como interceptações.
- O dano real incide somente sobre o **alvo efetivo**; usar `weapon_modifiers` relativos à sua classe.
- Nenhuma vantagem silenciosa por quantidade de escoltas ausentes, automatizadas ou de outro planeta.
- Sem pesquisa `fleet_coordination`, a proteção é zero; sem `fire_control_doctrine`, Equilibrada.
- **Risco conhecido:** `plans` usa projeção simplificada para selecionar alvos e `apply_hits` usa absorção real por escudo/armadura. A futura implementação deve manter consistência de projeções, amortecimento de *overkill* e pool planetário, sem alterar o resultado legado da doutrina Equilibrada sem decisão explícita.
- **Risco de balanceamento:** doutrina de classe rígida pode piorar dano total e favorecer *screen spam*. Medir contra navios leves, capitais, defesas e frotas mistas de custo equivalente.
- Não alterar a resolução separada de `resolve_missiles` nem a condição geral de vitória/saque com a mera adição de doutrinas.

## 8. Casos mínimos de validação futura

1. Combate sem doutrinas e escolta: resultado byte-equivalente ou semanticamente equivalente ao legado, incluindo seis salvas.
2. Equilibrada com `fire_control_doctrine`: mesmo seletor existente, sem bônus invisível.
3. Interceptação escolhe `light` quando presente e elegível; sem `light`, usa Equilibrada.
4. Ruptura escolhe `capital`; se não houver, `medium`; depois `light`, incluindo defesa pesada classificada como capital.
5. No mesmo grupo de classe, desempate determinístico compatível com a seleção atual.
6. Vanguard redireciona tiro para Odyssey; disparo subsequente na mesma salva não é redirecionado pela mesma Vanguard.
7. Sentinel só intercepta tiro cujo **atirador** tenha classe `light`.
8. Aegis pode proteger Atlas/Dominion; disparos contra a própria Aegis não acionam escolta.
9. Redirecionamento recalcula modificador de classe e respeita pool de escudos planetário sem duplicação.
10. Um navio que morre na salva ainda executa tiro já planejado no lado oposto; na salva seguinte não participa.
11. Guarnição formada por frotas distintas no mesmo planeta coopera; naves de outros planetas não.
12. Defesa sem munição não dispara; escolta não intercepta `strategic_missile`.
13. Ordens anteriores sem campo de doutrina adotam Equilibrada sem quebrar save ou persistência offline.
14. Replay/reconciliação não duplica perdas, consumo de munição, recompensas ou relatórios.
15. O relatório do atacante não revela estoques/tecnologias privadas não confirmadas por inteligência.

## 8.1. Dependência do próximo contrato

`PROPOSED`: [C3.0-D03 — guerra eletrônica, antiescudos, interdição e contenção estelar](combat-countermeasures.md) considera esta C3.0-D02 como **hipótese**, não como regra aprovada. A interferência só poderá degradar uma priorização especializada para o comportamento Equilibrada após aprovação conjunta dos contratos relevantes. Nenhum algoritmo desta D02 foi implementado ou validado por teste de aplicação.

## 8.2. Matriz de cenários posterior

`PROPOSED`: os casos B01–B10 e B18 da [C3.0-D04](combat-balance-plan.md) buscam medir custo, desempate, classes, redirecionamento, munição e regressão de saves. Eles **não** aprovam o ranking ou a persistência desta C3.0-D02 e não constituem testes executados.

## 9. Decisões pendentes — C3.0-D02

| ID | Decisão proposta para aprovação |
|---|---|
| **C3-D02-A** | Interceptação: priorizar `light` com fallback Equilibrada |
| **C3-D02-B** | Ruptura: ordenar `capital > medium > light`; manter modificadores existentes |
| **C3-D02-C** | Dentro da classe, manter ranking determinístico legado; doutrina Equilibrada idêntica ao legado |
| **C3-D02-D** | Alvo pretendido → redirecionamento único não recursivo → alvo efetivo → cálculo normal do dano |
| **C3-D02-E** | Capturar doutrina de ataque na ordem `ATTACK` e aplicar Equilibrada como fallback de saves e guarnição |
| **C3-D02-F** | Separar aquisição de alvos presentes da inteligência prévia; não conceder acesso a dados privados |
| **C3-D02-G** | Exigir telemetria reprodutível e preservar simultaneidade, defesa planetária, munição e persistência |

Todos esses itens estão **`PROPOSED`**. Números, variantes de armas, fórmula eletrônica e detalhes de armazenamento permanecem `OPEN`. Uma aprovação de design **não** autoriza implementação automática.

## 10. Fontes

- [Combat 3.0 — visão](combat-doctrines.md), [C3.0-D01 aprovada](combat-formations.md), [Research 3.0](research-3.md).
- [Combate executável](../../starz/persistent/combat.py), [Operações e missões](../../starz/persistent/service.py), [Inteligência](../../starz/persistent/intelligence.py).
- [Naves](ships.md), [balanceamento](balance.md), [QA local](../development/local-qa.md).
