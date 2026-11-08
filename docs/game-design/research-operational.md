# STARZ — R3.0-D02: contrato operacional das descobertas

**Estado:** `PROPOSED` — detalhamento funcional não aprovado.  
**Autoridade:** [R3.0-D01](research-3.md) (`APPROVED` para nomes, IDs, domínio, tier, dependências e capacidade principal).  
**Escopo:** especificação futura, sem código, migrações ou números de balanceamento.

## 1. Regras comuns

- Conclusão de pesquisa autoriza conhecimento, nunca executa automaticamente ação, disparo, viagem, captura ou construção.
- Toda operação deve validar pesquisa, dono, localização, infraestrutura, combustível/energia e recursos no servidor.
- Persistir ações que sobrevivam ao encerramento da sessão; resolver idempotentemente, inclusive offline, sem cobranças/entregas duplicadas.
- Usar naves reais, estoque local, comandos e eventos autoritativos existentes; não criar segunda economia, segundo HP ou motor de combate.
- Preservar os dez hulls convencionais, unidades e pesquisas existentes; configurações novas ausentes devem usar comportamento convencional.
- Categorias abaixo são **conceituais**: `UNLOCK`, `POLICY`, `OPERATION`, `PROJECT`; não são novos `Technology.kind`.

## 2. Contratos civis propostos

| ID | Modelo | Ativação e comportamento | Limite e evidência exigida |
|---|---|---|---|
| `automated_logistics` | `POLICY` | Jogador define origem, destino, recursos e reservas mínimas; agenda transferências com naves e rotas disponíveis. | Não gerar recursos, combustível, carga nem viagens instantâneas; falta de condições suspende política sem duplicar envios. |
| `megastructure_engineering` | `UNLOCK` | Autoriza iniciar megaprojeto orbital identificado por proprietário, sistema, estado e etapas. | Não concede captura estelar; obra nunca se completa pela mera pesquisa. |
| `precision_manufacturing` | `UNLOCK` | Permite fabricar módulos extremos em instalação industrial elegível com insumos locais. | Módulo produzido/entregue é identificável e não pode atender a dois projetos. |
| `stellar_logistics` | `OPERATION` | Transporta módulos identificados de megaprojetos entre locais com ETA e capacidade real. | Sem inventário imperial teletransportado; interrupção não duplica módulos. |

As políticas devem ser simples e contextuais, não uma linguagem programável de tarefas.

## 3. Contratos militares propostos

**Autoridade posterior:** a função operacional de escolta/coordenação da pesquisa `fleet_coordination` foi refinada e **aprovada como design** em [C3.0-D01](combat-formations.md). Os algoritmos funcionais de seleção das três doutrinas foram **aprovados como design** em [C3.0-D02](combat-targeting.md), e as contramedidas militares de [C3.0-D03](combat-countermeasures.md) foram aprovadas como design; parâmetros/entidades executáveis continuam `OPEN`. O restante desta R3.0-D02 não ganha aprovação automática.


| ID | Modelo | Ativação e comportamento | Limite e evidência exigida |
|---|---|---|---|
| `fire_control_doctrine` | `POLICY` | Aplica à frota prioridade predefinida de classes de alvos; padrão equilibrado. | Não dá dano grátis, alvos invisíveis nem acesso a subsistemas não detectados. |
| `fleet_coordination` | `POLICY` | Escoltas presentes e operacionais protegem membros elegíveis da mesma frota durante seleção de alvos. | Perda da escolta remove proteção; não cria escoltas fictícias ou invulnerabilidade. |
| `electronic_warfare` | `POLICY` | Modifica aquisição de alvos e qualidade de inteligência por confronto com sensores/contramedidas. | Não apaga informações já persistidas nem produz cegueira absoluta. |
| `spatial_interdiction` | `OPERATION` | Unidade/estrutura elegível ativa zona de cobertura sobre operações hostis válidas. | Cobertura limitada, contestável e com sustentação; não bloqueio eterno. |
| `shield_disruption` | `POLICY` | Perfil ofensivo voltado à redução de escudos, com desvantagem compensatória. | Não atravessa totalmente proteção nem supera todo alvo por padrão. |
| `containment_warfare` | `OPERATION` | Com inteligência e oportunidade tática, permite atacar subsistemas de contenção estelar. | Stargrave continua vulnerável a dano convencional; sem explosão/aniquilação automática. |
| `stellar_armaments` | `UNLOCK` | Permite integrar armamento principal em Stargrave efetivamente comissionada. | Consumo de energia, preparação visível, interrupção e dano não planetocida automático. |

