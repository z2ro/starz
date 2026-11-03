# Ship Geometry Lab 02 — Fleet Diversity

Abra `/#/ship-geometry-lab` (instância local de QA: `http://localhost:8010/#/ship-geometry-lab`).
A rota continua lazy, fora do AppShell e da sidebar. Não consulta API.
Base: main `53b0872`, após o merge da PR #10.

## Três receitas, uma linguagem

| Protótipo | Construção e leitura de silhueta |
|---|---|
| Horizon | Corvette leve, proa longa, sensores, três motores. Receita original preservada. |
| Wayfarer | Espinha longitudinal, comando frontal volumoso, oito módulos chanfrados de carga, travessas/gaiolas de sustentação e quatro bocais industriais circulares. |
| Vanguard | Casco fechado em cunha, quilha, placas seguindo as seções reais, comando dorsal, duas torres duplas, casamatas laterais e quatro bocais militares retangulares protegidos. |

As fichas e pranchas em `docs/design/imperial-command-v2/frotas/` orientam as
proporções e regiões funcionais. Os modelos são estudos experimentais, não substituem
os designs oficiais e não definem dimensões, armas ou atributos de gameplay.
Não há GLB, Blender, imagens geradas, modelos, texturas ou dependências externas.

`GeometryBuilder` e `appendHull` permanecem intactos. As receitas produzem geometria
indexada com vertex colors, por seções conectadas e volumes simétricos. A montagem
de materiais/camadas/disposal da Horizon foi movida, sem mudanças de comportamento,
para `ShipAssembly`; as três receitas usam o mesmo contrato. Teste SHA-256 compara
position, normal, color e índices da Horizon com a main anterior à extração.

`NavalDetails` contém apenas os detalhes reutilizados nesta rodada: placas espessas
e bocais abertos com núcleos recuados. Um teste de raycasting garante que tampas do
housing não escondem os núcleos. Hull Only mostra a estrutura portante; na Wayfarer,
a camada de plating também contém as carcaças dos módulos de carga.

## Galeria e renderização

O seletor mostra cada nave isoladamente; **Comparar frota** apresenta as três na
mesma cena e canvas. São alocadas uma vez e reutilizadas nas seleções. A disposição
considera as extensões projetadas na direção da câmera, evitando sobreposição nos
presets Side, Top e Rear. A comparação usa unidades comuns do laboratório, não
escala física canônica. Os nomes na legenda também abrem a inspeção individual.

Presets 3/4 Front, Side, Top, Rear e 3/4 Rear; drag, zoom e Reset. Modos PIXEL,
RAW 3D e SILHOUETTE, controles de camadas, materiais, iluminação, pausa e bounds.
Nenhuma geometria é criada por frame ou ao trocar câmera/material/seleção.
Emissão tem o mesmo pulso discreto da Horizon. Pause congela esse tempo.

Um WebGLRenderer, uma cena e o `ShipPixelPipeline` aprovado, sem alterações nos
shaders/paleta. Materiais, iluminação e câmera individual mantêm os defaults do Lab 01.
Unmount libera as três naves (inclusive materiais originais em SILHOUETTE), controles,
observer, helper, pipeline e renderer. A troca de seleção mantém o mesmo canvas.

| Geometria | Triângulos sem pós-pass | Meshes | Bounds X / Y / Z (lab) |
|---|---:|---:|---|
| Horizon | 2.494 | 8 | 3,78 / 1,89 / 11,18 |
| Wayfarer | 3.614 | 8 | 5,46 / 4,15 / 18,88 |
| Vanguard | 2.316 | 8 | 5,62 / 4,26 / 14,92 |

PIXEL: 9 draw calls por nave; 25 na comparação (24 meshes + pós-pass).
Em 1920×1080 no SwiftShader, as amostras iniciais PIXEL foram 20–24 FPS
(42–50ms), e a comparação RAW ficou em 54 FPS. São observações locais, não benchmark;
o custo principal continua sendo a quantização de paleta do pipeline aprovado.

## Validação

`npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
Testes novos cobrem determinismo, índices/normais/triângulos válidos, bounds,
simetria estrutural, materiais e descarte único, não sobreposição projetada,
enquadramento, navegação da galeria e regressão byte a byte da Horizon.
Os testes anteriores de planeta, adapter, cena integrada e gameplay são preservados.
Resultado final: 167 testes Vitest + 11 testes Node passaram; typecheck e build
passaram. Sem alteração de dependências ou configuração de testes.

Browser QA: Chromium/SwiftShader em 1920×1080, 1440×900 e 1366×768.
Por resolução: cinco ângulos PIXEL, RAW, SILHOUETTE e close-up dos motores de cada
nave; comparação frontal/lateral/superior/traseira, silhuetas e RAW (30 capturas).
Artefatos e relatórios locais: `tmp/ship-geometry-lab-02/` no repositório, sem versionar.
A inspeção inicial levou a uma rodada de refinamento: bocais da Vanguard abertos,
janelas/elementos de escala e projeção mais ampla da galeria. Aprovação artística final
pertence ao responsável pelo projeto.

Sem alterações em backend, gameplay, Shipyard, Planet View, registros canônicos
ou estado visual real. Nenhuma das novas naves aparece automaticamente no jogo.
Limitações: sem escala física, interiores, UVs ou detalhes canônicos finais; o pós-pass
de paleta é caro no SwiftShader. FPS de software não equivale a benchmark em GPU física.
