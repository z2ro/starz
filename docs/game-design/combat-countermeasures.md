# STARZ — C3.0-D03: guerra eletrônica, ruptura e contramedidas estelares

**Estado:** `PROPOSED` — contrato funcional para revisão, **não aprovado nem implementado**.  
**Branch de referência:** `experiment/persistent-universe`.  
**Autoridade aprovada:** [R3.0-D01](research-3.md) fixa os IDs e os propósitos de `electronic_warfare`, `shield_disruption`, `spatial_interdiction` e `containment_warfare` (e as contramedidas no Tier IV). [C3.0-D01](combat-formations.md) fixa o redirecionamento por escolta e as três doutrinas.  
**Propostas correlatas:** [C3.0-D02 — seleção de alvos](combat-targeting.md), [R3.0-D02 — capacidades](research-operational.md), [Stargrave](stargrave.md), [defesas](defenses.md).  
**Sem autorização:** código, YAML, novos IDs executáveis, migrações, números de dano, custo, tempo, alcance ou eficácia.

## 1. Objetivos e invariantes

1. **Todo poder tem contrajogo.** Ações especializadas oferecem vantagem *situacional*, não vitória automática nem imunidade.
2. Ciência habilita capacidades; execução exige presença, oportunidade e requisitos concretos, não apenas um nível de pesquisa.
3. Resultado é **determinístico**, calculado no servidor e reproduzível por snapshots de combate/ordens persistentes.
4. Dano e proteção são os **mesmos recursos físicos** existentes no combate. Não criar uma reserva paralela de HP, escudo ou dano eletrônico.
5. Não alterar o contrato aprovado de escolta, não alterar unilateralmente o algoritmo ainda proposto da C3.0-D02 e não quebrar saves legados.
6. O atacante pode selecionar um alvo **presente e combatível** sem espionagem prévia; isso não autoriza revelar estoques, pesquisas e subsistemas privados.
7. A Stargrave continua uma unidade militar móvel excepcional com **exatamente uma estrela cativa**, não um `hull` convencional. Pode perder contra frotas convencionais preparadas e não concede vitória automática.
8. `missile_interceptor` e `resolve_missiles` permanecem restritos às munições estratégicas existentes; não inferir interceptação genérica de armas Stargrave.

## 2. O que já é `IMPLEMENTED`

| Área | Fonte e comportamento atual | Lacuna nova |
|---|---|---|
| Seleção naval | `combat.py:plans` seleciona alvos com `weapon_modifiers`, HP projetado e ID; planos simultâneos por até seis salvas | Não há perturbação de targeting ou perfis antiescudo |
| Defesa | `apply_hits` consome primeiro escudo planetário disponível, depois escudo naval e HP mitigado por `armor` | Não existe canal de dano especializado nem vulnerabilidade de subsistema |
| Inteligência | `intelligence.py` calcula qualidade 0–3 e relatórios que expiram; `sensors`, `espionage`, `counter_intelligence` já influenciam as observações | Não existe tecnologia `electronic_warfare` nem mecanismo ativo de interferência |
| Missões | `service.py` mantém ordens, ETA, propriedade, guerra, recall e revalidação na chegada | Não existe interdição operacional de região |
| Defesas | `planetary_shield`, `orbital_platform` e seis estruturas atuais; `missile_interceptor` usa munição real para mísseis estratégicos | Nenhuma matriz de interdição ou bateria de contenção |
| Stargrave | Design visual sem `hull_id`, sem entidade de captura ou módulo autoritativo | Subsistemas, bombardeio e contrajogo especial ainda são design |

Esses fatos não demonstram que qualquer capacidade desta D03 esteja disponível.

## 3. `electronic_warfare` — interferência eletrônica (Militar III)

**Capacidade principal `APPROVED`:** interferir em sensores e aquisição de alvos.  
**Contrato `PROPOSED`:** contestar a *precisão da escolha*, não desligar navios ou retirar unidades da batalha.

### 3.1. Dois contextos, mesma descoberta

