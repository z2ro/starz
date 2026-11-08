# STARZ — Combat 3.0: registro de aprovações

**Decisão do responsável:** «aprovo tudo» (08/11/2026), emitida após apresentação da [C3.0-D05](combat-integration.md), das C3.0-D02/D03 pendentes e do [plano C3.0-D04](combat-balance-plan.md).  
**Estado:** `APPROVED` **como design e planejamento**, incluindo C3.0-D06-A–H em 08/11/2026; `NOT IMPLEMENTED` para novas mecânicas. A [C3.0-D07](combat-technical-contracts.md) continua `PROPOSED`.  
**Branch:** `experiment/persistent-universe`.  
**Escopo:** registrar decisões concretas submetidas à aprovação. Não interpretar como licença para implementar gameplay, alterar YAML ou banco, iniciar testes de gameplay, criar PR ou realizar merge.

## 1. Especificações aprovadas

| Especificação | Estado | Escopo da aprovação |
|---|---|---|
| [C3.0-D01](combat-formations.md) | `APPROVED` anteriormente | Escolta automática, redirecionamento real, Vanguard/Sentinel/Aegis, limite inicial de um tiro por salva sujeito a balanceamento, três doutrinas, guarnição planetária e simultaneidade |
| [C3.0-D02](combat-targeting.md) | `APPROVED` agora | As decisões **C3-D02-A–G** de targeting, fallback, despacho, sigilo e invariantes |
| [C3.0-D03](combat-countermeasures.md) | `APPROVED` agora | As decisões **C3-D03-A–G** de interferência, ruptura de escudos, interdição, contenção e segurança |
| [C3.0-D04](combat-balance-plan.md) | `APPROVED` como **plano de validação** | Matriz B01–B18, métricas, gates, metodologia e comparações; **não** os resultados nem os números ainda inexistentes |
| [C3.0-D05](combat-integration.md) | `APPROVED` como **contrato de arquitetura e sequência proposta** | Integrações, separação de responsabilidades, compatibilidade, riscos, plano P0–P5 e recomendações explicitadas; não autoriza executar P0–P5 |

**Importante:** `APPROVED` não equivale a `IMPLEMENTED`. `PROPOSED` dentro dos documentos anteriores pode indicar variantes de parâmetros, entidades e mecanismos que não receberam uma escolha específica, enquanto as **decisões funcionais identificadas acima** estão aprovadas.

## 2. C3.0-D02 — decisões A–G aprovadas

- **A:** Interceptação prioriza unidades `light` quando elegíveis; sem elas, usa Equilibrada.
- **B:** Ruptura prioriza classes `capital > medium > light`, sem bônus de dano; estruturas pesadas classificadas como `capital` no modelo existente continuam elegíveis, com efeitos monitorados na validação.
- **C:** Dentro da classe priorizada, preservar ranking determinístico legado e comportamento exatamente convencional para Equilibrada.
- **D:** selecionar alvo pretendido → verificar escolta elegível e limite → determinar alvo efetivo → calcular modificador de classe e dano real; não permitir redirecionamento recursivo.
- **E:** capturar doutrina ofensiva na ordem `ATTACK`; usar Equilibrada para ordens/saves legados e guarnições mistas na primeira versão.
- **F:** diferenciar combatibilidade de unidade presente de inteligência prévia, sem divulgar dados privados.
- **G:** preservar seis salvas, simultaneidade, munição, telemetria, persistência e replay idempotente.

## 3. C3.0-D03 — decisões A–G aprovadas

- **A:** guerra eletrônica contesta a eficácia da prioridade especializada, podendo degradá-la temporariamente para Equilibrada, **sem impedir disparos**.
- **B:** só a qualidade de **novos** relatórios de reconhecimento pode ser degradada, mantendo escala 0–3, expiração e função de contrainteligência.
- **C:** `shield_disruption` habilita perfil antiescudo opcional por frota, independente da doutrina de alvo e com custo de oportunidade no ataque ao casco.
- **D:** `spatial_interdiction` opera por zona regional sustentada, contestável, interrompível e sem bloqueio absoluto.
- **E:** `containment_warfare` permite tiro dirigido a subsistemas estelares conhecidos/expostos; danos respeitam proteções reais e não geram ataques extras nem destruição automática.
- **F:** Stargrave permanece vulnerável a frotas convencionais preparadas; cinco subsistemas **conceituais** podem degradar capacidades; `missile_interceptor` não intercepta indiscriminadamente armas estelares.
- **G:** autoridade do servidor, simultaneidade, sigilo, idempotência e relatórios auditáveis são invariantes.

## 4. C3.0-D05 — pontos de integração

