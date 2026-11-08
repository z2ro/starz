# STARZ — C3.0-D06: fechamento operacional aprovado

**Estado:** `APPROVED` **como design** em 08/11/2026, decisões **A–H** aprovadas explicitamente pelo responsável. **Não implementado.**  
**Fonte:** deliberação «STARZ — decisões C3.0-D06» (A–H: APROVADO; números sujeitos a simulação).  
**Escopo:** fechar emissores de guerra eletrônica, contestação, interdição, perfil antiescudo, captura/construção/derrota Stargrave e gate Fundamental V; **não** autoriza código, YAML, banco, testes de gameplay, PR ou merge.  
**Precedência:** [C3.0-D01–D05](combat-3-decisions.md), [Research 3.0](research-3.md), [Stargrave](stargrave.md). O desenho técnico D07-A–H foi aprovado expressamente em [C3.0-D07 — contratos técnicos](combat-technical-contracts.md) (`APPROVED` como design); nomes de schema, parâmetros e resultados de testes continuam `OPEN`/não executados.

## 1. Registro das oito decisões `APPROVED`

| ID | Decisão | Regra funcional aprovada | Parâmetros que exigem validação |
|---|---|---|---|
| **D06-A** | Odyssey como emissora de EW | Odyssey **real, presente e operacional**, com `electronic_warfare` pesquisada, permite interferência; automatizada, redundante e sem empilhamento infinito | Seleção do emissor se houver várias; força relativa; alcance de proteção planetária |
| **D06-B** | Contestação determinística | Pode degradar doutrina especializada a Equilibrada **na salva afetada**, sem negar disparos; novas observações sofrem possível degradação, sem mudar histórico | Fórmula e limiares; redução de até um nível de qualidade é **hipótese**, não número final |
| **D06-C** | Plataforma orbital em modo de interdição | `orbital_platform` existente alterna entre defesa convencional e interdição; em interdição **não dispara armas convencionais**, exige energia/tripulação/pesquisa | Custos e cobertura; regra de escolha entre múltiplas plataformas |
| **D06-D** | Interdição única na chegada | Só missões hostis elegíveis; atraso único e finito na **chegada**; ordem sucessora idempotente, sem combustível duplicado, sem impedir retorno | Candidato inicial: até **25% do ETA original, limitado a 30 min**; **não aprovado como coeficiente final** |
| **D06-E** | Perfil antiescudo com trade-off | Opcional por frota, independente da doutrina, fixado na ordem `ATTACK`; benefício contra absorção real de escudos implica desvantagem contra casco | Coeficientes de teste **1,25×** contra escudos e **0,80×** contra casco; **não definitivos** |
| **D06-F** | Captura e construção persistente da Stargrave | Sistema descoberto, desabitado, não natal; exclusividade por estrela; cinco fases; estrela e Stargrave em estado próprio; módulos transportados fisicamente | Custo, duração, infraestrutura exata; **uma Stargrave operacional ou em obra por império** é *limite inicial sujeito a simulação* |
| **D06-G** | Subsistemas, derrota e recuperação | Contenção, propulsão, armamentos, escudos e controle degradáveis; derrota não apaga mundos; destroço e vínculo estelar permanecem controlados até disposição segura | HP de subsistemas, desabilitações, reparos, resgate, destino da estrela, efeitos planetários |
| **D06-H** | Gate Fundamental V | Remover `military_tier_4` de `fundamental_tier_5`; adicionar `science_infrastructure:2`; preservar `fundamental_tier_4`, `energy_engineering` e `energy_engineering:4` | Novos custos e duração **não** foram aprovados; preservar o custo/tempo atual até balanceamento futuro |

**Autoridade sobre números:** a declaração «números continuam sujeitos a simulação» aplica-se às percentagens, multiplicadores, limites operacionais numéricos ainda experimentais, HP, custos, tempo, capacidade, consumo, alcance e eficácia. Não converter valores de ensaio em constantes de produção apenas por estarem documentados.

## 2. D06-A/B: Odyssey + guerra eletrônica