**No combate naval:** interferência eficaz pode degradar a **priorização especializada** de um adversário para o comportamento `Equilibrada` **naquela salva**. O adversário continua selecionando e atingindo alvos reais. A doutrina escolhida não é apagada nem regravada; o efeito de interferência somente limita a qualidade de sua execução. Não reduzir automaticamente dano bruto, número de disparos ou HP.

**Em inteligência:** interferência eficaz pode reduzir a qualidade **de uma nova observação** dentro da escala existente de 0 a 3, sem converter estimativas em acesso a dados privados ou modificar relatórios antigos. Relatórios continuam expirando pelos mecanismos atuais. A proteção já fornecida por `counter_intelligence` não deve ser aplicada duas vezes ao mesmo estágio de cálculo.

### 3.2. Contestação e ativação

- Um império precisa ter concluído `electronic_warfare` para **emitir** interferência.
- `sensor_array` e `computing` preservam valor como fundamentos de aquisição e resistência, além da função atual; `counter_intelligence` continua especializado em observações.
- **`OPEN`:** qual nave ou instalação já existente é elegível para sustentar a interferência; não inventar `jamming_strength` ou um novo hull sem contrato. A primeira implementação deve reutilizar um atributo/role comprovado ou explicitar a capacidade em dados validados.
- **`PROPOSED`:** resultado contestado por vantagem científica/operacional, com três estados relatáveis: `normal`, `contested`, `degraded`. Esses nomes são de design, **não** novos enums.
- Um jogador sem `electronic_warfare` ainda pode resistir por `sensor_array` e capacidades existentes; a nova tecnologia não torna espionagem nem doutrinas inutilizáveis.

### 3.3. Casos de não efeito

- Sem emissor elegível presente/operacional: não há interferência ativa.
- Com política de alvo `Equilibrada`: degradá-la para Equilibrada não cria penalidade adicional.
- Não há redução de precisão baseada em sorte não reproduzível nem ataques a frotas ausentes.
- Não desfazer reconhecimento realizado ou atualizar silenciosamente informação já expirada.

**Risco técnico:** o seletor legado não possui conceito de qualidade da aquisição de alvos. A futura implementação precisa integrar essa decisão ao contexto de planejamento, sem criar acesso à tecnologia privada do adversário no relatório.

## 4. `shield_disruption` — perfil antiescudo (Militar IV)

**Capacidade principal `APPROVED`:** combate especializado contra escudos energéticos.  
**Contrato `PROPOSED`:** permitir **um perfil ofensivo de antiescudo por frota** quando a tecnologia estiver concluída. O perfil é independente da doutrina de *seleção* do alvo: Interceptação/Ruptura respondem a **quem** atacar; antiescudo responde a **como** o dano é aplicado.

### 4.1. Mecanismo mínimo

- Escolha opcional, uma vez antes da missão `ATTACK`, sem controles por nave ou salva. O padrão legado é armamento convencional.
- Disparo antiescudo tem vantagem **somente na parcela que efetivamente alcança a absorção por escudo**, e trade-off ofensivo contra HP/casco ou contra alvos sem escudo; os coeficientes são `OPEN`.
- Escudo planetário é coletivo: a especialização deve descontar da **carga real de geradores** sem inventar um escudo por nave, e a propriedade do dano deve constar no relatório.
- Em ausência de escudos ativos, o perfil não pode oferecer benefício líquido universal, e pode ser inferior ao padrão.
- Não permite ignorar toda proteção, alterar HP máximo ou disparar sem munição.

### 4.2. Compatibilidade

O contrato atual resolve `planetary_shield` antes do escudo naval. **`PROPOSED`:** calcular o efeito específico na etapa de absorção existente, usando um único orçamento de dano e consumo; não lançar um segundo ataque «extra contra escudos».

**`OPEN`:** como uma guarnição ou instalação local selecionaria perfil antiescudo, se isso for autorizado. O desenho inicial não concede o perfil automaticamente a todos os canhões e mísseis defensivos.

**Risco:** um perfil de arma separado é uma segunda escolha de missão, além da doutrina de alvos. Deve caber no painel existente sem criar microgerenciamento; se o custo de interface for alto, avaliar seleção por política de frota persistente. A decisão deve ser anterior ao despacho, não por salva.

## 5. `spatial_interdiction` — interdição operacional (Militar IV)

