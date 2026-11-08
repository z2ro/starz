# STARZ 3.0 — P0: diagnóstico de prontidão para implementação

**Estado:** `BASELINE DOCUMENTAL PARCIAL`, obtido por leitura do código e dos testes na branch `experiment/persistent-universe`. **Não houve execução de testes ou inicialização de banco.**  
**Autoridade de design:** [Research 3.0 D01](../game-design/research-3.md) e [Combat 3.0 D01–D11](../game-design/combat-3-decisions.md), ambos aprovados como design. [Plano D12](../game-design/combat-implementation-plan.md) permanece `PROPOSED`; este inventário P0 não o aprova nem autoriza implementar gameplay.  
**Risco da atividade realizada:** **baixo**, leitura remota e documentação apenas.  
**Data da inspeção:** 08/11/2026.  
**Política expressa de desenvolvimento:** compatibilidade com **saves antigos descartáveis** dispensada; dados de outros usuários/ambientes compartilhados não podem ser resetados sem autorização específica. `AGENTS.md` e o [índice de design](../game-design/README.md) refletem essa política.

## 1. Constatações verificadas no repositório

| Área | Arquivo existente | Constatação do código |
|---|---|---|
| Ciência executável | `persistent_data/technologies/levels.yaml` | Catálogo com **44 IDs**; 16 novas descobertas R3.0-D01 ainda não foram adicionadas |
| Validação de conteúdo | `starz/data.py` | `Technology` reconhece `repeatable`/`breakthrough`, `requires`, `level_requires`, `advances_tier`; `Catalog` verifica referências/grafo e efeitos conhecidos |
| Progressão | `starz/progression.py` | Gates de tier, domínios e ciência materializados no motor; sem efeitos novos autorizados por mera documentação |
| Universo procedural | `starz/universe.py` | `generate_system` escolhe **uma** classe estelar e cria **um** objeto `star: Star` em `StarSystem`; o modelo atual **não apresenta múltiplos astros por sistema** |
| Sistema persistente | `starz/db/models.py` | `StarSystem.id` UUID, `universe_id`, `x,y`; `Planet.system_id` FK; não há entidade executável de fonte estelar cativa, projeto ou Stargrave |
| Missões | `starz/persistent/service.py` | `dispatch` autoriza `ATTACK` ao planeta com guerra ativa, `UniverseOrder` contém JSONB, `due_at`, `resolved`; `settle` processa `due_at,id` e finaliza a ordem |
| Combate | `starz/persistent/combat.py` | Seis salvas e resolução de danos; não inclui doutrinas novas, escoltas automáticas, EW estelar ou Stargrave persistente |
| Scripts/QA | `scripts/qa.cjs`, [política](local-qa.md) | `quick`, `affected`, `full`; `full` não é obrigatório apenas para documentação |

**Consequência técnica:** em **V1 de estrela única**, o UUID de `StarSystem` pode ser a **referência canônica para a origem** de uma estrela por sistema, desde que toda renderização/consulta respeite o novo estado persistente. **Ainda não decidir como forma final da chave de `stellar_source`** antes de auditar produção visual, API e migração; identidade do sistema ≠ identidade do invólucro físico/Stargrave.

**Alerta de divergência:** o GDD e documentos antigos ainda contêm afirmações históricas de “preservar saves”. A decisão de 08/11/2026 **dispensa retrocompatibilidade com saves antigos de desenvolvimento**, mas **não** elimina unicidade, transações ou a integridade de estados produzidos pela nova versão.

## 2. Inventário dos testes existentes (arquivos confirmados)

