# STARZ — C3.0-D08: destino estelar, custódia e matriz experimental

**Estado:** `APPROVED` como **design**, decisões **D08-A–H** aprovadas expressamente em 08/11/2026. **NOT IMPLEMENTED**.  
**Autoridade:** [C3.0-D01–D07](combat-3-decisions.md), especialmente [D06-F/G](combat-operational-closures.md) e [D07-E/F/H](combat-technical-contracts.md).  
**Limite da aprovação:** a **matriz numérica é aprovada como instrumento de simulação**, **não** como valores de produção, metas de vitória ou balanceamento verificado.  
**Desenvolvimento:** nenhum gameplay, YAML, SQL, migration, script de simulação, frontend, PR, merge ou deploy autorizado por este documento.  
**Próximo contrato aprovado:** [C3.0-D09 — custódia e liquidação estelar](combat-stellar-custody.md), `APPROVED` como design. **Contrato de adjudicação aprovado:** [C3.0-D10](combat-custody-adjudication.md), `APPROVED` como design. **Contrato seguinte:** [C3.0-D11](combat-custody-transfer.md), `PROPOSED`.

## 1. Decisões D08 aprovadas

| ID | Estado | Regra aprovada |
|---|---|---|
| **D08-A** | `APPROVED` | Após derrota, confinamento passivo seguro da estrela, sem destruição planetária automática, geração de energia militar ou retorno instantâneo. |
| **D08-B** | `APPROVED` | Custódia do destroço exige operação e controle militar válido, contestável; vitória não transfere propriedade de Stargrave funcional. |
| **D08-C** | `APPROVED` | Três destinos explícitos e exclusivos: **reconstrução**, **repatriação** ou **descomissionamento seguro**. |
| **D08-D** | `APPROVED` | Captura inicial restrita a sistemas **descobertos, desabitados, não natais, de estrela única**, sem colonização comprometida nem reserva conflitante. |
| **D08-E** | `APPROVED` | Ciclo de vida persistente, sem autodestruição temporizada ou penalização irreversível automática por inatividade. |
| **D08-F** | `APPROVED` **somente como metodologia** | Matriz conservador/intermediário/elevado para testar antiescudo, interdição, preparo de ataque, salvamento e estabilização; **coeficientes não aprovados**. |
| **D08-G** | `APPROVED` **como metodologia** | Baseline legado antes das capacidades, variação controlada e comparação econômica/estratégica; não existem resultados medidos. |
| **D08-H** | `APPROVED` | Unicidade estelar, resolução idempotente, ausência de duplicação/recompensa dupla, sigilo e preservação de saves como invariantes obrigatórias. |

**Precedência:** esta D08 refina as escolhas já aprovadas em D06 e D07; não retira a estrela automaticamente da Stargrave, não cria nova classe `hull` e não altera o contrato dos seis rounds de combate.

## 2. D08-A/E — derrota e confinamento passivo

Ao ser derrotada, a Stargrave perde mobilidade, armamentos, vantagens operacionais e produção energética militar; a estrela mantém identidade e vínculo exclusivo. O destroço e seu núcleo permanecem em local conhecido pelo servidor, com confinamento passivo estável e **sem relógio de autodestruição**. Jogadores offline não sofrem colapso por ausência de login.

Uma eventual desmontagem da estrutura externa converte o núcleo em objeto estelar **persistente e não militar**; isso não significa geração, teleporte, liberação ou duplicação de astro.

**Modelo semântico aprovado:** `building → operational ↔ damaged → incapacitated → sealed_wreck`, com três operações finais mutuamente exclusivas. Os nomes são de design, não enums executáveis aprovados. Reconstrução exige trabalho/material/tecnologia e nunca restaura imediatamente módulos ou HP. Destruição do núcleo e efeitos astrofísicos catastróficos **não** são uma consequência automática padrão.

## 3. D08-B — controle militar versus custódia

**Separam-se:** (i) império que construiu originalmente a Stargrave; (ii) ocupação/controle militar atual do local; (iii) custódia autorizada do núcleo; (iv) titularidade final de recursos/relíquia.

- Vencer a batalha **não** transfere instantaneamente Stargrave operacional, estrela ou todo o inventário de módulos.
- Operação de custódia deve exigir presença militar e condições elegíveis, após **janela de estabilização**; a duração numérica permanece sujeita a simulação.
- Rivais podem contestar a operação de salvamento militarmente; não há transferência por simples clique do frontend ou mudança visual no mapa.
- Somente uma operação exclusiva de custódia/disposição pode estar comprometida para o mesmo núcleo em determinado instante. Concorrência precisa ser controlada no servidor.
- O núcleo não dá bônus de energia, armas, mobilidade ou produção ao eventual custodiante. A posse de materiais recuperados exige liquidação material efetiva e única.