**Capacidade principal `APPROVED`:** restringir operações estratégicas hostis de forma contestável.  
**Contrato `PROPOSED`:** uma **zona regional de interdição** sustentada por unidade/instalação real e custo operacional, sem tratar interdição como disparo comum.

- O emissor tem identidade, proprietário, posição, estado, cobertura e janela de atividade.
- A zona somente afeta **operações hostis elegíveis** que cruzem uma condição explícita de entrada, saída ou chegada; o caso exato de gatilho é `OPEN`.
- O impacto é **atraso ou desvantagem operacional limitada**, nunca bloqueio absoluto indefinido, teleporte, cancelamento retroativo ou captura automática.
- A defesa pode neutralizar o emissor, sair da área, interromper sua sustentação ou utilizar contramedida futura; os mecanismos exatos exigem especificação própria.
- Uma interdição não altera missões já encerradas. Ordens futuras precisam ser resolvidas pela mesma autoridade de `UniverseOrder` e revalidadas no momento adequado.
- **Não aplicar automaticamente** a `MOVE`, `TRANSPORT`, `RETURN` ou `COLONIZE` de aliados/neutros; situações diplomáticas e momento da revalidação continuam `OPEN`.
- A tecnologia não é requisito para construir Stargrave; é ferramenta de contrajogo antes do Tier V.

**Risco prioritário:** `UniverseOrder.due_at` coordena a reconciliação offline. Interdição não pode gerar ciclos sem término, eventos infinitos ou reprocessamento duplicado. Congelar o alvo por tempo indefinido é proibido pelo design.

## 6. `containment_warfare` — ataques de contenção (Militar IV)

**Capacidade principal `APPROVED`:** atingir subsistemas críticos de contenção estelar sem exigir tecnologia de construção da Stargrave.  
**Contrato `PROPOSED`:** uma **opção de tiro dirigido** a subsistema **identificado e vulnerável**, sob condições de batalha e oportunidade. Não é um multiplicador global de dano.

### 6.1. Pré-condições

1. O império atacante concluiu `containment_warfare` (requisitos de pesquisa já aprovados na R3.0-D01).
2. O alvo é uma Stargrave real, presente e combatível; nenhuma nave convencional muda de classe para simular Stargrave.
3. O subsistema escolhido é conhecido por observação autorizada **ou** foi exposto durante confronto autoritativo; não usar estado privado do inimigo para mostrar vulnerabilidade inexistente na inteligência do atacante.
4. Ataques especiais respeitam barreiras/escudos que ainda protegem aquele subsistema. Não há bypass de contenção apenas por possuir a pesquisa.
5. O atacante compromete potência de tiro real do disparo dirigido; **não** cria um segundo ataque ou dano gratuito.

### 6.2. Modelo mínimo de subsistemas (conceitual)

| Subsistema Stargrave | Consequência de degradação `PROPOSED` | Não significa |
|---|---|---|
| **Containment** (núcleo estelar) | Reduz estabilidade/capacidade de confinamento e pode forçar limitações operacionais | Explosão imediata do sistema, morte automática de planeta ou estrela duplicada |
| **Propulsion** | Restringe deslocamento e manobras | Remover a unidade instantaneamente do mapa |
| **Weapons** | Impede ou atrasa preparação e disparo estelar | Desligar toda defesa convencional ou autodestruir arma por padrão |
| **Shielding** | Reduz proteção disponível para os próximos ataques | Criar HP negativo ou atravessar blindagem arbitrariamente |
| **Control** | Limita operações coordenadas quando comprometido | Transferir propriedade ao atacante |

Esses nomes **não são IDs executáveis**, tabelas nem número de slots aprovado. A integridade estrutural da Stargrave e a situação da estrela cativa precisam de contrato de persistência próprio.

### 6.3. Ataque convencional continua válido

Uma frota com naves convencionais e sem `containment_warfare` deve ser capaz de destruir uma Stargrave por combate de atrito, desde que esteja preparada e seja suficientemente poderosa. A descoberta especializada fornece acesso à *seleção de fragilidade*, não exclusividade de dano.

