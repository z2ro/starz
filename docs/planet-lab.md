# Planet Lab 02 — Procedural Planet Diversity

Abra `http://localhost:8000/#/planet-lab` depois do build servido pelo FastAPI,
ou a URL exibida por `npm run dev` com `#/planet-lab`.
A rota é lazy-loaded e fica fora do AppShell. Nenhum estado de gameplay é consultado.

O laboratório usa Three.js WebGLRenderer 0.185, OrthographicCamera e OrbitControls.
O HTML local Bramley Oval forneceu a referência técnica para render target reduzido,
DepthTexture, outlines, Bayer 4×4 e nearest-neighbor. A cena e a interface são próprias.

## Geração

`planetGenerator.ts` amostra value noise 3D em posições normalizadas da esfera.
fBM e domain warping produzem continentes; altitude, latitude, temperatura e umidade
selecionam gelo, montanha, deserto e vegetação. Geologia regional diferencia minerais,
rochas e solos. Gelo marinho e continental têm cores diferentes e afloramentos
podem expor rocha. Costas e biomas permanecem discretizados pela textura 512×256.

Um gerador atende aos quatro presets em `planetLabTypes.ts`:

| Família | Morfologia / clima | Atmosfera |
| --- | --- | --- |
| Terran | Preserva escalas e parâmetros iniciais do Lab 01; oceanos, continentes e vegetação | Azulada |
| Oceanic | Nível de água alto, escala continental maior, ilhas e maior umidade | Azul-claro |
| Desert | Pouca água e umidade, relevo forte, planaltos e minerais | Quente e tênue |
| Frozen | Temperatura baixa, gelo continental/marinho e rochas expostas | Fria e discreta |

Selecionar família aplica parâmetros iniciais e mantém a seed. Sliders podem
sobrescrever água, temperatura, montanhas, nuvens, escala continental, warp e umidade.
A combinação família + seed + parâmetros reproduz geografia, biomas e nuvens iniciais.
Terran conserva a seed do Lab 01; outras famílias incluem seu identificador no hash
geográfico. Nuvens usam a seed e a cobertura, com rotação independente.
Não há aleatoriedade por frame nem quatro renderers separados.

`generatePlanetData` produz buffers CPU, usados pelas mesmas CanvasTextures do Lab 01.
As texturas e o relevo são recriados somente quando os parâmetros geográficos mudam.
Os buffers são enviados ao canvas em lote. Nuvens não projetam sombras; a atmosfera
continua usando Fresnel aproximado com direção estelar.

A nave é um protótipo composto de geometria Three.js, sem relação canônica com a
Horizon. Sua órbita inclinada usa depth testing real e uma orientação tangencial.

## Pipeline e controles

PIXEL renderiza a cena em WebGLRenderTarget reduzido conforme Pixel size (1–6),
com cor e profundidade. Um quad amplia a textura com NearestFilter e aplica
quantização OKLab numa paleta fixa de 48 cores. Dither e outlines são opcionais.
RAW 3D renderiza diretamente na resolução da viewport para comparação.
DPR fica em 1 para limitar o custo. O painel mostra FPS aproximado, tempo entre
frames, triângulos/draw calls e resolução interna; valores exigem browser real.

Arraste para orbitar a câmera, use scroll para zoom, escolha presets ou Reset.
Regenerate aplica a seed escrita. A galeria STARZ-001 a STARZ-005 tem seleção direta,
Previous/Next com retorno circular e mantém os parâmetros atuais. Não usa thumbnails
nem renderers simultâneos. Luz, inclinação, velocidades e modos continuam disponíveis.
Reduced motion inicia a animação pausada. Nave, câmera e pós-processamento preservados.

## Diagnósticos e 20 combinações

Water level é um limiar, não um percentual de água. O painel calcula cobertura
diretamente das amostras que geram a textura, ponderando cada faixa pela sua área
esférica. São medidas da grade finita, não integrais analíticas do planeta.
Água inclui bacias congeladas; água aberta exclui gelo. Gelo inclui terra e mar.
Coastal band mede a faixa com distância ao nível do mar <0,018; não conta continentes.
Diversidade conta biomas com >0,1% de área. Elevação e temperatura são relativas (0–1).
Generation time mede o raster CPU; exclui geometria, upload de textura e render GPU.

