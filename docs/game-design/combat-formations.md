# STARZ — C3.0-D01: escolta, formações e proteção

**Estado:** `PROPOSED` — regras funcionais aguardando aprovação.  
**Contexto aprovado:** [Research 3.0 R3.0-D01](research-3.md), especialmente `fleet_coordination` e `fire_control_doctrine`.  
**Documentos relacionados:** [Combat 3.0](combat-doctrines.md), [combate atual](combat.md), [naves](ships.md).  
**Escopo:** design documental; sem código, novos atributos, YAML, migração ou valores de balanceamento autorizados.

## 1. Objetivo

Criar decisões de composição reais sem microgerenciamento individual: doutrina controla **alvos inimigos prioritários**; formação determina **quem pode proteger quem**. As formações são relacionamentos lógicos entre naves fisicamente presentes no combate, **não** coordenadas espaciais, vagas ou entidades adicionais.

## 2. Auditoria do sistema existente (`IMPLEMENTED`)

- `resolve_battle` recebe naves atacantes reais de uma ordem `ATTACK` e defensores do planeta obtidos via `local_defenders`, além de estruturas defensivas.
- `fleet_units` obtém HP persistido, escudo de combate, blindagem, dano e modificadores de classe; `plans` seleciona alvos determinísticos usando classe, HP e ID; `apply_hits` aplica absorção e danos.
- O atacante e o defensor **planejam a mesma salva antes de sofrer perdas**. A batalha tem até **seis salvas**. Não usar remoção imediata de unidades do lado oposto antes de planejar a salva.
- `local_defenders` pode reunir naves de **mais de uma frota** e naves destacadas diretamente no planeta. A implementação não tem formação operacional nem proteção entre hulls.
- As frotas reais armazenam `ship_ids`. A operação de missão em `UniverseOrder` fornece `fleet_id`; partidas, retornos, combate e relatórios são persistidos.
- Não presumir posição 3D, raio de escolta, armas de interceptação naval ou compartilhamento de escudos a partir do nome/role de uma classe.

## 3. Decisões de interface propostas

- Uma **doutrina de alvo por frota em missão**, com padrão «Equilibrada». A seleção é feita antes do combate; não há comandos por salva.
- A cobertura de escolta é **automática** quando o império concluiu `fleet_coordination` e tem unidades habilitadas presentes. Nenhuma segunda escolha de formação obrigatória.
- Recomendar **três** doutrinas inicialmente: Equilibrada (padrão, compatível com hoje), Interceptação (ameaças leves) e Ruptura (alvos pesados). A quarta candidata «Proteção» fica **não recomendada**, porque duplicaria a responsabilidade da formação.
- `fire_control_doctrine` habilita doutrinas de foco; `fleet_coordination` habilita proteção funcional. Uma pesquisa não substitui a outra.
- Sem `fire_control_doctrine`, usar a política atual, sem efeitos colaterais. Sem `fleet_coordination`, nenhum tiro é redirecionado por escolta.

## 4. Alternativas de proteção analisadas

| Alternativa | Vantagem | Problema | Parecer |
|---|---|---|---|
| Multiplicador passivo de redução de dano | Simples | Vira bônus invisível, aproxima-se de `armor` e favorece agrupamentos excessivos | Não recomendar |
| Compartilhamento geral de escudos | Valor temático para Aegis | Nova reserva de recursos, recarga e ordem de absorção; alto custo de persistência | Adiar |
| **Redirecionamento limitado de disparos** | Efeito compreensível, usa HP/escudos reais e funciona com seleção existente | Exige regra de escolha e limite por escolta | **Recomendar para primeira versão** |

## 5. Mecânica mínima de escolta — proposta de implementação futura

### 5.1. Elegibilidade

1. O lado do conflito concluiu `fleet_coordination`.
2. Escolta e unidade protegida são do **mesmo império e do mesmo grupo tático** e estão presentes e operacionais no **início da salva**.
3. Na ofensiva, o grupo é a frota real da ordem `ATTACK`; na defesa planetária, todas as naves defensoras **efetivamente presentes naquele planeta** formam um único grupo de guarnição para cálculo de cobertura, mesmo se vierem de frotas distintas. Estruturas não participam do grupo naval.
4. Naves em trânsito, ainda em montagem, destruídas ou estacionadas em outro planeta não oferecem cobertura.
5. A escolta não protege a si própria e não intercepta disparos que já a têm como alvo.
6. Não existem coberturas automáticas entre impérios/aliados; ataques combinados não são uma funcionalidade atual.