**OPEN:** direito de resgate pelo proprietário original, regras de contestação e expiração, requisitos de controle local para o objeto móvel, guarda em território neutro e adjudicação em caso de paz durante salvamento. A D09 propõe os contratos transacionais, não inventa regras jurídicas de soberania do universo.

## 4. D08-C — três destinos mutuamente exclusivos

### 4.1. Reconstrução

- Custodiante autorizado pode iniciar obra mediante pesquisa, infraestrutura industrial, módulos e logística apropriados.
- Reutiliza a **mesma identidade de estrela**, sem reemitir `stellar_source_id`.
- Restaura unidade por trabalho persistente e consumo de recursos, não por reparar tudo em um tick.
- Um vencedor sem requisitos científicos **não** pode ligar a Stargrave nem reaproveitar instantaneamente suas armas.
- Os materiais que tenham sido comprometidos em reconstrução não podem ser resgatados uma segunda vez ao cancelar obra.

### 4.2. Repatriação estelar

- Núcleo é transportado **fisicamente** e de forma auditável ao **sistema de origem**, com rota, unidade/infraestrutura habilitada, combustível e módulos reais; sem teleporte administrativo.
- O registro de origem de `StellarSource` não muda por transferência de custódia.
- Reinstalação só é confirmada após chegada e validação de integridade/identidade.
- A estrela volta a existir no renderizador **com a mesma identidade**; `StarSystem`, `Planet` e `planet_index` não são recriados nem renumerados.
- A condição astronômica restaurada **não recompõe automaticamente estoques, edifícios, clima, vida planetária ou recursos** e não torna colônias válidas sem uma regra explícita.

### 4.3. Descomissionamento seguro

- Núcleo vira uma **relíquia selada** durável, não militar, sem arma, viagens, produção energética nem extração automática.
- A custódia da relíquia e seu local são persistidos; a estrela **não** volta automaticamente ao sistema natal.
- Na primeira versão, relíquias descomissionadas não podem ser usadas como fonte de uma segunda captura, Stargrave, estrela de fundo ou recurso infinito.
- Eventual desbloqueio de reativação futura exige outro contrato, não fica implicitamente autorizado pela pesquisa `stellar_extraction`.

**Exclusividade:** uma decisão final concluída encerra as demais; concorrência de finalização deve ter **um** vencedor transacional. Estados finais não podem coexistir para a mesma estrela. Recuperação de falha não duplica recompensas.

## 5. D08-D — elegibilidade de estrela na primeira versão

Critérios conjuntos: o sistema é descoberto, possui **uma única estrela com identidade canônica**, não é natal, não contém colônia existente ou missão de colonização comprometida, e nenhuma estrela ou projeto de captura conflitante já está reservado. Reserva da captura e bloqueio de colonização devem ser transacionais.

**Sistemas binários/múltiplos ficam excluídos** inicialmente, mesmo que a D07 admita identidade estelar generalizável. Não remover ou renumerar coordenadas/IDs dos sistemas e planetas durante retirada/repatriação. Sistema privado de estrela pode continuar no mapa mas fica indisponível à colonização convencional enquanto não houver contrato explícito de habitabilidade; repatriação não cria colônia ou estoque por analogia.

**OPEN:** como classificar astros e contar estrelas no gerador procedural, antes de definir um ID executável e implementar elegibilidade.

## 6. D08-F — matriz numérica EXPERIMENTAL

**Os valores abaixo são somente candidatos para testes futuros. A aprovação da D08-F autoriza a *metodologia de comparar cenários*, não fixa nenhuma constante de produção.**

| Variável | Conservador | Intermediário | Elevado |
|---|---:|---:|---:|
| Efetividade contra escudos do perfil antiescudo | **1,10×** | **1,25×** | **1,40×** |
| Efetividade contra casco com perfil antiescudo | **0,90×** | **0,80×** | **0,70×** |
| Atraso único por interdição (% ETA original) | **10%** | **25%** | **40%** |
| Teto do atraso por interdição | **10 min** | **30 min** | **60 min** |
| Preparação detectável de ataque estelar | **24 h** | **18 h** | **12 h** |
| Recuperação de materiais de destroço | **10%** | **25%** | **40%** |
| Estabilização antes de salvamento disputável | **48 h** | **24 h** | **12 h** |