**`OPEN`:** escolha manual de subsistema antes do despacho versus seleção contextual quando a vulnerabilidade se torna conhecida, custo de precisão, expiração da informação, ordem entre armadura externa e módulos e possibilidade de recuperação segura. Não atribuir janela, dano ou probabilidade ainda.

## 7. Matriz de contrajogo e interação com doutrinas

| Ação ofensiva | Resposta defensiva | Limite que impede dominância |
|---|---|---|
| Interceptação/Ruptura (C3.0-D02, ainda `PROPOSED`) | Escoltas e composição aprovadas pela C3.0-D01 | Doutrina orienta alvo, não gera dano extra |
| `electronic_warfare` | Sensores, computação e capacidade de aquisição | Não impede todo disparo nem substitui espionagem |
| `shield_disruption` | Reservas de escudo, armadura e composições sem escudo | Perfil tem custo de oportunidade contra casco |
| `spatial_interdiction` | Neutralizar emissor, contornar zona, manter operação | Nunca bloqueio permanente ou universal |
| `containment_warfare` | Escudos, estabilidade, proteção de subsistemas, contrafogo | Sem acesso exclusivo a dano na Stargrave |
| Bombardeio Stargrave | Batalha orbital, ruptura, interdição e interrupção de preparo | Sem ataque planetocida instantâneo |

**Fronteira entre capacidades:**
- Doutrina **Ruptura** prioriza classes pesadas; **`shield_disruption`** especifica um perfil contra escudos; **`containment_warfare`** seleciona um subsistema estelar. São três decisões distintas, não três multiplicadores empilhados.
- `electronic_warfare` contesta prioridades e inteligência; não recalcula regras de proteção da escolta na mesma salva.
- `spatial_interdiction` afeta operações persistentes; não entra na rotina de dano de `plans` só por ser Militar IV.

## 8. Defesas planetárias e Stargrave

**`IMPLEMENTED`:** `point_defense`, `orbital_missile_battery`, `heavy_em_cannon`, `planetary_shield`, `orbital_platform` e `missile_interceptor` têm funções existentes. O último intercepta **mísseis estratégicos**, não ataques da Stargrave nem disparos navais arbitrários.

**`PROPOSED`:** no futuro podem existir uma matriz de interdição gravitacional e uma bateria de ruptura de contenção. São **conceitos**, sem IDs, recursos, limites, bônus, slots, custos ou construção aprovados. Não representar `missile_interceptor` como equivalente dessas estruturas. Qualquer integração com `planetary_shield` deve consumir carga existente, não criar proteção adicional.

A presença de estruturas não concede segurança absoluta ao planeta; combate orbital, janela detectável de bombardeio e resposta de jogadores offline permanecem parte da [especificação da Stargrave](stargrave.md).

## 9. Ordem de resolução candidata (`PROPOSED`)

1. Resolver condições de chegada, diplomacia, interdição e disponibilidade da operação **antes** de montar o combate, com estado e timestamp autoritativos.
2. Construir snapshots de ambos os lados: participantes, doutrinas, pesquisas, sensores, informação, escudos e recursos.
3. Resolver contestação de aquisição eletrônica **antes** da escolha de alvos da salva, sem alterar permanentemente políticas.
4. Aplicar seleção conforme C3.0-D02 (que continua `PROPOSED`), selecionar alvo pretendido, verificar cobertura/único redirecionamento por escolta da C3.0-D01.
5. Aplicar perfil antiescudo ou disparo dirigido **sobre o alvo efetivo** com um orçamento único de dano, respeitando absorção real; para Stargrave, considerar regras de módulos quando existirem.
6. Planejar **ambos os lados** da salva sem aplicar perdas antes de completar os dois planos.
7. Aplicar HP/escudos/módulos, consumir munição e registrar perdas, uma vez, preservando simultaneidade.
8. Recalcular estado de cobertura, interferência e capacidade de subsistemas apenas para a próxima salva.
9. Persistir conclusão, efeitos, relatórios e resultados exatamente uma vez.

Não alterar seis salvas, saque, defesa planetária ou condição de vitória por analogia. Não adicionar pseudoaleatoriedade ou discricionariedade do cliente.

## 10. Casos mínimos de QA e cenários de balanceamento futuros