**Refinamento `APPROVED` como design:** [C3.0-D03](combat-countermeasures.md) diferencia aquisição de alvos, perfil de ruptura de escudos, interdição operacional e ataque de contenção. Os contratos funcionais A–G de C3.0-D02/D03 foram aprovados expressamente; a [C3.0-D06-A–H](combat-operational-closures.md) aprovou Odyssey emissora, plataforma de interdição na chegada, perfil antiescudo, construção/derrota Stargrave e gate científico `science_infrastructure:2`. Fórmulas, números, schema e o restante da R3.0-D02 seguem `OPEN`/`PROPOSED`. Os demais contratos científicos da R3.0-D02 permanecem em discussão.

### Separação de funções

- Controle de tiro escolhe prioridades, coordenação organiza proteção, guerra eletrônica contesta informação.
- Ruptura de escudos funciona contra alvos comuns; guerra de contenção é especializada.
- Interdição atua sobre uma região, não sobre a propriedade/identidade permanente de uma nave.
- `containment_warfare` está no Tier IV e não exige `stellar_extraction`, `mobile_stellar_confinement` ou `stellar_armaments`.

## 4. Contratos fundamentais propostos

| ID | Modelo | Ativação e comportamento | Limite e evidência exigida |
|---|---|---|---|
| `gravitational_physics` | `UNLOCK` | Base para gravitação, interdição e propulsão excepcional. | Não concede velocidade automática a hulls atuais. |
| `extreme_materials` | `UNLOCK` | Autoriza módulos explicitamente marcados como compatíveis com condições extremas. | Não altera resistência de todas as naves. |
| `stellar_extraction` | `PROJECT` | Inicia captura de estrela elegível com proprietário, vínculo e estado exclusivos. | Sem estrela duplicada; não mudar IDs/coordenadas procedurais; impactos planetários ainda `OPEN`. |
| `mobile_stellar_confinement` | `UNLOCK` | Autoriza núcleo móvel para exatamente uma estrela cativa, com integridade e estabilidade separadas. | Não transforma qualquer hull em Stargrave, nem gera desastre automático quando danificado. |
| `gravitational_propulsion` | `UNLOCK` | Autoriza propulsão de estruturas móveis excepcionais com rota/ETA autoritativos. | Não modifica automaticamente motores das dez classes convencionais. |

## 5. Proposta de estados operacionais

- Política: `inactive`, `active`, `suspended`; motivo explícito de indisponibilidade.
- Operação: `planned`, `committed`, `in_transit_or_active`, `resolved`, `cancelled_or_failed`; os nomes são semânticos e **não** enums executáveis aprovados.
- Megaprojeto: `planned`, `building`, `stabilizing`, `integrating`, `commissioned`, `disabled_or_lost`; transições, compensações e recursos `OPEN`.

A resolução de cada evento deve ser atômica e idempotente. A fonte de verdade científica continua `universe.levels` e seus registros de conclusão; operações e projetos podem demandar persistência nova no futuro.

## 6. Interface, validação e implementabilidade

Na tela Pesquisa, diferenciar **bônus repetível**, **descoberta única**, **ação habilitada** e **projeto persistente**; nunca rotular intenção documental como funcionalidade implementada.

Critérios futuros para revisão e testes direcionados:
- Bloquear operação sem conhecimento/requisitos, preservar pesquisas e saves legados.
- Não duplicar módulos, pagamentos, combustível e remessas ao reprocessar eventos offline.
- Escolta deixa de proteger quando destruída; guerra eletrônica é contestável.
- Interdição limitada pode ser neutralizada; perfil antiescudo apresenta custo de oportunidade.
- Stargrave recebe dano convencional e ataques especializados; nunca é imune a todos os hulls comuns.
- Uma estrela não possui dois vínculos de captura/confinamento concorrentes.

