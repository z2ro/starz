# Ship Geometry Lab 01

Abra `#/ship-geometry-lab` na aplicação, ou
`http://localhost:5173/static/#/ship-geometry-lab` com `npm run dev`.
Rota lazy fora do AppShell, sem acesso à API ou alteração de gameplay.

## Objetivo e referência

Uma Exploration Corvette experimental, **Horizon Prototype**, inteiramente em código.
O HTML local `tmp/Lighthouse Cup (Copy).html` orientou batching, índices, cores por
vértice e transform stack. `frotas/HORIZON.md` e a prancha oficial orientaram proa
alongada, casco chanfrado e três motores. O protótipo não substitui a Horizon canônica.
Nenhum GLB, Blender, modelo externo, imagem gerada ou textura externa é usado.

## Geometria

- `GeometryBuilder`: triangle, quad, box, tapered box, cylinder e beam; stack de
  transformações; cores lineares por vértice; BufferGeometry indexada; normais e bounds.
  Rejeita dimensões/transformações inválidas e faces degeneradas. Reflexões negativas
  são rejeitadas; a simetria é construída explicitamente nos pontos do modelo.
- `HullGenerator`: oito seções octogonais conectadas de proa a popa, com tampas.
  Cada seção define largura, altura, elevação e chanfro. O casco é fechado.
- `ShipGeometry`: comando integrado, blindagem com espessura, raízes laterais,
  aletas traseiras, sensores, ventilação, aberturas e luzes pequenas. Três motores
  têm housing, lip, parede interna, núcleo recuado e estrutura interna do bocal.
  Detalhes estáticos são consolidados por camada/material, sem centenas de meshes.

Convenção: +Y dorsal; proa −Z, popa +Z; simetria principal em X.
Bounds: aproximadamente **3,782 × 1,895 × 11,182 unidades de laboratório**;
não são dimensões físicas canônicas. Modelo completo: **2.494 triângulos, 8 meshes**.

## Materiais, câmera e controles

MeshStandardMaterial flat-shaded com vertex colors: aço azul/navy, grafite e
blindagem clara localizada. Emissivos somente nos núcleos e observação; nav lights
usam material básico. Star azimuth/elevation/intensity controlam a luz direcional;
hemisphere fill e rim discretos preservam leitura dos volumes.

OrthographicCamera com framing por projeção dos oito cantos do bounding box.
Presets: 3/4 Front, Side, Top, Rear, 3/4 Rear. Drag, zoom e Reset via OrbitControls.
O preset inicial ocupa cerca de 60–72% da largura útil, conforme a proporção da tela.

Hull Only, Armor, Engines, Details e Bounding Box controlam camadas reais.
Hull tone, armor contrast e engine emission atualizam materiais sem reconstruir
geometria. Silhouette troca todos os materiais por uma única cor sem iluminação.
O pulso dos motores é sutil (±3,5%); Pause congela o pulso. Reduced motion inicia pausado.

## Renderização e lifecycle

`ShipPixelPipeline` mantém uma cópia local da paleta de 48 cores e dos shaders
aprovados do Planet Lab: target reduzido com DepthTexture, NearestFilter, OKLab,
Bayer e outlines. Um teste verifica a igualdade da cópia. A consolidação é futura,
para preservar o Planet Lab integralmente neste slice. Nenhum arquivo desse lab mudou.

Pixel size 1–6, outlines e dither são ajustáveis. RAW 3D renderiza diretamente na
resolução do viewport; Silhouette ignora quantização para manter uma única cor.
PIXEL completo: **2.496 triângulos e 9 draw calls**, incluindo o pós-pass.
Sem texturas de superfície. Geometria e materiais são criados uma vez. Unmount cancela
RAF, desconecta ResizeObserver, descarta controles, geometrias/materiais únicos,
targets, renderer e canvas. Materiais originais também são liberados em Silhouette.

## Validação

`npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
Os testes cobrem buffers, índices, normais/winding, volume positivo, arestas fechadas,
conexão entre seções, simetria, enquadramento, visibilidade, materiais, disposal,
controles React e rota isolada. Não tentam provar qualidade artística.

Browser QA em Chromium/SwiftShader a 1920×1080, 1440×900 e 1366×768, com nove
capturas por viewport: os cinco presets, RAW, Silhouette, Hull Only e Bounding Box.
Artefatos locais em `/tmp/starz-ship-geometry-lab01-qa/`. A primeira inspeção gerou
uma rodada de refinamento dos painéis, janela, aletas e interiores dos bocais.
Sem overflow horizontal; favicon.ico retorna 404, sem impacto na cena.
PIXEL 3px observado no SwiftShader: 21–24 FPS a 1920×1080, 36–42 a 1440×900
e 47–50 a 1366×768. RAW em 1920×1080: 55 FPS. São amostras locais, não benchmark.

## Limitações e próximo passo

Modelo estilizado de baixa contagem, sem detalhes canônicos finais, UVs ou física.
O pós-pass de paleta é caro em SwiftShader; FPS de software não é benchmark de GPU.
A avaliação artística final pertence ao responsável do projeto. Próximo passo:
revisão das capturas, sem integração automática ao Planet Lab ou Shipyard.
