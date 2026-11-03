# Space Scene Lab 02 — Living Orbital World

Abra `http://localhost:8000/#/space-scene-lab` com o build servido, ou use a URL
do `npm run dev` com `#/space-scene-lab`. Preview frontend disponível na porta 8000
quando iniciado com `npm exec vite preview -- --port 8000`.
Rota lazy fora do AppShell, sem consultas à API. Lab 02 parte de main `066a4ac`,
merge da PR #6 (Space Scene Lab 01). Sem alterações nos geradores aprovados.

## Conteúdo incremental

- **Lua:** esfera 96×64 com 64 crateras determinísticas, depressão, borda elevada
  e variação mineral por vertex colors. Seed derivada de `seed:moon`. Raio inicial
  0,24 contra 1,28 do planeta; rotação 0,025 rad/s e órbita 0,035 rad/s independentes.
  Usa a mesma estrela, shadow map e depth buffer. Nenhuma imagem ou GLB externo.
- **Luzes noturnas:** simulação visual experimental, sem civilizações ou população
  de gameplay. Uma distribuição Fibonacci amostra o `samplePlanet` existente:
  terra sem gelo, altitude moderada, latitude, temperatura, umidade e preferência
  costeira. Concentrações regionais determinísticas evitam um tapete uniforme.
  Terran é o padrão; Oceanic prioriza as ilhas disponíveis, Desert tem densidade
  reduzida e Frozen não recebe assentamentos. Um único Points com shader próprio
  mascara emissão por `smoothstep(0.03, 0.25, -dot(normalMundial, direçãoSolar))`.
  A normal acompanha inclinação e rotação planetárias; o oceano não recebe cidades.
  Nuvens continuam separadas e passam sobre as luzes. Sem bloom ou PointLights.
- **Estação:** núcleo conectado, módulos de serviço, dois braços de atracação,
  painéis segmentados, suportes e navigation lights emissivas. GeometryBuilder
  existente consolida tudo em três meshes. Largura inicial aproximada 0,47,
  menor que o comprimento visual 1,0 da nave. Não é um estaleiro de gameplay.

Moon/Station Focus foram acrescentados para inspecionar esses objetos. Os quatro
presets anteriores permanecem. Cinematic mantém o enquadramento aprovado;
Orbit Overview inclui as órbitas externas. Fases iniciais 0,5 (lua) e 4,9 (estação)
preservam espaço para a nave e os títulos. Objetos secundários podem sair do
enquadramento Cinematic durante sua órbita: use Overview ou Focus para acompanhá-los.

O raio orbital da estação é `raioNave + esferaNave + esferaEstação + 0,14`.
A lua fica além de `raioEstação + esferaEstação + raioLua + 0,18`.
Essas faixas radiais garantem separação completa mesmo com inclinações diferentes
e ao alterar escala/raio. São escolhas de apresentação, não mecânica orbital.

Controles independentes de visibilidade, escala, velocidade e intensidade permitem
comparar conteúdo. **Compare Lab 01** desliga os três acréscimos e volta a Cinematic,
sem modificar seed, planeta, nave, iluminação ou render settings. Para Planet Only,
desligue também Ship visibility. Pause congela todas as órbitas, rotações e pulsos;
câmera e controles continuam utilizáveis. Nenhum objeto é reconstruído por frame.
Seed/família substituem e descartam lua/luzes junto ao planeta, mantendo a estação.

## Reutilização

- `planetlab/PlanetModel.ts` extrai a montagem do Planet Lab para `createLabPlanet`.
  O Planet Lab usa a mesma função. O gerador, texturas 512×256, relevo, materiais,
  atmosfera e nuvens permanecem iguais; `disposeLabObject` mantém o export anterior.
- `createPrototypeShip()` é usado diretamente, sem modificar vértices, blindagem,
  três motores ou materiais. A nave continua sendo Horizon Prototype experimental.
- Uma instância de `ShipPixelPipeline` processa toda a cena. Não há novo shader:
  target reduzido, DepthTexture, NearestFilter, OKLab, Bayer e outlines aprovados.
  RAW renderiza diretamente na resolução do viewport.

Uma cena 3D, um WebGLRenderer e um pós-pass fullscreen. Sem WebGPU, GLB ou novos assets.

## Apresentação e órbita

A nave é centrada por Object3D.position, escalada uniformemente por um grupo e
orientada por um pivot orbital. Escala inicial: comprimento aparente 1,0 contra
diâmetro planetário 2,56; são unidades experimentais, sem significado físico canônico.
O tamanho aparente pode ser ajustado entre 0,4 e 1,2, preservando as proporções.