| Área | Testes/canais existentes | Reutilização recomendada |
|---|---|---|
| Ciência | `tests/test_research_domains.py`, `tests/research_domains.test.tsx`, `tests/research_connections.test.tsx`, `tests/research_command.test.tsx` | Tiers, três domínios, lista de 60 pesquisas, construção real e ausência de bônus fictício |
| Catálogo e hulls | `tests/test_fleet_integration.py`, `tests/test_capacity.py`, `scripts/validate_game_data.py` | Dez hulls e novos requisitos científicos, sem remover IDs existentes |
| Combate/defesa | `tests/test_planetary_defense.py`, `tests/test_fleet_intelligence.py`, `tests/warfare_ux.test.tsx` | Base para B01–B18, doutrinas, escudos, EW, interdição |
| Servidor persistente | `tests/test_persistent_universe.py`, `tests/test_postgres.py`, `tests/test_fleet_integration.py` | Transações, concorrência, guerra, retorno, reconciliação offline e unicidade estelar |
| Mundo/visual | `tests/galaxy_identity.test.tsx`, `tests/galaxy_spatial.test.tsx`, `tests/planet_procedural.test.tsx` | Estado de estrela capturada/ausente e identidade de `StarSystem`, além de âncoras de destroço |
| QA navegador | `scripts/research_qa.cjs`, `scripts/warfare_qa.cjs`, `scripts/visual-qa.cjs` | Fluxos reais em ambientes de teste/contas sintéticas quando autorizados |

**Compatibilidade com saves descartáveis:** `test_legacy_work_and_levels_migrate_without_reset`, testes de migração antiga de defesas/planetário e backfills podem continuar sendo úteis à engine existente, mas **não devem impor backfill para os novos recursos STARZ 3.0**. Não apagar testes existentes sem revisar sua função no contrato atual; adequar a política de QA apenas na implementação aprovada.

## 3. Pré-condições reais para executar a fase P1 — Research 3.0

**A. Conteúdo:** converter os 16 `id` de [R3.0-D01](../game-design/research-3.md) em entradas `breakthrough` de pesquisa única, com três domínios e tiers aprovados; manter os 44 IDs do catálogo. Terceirização de `future_unlocks` não faz gameplay acontecer.

**B. Dependências:** trocar `fundamental_tier_5` de `military_tier_4` para `science_infrastructure:2`, mantendo seus outros requisitos; separar `stellar_containment` de `carrier_operations` preservando o gate científico restante. Revisar nível/tier para inexistência de ciclos.

**C. Efeitos:** **não** introduzir chaves em `effects` não reconhecidas pelo `Catalog`, nem marcar `implemented` capacidades de escolta, operação logística, EW ou Stargrave sem alterar a engine real.

**D. Testes exigidos na implementação:** carregamento do overlay `game_data` + `persistent_data`; exatamente 60 IDs, únicos; avanços de tier corretos, sem `advances_tier` extra; grafo de dependências acíclico; todas as pesquisas alcançáveis; alterações de requisito Fundamental V; suporte de UI e API para lista; dez hulls existentes continuam definidos.

**E. Critérios de saída:** catálogo válido carregável, nenhum ID/hull removido, nenhuma pesquisa com capacidade falsa, testes relevantes passando, registro do que foi **IMPLEMENTED** versus apenas **UNLOCKED** no design.

## 4. Dependências e riscos dos próximos blocos

| Fase | Depende de | Principal bloqueio factual |
|---|---|---|
| P1 Pesquisa | Aprovação de implementação P1 e requisitos R3.0-D01 | Entradas YAML novas ainda não existem; efeitos operacionais R3.0-D02 não aprovados integralmente |
| P2 Combate | P1 para tecnologias habilitadoras | Modificar `plans/apply_hits` de modo consistente, recalcular alvo após escolta e garantir uma sucessora de interdição |
| P3 Captura | Schema e identidade `StarSystem` | Estado persistente de ausência de astro + bloqueio transacional de colonização |
| P4 Stargrave | Fonte/projeto persistente e adaptador de combate | Não existe alvo livre em `ATTACK` nem unidade excepcional executável |
| P5 Custódia | Destócio, localização/âncora, contratos D09–D11 | Modelo atual não representa controle militar geral de espaço profundo |
| P6 Balanceamento | Mecânicas implementadas e dados mensurados | Nenhum cenário B/T foi executado; números D08 são experimentais |

**Decisão arquitetural preservada:** o modelo atual de `StarSystem` possui um `star`; portanto, o rollout inicial de captura em estrela única é compatível com a estrutura procedural atual. Não declarar o sistema apto à captura sem verificar simultaneamente descoberta, origem, colônias, colonização comprometida e vínculo exclusivo.

## 5. Checklist P0 (situação atual)