O cenário **intermediário é apenas baseline de ensaio**, não recomendação final. Para evitar favorecer a hipótese inicial, medir também os dois extremos, inclusive sob jogadores offline e composições de custo diferente.

**Guerra eletrônica:** comparar emissor Odyssey operacional e contestação contra `sensor_array`, `computing` e defesa eletrônica real; possíveis resultados `neutralized / contested / degraded`; sem efeito cumulativo infinito e sem alterar relatórios históricos. A queda de **até um nível** em nova observação 0–3 continua uma hipótese numérica, **não** coeficiente aprovado.

**Integridade Stargrave:** não estabelecer HP como múltiplo direto do custo da Dominion. Modelar custo industrial/logístico, escudo, casco, módulos e janela de resposta separadamente; comparar frotas convencionais preparadas contra contramedidas de Tier IV.

**Demais parâmetros OPEN:** custos de construção/transporte/repatriação, tempos de cada fase, velocidade/fuel, energia, HP, limites por império, percentuais econômicos, tempo de salvamento e limiar de derrota. Não adicionar valores a YAML ou serviço por este documento.

## 7. D08-G — método de validação

**Sequência aprovada como plano, sem execução:**

1. Preservar **baseline** e seis salvas do combate legado, nas mesmas condições de estado.
2. Comparar doutrinas e escoltas sob custo industrial equivalente, incluindo `screen spam`.
3. Variar EW/contra-sensores em reconhecimento novo e prioridade de tiro.
4. Testar perfil antiescudo com/sem escudos planetários, munição e trade-off real de casco.
5. Testar interdição uma vez na chegada, paz, emissor desligado, reconciliação offline e replay.
6. Testar Stargrave contra frota convencional preparada e opções de contenção, sem fictício `dominion_hull`.
7. Testar derrota, janela de estabilização, custódia, contestação, reconstrução, repatriação e relíquia selada.

Métricas: perdas por hull, materiais/tempo de reposição, tripulação, combustível, energia, sobrevivência de apoio, tempo de reação do defensor, quantidade de salvamentos, materiais recuperados, duplicações, integridade dos IDs e divergência sob replay. **Não definir win-rate objetivo antes de medir baselines.**

Referenciar a [C3.0-D04 — B01–B18](combat-balance-plan.md) e a [C3.0-D07 — T01–T16](combat-technical-contracts.md), estendendo os contratos de aceitação para fluxos pós-derrota.

## 8. D08-H — invariantes de segurança aprovadas

- Uma estrela = uma identidade persistente, no máximo um vínculo ativo e um estado final exclusivo.
- Nunca criar dois núcleos, duas Stargraves ou duas recompensas a partir do mesmo evento/estrela.
- Destroço/relíquia selados não atacam, movem nem geram recursos militares.
- Nenhuma transferência automática de Stargrave pronta ao vencedor.
- Nenhuma repatriação instantânea; viagem e reinstalação são operações persistentes reais.
- Nenhum colapso planetário ou apagamento de colônias/contas como consequência obrigatória de derrota.
- Não modificar IDs/posições procedurais nem dar progresso, recurso ou acesso retroativo a saves legados.
- Transições idempotentes com commit/rollback transacional; falha ou replay não concluem dois destinos.
- Segredos de pesquisa, inteligência e custódia não autorizados ficam fora de relatórios adversários.

**Tolerância a falhas de unicidade/duplicação: zero.** A aprovação não inclui esquema SQL, names de enum, coeficientes fixos ou execução de testes.

## 9. Continuidade D09

A [C3.0-D09](combat-stellar-custody.md) está `APPROVED` como design técnico: define custódia contestável, contratos de destino, compensações e liquidação material idempotente com cenários T17–T32. O refinamento [C3.0-D10](combat-custody-adjudication.md) está `APPROVED` como design para controle militar, claims concorrentes e invariantes de unicidade; a [C3.0-D11](combat-custody-transfer.md) permanece `PROPOSED` para transferência de custódia e espaço profundo, sem criar soberania fictícia. Os três destinos e a ausência de autodestruição são `APPROVED`; qualquer prazo, custo ou adjudicação ainda exige decisão.

**Não implementar gameplay.** A C3.0-D08 é uma aprovação de **design e metodologia**, não de números de produção.
