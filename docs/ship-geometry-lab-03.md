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