1. `electronic_warfare` ausente: combate e reconhecimento conservam comportamento legado.
2. Com interferência contestada, doutrina pode degradar para Equilibrada mas nenhum alvo real torna-se intocável.
3. Ações de espionagem antigas permanecem históricas e expiram sem atualização clandestina.
4. Perfil antiescudo contra escudo ativo pode beneficiar; contra casco sem escudo deve exibir custo de oportunidade.
5. Escudo planetário consome carga **uma única vez** mesmo sob ruptura especializada.
6. Perfis especiais não causam tiros extras, munição fictícia ou dano de casco sem atravessar defesas reais.
7. Interdição afeta apenas operações hostis e elegíveis e não paralisa indefinidamente jogadores offline.
8. Ordem já resolvida permanece resolvida após mudança de interdição; eventos não são duplicados em `settle`.
9. `containment_warfare` acessível no Tier IV sem tecnologias estelares V.
10. Stargrave sem `hull` convencional não é tratada como `dominion_hull`; módulos possuem identidade e vínculo à estrela únicos.
11. Frotas convencionais sem pesquisa estelar podem vencer em cenários de custo e preparação apropriados.
12. Ataque dirigido sem vulnerabilidade conhecida segue política convencional ou é explicitamente indisponível, nunca lê informação oculta para a UI.
13. Dano à contenção não causa destruição planetária automática; recuperação e colapso seguro exigem regras próprias.
14. Proteções/ataques obedecem ao snapshot simultâneo e à guarnição cooperativa C3.0-D01.
15. Relatório apresenta causas observáveis por jogador sem compartilhar segredos do adversário.

**Comparações de equilíbrio necessárias:** frota mista contra navios de escudo alto/baixo; doutrina sob interferência; defesa com/sem carga planetária; Stargrave com escolta versus frota antissubsistema; resultado offline sob interdição. Comparar custo industrial, tempo de reposição, energia, tripulação e perdas, não apenas dano bruto.

## 11. Decisões para aprovação posterior

| ID | Deliberação `PROPOSED` |
|---|---|
| **C3-D03-A** | Guerra eletrônica degrada a prioridade de alvos especializada para Equilibrada, sem reduzir o número de tiros ou apagar alvos |
| **C3-D03-B** | Em reconhecimento, a tecnologia afeta somente observações **novas**, preservando 0–3, expiração e `counter_intelligence` |
| **C3-D03-C** | `shield_disruption` habilita perfil antiescudo opcional por frota, com custo real contra casco, independente da doutrina de alvo |
| **C3-D03-D** | `spatial_interdiction` é zona operacional limitada, sustentada, interrompível e sem bloqueio absoluto |
| **C3-D03-E** | `containment_warfare` autoriza tiro dirigido contra módulo estelar conhecido/exposto, sem dano duplicado ou destruição automática |
| **C3-D03-F** | Stargrave conserva vulnerabilidade convencional; dano degradável aos cinco subsistemas conceituais e interceptador de mísseis continua restrito |
| **C3-D03-G** | Manter simultaneidade, autoridade, sigilo, idempotência e relatórios como invariantes; nenhum valor numérico aprovado |

**`OPEN`**: emissor elegível de interferência; fórmula de contestação; perfil/penalidade antiescudo; raio e custos da interdição; momento exato de gatilho; modelo persistente de módulos; janelas de reação e bombardeio; custo de precisão; algoritmo C3.0-D02; interfaces. Todos requerem revisão separada antes de escrever código.

## 12. Referências

- [Índice de game design](README.md), [Combat 3.0 — visão](combat-doctrines.md), [C3.0-D01](combat-formations.md), [C3.0-D02](combat-targeting.md).
- [Research 3.0 — identidades](research-3.md), [contratos operacionais](research-operational.md).
- [Defesas](defenses.md), [Stargrave](stargrave.md), [Balanceamento](balance.md).
- [Motor de combate](../../starz/persistent/combat.py), [serviço persistente](../../starz/persistent/service.py), [inteligência](../../starz/persistent/intelligence.py), [catálogo de defesas](../../persistent_data/defenses/defenses.yaml).

**Não implementar gameplay, YAML, migrações ou simulações de balanceamento nesta etapa documental.**