- A tecnologia `electronic_warfare` habilita emissão, mas não cria emissor virtual. A Odyssey deve pertencer ao império, estar pronta, co-localizada na frota participante ou estacionada no **planeta** defensor e funcional.
- Na frota, atua sobre aquisição de alvos; em planeta, pode influenciar **novas** observações hostis daquele planeta. Não proteger automaticamente todo o sistema ou mundos vizinhos.
- Com múltiplas Odyssey, não somar jamming indefinidamente. Redundância significa troca de emissor elegível caso outro seja destruído; **não** sobreposição de bônus ilimitados.
- Interferência contestada por sensores/computação e por capacidade adversária elegível. Sem relógio aleatório e sem acesso a inteligência privada no frontend.
- A escolha de doutrina capturada no despacho não é apagada pela interferência; o comportamento efetivo de uma salva pode cair para Equilibrada. Dano e total de disparos não sofrem penalidade genérica.
- Novo reconhecimento pode ter qualidade reduzida dentro de 0–3; relatórios anteriores mantêm conteúdo e expiração originais, incluindo observações expiradas.
- `OPEN`: fórmula de comparação, seleção do emissor, efeito após destruição no snapshot da salva, extensão ao reconhecimento e dados visíveis ao adversário. A opção de **até um nível** de perda de qualidade é inicial para simulação.

## 3. D06-C/D: plataforma orbital e interdição única

- Ativação exige `spatial_interdiction`, uma `orbital_platform` real, presente, concluída, energizada e guarnecida.
- **Modo defesa:** comportamento ofensivo legado. **Modo interdição:** a mesma plataforma sustenta zona no sistema e **não** executa seus disparos convencionais; não cria uma segunda plataforma ou HP.
- Uma zona efetiva por império/sistema como regra de composição inicial; o número exato e a cobertura deverão ser simulados. Ausência de energia/tripulação desativa novos efeitos de interdição.
- A verificação ocorre em **chegada de missão `ATTACK` hostil** cuja validade diplomática, destino e localização foram revalidadas. Missões neutras/comerciais e `RETURN` não entram.
- Uma ordem sofre o efeito **uma única vez**. Registrar marca persistente na cadeia de missão; nenhuma interceptação em cascata na chegada sucessora.
- O serviço atual resolve `UniverseOrder` vencida e a marca `resolved=True`. Portanto, o futuro contrato deve **finalizar o evento de chegada anterior** e criar **uma ordem sucessora** com ETA alterado, preservando identidade, status transitório e reserva de combustível da frota.
- Se a plataforma for desativada depois da aplicação, o adiamento previamente comprometido permanece contabilizado: não reabrir ordens já resolvidas.
- A interdição não permite congelar jogadores indefinidamente, invadir direitos de neutros ou alterar retroativamente viagens já finalizadas.

**Hipótese numérica para B14:** `delay = min(ceil(0.25 * original_eta_seconds), 1800)`, ajustada por fronteiras de tempo, mínimo não negativo e testes. **Não aprovado como fórmula final.**

## 4. D06-E: antiescudo por missão

- A frota possui perfil **convencional** (padrão) ou **antiescudo** (com `shield_disruption`) no despacho ofensivo; **doutrina de alvo** é uma configuração separada.
- A unidade de dano não se duplica. Um único disparo atravessa o pool do `planetary_shield` (quando aplicável), escudo da unidade e casco mitigado por armadura. A conversão de eficiência no gasto de escudo e no dano contra casco deve ser contabilizada **uma única vez**.
- Antiescudo não ignora toda a proteção, não gera tiro extra e deve ter custo de oportunidade em alvos sem escudo.
- O atacante não modifica perfil durante viagem ou salvas da missão já despachada. Guarnições não passam a usar perfil especializado automaticamente.
- Os fatores de ensaio **1,25× e 0,80×** não constituem `effects` executáveis nem substituem os modificadores de classe do hull.

## 5. D06-F: projeto Stargrave em cinco fases

**`APPROVED` como direção de gameplay:** uma Stargrave móvel excepcional contém exatamente uma estrela capturada. Não é `dominion_hull`, não compartilha o inventário de hulls comuns nem existe como simples asset visual.