As **diretrizes arquiteturais INT-01–INT-08** ficam aprovadas como **princípios de design**, sem aprovar enum, coluna, algoritmo numérico ou execução.

| Pergunta de integração | Resultado |
|---|---|
| **INT-A — Ruptura e estruturas de classe `capital`** | `APPROVED`: não excluir estruturas pesadas já classificadas como `capital` da preferência de classe; medir risco de priorização excessiva |
| **INT-B — emissor de interferência** | `APPROVED` pela C3.0-D06-A: Odyssey real operacional; fórmula, alcance e seleção de emissor ainda `OPEN` |
| **INT-C — perfil antiescudo** | `APPROVED`: opção da frota capturada na ordem ofensiva no despacho; sem microgerenciamento por salva |
| **INT-D — gatilho e duração da interdição** | `APPROVED` pela C3.0-D06-C/D: plataforma orbital em modo interdição, gatilho na chegada de missão hostil, atraso uma vez por cadeia e ordem sucessora; teto numérico ainda `OPEN` |
| **INT-E — doutrina de guarnição** | `APPROVED`: Equilibrada na primeira versão para guarnições heterogêneas, sem remover a escolta cooperativa aprovada |

**Atualização posterior C3.0-D06 (08/11/2026):** INT-B e INT-D foram fechadas funcionalmente. A escolha de Odyssey e plataforma/chegada está em [C3.0-D06](combat-operational-closures.md). Permanecem `OPEN` fórmulas, números, escopo fino, schema e destino da estrela.

## 5. Aspectos não aprovados ou não resolvidos

1. **Parâmetros quantitativos:** coeficientes de guerra eletrônica, antiescudo, alcance/custo da interdição, dano de subsistemas, recursos, tempos, duração, janelas de reação, consumo e thresholds de balanceamento. O limite de uma interceptação por escolta/salva é **regra inicial aprovada**, ainda sujeita a simulação.
2. **Contratos técnicos exatos:** Odyssey e plataforma com gatilho na chegada já foram escolhidas na C3.0-D06. Persistem `OPEN` alcance, fórmula, nomes de campos/enums, schema, APIs, migrações, rollback, sigilo detalhado e integridade persistente da Stargrave; consultar [C3.0-D07](combat-technical-contracts.md) (`PROPOSED`).
3. **R3.0-D02:** os contratos operacionais das tecnologias não discutidos especificamente nas C3.0-D01–D05 **não são automaticamente reclassificados**. A aprovação de Combat 3.0 não substitui uma decisão explícita sobre todos os contratos de Pesquisa 3.0.
4. **Research Fundamental V:** substituição de `military_tier_4` por `science_infrastructure:2` está `APPROVED` pela C3.0-D06-H; continua **não implementada** no YAML executável.
5. **Desenvolvimento:** nenhuma implementação de gameplay, catálogo de pesquisa, testes de simulação, migrações, PR, merge ou deploy é autorizada por esta decisão.

## 6. Próximos gates

- **G0:** regras funcionais C3.0-D01–D03 aprovadas; plano C3.0-D04 e integração C3.0-D05 aprovados como documentação.
- **G1:** INT-B/D foram fechadas funcionalmente pela D06; fechar números, contrato de destino da estrela, schema, eventos e algoritmos operacionais ainda `OPEN`; revisar a [C3.0-D07](combat-technical-contracts.md) antes de qualquer execução.
- **G2:** somente com autorização separada de implementação/validação, executar baseline e cenários documentados.
- **G3:** medir custo-benefício das tecnologias e contramedidas e propor faixas de ajuste para aprovação específica.

Aprovação documental não inicia nenhuma dessas atividades executáveis.

## 7. Aprovação explícita C3.0-D06 (08/11/2026)

**`APPROVED` como design:** [C3.0-D06-A–H](combat-operational-closures.md): Odyssey emissora, EW determinística, plataforma orbital em modo interdição sem disparo, interdição única na chegada por ordem sucessora, perfil antiescudo por frota, cinco etapas de captura/construção Stargrave, cinco subsistemas com destroço e recuperação segura, e `science_infrastructure:2` como requisito substituto de Fundamental V. A D06 supersede os antigos estados `OPEN` de INT-B e INT-D apenas na escolha funcional.

**`PROPOSED`:** [C3.0-D07 — contratos técnicos](combat-technical-contracts.md) documenta possíveis campos/versionamento, vínculos exclusivos de estrela, transações e cenários T01–T16; seu desenho ainda não foi aprovado.

**`OPEN`:** 1,25×/0,80× antiescudo e atraso 25%/30 min são **hipóteses sujeitas a simulação**, não constantes aprovadas. Qualidade EW, demais coeficientes, custos, HP, slots e duração continuam indefinidos. Não houve edição executável, migração ou teste de gameplay.