Medição CPU da grade runtime 512×256, cinco seeds por família:

| Família | Seed | Água % | Gelo % | Biomas | Costa % |
| --- | --- | ---: | ---: | ---: | ---: |
| Terran | STARZ-001 | 31,95 | 11,95 | 10 | 8,23 |
| Terran | STARZ-002 | 54,50 | 8,72 | 10 | 8,81 |
| Terran | STARZ-003 | 46,06 | 8,53 | 10 | 14,17 |
| Terran | STARZ-004 | 64,28 | 9,88 | 10 | 11,29 |
| Terran | STARZ-005 | 56,36 | 9,54 | 10 | 15,74 |
| Oceanic | STARZ-001 | 77,78 | 5,12 | 8 | 9,43 |
| Oceanic | STARZ-002 | 76,68 | 6,05 | 8 | 10,33 |
| Oceanic | STARZ-003 | 83,68 | 3,80 | 8 | 9,25 |
| Oceanic | STARZ-004 | 85,86 | 5,09 | 8 | 6,88 |
| Oceanic | STARZ-005 | 89,30 | 3,67 | 8 | 6,33 |
| Desert | STARZ-001 | 0,22 | 6,45 | 6 | 0,41 |
| Desert | STARZ-002 | 0,90 | 8,45 | 8 | 1,11 |
| Desert | STARZ-003 | 1,10 | 11,09 | 8 | 1,44 |
| Desert | STARZ-004 | 0,63 | 7,90 | 8 | 0,78 |
| Desert | STARZ-005 | 0,45 | 12,18 | 7 | 1,22 |
| Frozen | STARZ-001 | 59,72 | 76,45 | 6 | 9,74 |
| Frozen | STARZ-002 | 41,70 | 62,13 | 6 | 12,95 |
| Frozen | STARZ-003 | 57,35 | 61,19 | 6 | 9,41 |
| Frozen | STARZ-004 | 55,90 | 58,61 | 6 | 10,13 |
| Frozen | STARZ-005 | 65,80 | 65,69 | 6 | 14,36 |

Elevação observada: 0–1, exceto Oceanic/STARZ-004 (0–0,9644).
Faixa total de temperatura: Terran 0–0,740; Oceanic 0–0,781;
Desert 0–0,914; Frozen 0–0,275. A saturação do relevo em 1 limita o diagnóstico
de picos extremos; não representa altitude em unidades físicas.
Na execução Node local, o raster CPU levou 697–948 ms por planeta; no Chromium
as capturas indicaram aproximadamente 416–546 ms. São observações locais.

## Validação e limites

Execute `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
Testes verificam 20 combinações, dados finitos, frações consistentes, diversidade,
determinismo dos buffers, continuidade na longitude, presets, controles e lifecycle.
Não substituem avaliação visual. `npm test` inclui os testes Node existentes.

Browser QA executado em Chromium headless com SwiftShader (renderização por software):
1920×1080 e 1366×768, STARZ-001 e STARZ-002 nas quatro famílias; comparações RAW/PIXEL
para STARZ-001 e retomada da órbita. Sem overflow horizontal ou erro JavaScript/shader.
O console registrou um recurso 404 sem impacto na cena. A primeira sessão longa
encerrou antes de concluir; execuções separadas por viewport concluíram.
Capturas e relatórios locais: `/tmp/starz-planet-lab02-qa/` (fora do runtime/Git).

Observações de PIXEL: 44.934 triângulos, 12 draw calls; 17–23 FPS em 1920×1080 e
35–41 FPS em 1366×768. Esses FPS por software não são comparáveis aos 144 FPS
observados pelo usuário em outra execução. Não foi feito benchmark em GPU física.
RAW preserva leitura de costa e relevo, mas evidencia bordas discretas de biomas.
Não há scattering físico, erosão, sombras de nuvem ou dinâmica orbital real.