| Fase | Resultado persistente futuro |
|---|---|
| 1. Captura | Projeto e reserva exclusiva de estrela elegível, instalações físicas e início de operação |
| 2. Estabilização | Contenção energética controlada e verificação de estabilidade |
| 3. Montagem | Núcleo/estrutura física com módulos realmente fabricados |
| 4. Integração | Propulsão, controle, escudos e logística associados ao mesmo projeto |
| 5. Comissionamento | Armamento e unidade excepcional operacional após validação dos requisitos militares |

**Elegibilidade:** estrela de sistema descoberto, desabitado e não natal. Validar não só colônias, mas **projetos de colonização em trânsito/comprometidos** antes de aceitar reserva de captura. Após compromisso de captura, novas colonizações naquele sistema devem ser rejeitadas no servidor. Controlar concorrência de projetos de jogadores diferentes em transação.

**O universo mantém IDs e coordenadas dos sistemas e planetas.** Captura altera estado estelar persistente, não remove/renumera objetos procedurais. Uma estrela não pode estar vinculada simultaneamente a dois projetos/Stargraves.

**`OPEN`:** elegibilidade em sistemas com múltiplas estrelas, localização da montagem, custos, fase que de fato retira a estrela da fonte, relação de propriedade, destino de sistemas sem estrela e limitação inicial por império. O limite **uma Stargrave operacional ou em construção** é candidato a confirmar por simulação, não uma restrição implícita de banco aprovada como número definitivo.

## 6. D06-G: subsistemas, derrota e destino estelar

- Subsistemas conceituais: **containment**, **propulsion**, **weapons**, **shielding**, **control**. São chaves **propostas no design**, não nomes de colunas ou IDs executáveis aprovados.
- A unidade tem vida estrutural própria e integridade por subsistema; falha do armamento impede disparo estelar, falha de propulsão restringe viagem, falha de controle restringe operações. A contenção exige degradação segura; não explosion automática.
- Estados semânticos: `building`, `operational`, `damaged`, `incapacitated`, `wreck`, `decommissioned`; ainda não são enums implementados.
- Derrota encerra imediatamente capacidade de atacar, mover e obter vantagens militares conforme condição. O destroço conserva titularidade/posição/estrela e exige fluxo explícito de recuperação, desmontagem ou liberação segura.
- `containment_warfare` permite tiro dirigido em vulnerabilidade conhecida/exposta, mas frotas convencionais preparadas **continuam aptas a vencer**.
- Não apagar planeta/conta ou criar estrela nova por destruição. A resolução final do núcleo, contratos de reabilitação e consequências planetárias dependem de especificação própria.

## 7. D06-H: Fundamental V

**Gate científico novo, aprovado como design:**

```yaml
# ILUSTRATIVO, NÃO EDITAR O CATÁLOGO NESTA TAREFA
fundamental_tier_5:
  requires: [fundamental_tier_4, energy_engineering]
  level_requires:
    energy_engineering: 4
    science_infrastructure: 2
```

Esta representação **preserva** requisitos existentes não removidos e adiciona o requisito científico por nível. A implementação futura deve modificar o arquivo canônico com migração/validação explícitas, sem revogar progressão científica paga, níveis antigos ou acesso a hulls existentes. **`stellar_containment` ainda exige `carrier_operations` no catálogo executável atual:** sua desvinculação já foi aprovada em R3.0-D01, mas continua não implementada.

## 8. Limites de aprovação e próxima especificação

**`APPROVED`:** decisões funcionais D06-A–H descritas acima.  
**`APPROVED` como design técnico:** [C3.0-D07 — modelo de eventos, persistência e transições](combat-technical-contracts.md), decisões A–H e T01–T16; sem código nem testes executados.  
**`OPEN`:** fórmula EW, custo/alcance, coeficientes antiescudo, tempo de interdição, HP, orçamento estelar, estado de estrela em sistema múltiplo, concorrência/migrações e destino seguro da estrela.  
**`NOT IMPLEMENTED`:** todo o gameplay novo; nenhum teste, simulação ou nova migração foi realizado.

Fontes: [Registro Combat 3.0](combat-3-decisions.md), [C3.0-D03](combat-countermeasures.md), [C3.0-D05](combat-integration.md), [Research 3.0](research-3.md), [Stargrave](stargrave.md), [órgão de missões](../../starz/persistent/service.py), [ordens](../../starz/db/models.py).
