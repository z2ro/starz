# STARZ — Combat 3.0: doutrinas, formações e resolução de combate

**Estado:** C3.0-D01–D03 `APPROVED` como design, D04 como plano de validação e D05 como arquitetura em 08/11/2026. Ver [registro consolidado](combat-3-decisions.md). Parâmetros ainda `OPEN`; nada implementado.  
**Dependência:** [Research 3.0 — identidades aprovadas](research-3.md) e [contratos operacionais propostos](research-operational.md).

## 1. Objetivo

Tornar composição naval, reconhecimento, doutrina, escolta e contramedidas escolhas estratégicas significativas, sem transformar o combate em microgerenciamento por nave. Preservar naves reais, hulls, estados de dano, localizações e economias atuais.

## 2. Base `IMPLEMENTED`

- Frotas guardam `ship_ids` reais; propriedade e co-localização são verificadas no servidor.
- O combate persistente em `starz/persistent/combat.py` resolve até seis salvas; planos são calculados antes de aplicar as perdas da mesma salva. Dano de casco é persistente.
- Ataques usam modificadores por `combat_class`, dano por `weapons`, escudos e mitigação `armor`; armamento embarcado de Atlas usa capacidade abstrata.
- Missões e ordens persistentes são gerenciadas por `starz/persistent/service.py`; inteligência/contrainteligência por `starz/persistent/intelligence.py`.
- A Stargrave não é um hull convencional construível. **Não** implementar subsistemas estelares por simples modificação de `dominion_hull`.

## 3. Princípios de design `PROPOSED`

1. Uma **doutrina por frota**, com valor padrão neutro; sem comandos individuais por nave e sem necessidade de intervenção em cada salva.
2. Funções de classe são capacidades verificáveis, não nomes de `role` nem multiplicadores indefinidos.
3. Doutrinas redistribuem foco/cobertura, mas não criam HP ou dano gratuitamente.
4. Toda especialização tem custo de oportunidade, vulnerabilidade e telemetria no relatório.
5. Reconhecimento aumenta a qualidade da informação, mas não consulta estado privado do oponente sem autorização mecânica.
6. A decisão do combate é autoritativa, reproduzível e atomicamente persistida.
7. O modo padrão deve manter comportamento compatível com saves atuais e sem pesquisas novas.

## 4. Doutrinas de alvo — três opções `APPROVED`

| Doutrina | Identidade aprovada | Algoritmo de prioridade |
|---|---|---|
| Equilibrada | Padrão, sem pesquisa específica | Fallback legado, aprovado em [C3.0-D02](combat-targeting.md) como design |
| Interceptação | Ameaças leves | Prioriza `light`, fallback Equilibrada, `APPROVED` como design |
| Ruptura | Alvos pesados | `capital > medium > light`, `APPROVED` como design |

**Não existe doutrina Proteção** no conjunto aprovado: cobertura decorre automaticamente de `fleet_coordination` e composição de frota. `fire_control_doctrine` habilita as alternativas de foco, sujeitas ao contrato de seleção. IDs executáveis, custo de oportunidade quantitativo e formato persistido exato seguem `OPEN`; ranking funcional foi aprovado.

## 4.1. Aprovação C3.0-D01 e detalhamento C3.0-D02

- `APPROVED`: [C3.0-D01](combat-formations.md) registra proteção automática, redirecionamento real, papéis de Vanguard/Sentinel/Aegis, limite inicial de **um disparo por escolta/salva** sujeito a simulação, guarnição cooperativa e simultaneidade compatível com saves.
- `APPROVED` como design: [C3.0-D02 — doutrinas e seleção determinística](combat-targeting.md) especifica ordem de resolução, prioridade por classe, fallback, seleção, telemetria e sigilo. Campos executáveis e números ainda `OPEN`; não autoriza implementação.

## 5. Formação e escolta

**`APPROVED`:** a proteção é automática, depende de `fleet_coordination` e da composição real. Os papéis e cobertura por nave estão definidos na [C3.0-D01](combat-formations.md). Hulls e requisitos atuais de construção são preservados; ainda não existe gameplay executável dessas habilidades.

- Vanguard: escolta leve, protege funções vulneráveis contra ameaças leves.
- Sentinel: defesa e interceptação elegível, sujeita a munição/capacidade quando a regra específica existir.
- Aegis: proteção de linha; eventual coordenação de escudo exige contrato novo (não presumir compartilhamento hoje).
- Spearhead/Leviathan: pressão ofensiva e alvos capitais; sem imunidade a unidades leves.
- Horizon/Odyssey/Wayfarer: reconhecimento, ciência e logística, quando presentes; não criar capacidades fictícias em combate.
- Atlas: suporte de alas conforme modelo autoritativo; Dominion: coordenação quando esta mecânica vier a existir.

A proteção não cria naves abstratas. Perda de escoltas remove cobertura na próxima etapa de resolução aplicável. O resultado não deve violar a regra existente de planejamento simultâneo de salvas.

## 6. Pipeline de resolução proposto

```mermaid
flowchart TD
    A["Validar guerra, alvo, donos, presença e integridade"] --> B["Montar unidades reais e contexto tecnológico"]
    B --> C["Resolver sensores, informação e alvos elegíveis"]
    C --> D["Aplicar doutrina e proteção de formação"]
    D --> E["Planejar disparos simultâneos da salva"]
    E --> F["Aplicar escudos, mitigação e dano"]
    F --> G["Persistir danos, perdas e recursos consumidos"]
    G --> H{"Restam unidades e salvas?"}
    H -- "Sim" --> C
    H -- "Não" --> I["Liquidar resultado, relatório e eventos uma vez"]
```