- [x] Ler design canônico e decisões aprovadas D01–D11.
- [x] Conferir política de save descartável em `AGENTS.md` e índice de design.
- [x] Inspecionar `models.py`, `service.py`, `data.py`, `progression.py` e `universe.py`.
- [x] Identificar testes existentes e entradas QA para Pesquisa, Combate e Postgres.
- [x] Verificar no catálogo que Research 3.0 não foi aplicado.
- [ ] Validar ambiente e DB de QA **local e isolado**, sem tocar em bancos compartilhados.
- [ ] Executar baseline relevante de testes com logs, depois que houver ambiente e autorização de execução.
- [ ] Auditar renderização da estrela e API em todos os caminhos de leitura procedural; confirmar como sobrepor estado estelar capturado.
- [ ] Fechar os contratos operacionais civis R3.0-D02 ou delimitar explicitamente efeitos **não implementados** em P1.
- [ ] Obter decisão de início de implementação e granularidade P1; documentar seus commits e QA ao concluir.

## 6. Próximo movimento proposto

**Não abrir D13 só para expandir o design.** Primeiro concluir P0 em um clone/ambiente isolado, com baseline de Research/Combat/Postgres; então executar **P1**, prioritariamente o catálogo das 16 descobertas **com efeitos novos ainda não ativos**, sem fabricar implementação de logística/Stargrave. Após P1 validada, avançar a P2 em etapas (targeting/escorta → EW/antiescudo → interdição), mantendo diagnósticos e qualidade por fase.

**Nota:** aprovação de D11, dispensa de saves antigos e o comando “ok, vamos seguir” autorizam avançar neste **diagnóstico documental**. Eles não devem ser interpretados como autorização de reset, merge, deploy ou implantação automática de novo gameplay.

**Sem testes executados, alterações em Python/YAML, banco ou frontend nesta etapa.**

## 7. Execução P0 — autorização STARZ 3.0 (08/11/2026)

A instrução de implementação STARZ 3.0 substitui a restrição documental de início acima. Base executada: `651fd75`, branch `experiment/persistent-universe`; sem alterações rastreadas preexistentes. `docs/game-desing/` é arquivo local do responsável e permanece intocado.

| Verificação executada | Resultado | Evidência local |
|---|---|---|
| Catálogo base + campanha + persistente | PASS, três catálogos | `.qa/runs/starz3-p0/content.log` |
| Backend sem banco | PASS, 83 testes | `.qa/runs/starz3-p0/backend-unit.log` |
| PostgreSQL/migrations/multiplayer | PASS, 32 testes, zero skips | `.qa/runs/starz3-p0/backend-db.log` |

Execução pelos grupos exportados do runner local, sem ampliar para navegador/build durante o baseline de backend. Total 96,5 s; PostgreSQL 91,5 s. O helper existente criou um contêiner `starz-qa-*` identificado, imagem local `postgres:17-alpine`, porta efêmera somente loopback e dados tmpfs; removeu somente esse contêiner ao terminar. Não houve acesso a saves, URLs de banco herdadas ou projetos Compose existentes. Nenhuma falha preexistente apareceu nesse escopo; frontend e visual ainda não validados nesta P0.

Auditoria do gerador: `generate_system` cria exatamente um `Star` por sistema. A identidade estelar pode ser derivada do UUID persistente do sistema com namespace estável. Captura exige overlay persistente de ausência em todas as leituras autorizadas; o objeto procedural sozinho não determina disponibilidade. O alvo atual de `ATTACK` é planeta; presença naval no espaço profundo não existe e não será simulada como órbita arbitrária.

Diferenças para os contratos: 44→60 pesquisas; sem novas doutrinas/escoltas/EW/perfil/interdição; sem fonte/projeto/unidade estelar persistentes. Lacunas funcionais efetivas: localização de montagem e fase de retirada do astro (D06-F); proteção/conhecimento de módulos e regras detalhadas de bombardeio; presença/combate no espaço profundo; extinção de império e direitos de terceiros neutros. Coeficientes podem ser experimentais conforme a autorização atual, mas não resolvem essas decisões funcionais. Cada fatia independente deve avançar, com os limites registrados no relatório de implementação.