## 7. Lacunas `OPEN` e fronteira de implementação

`APPROVED` como design: três doutrinas e algoritmo funcional de alvo (C3.0-D02), escoltas (C3.0-D01), contratos funcionais EW/antiescudo/interdição/contra-Stargrave (C3.0-D03). `APPROVED` pela [D06](combat-operational-closures.md): Odyssey como emissora EW, `orbital_platform` como unidade de interdição, gatilho único na chegada, cinco etapas de Stargrave e `science_infrastructure:2` para Fundamental V. `OPEN`: fórmula EW; custo/alcance/duração de interdição; números e armazenamento; detalhes de vulnerabilidades e persistência; automação logística; transporte de módulos; elegibilidade em sistemas múltiplos e colonização concorrente; catástrofes/recuperação; duração, custos e fórmulas. [C3.0-D07](combat-technical-contracts.md) aprova como design obrigações técnicas de persistência/unicidade, sem definir o schema final ou aprovar os demais contratos R3.0-D02.

O catálogo atual aceita somente `repeatable` e `breakthrough`; as categorias conceituais acima não podem ser gravadas como `kind` sem alterar o schema. `effects` aceita apenas chaves suportadas por `starz/progression.py`. `unlocks` não implementa habilidades; requisitos conjuntos precisam ser verificáveis na lógica autoritativa. Nenhum YAML é alterado nesta etapa.

## 8. Próxima especificação

[Combat 3.0 — doutrinas e formações](combat-doctrines.md) detalha o próximo desenho, separando regras propostas de dados e combate atuais. A definição de fórmulas e migração permanece futura e requer aprovação.

Referências: [Research 3.0](research-3.md), [combate](combat.md), [naves](ships.md), [Stargrave](stargrave.md), [economia](economy.md), [balanceamento](balance.md).

## Registro de implementação STARZ 3.0 (08/11/2026)

A tarefa de implementação autorizou R3.0-D01 e os comportamentos fechados posteriormente por C3.0-D01–D11. O status `PROPOSED` histórico deste documento permanece válido para políticas não fechadas; não significa ausência das funções já implementadas abaixo. Ver [evidências](../development/starz-3-implementation.md) e [matriz técnica](../development/starz-3-acceptance.md).

| Descoberta | Função efetiva no servidor |
|---|---|
| `automated_logistics` | Identidade e progressão implementadas; políticas automáticas continuam propostas. É requisito real de `stellar_logistics`. |
| `megastructure_engineering` | Requisito da reserva/projeto estelar e primeira fase. |
| `precision_manufacturing` / `extreme_materials` | Fabricação de módulos com recursos locais e indústria reais. |
| `stellar_logistics` | Entrega de módulos/suprimentos e transporte físico do núcleo. |
| `fire_control_doctrine` | Doutrina congelada no despacho, sem bônus gratuito de dano. |
| `fleet_coordination` | Redirecionamento limitado para escoltas reais conforme D01. |
| `electronic_warfare` | Odyssey operacional e contestação por sensores/computação; observações novas, nunca histórico reescrito. |
| `spatial_interdiction` | Plataforma real em modo exclusivo; uma sucessora por chegada hostil `ATTACK` elegível. |
| `shield_disruption` | Perfil antiescudo independente, orçamento único e penalidade de casco. |
| `containment_warfare` | Mira em subsistema com inteligência e exposição elegíveis. Dano convencional continua possível. |
| `stellar_armaments` | Comissionamento, armas da unidade e bombardeio preparado/revalidado. |
| `gravitational_physics` | Conhecimento e dependências científicas reais; não concede bônus passivo ou manipulação espacial não especificada. |
| `stellar_extraction` | Reserva exclusiva de fonte única elegível e captura por fases. |
| `mobile_stellar_confinement` | Integração da contenção móvel e requisitos do transporte do núcleo. |
| `gravitational_propulsion` | Montagem de propulsão, deslocamento com energia finita e logística de recuperação. |

Nenhuma linha acima promove coeficientes experimentais a balanceamento definitivo ou autoriza funcionalidades adicionais propostas no restante do documento.
