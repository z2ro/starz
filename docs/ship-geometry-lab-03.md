# Ship Geometry Lab 03 — Complete Imperial Fleet

Continuação na branch `feat/ship-geometry-lab-02`, a partir de `d933a5b`.
Rota isolada: `/#/ship-geometry-lab`. Sem API, novos hulls ou integração ao gameplay.

## Grupo 1 — escoltas e cruzadores

Sentinel: proa robusta, ombros blindados, sensores protegidos e cintura defensiva.
Odyssey: observatório parabólico aberto com feed e tripé, laboratórios laterais
ligados por braços estruturais; sem baterias militares.
Aegis: bulwarks equilibrados, quilha profunda, terraços de bateria e comando dorsal.
Spearhead: revisão atual com proa em lança dominante, comando baixo, rails dianteiros,
aletas traseiras curtas e seis motores. Referências: fichas e PNGs individuais em
`docs/design/imperial-command-v2/frotas/`; não são modelos canônicos finais.

Reutilização: `GeometryBuilder`, `appendHull`, `ShipAssembly`, materiais, luz e
`ShipPixelPipeline`. `FleetPrimitives` contém somente composição de placas, ponte,
baterias, ventilação e motores realmente reutilizados nesta rodada.
Horizon/Wayfarer/Vanguard preservadas byte a byte nos buffers de posição/normal/cor/índice.

A galeria compara silhuetas normalizadas em grade, com nomes ancorados na projeção
real de cada objeto. Comparar escala usa transformações de apresentação separadas
da geometria, seguindo a progressão do Fleet Scale Guide. Os números de apresentação
são unidades ilustrativas, nunca metros/quilômetros ou atributos de gameplay.

QA do grupo 1 em Chromium/SwiftShader, 1920×1080: cinco ângulos, PIXEL, RAW,
silhueta, motores e comparação. A inspeção motivou refinamento da blindagem lateral
da Sentinel, comando da Aegis e aletas da Spearhead antes do próximo grupo.
Artefatos: `tmp/ship-geometry-lab-03/group1/`.

## Grupo 2 — capital ships

Leviathan: casco longitudinal profundo, cinturões em camadas, bateria central e
casamatas pesadas em sponsons escalonados, seis motores (quatro principais grandes
e dois auxiliares). Os sponsons quebram o contorno em degraus, distinguindo a silhueta
normalizada da Aegis sem depender apenas do aumento de escala.
Atlas: galerias de hangar com tetos, pisos, costelas, paredes internas, aberturas
laterais reais e áreas de manutenção; Interceptor/Fighter/Bomber são apenas
contexto documentado do complemento, nunca classes selecionáveis ou gameplay.
Dominion: fortaleza larga de comando, núcleo profundo, proa de corredores pareados,
terraços de armamento, cidadela octogonal/angulada e propulsão protegida.

QA do grupo 2 em 1920×1080 motivou reforço das baterias da Leviathan, blocos de
serviço entre as aberturas do Atlas e refinamento angular da cidadela/proa da
Dominion. Raycasting testa que os hangares do Atlas possuem profundidade aberta,
não portas pintadas. Transformações de escala não modificam buffers das receitas.
Artefatos: `tmp/ship-geometry-lab-03/group2/`.

## Grupo 3 — Stargrave-class

Categoria separada: megaconstrução aproximadamente omnidirecional, não uma nave
com proa/popa. Estrela procedural cativa, três planos de segmentos Dyson,
treliças conectadas, seis setores radiais de serviço/militares e docas reentrantes.
Não possui motores, bocais, feixe estelar ou habilidades de gameplay.
Os intervalos entre segmentos são geometria ausente real, não transparência:
raycasting verifica a estrela exposta e espaços negativos no anel de contenção.
A inspeção inicial motivou abertura dos segmentos, simplificação de subdivisões
e enquadramento por esfera calculada dos vértices reais, em vez dos cantos vazios
de uma AABB. Os presets são eixos/isometrias arbitrários.

`Comparar frota` apresenta os onze designs normalizados; `Comparar escala` contém
somente as dez naves convencionais. `Stargrave / Categoria` compara a megaconstrução
à Dominion em uma relação **ilustrativa**, explicitamente sem proporção física
canônica. A Stargrave não pertence à progressão linear das naves.

Todos os modelos são criados uma vez por renderer. Seleção, materiais, visibilidade
e escala reutilizam os buffers. Batches vazios não viram meshes; todos os materiais
alocados são descartados, inclusive os de propulsão não usados pela Stargrave.
Paleta, shaders, pós-processamento, geradores dos outros labs e gameplay intactos.

## Validação e revisão

Comandos: `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
Testes focados: determinismo das onze receitas, buffers finitos/indexados, normais,
simetria bilateral convencional, equilíbrio radial da Stargrave, hangares abertos,
enquadramento, separação projetada, escala, controles e disposal idempotente.
As três receitas anteriores possuem fingerprints de regressão dos buffers.

Browser QA: Chromium com SwiftShader em 1920×1080, 1440×900 e 1366×768.
Capturas por classe: cinco ângulos PIXEL, RAW, SILHOUETTE e close-up; também galeria,
escala convencional e categoria Stargrave. Artefatos locais finais:
`tmp/ship-geometry-lab-03/final/`, incluindo relatórios JSON com estatísticas reais.
São execuções de GPU de software, sem benchmark de hardware ou meta de FPS validada.
A aprovação artística final permanece com o responsável do STARZ.

Na revisão final em 1366×768, os rótulos das menores naves na comparação de escala
ficaram próximos demais; foram alternados em duas linhas, mantendo as âncoras X.
Resultado técnico: 196 testes Vitest e 11 testes Node passaram, além de typecheck,
build e diff check. São 47 testes focados na geometria/galeria desta etapa.
As 297 capturas finais verificaram canvas estável, ausência de overflow horizontal
da página e de erros JavaScript/shader registrados.

| Modelo | Triângulos da geometria | Meshes |
|---|---:|---:|
| Horizon | 2.494 | 8 |
| Wayfarer | 3.614 | 8 |
| Vanguard | 2.316 | 8 |
| Sentinel | 2.694 | 8 |
| Odyssey | 2.082 | 8 |
| Aegis | 3.388 | 8 |
| Spearhead | 3.016 | 8 |
| Leviathan | 5.276 | 8 |
| Atlas | 2.880 | 8 |
| Dominion | 2.622 | 8 |
| Stargrave | 5.408 | 6 |

Frota completa: 35.790 triângulos de geometria, 86 meshes; PIXEL registra mais
dois triângulos e uma draw call do pós-pass (87 calls no total).
Estatísticas/bounds completos: `tmp/ship-geometry-lab-03/final/geometry-stats.json`.

Limites: protótipos estilizados, não designs oficiais finais; dimensões em unidades
do laboratório; nenhum novo hull, atributo de combate, strike craft independente
ou integração de estado real. Não há PR nem merge automático.