A órbita circular tem raio inicial 2,05, inclinação 10° e velocidade 0,22 rad/s.
O raio efetivo é limitado a atmosfera + bounding sphere da nave + folga 0,12.
O painel informa o raio seguro efetivo quando o pedido precisa ser limitado.
A proa −Z segue a tangente; +Y acompanha a normal orbital, evitando inversões de roll.
A fase inicial 1,85 rad coloca a nave no lado iluminado. Uma linha discreta representa
a mesma trajetória. Depth testing faz a oclusão real; não há troca de layers ou sprites.

Pause congela tempo visual, rotação planetária, nuvens, pulso dos motores e fase orbital.
OrbitControls e controles de inspeção continuam disponíveis. Reduced motion inicia pausado.
Somente mudanças de família/seed/Regenerate substituem e descartam o planeta.
Alterações de luz, órbita, escala e render não geram geometrias/texturas novas.

## Câmera e iluminação

Cinematic usa uma vista elevada para mostrar o dorso da nave e manter o planeta
dominante. Planet Focus preserva direção e span 2,15 do Planet Lab. Orbit Overview
enquadra o envelope orbital. Ship Focus usa o bounding box original escalado e
acompanha posição/orientação sem introduzir uma segunda cena ou um segundo modelo.

Uma única DirectionalLight ilumina planeta e nave na direção estelar configurada.
Sombras PCFSoft 1024² permitem que o planeta sombreie a nave. As nuvens não projetam
sombras. Atmosfera recebe o mesmo vetor solar. As luzes de estúdio do Ship Lab não
são instanciadas; um fill hemisférico 0,14 preserva leitura mínima na sombra.
Por isso os metais assumem a cor e o contraste da estrela compartilhada.
O disco visual da estrela marca essa direção; fica oculto em Ship Focus para não
competir com a inspeção ampliada. É uma aproximação de apresentação, não uma estrela
em escala física. Os materiais e os labs isolados continuam preservados.

## Validação

Execute `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
Testes cobrem os geradores reais, preservação dos buffers da nave, presets/família/seed,
órbita periódica, tangente/normal, escala e folga, pausa, framing e descarte deduplicado.
Os testes React verificam controles, lifecycle e rota isolada sem GPU.

Browser QA: Chromium headless/SwiftShader em 1920×1080, 1440×900 e 1366×768.
Capturas incluem Cinematic PIXEL/RAW, quatro famílias, Planet Focus, Ship Focus,
Orbit Overview e nave à frente/atrás. Artefatos: `/tmp/starz-space-scene-lab01-qa/`.
A inspeção inicial levou ao ajuste da fase, câmera e escala iniciais, sem remodelar.
Também foram verificados pause/câmera, tracking durante uma órbita e os labs isolados.

Lab 02: capturas Cinematic PIXEL, RAW, Night Lights ON/OFF, Moon Focus, Station Focus,
Ship Focus, Overview, Planet Only e as quatro famílias ficam em
`/tmp/starz-space-scene-lab02-qa/`. Testes adicionais cobrem crateras/geometria finita,
elegibilidade e determinismo das cidades, máscara solar, estação batched, separação
orbital por bounding spheres, controles, pausa e descarte dos recursos substituídos.

Comparação na mesma execução do build, 1440×900, Cinematic PIXEL 3, seed aurelia-01,
tempo pausado, Chromium/ANGLE SwiftShader (três amostras após aquecimento):

| Conteúdo | Triângulos nos passes | Draw calls | FPS observado | Frame time |
| --- | ---: | ---: | ---: | ---: |
| Lab 01, acréscimos desligados | 69.630 | 23 | 31–32 | 31,4–32,3 ms |
| Lab 02 | 95.118 | 32 | 29–30 | 33,3–34,4 ms |

Não são benchmarks de hardware. Os três viewports passaram sem overflow e sem
erros JS/shader. O build na porta 8000 não fez chamadas à API; Planet Lab 02 e
Ship Geometry Lab 01 também foram abertos para conferir regressão visual.

## Limitações

Órbita e escala são visuais, sem física ou dados de gameplay. Na sombra ou atrás do
planeta a nave pode perder visibilidade, conforme luz e depth buffer. O pós-pass
é caro em SwiftShader; medições por software não são benchmark de GPU física.
Contadores incluem os passes de sombra e pós-processamento. A geração CPU ainda
pode causar uma pausa breve ao trocar planeta. O 404 de favicon.ico é preexistente.
Não há integração com Planet View ou Shipyard; aprovação artística final é humana.
Luzes urbanas não simulam estradas, história ou densidade populacional. Seu tamanho
tem um mínimo de um pixel para leitura no pós-processamento. A lua é uma aproximação
rochosa estilizada, sem geologia física; crateras menores se perdem no zoom Cinematic.
