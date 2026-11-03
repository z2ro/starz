# Planet Lab 01

Abra `http://localhost:8000/#/planet-lab` depois do build servido pelo FastAPI,
ou a URL exibida por `npm run dev` com `#/planet-lab`.
A rota é lazy-loaded e fica fora do AppShell. Nenhum estado de gameplay é consultado.

O laboratório usa Three.js WebGLRenderer 0.185, OrthographicCamera e OrbitControls.
O HTML local Bramley Oval forneceu a referência técnica para render target reduzido,
DepthTexture, outlines, Bayer 4×4 e nearest-neighbor. A cena e a interface são próprias.

## Geração

`planetGenerator.ts` amostra value noise 3D em posições normalizadas da esfera.
fBM e domain warping produzem continentes; altitude, latitude, temperatura e umidade
selecionam gelo, montanha, deserto e vegetação. A seed textual é determinística.
As texturas e o relevo são recriados somente ao mudar parâmetros de geração.
O controle de água ajusta o nível do mar; seu valor não é uma medição exata da fração
de superfície coberta. Nuvens têm textura e rotação separadas; não projetam sombras.
A atmosfera usa Fresnel aproximado com direção estelar.

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
Regenerate aplica a seed escrita. Luz, inclinação, cobertura, velocidades e modos
de renderização alteram a cena. Reduced motion inicia a animação pausada.

## Validação e limites

Execute `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
Testes verificam determinismo, continuidade na longitude, parâmetros, controles,
rota e descarte de recursos compartilhados. Não substituem avaliação visual.

Sem browser instalado no ambiente desta implementação: screenshots, legibilidade
nos quatro viewports e meta de 60 FPS permanecem sem validação. O veredito visual
é PARTIAL até revisão em navegador. Texturas CPU 512×256 podem causar uma pausa
curta ao regenerar. Não há scattering físico, sombras de nuvem ou dinâmica orbital.