### 5.2. Mapa de proteção por hull

| Escolta real | Protege preferencialmente | Condição especial | Limitação |
|---|---|---|---|
| `vanguard_hull` (Vanguard) | Horizon, Wayfarer, Odyssey | Contra disparos convencionais elegíveis | Não protege capitais nem a Stargrave |
| `sentinel_hull` (Sentinel) | Horizon, Wayfarer, Odyssey, Atlas | Somente contra disparos de **naves da classe atacante `light`** na primeira versão | Não interceta `strategic_missile` nem substitui `missile_interceptor` |
| `aegis_hull` (Aegis) | Atlas e Dominion | Contra disparos convencionais elegíveis | Usa **escudos e HP próprios**, sem transferir ou inventar escudos |
| Demais classes | Sem capacidade de escolta automática | Mantêm papéis ofensivos/científicos/logísticos | Não receber poderes não especificados |

**Justificativa:** Vanguard protege unidades de apoio de forma geral; Sentinel cobre ameaças leves com vocação antinaves leves já compatível com seu perfil; Aegis preserva capitais de suporte/comando. As três compartilham um único algoritmo de proteção, variando somente elegibilidade.

### 5.3. Limite e ordenação

**Hipótese de design (não coeficiente aprovado):** cada escolta pode redirecionar no máximo **um disparo por salva**, sem gastar outra munição nem criar HP. Precisa ter HP positivo e proteção disponível no *snapshot* do início da salva; não pode redirecionar para um casco cujo HP+escudo projetado já esteja esgotado.

Para um ataque a um alvo protegido, buscar escoltas elegíveis ainda disponíveis. Prioridade de desempate recomendada: especialidade (Sentinel contra classe leve; Vanguard para apoio; Aegis para capital), menor quantidade de redirecionamentos na salva e ID estável. A lista exata de prioridades requer comparação de simulação; não atribuir coeficientes artificiais.

Um disparo redirecionado passa a ter a **escolta como alvo efetivo**. Recalcular modificador de classe do atirador contra a escolta efetiva; aplicar escudo, armadura e dano segundo a rotina autoritativa, com as reservas planetárias existentes quando aplicáveis. Não se produz um disparo extra, não se divide dano entre dois cascos e não se cria um bônus de dano.

### 5.4. Simultaneidade

- Registrar no início de cada salva as naves presentes, HP/escudos, tecnologias e possíveis escoltas.
- Computar plano atacante e defensor a partir **dos snapshots pré-dano de ambos os lados**.
- Dentro de cada lado, registrar disparos planejados, alvo pretendido e alvo efetivo; não exceder limite de cada escolta naquele lado.
- Aplicar ambos os planos sem permitir que a morte ocorrida durante a aplicação do outro lado altere retroativamente a mesma salva.
- No início da próxima salva, recalcular cobertura dos sobreviventes. Uma escolta destruída na salva anterior não protege novamente.
- Atualizar danos, perdas e relatório no evento autoritativo persistente, exatamente uma vez.

**Exemplo não numérico:** um disparo originalmente destinado a uma Odyssey é redirecionado para uma Vanguard elegível. O dano passa a considerar a classe e as defesas da Vanguard. Outro ataque à Odyssey na mesma salva poderá alcançá-la se não existir outra escolta com capacidade disponível.

## 6. Doutrinas — integração posterior

| Doutrina de alvo | Quem tenta atacar | Trade-off/garantia |
|---|---|---|
| Equilibrada | Seleção convencional existente | Fallback obrigatório para saves/ordens sem doutrina |
| Interceptação | Ameaças leves elegíveis | Menor atenção a capitais se houver alvos leves |
| Ruptura | Capitais e unidades pesadas elegíveis | Pode ser fraca contra enxames e escoltas |
| Proteção | **Retirar da seleção inicial proposta** | Sua função fica na cobertura de formação automática |