**Atenção:** a engine atual planeja os dois lados antes de aplicar as perdas; o novo pipeline não autoriza mudar essa simultaneidade silenciosamente. Tampouco se deve introduzir aleatoriedade não reproduzível.

## 6.1. Contrato C3.0-D03 em revisão

`APPROVED` como design: [C3.0-D03 — guerra eletrônica, ruptura e contramedidas estelares](combat-countermeasures.md) separa interferência de aquisição, perfil antiescudo e ataque dirigido a módulo. Não acrescenta um bônus universal de dano nem altera o papel aprovado de escoltas. `C3.0-D02` foi elevada a `APPROVED` por aprovação expressa de 08/11/2026; parâmetros, schema e implementação continuam pendentes.

## 7. Guerra eletrônica e inteligência

- `electronic_warfare` contesta aquisição de alvos e qualidade de relatórios.
- Oportunidade de reconhecimento pode permitir políticas mais precisas, sem revelar automaticamente informações privadas.
- `counter_intelligence` e `sensor_array` mantêm função efetiva; eventuais novos modificadores exigem contratos e comparação com o modelo de razão/qualidade existente.
- O alvo deve ser elegível pela informação válida no momento do confronto; não derivar HP invisível do frontend.

## 8. Escudos, ruptura e Stargrave

- `shield_disruption` define perfil contra escudos com custo de oportunidade, sem bypass absoluto.
- `containment_warfare` define a elegibilidade de atacar subsistemas estelares identificados, mantendo ataques convencionais possíveis.
- Stargrave tem núcleo, escudos, propulsão, controle e armamento como **subsistemas propostos**, com efeitos degradáveis. Dano não causa destruição automática do planeta ou explosão inevitável da estrela.
- Interdição regional tem contrato distinto de disparos e não deve paralisar a nave adversária indefinidamente.
- Equivalência de poder, janela de bombardeio, consumo de energia e perda de subsistemas continuam `OPEN`.

## 8.1. Validação futura e balanceamento

`APPROVED` como plano de validação: [C3.0-D04 — matriz de cenários](combat-balance-plan.md) estabelece comparações de custo industrial, escolta, guerra eletrônica, ruptura, interdição, Stargrave e reconciliação offline. Os baselines e métricas não representam funcionalidades executadas nem autorizam parâmetros de combate. Os detalhes funcionais A–G da C3.0-D02/D03 estão aprovados; efeitos quantitativos e condições operacionais ainda `OPEN`.

## 8.2. Integração técnica

`APPROVED` como arquitetura: a [C3.0-D05](combat-integration.md) especifica pontos de integração do resolvedor, ordens persistentes, alvos pretendidos/efetivos, escudos, sigilo e interdição. Mantém INT-B e INT-D como questões abertas; C3.0-D02/D03 e INT-A/C/E foram aprovadas como design, sem autorizar gameplay.

## 8.3. Fechamento operacional D06 e integração técnica D07

`APPROVED` como design: a [C3.0-D06](combat-operational-closures.md) definiu Odyssey emissora EW, `orbital_platform` em modo de interdição com gatilho de chegada, perfil antiescudo na ordem e Stargrave com vínculo estelar exclusivo e estados degradáveis. **Números continuam candidatos para simulação**. A [C3.0-D07](combat-technical-contracts.md) está `APPROVED` como contrato de design técnico de persistência/eventos, **sem autorizar código**.

## 9. Relatório e interface

Mostrar doutrina, composição antes/depois, quantidade de alvos protegidos, condições de aquisição, ataques absorvidos por cobertura, dano por tipo e efeitos de tecnologia **somente quando calculados pelo servidor**. Jogadores não recebem detalhes ocultos do inimigo que não obtiveram por inteligência legítima.

A seleção de doutrina deve ser compacta e fazer parte da gestão de frota existente, não de um painel de nave por nave.

## 10. Critérios de validação futura

- Salva simultânea permanece correta; mesmas condições produzem mesmo resultado.
- Doutrina neutra conserva comportamento compatível com o combate anterior.
- Escolta ausente, destruída ou fora do sistema não protege.
- Guerra eletrônica pode ser contestada e não apaga relatórios legados.
- Perfil antiescudo apresenta custo de oportunidade contra alvos sem escudo.
- Unidades convencionais preparadas podem danificar/derrotar Stargrave em cenários adequados.
- Nenhuma unidade, estoque, munição ou dano é contabilizado duas vezes em resolução offline.
- Não abrir combat round microgerenciamento nem exigir novas filas por nave.

## 11. Questões `OPEN`

- As três doutrinas e o desempate funcional estão aprovados; calibrar a eficácia e testar vieses de identificação ou overkill. Ver [C3.0-D02](combat-targeting.md).
- Como selecionar entre alvos sob informação incompleta e empates sem viés indesejado?
- A C3.0-D01 aprovou redirecionamento real, sem redução percentual adicional nem escudo compartilhado; validar limite inicial de uma interceptação por escolta/salva.
- Que função de combate mínima é necessária para cada uma das dez classes?
- Como medir custo de oportunidade da ruptura de escudos?
- Quando a janela de interdição afeta lançamento versus chegada e quais contramedidas a neutralizam?
- Qual interface/relatório oferece clareza sem revelar dados de outro jogador?

**Não executar código ou alterar catálogos com base neste documento.** A próxima etapa é aprovação dos princípios e escolha das regras mínimas, seguida de cenários de simulação em [balance.md](balance.md).