A doutrina deve ser lida do **contexto de frota real/ordem**, e não apenas de nível científico. Novo campo e armazenamento dependem de uma especificação de persistência; não inventar nome executável agora. Para ataque, congelar seleção no despacho é **proposta**, pois disparos só serão calculados na chegada; para guarnições compostas por frotas diversas, usar Equilibrada na primeira versão evita regras de conflito não especificadas. Revisar essa assimetria antes da aprovação final de targeting.

## 7. Integrações que precisam de design adicional

- **Defesa planetária:** o pool de escudos das instalações é absorvido conforme o motor atual. Uma escolta **não** transfere a carga de um gerador; redirecionamento naval ocorre sem duplicar absorções.
- **Mísseis estratégicos:** `resolve_missiles` é independente. O interceptor naval da Sentinel e a cobertura de baterias são futuras especificações, não efeitos desta escolta.
- **Atlas:** `carrier_capacity` é dano abstrato, não cria dez caças que possam proteger/ser protegidos.
- **Stargrave:** não é `hull` convencional e não adquire proteção infinita só por estar perto de uma frota. Contrato separado para escoltas/contrajogo estelar.
- **Informação:** relatórios do dono podem mostrar «disparo redirecionado» e quantidade de interceptações; relatórios adversários obedecem à inteligência e ao sigilo válidos.
- **Composição:** a defesa pode reunir várias frotas; a ofensiva é uma única ordem de ataque. A simulação deve comparar essa diferença e evitar formar escoltas de outro planeta.

## 8. Cenários de validação futura

1. Mesmo combate sem `fleet_coordination`: resultado idêntico ao modelo legado.
2. Presença de Vanguard + Odyssey: ataque elegível pode atingir Vanguard em vez de Odyssey.
3. Ataque direto a Vanguard: nenhuma interceptação da própria nave.
4. Duas ameaças na mesma salva, só uma escolta: não mais de uma proteção por escolta.
5. Escolta com HP insuficiente/sem defesa projetada: não cria absorção infinita.
6. Sentinel versus atacante `light`: elegível; Sentinel versus `capital`: indisponível na primeira versão.
7. Aegis protege Atlas/Dominion e não transfere pontos de escudo.
8. Disparo redirecionado reavalia `weapon_modifiers` conforme a classe efetiva.
9. Escolta destruída na salva atual ainda segue o snapshot simultâneo; na seguinte não protege.
10. Com guarnição de várias frotas, apenas naves presentes no mesmo planeta contam.
11. Estruturas, naves em trânsito e alianças não concedem cobertura naval.
12. Sem munição de bateria, não se cria disparo; escolta não consome ou intercepta míssil estratégico.
13. Persistência e reprocessamento offline não duplicam dano, ganhos ou perdas.
14. Balanceamento compara eficiência industrial por composição e evita «screen spam».
15. Relatórios registram o suficiente para reproduzir seleção e redirecionamento sem revelar inteligência ilegítima.

## 9. Decisões que ainda exigem aprovação

- **C3-D01-A:** proteção automática por pesquisa+composição, sem configuração manual.
- **C3-D01-B:** redirecionamento limitado para HP/escudos reais, em vez de redução percentual ou escudo compartilhado.
- **C3-D01-C:** mapa de cobertura proposto para Vanguard/Sentinel/Aegis.
- **C3-D01-D:** hipótese de **um** disparo redirecionado por escolta/salva (sujeita ao simulador).
- **C3-D01-E:** três doutrinas ofensivas e retirada da opção Proteção.
- **C3-D01-F:** guarnição defensora conjunta por planeta e ataque agrupado por frota real.
- **C3-D01-G:** preservação explícita da simultaneidade e do comportamento legado como fallback.

Números, prioridades finais e contrato de armazenamento da doutrina continuam `OPEN`. **Nenhum item aqui é `APPROVED` por constar no documento.**

## 10. Fontes de implementação e QA (somente referência)

- [Combate](../../starz/persistent/combat.py): `fleet_units`, `plans`, `apply_hits`, `resolve_battle`, `resolve_missiles`.
- [Missões e guarnições](../../starz/persistent/service.py): `dispatch` e `resolve`.
- [Catálogo de hulls](../../persistent_data/ships/functions.yaml).
- [Política de testes local](../development/local-qa.md).

**Não implementar, não registrar novos efeitos no catálogo e não executar suítes completas por causa desta documentação.**
