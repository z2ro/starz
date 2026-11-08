# STARZ — Game Design Document v1.0

Status: DRAFT
Branch: experiment/persistent-universe
Type: Game Design Specification

## Objetivo

Definir a arquitetura completa de gameplay do STARZ,
incluindo pesquisa, economia, naves, defesas, combate,
balanceamento e progressão até a Stargrave.

## Regras de desenvolvimento

- Este documento contém decisões e propostas de design.
- Não implementar funcionalidades sem aprovação.
- Preservar os identificadores e saves existentes.
- Documentar mudanças de balanceamento.
- Validar novas mecânicas antes da implementação.
- Separar regras aprovadas de hipóteses provisórias.

STARZ — Arquitetura de Game Design 1.0
Proposta de design • Universo multiplayer persistente • Stargrave como referência máxima de progressão

A Stargrave será uma meganave de guerra móvel, construída ao redor de uma única estrela cativa, capaz de enfrentar grandes frotas e executar bombardeios planetários devastadores. Terá poder excepcional, mas poderá ser derrotada por estratégias militares, tecnológicas e econômicas.

A consequência mais importante dessa decisão é que não devemos balancear o STARZ apenas como uma sequência de construções e pesquisas. Precisamos equilibrar impérios inteiros, desde a primeira mina até as guerras envolvendo megaconstruções estelares.
1. Princípios fundamentais
Proponho seis regras para orientar todos os sistemas futuros:
1. Nenhuma tecnologia deve ser inútil. Cada pesquisa precisa oferecer uma capacidade, um efeito relevante ou um caminho estratégico.
2. Nenhuma nave deve se tornar completamente obsoleta. Naves avançadas podem ser mais poderosas, mas unidades especializadas precisam continuar úteis.
3. Todo poder deve ter uma contramedida. Isso inclui a Stargrave.
4. Economia e logística devem influenciar as guerras. Produzir uma frota não é o mesmo que conseguir sustentá-la.
5. A progressão deve permitir especializações. Um império científico, industrial ou militar deve ter caminhos competitivos.
6. O universo persistente não deve ter uma vitória final obrigatória. Construir a Stargrave representa uma conquista extraordinária, não o encerramento da partida.
Esses princípios orientarão as fórmulas e os sistemas, em vez de tentarmos corrigir problemas de equilíbrio apenas alterando números.
2. O que vamos preservar do STARZ atual
A auditoria do repositório confirma que já temos uma base significativa:
Sistema	Implementado	Decisão
Pesquisa	32 linhas repetíveis, 12 projetos de avanço, 3 domínios e 5 tiers	Preservar estrutura
Economia	Recursos locais, produção industrial, energia e trabalhadores	Ampliar relações econômicas
Naves	10 classes convencionais	Preservar designs, refinar funções
Defesas	6 estruturas, munição, escudos e reparos	Adicionar especializações avançadas
Combate	Até 6 salvas simultâneas e danos persistentes	Evoluir para subsistemas e operações estratégicas
Logística	Transporte, combustível, carga e ETA reais	Tornar importante no endgame
Stargrave	Modelo visual e pesquisa preliminar	Criar mecânica própria

Duas inconsistências do catálogo atual precisam ser corrigidas no projeto de design:
- stellar_containment concede um bônus de energia e depende de carrier_operations. A contenção de uma estrela não deveria depender diretamente da operação de porta-aviões.
- Muitas naves possuem funções descritivas, mas ainda não têm capacidades exclusivas correspondentes na engine.
Ambos são problemas de arquitetura de gameplay, não de aparência. A revisão futura precisará preservar IDs, pesquisas concluídas e saves existentes.

Referências: Research 2.0 e Planetary Defense 1.0.

3. O ciclo completo do jogo
#chatgpt-mermaid-_r_p3_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_p3_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_p3_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_p3_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_p3_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_p3_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_p3_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_p3_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_p3_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_p3_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_p3_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_p3_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_p3_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_p3_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_p3_ p{margin:0;}#chatgpt-mermaid-_r_p3_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_p3_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_p3_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_p3_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_p3_ .label text,#chatgpt-mermaid-_r_p3_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_p3_ .node rect,#chatgpt-mermaid-_r_p3_ .node circle,#chatgpt-mermaid-_r_p3_ .node ellipse,#chatgpt-mermaid-_r_p3_ .node polygon,#chatgpt-mermaid-_r_p3_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_p3_ .rough-node .label text,#chatgpt-mermaid-_r_p3_ .node .label text,#chatgpt-mermaid-_r_p3_ .image-shape .label,#chatgpt-mermaid-_r_p3_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_p3_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_p3_ .rough-node .label,#chatgpt-mermaid-_r_p3_ .node .label,#chatgpt-mermaid-_r_p3_ .image-shape .label,#chatgpt-mermaid-_r_p3_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_p3_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_p3_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_p3_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_p3_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_p3_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_p3_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_p3_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_p3_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_p3_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_p3_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_p3_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_p3_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_p3_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_p3_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_p3_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_p3_ .icon-shape,#chatgpt-mermaid-_r_p3_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_p3_ .icon-shape p,#chatgpt-mermaid-_r_p3_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_p3_ .icon-shape .label rect,#chatgpt-mermaid-_r_p3_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_p3_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_p3_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_p3_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_p3_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_p3_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_p3_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_p3_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_p3_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_p3_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_p3_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_p3_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_p3_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_p3_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_p3_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_p3_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_p3_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_p3_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_p3_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_p3_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_p3_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_p3_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_p3_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_p3_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_p3_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-_r_p3_ .node rect,#chatgpt-mermaid-_r_p3_ .node circle,#chatgpt-mermaid-_r_p3_ .node ellipse,#chatgpt-mermaid-_r_p3_ .node polygon,#chatgpt-mermaid-_r_p3_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_p3_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_p3_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_p3_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_p3_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_p3_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}#chatgpt-mermaid-_r_p3_ .ultimate rect{fill:rgb(27, 57, 71)!important;stroke:rgb(215, 170, 83)!important;color:rgb(248, 223, 155)!important;}#chatgpt-mermaid-_r_p3_ .ultimate polygon{fill:rgb(27, 57, 71)!important;stroke:rgb(215, 170, 83)!important;color:rgb(248, 223, 155)!important;}#chatgpt-mermaid-_r_p3_ .ultimate ellipse{fill:rgb(27, 57, 71)!important;stroke:rgb(215, 170, 83)!important;color:rgb(248, 223, 155)!important;}#chatgpt-mermaid-_r_p3_ .ultimate circle{fill:rgb(27, 57, 71)!important;stroke:rgb(215, 170, 83)!important;color:rgb(248, 223, 155)!important;}#chatgpt-mermaid-_r_p3_ .ultimate path{fill:rgb(27, 57, 71)!important;stroke:rgb(215, 170, 83)!important;color:rgb(248, 223, 155)!important;}#chatgpt-mermaid-_r_p3_ .ultimate tspan{fill:rgb(248, 223, 155)!important;}Recursos e populaçãoIndústria e energiaPesquisa científicaFrotas e defesasExploração e expansãoNovos planetas e recursosTecnologias avançadasEngenharia estelarConstrução da StargraveProjeção de poderNovas disputas econtramedidas






O jogo teria cinco fases de desenvolvimento, sem obrigar todos os impérios a avançarem exatamente na mesma velocidade.
Fase	Experiência principal	Objetivo estratégico
Fundação	Organizar a economia inicial	Tornar o planeta sustentável
Industrialização	Especializar produção e construir frotas	Atingir capacidade orbital
Expansão	Explorar, colonizar, comercializar e guerrear	Controlar múltiplos sistemas
Supremacia	Construir infraestrutura e frotas de grande escala	Projetar poder interestelar
Engenharia Estelar	Capturar estrelas e desenvolver megaprojetos	Acessar capacidades excepcionais

A Stargrave seria uma das expressões máximas da quinta fase, mas não deveria ser a única opção relevante para um império avançado.

4. Arquitetura científica — Research 3.0
A pesquisa deve ser o principal sistema de desbloqueio do STARZ. Preservaremos os três domínios atuais, a capacidade científica imperial e os três programas de pesquisa simultâneos.

A mudança será organizar as tecnologias em especializações com efeitos verificáveis na engine.
Domínios e especializações
Civil — Economia e infraestrutura

Extração, automação, manufatura, logística, colonização, energia industrial e megaengenharia.

Endgame: capacidade de produzir, transportar e sustentar uma Stargrave.

Militar — Guerra e defesa

Armamentos, escudos, blindagem, doutrinas de frota, guerra eletrônica e armamentos estratégicos.

Endgame: armamentos da Stargrave e tecnologias para neutralizá-la.

Fundamental — Ciência e física

Propulsão, sensores, computação, materiais, gravitação, astrofísica e contenção estelar.

Endgame: capturar uma estrela e mantê-la estabilizada dentro de uma estrutura móvel.


Novas pesquisas de alto impacto
Esta é uma primeira seleção de tecnologias que complementaria as 32 existentes.
Tecnologia proposta	Domínio / Tier	Efeito de gameplay
Logística automatizada	Civil III	Maior eficiência operacional de comboios
Engenharia de megaestruturas	Civil IV	Construção de instalações orbitais gigantes
Indústria de precisão extrema	Civil V	Fabricação de componentes de contenção
Logística estelar	Civil V	Transporte de módulos de megaprojetos
Guerra eletrônica	Militar III	Redução da eficiência de sensores e aquisição de alvos
Interdição espacial	Militar IV	Dificulta deslocamentos estratégicos hostis
Armamentos de ruptura	Militar IV	Dano especializado em escudos e estruturas
Guerra de contenção	Militar V	Ataques especializados aos subsistemas da Stargrave
Armamentos estelares	Militar V	Habilita o armamento principal da Stargrave
Física gravitacional avançada	Fundamental IV	Base para manipulação gravitacional
Materiais extremos	Fundamental IV	Resistência a condições energéticas excepcionais
Extração estelar	Fundamental V	Habilita instalações de captura
Confinamento estelar móvel	Fundamental V	Habilita o núcleo energético da Stargrave
Propulsão gravitacional	Fundamental V	Habilita seu deslocamento interestelar

Os efeitos indicados são propostas, não funcionalidades já existentes.
Árvore específica da Stargrave
#chatgpt-mermaid-_r_qp_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_qp_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_qp_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_qp_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_qp_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_qp_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_qp_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_qp_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_qp_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_qp_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_qp_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_qp_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_qp_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_qp_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_qp_ p{margin:0;}#chatgpt-mermaid-_r_qp_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_qp_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_qp_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_qp_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_qp_ .label text,#chatgpt-mermaid-_r_qp_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_qp_ .node rect,#chatgpt-mermaid-_r_qp_ .node circle,#chatgpt-mermaid-_r_qp_ .node ellipse,#chatgpt-mermaid-_r_qp_ .node polygon,#chatgpt-mermaid-_r_qp_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_qp_ .rough-node .label text,#chatgpt-mermaid-_r_qp_ .node .label text,#chatgpt-mermaid-_r_qp_ .image-shape .label,#chatgpt-mermaid-_r_qp_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_qp_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_qp_ .rough-node .label,#chatgpt-mermaid-_r_qp_ .node .label,#chatgpt-mermaid-_r_qp_ .image-shape .label,#chatgpt-mermaid-_r_qp_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_qp_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_qp_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_qp_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_qp_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_qp_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_qp_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_qp_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_qp_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_qp_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_qp_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_qp_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_qp_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_qp_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_qp_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_qp_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_qp_ .icon-shape,#chatgpt-mermaid-_r_qp_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_qp_ .icon-shape p,#chatgpt-mermaid-_r_qp_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_qp_ .icon-shape .label rect,#chatgpt-mermaid-_r_qp_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_qp_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_qp_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_qp_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_qp_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_qp_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_qp_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_qp_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_qp_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_qp_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_qp_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_qp_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_qp_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_qp_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_qp_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_qp_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_qp_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_qp_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_qp_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_qp_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_qp_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_qp_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_qp_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_qp_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_qp_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-_r_qp_ .node rect,#chatgpt-mermaid-_r_qp_ .node circle,#chatgpt-mermaid-_r_qp_ .node ellipse,#chatgpt-mermaid-_r_qp_ .node polygon,#chatgpt-mermaid-_r_qp_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_qp_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_qp_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_qp_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_qp_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_qp_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}#chatgpt-mermaid-_r_qp_ .ultimate rect{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_qp_ .ultimate polygon{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_qp_ .ultimate ellipse{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_qp_ .ultimate circle{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_qp_ .ultimate path{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_qp_ .ultimate tspan{fill:rgb(249, 223, 156)!important;}Civil V: MegaindústriaEstrutura de capturaFundamental V: ExtraçãoestelarContenção de uma estrelaNúcleo StargraveFundamental V: PropulsãogravitacionalEstrutura móvelMilitar V: ArmamentosestelaresStargrave operacional






Uma decisão importante: a pesquisa militar não deveria ser necessária para capturar uma estrela, mas deveria ser necessária para concluir uma Stargrave armada.

Isso permite que as mesmas tecnologias científicas sustentem outras megaconstruções no futuro.
Progressão e balanceamento científico
Hoje as linhas repetíveis têm crescimento exponencial de custo e trabalho, com limites técnicos de nível. Isso pode funcionar para bônus incrementais, mas não seria o ideal para descobertas excepcionais.

Eu separaria:
Tipo de pesquisa	Progressão
Tecnologia repetível	Níveis e bônus progressivos
Descoberta científica	Desbloqueio único
Avanço de tier	Exige capacidade e pré-requisitos
Especialização estratégica	Desbloqueia uma função ou regra
Projeto estelar	Descoberta única de custo extraordinário

Os avanços de tier existentes seriam preservados. As novas pesquisas seriam acrescentadas por identificadores estáveis, com um grafo de dependências sem ciclos e migrações compatíveis com pesquisas já concluídas.

5. Economia 3.0 — da primeira mina à Stargrave
A economia deve continuar local aos planetas. Não recomendo criar um inventário imperial compartilhado que permita teleportar recursos entre colônias.

A grande mudança seria tornar capacidade produtiva, disponibilidade de materiais e logística três limitações distintas.
Cadeia produtiva
#chatgpt-mermaid-_r_r1_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_r1_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_r1_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_r1_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_r1_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_r1_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_r1_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_r1_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_r1_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_r1_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_r1_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_r1_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_r1_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_r1_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_r1_ p{margin:0;}#chatgpt-mermaid-_r_r1_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_r1_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_r1_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_r1_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_r1_ .label text,#chatgpt-mermaid-_r_r1_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_r1_ .node rect,#chatgpt-mermaid-_r_r1_ .node circle,#chatgpt-mermaid-_r_r1_ .node ellipse,#chatgpt-mermaid-_r_r1_ .node polygon,#chatgpt-mermaid-_r_r1_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_r1_ .rough-node .label text,#chatgpt-mermaid-_r_r1_ .node .label text,#chatgpt-mermaid-_r_r1_ .image-shape .label,#chatgpt-mermaid-_r_r1_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_r1_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_r1_ .rough-node .label,#chatgpt-mermaid-_r_r1_ .node .label,#chatgpt-mermaid-_r_r1_ .image-shape .label,#chatgpt-mermaid-_r_r1_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_r1_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_r1_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_r1_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_r1_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_r1_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_r1_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_r1_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_r1_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_r1_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_r1_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_r1_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_r1_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_r1_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_r1_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_r1_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_r1_ .icon-shape,#chatgpt-mermaid-_r_r1_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_r1_ .icon-shape p,#chatgpt-mermaid-_r_r1_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_r1_ .icon-shape .label rect,#chatgpt-mermaid-_r_r1_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_r1_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_r1_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_r1_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_r1_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_r1_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_r1_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_r1_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_r1_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_r1_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_r1_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_r1_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_r1_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_r1_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_r1_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_r1_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_r1_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_r1_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_r1_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_r1_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_r1_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_r1_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_r1_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_r1_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_r1_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-_r_r1_ .node rect,#chatgpt-mermaid-_r_r1_ .node circle,#chatgpt-mermaid-_r_r1_ .node ellipse,#chatgpt-mermaid-_r_r1_ .node polygon,#chatgpt-mermaid-_r_r1_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_r1_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_r1_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_r1_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_r1_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_r1_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}#chatgpt-mermaid-_r_r1_ .ultimate rect{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_r1_ .ultimate polygon{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_r1_ .ultimate ellipse{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_r1_ .ultimate circle{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_r1_ .ultimate path{fill:rgb(32, 59, 75)!important;stroke:rgb(214, 173, 96)!important;color:rgb(249, 223, 156)!important;}#chatgpt-mermaid-_r_r1_ .ultimate tspan{fill:rgb(249, 223, 156)!important;}Ferrita brutaLiga refinadaComponentesVoláteisCombustíveisIndústria navalLogística espacialFrotas convencionaisMegaindústriaMódulos de contençãoProjeto StargraveUma estrela capturada






Os recursos convencionais continuariam sendo os atuais:
Recurso	Principal função	Gargalo de endgame
Ferrita bruta	Alimentar processamento	Capacidade de extração
Liga refinada	Estruturas, blindagem e cascos	Indústria pesada
Componentes	Eletrônica, máquinas e sistemas complexos	Manufatura avançada
Voláteis	Processamento químico e combustíveis	Abastecimento industrial
Combustível iônico	Propulsão elétrica e sistemas compatíveis	Eficiência e autonomia
Combustível de fusão	Propulsão e sistemas energéticos compatíveis	Operações de grande escala
Energia	Sustentar instalações	Capacidade contínua de geração

Precisaremos formalizar melhor a distinção mecânica entre combustível iônico e de fusão, além da compatibilidade com os motores existentes. Não basta que sejam dois itens consumíveis com custos diferentes.
Três capacidades econômicas
Produção: determina quanto o planeta consegue extrair e fabricar.

Indústria: determina quantos projetos consegue executar e com que velocidade.

Logística: determina quanto consegue transportar, para onde e a que custo.

A Stargrave deverá exigir domínio dos três aspectos.
Especialização planetária
Tipo de colônia	Vantagem	Dependência
Mineradora	Matérias-primas abundantes	Energia e transporte
Industrial	Ligas e componentes	Fornecimento de insumos
Científica	Grande capacidade de pesquisa	Economia para sustentar laboratórios
Energética	Produção energética elevada	Infraestrutura e manutenção
Militar	Construção e reparo naval	Recursos e abastecimento
Estaleiro de megaprojetos	Construção de módulos extraordinários	Várias colônias e logística especializada

Essas seriam especializações emergentes de edifícios, tecnologia e condições planetárias, não classes rígidas que obrigam o jogador a escolher uma única função para cada planeta.
Economia da Stargrave
Não adicionaria cinco novos recursos estelares ao HUD.

O sistema teria apenas uma entidade especial de projeto, com três informações principais:
Elemento	Natureza
Núcleo estelar capturado	Ativo único associado a uma estrela
Módulos de contenção	Componentes especiais fabricados pela megaindústria
Estabilidade energética	Estado operacional da construção

O núcleo não seria um recurso estocável ou comercializável em unidades comuns. Ele seria uma entidade persistente com origem, proprietário, estado de captura e localização.

Isso permite usar os recursos já existentes para quase toda a construção, evitando inflar artificialmente a economia.

6. Frotas 3.0 — funções, composição e contrajogo
Eu manteria as dez classes aprovadas, mas daria a cada uma uma especialização funcional real.
Nave	Função principal	Capacidade diferenciada proposta
Horizon	Reconhecimento	Detectar alvos, rotas e vulnerabilidades
Wayfarer	Transporte	Abastecer operações e transportar materiais
Vanguard	Escolta	Proteger naves vulneráveis
Sentinel	Defesa naval	Interceptar mísseis e ameaças leves
Odyssey	Pesquisa	Analisar anomalias e subsistemas inimigos
Aegis	Cruzador	Proteger aliados com escudos coordenados
Spearhead	Ataque pesado	Romper blindagem e atingir módulos
Leviathan	Combate capital	Sustentar poder de fogo elevado
Atlas	Porta-aviões	Coordenar alas de ataque e defesa
Dominion	Comando	Melhorar coordenação de frotas compostas
Stargrave	Meganave estelar	Armas extraordinárias e bombardeio estratégico

A palavra especialização é importante. Uma Dominion não deve substituir uma Odyssey em expedições científicas, por exemplo.
Arquitetura de atributos navais
Além dos dados existentes, eu formalizaria os seguintes grupos:
Grupo	Atributos necessários
Estrutura	Casco, blindagem, massa
Defesa	Escudos, resistências, interceptação
Ataque	Dano por categoria, precisão, recarga
Operação	Combustível, alcance, manutenção
Logística	Carga, tripulação, abastecimento
Especialização	Sensores, apoio, ciência ou comando

Cada nave teria um conjunto pequeno de capacidades específicas. Evitaria transformar o STARZ em um jogo de equipamentos individuais com dezenas de modificadores difíceis de compreender.
Como funcionariam as frotas compostas
Uma frota que protege a Stargrave poderia utilizar Vanguard e Sentinel na escolta, Aegis para proteção, Odyssey para reconhecimento e Wayfarer para logística.

Uma frota que tenta destruí-la precisaria combinar sensores avançados, armas de ruptura, proteção contra o canhão estelar e capacidade de sustentar o combate.

A Stargrave sozinha deveria ser extraordinariamente poderosa, mas vulnerável quando privada de escolta e suporte.

Isso garante que as dez classes convencionais continuem relevantes no endgame.

7. Defesas 3.0 — impedir a vitória automática
As seis defesas atuais continuariam sendo a base da proteção planetária.

Elas teriam três camadas de especialização:
Camada	Estruturas	Função
Defesa próxima	Defesa pontual e interceptadores	Proteger contra ameaças leves e mísseis
Defesa pesada	Baterias orbitais, canhões EM e plataformas	Enfrentar cruzadores e capitais
Defesa estratégica	Escudos planetários e novas tecnologias de interdição	Resistir a operações de grande escala

Novas contramedidas de endgame
Contramedida	Tier proposto	Efeito
Rede de detecção estelar	IV	Detecta preparação de operações da Stargrave
Interditor gravitacional	IV	Dificulta deslocamentos estratégicos
Bateria de ruptura de contenção	V	Danifica sistemas externos da Stargrave
Matriz de escudos planetários	V	Reduz danos de bombardeio
Centro de comando defensivo	IV	Coordena plataformas, mísseis e frotas locais

A tecnologia de interdição e a detecção inicial devem ser acessíveis antes de um império conseguir construir a primeira Stargrave.

Caso contrário, os primeiros jogadores a chegarem ao Tier V podem adquirir uma vantagem praticamente impossível de enfrentar.

As contramedidas também terão custos, consumo energético e vulnerabilidades convencionais. Não existirão escudos absolutamente invulneráveis.

8. Stargrave — especificação de combate
Stargrave: Meganave de Contenção Estelar
Categoria: unidade estratégica singular • Núcleo: uma estrela cativa • Mobilidade: interestelar • Função: supremacia naval e bombardeio planetário

A Stargrave possuirá uma arquitetura própria. Não será apenas uma Dominion com mais pontos de vida.
Subsistemas
Núcleo de contenção

Subsistema

Mantém a estrela estabilizada e fornece energia aos sistemas

Escudos estelares

Subsistema

Absorvem ataques, consumindo capacidade energética

Armamento principal

Subsistema

Concentra energia para disparos de alto impacto

Propulsão gravitacional

Subsistema

Permite deslocamentos estratégicos preparados

Sistemas de controle

Subsistema

Coordenam sensores, módulos e segurança operacional

Representação conceitual dos módulos, sem valores de durabilidade definidos.
Energia como limitação estratégica
A estrela cativa poderia fornecer energia continuamente, mas os sistemas da Stargrave teriam limites de extração, distribuição e dissipação térmica.

Portanto, dispor de uma estrela não significa possuir energia utilizável infinita em cada instante.

Proponho que três operações concorram pela mesma capacidade energética:
Operação	Consumo operacional	Consequência
Escudos de alta potência	Alto e contínuo	Reduz energia disponível para armas
Canhão estelar	Pico extremamente alto	Exige preparação e limita outras funções
Deslocamento gravitacional	Alto durante preparação	Restringe disparos e recuperação defensiva

O núcleo deve manter uma reserva mínima de contenção que não possa ser gasta como energia de combate.

Se essa reserva ficar comprometida, a Stargrave entrará em desligamento de emergência, não em uma explosão capaz de destruir automaticamente sistemas inteiros.
Armamentos
Armamento	Alvo	Função
Canhão estelar	Capitais e estruturas orbitais	Dano extremo, preparação longa
Baterias secundárias	Naves convencionais	Proteção e combate sustentado
Supressão orbital	Defesas planetárias	Preparar o bombardeio
Bombardeio estelar	Infraestrutura planetária	Danos estratégicos persistentes

A Stargrave não terá de executar necessariamente todas essas ações no mesmo combate.
Bombardeio devastador
Eu separaria duas operações distintas.

Ataque orbital: a Stargrave combate as frotas e as defesas que protegem o planeta.

Bombardeio estratégico: depois de conquistar superioridade orbital, inicia uma operação prolongada contra infraestrutura planetária.

O bombardeio teria uma preparação visível, durante a qual o defensor poderia receber reforços, reparar defesas, mobilizar frotas ou organizar uma retirada.

Como hipótese inicial, podemos testar uma janela de preparação de 12 a 24 horas reais, adequada a um universo assíncrono. Esse tempo ainda precisa ser validado por simulação e testes com jogadores.
Fluxo de uma operação de bombardeio
#chatgpt-mermaid-_r_sm_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_sm_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_sm_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_sm_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_sm_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_sm_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_sm_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_sm_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_sm_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_sm_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_sm_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_sm_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_sm_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_sm_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_sm_ p{margin:0;}#chatgpt-mermaid-_r_sm_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_sm_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_sm_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_sm_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_sm_ .label text,#chatgpt-mermaid-_r_sm_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_sm_ .node rect,#chatgpt-mermaid-_r_sm_ .node circle,#chatgpt-mermaid-_r_sm_ .node ellipse,#chatgpt-mermaid-_r_sm_ .node polygon,#chatgpt-mermaid-_r_sm_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_sm_ .rough-node .label text,#chatgpt-mermaid-_r_sm_ .node .label text,#chatgpt-mermaid-_r_sm_ .image-shape .label,#chatgpt-mermaid-_r_sm_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_sm_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_sm_ .rough-node .label,#chatgpt-mermaid-_r_sm_ .node .label,#chatgpt-mermaid-_r_sm_ .image-shape .label,#chatgpt-mermaid-_r_sm_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_sm_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_sm_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_sm_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_sm_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_sm_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_sm_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_sm_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_sm_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_sm_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_sm_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_sm_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_sm_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_sm_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_sm_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_sm_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_sm_ .icon-shape,#chatgpt-mermaid-_r_sm_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_sm_ .icon-shape p,#chatgpt-mermaid-_r_sm_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_sm_ .icon-shape .label rect,#chatgpt-mermaid-_r_sm_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_sm_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_sm_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_sm_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_sm_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_sm_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_sm_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_sm_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_sm_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_sm_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_sm_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_sm_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_sm_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_sm_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_sm_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_sm_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_sm_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_sm_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_sm_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_sm_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_sm_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_sm_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-_r_sm_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_sm_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_sm_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-_r_sm_ .node rect,#chatgpt-mermaid-_r_sm_ .node circle,#chatgpt-mermaid-_r_sm_ .node ellipse,#chatgpt-mermaid-_r_sm_ .node polygon,#chatgpt-mermaid-_r_sm_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_sm_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_sm_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_sm_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_sm_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_sm_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Stargrave chega ao sistemaConfronto com defesas orbitaisSuperioridade orbital?Recuar ou continuar combatePreparar bombardeioAlerta ao defensorContenção e órbita mantidas?Operação interrompidaBombardeio resolvidoDanos persistentes e relatórioNãoSimNãoSim






Limite de destruição: o bombardeio poderá destruir níveis de instalações, danificar defesas, interromper produção e causar perdas econômicas importantes. Ele não poderá eliminar instantaneamente um planeta, apagar uma colônia ou excluir a conta do jogador.

Um alvo desprotegido poderá sofrer perdas severas. Um alvo com tecnologias de defesa estelar deverá conseguir reduzir os danos ou interromper a operação.

Para preservar o combate existente, a fase inicial de confronto usaria as unidades e salvas da engine atual. Preparação, interrupção e bombardeio seriam operações estratégicas persistentes separadas.
Como destruir uma Stargrave
O processo deve ser possível mesmo sem possuir outra Stargrave.
Estratégia	O que o defensor precisa fazer
Superioridade militar	Concentrar frotas com capacidade anticapital
Ruptura de contenção	Pesquisar armas e sensores especializados
Guerra de desgaste	Forçar consumo operacional e reparos
Interdição	Impedir ou atrasar deslocamento
Ataque logístico	Destruir escoltas e instalações de suporte
Ataque coordenado	Combinar tecnologias e frotas de vários impérios

O sistema de contenção não poderá ser atacado diretamente enquanto todas as proteções externas estiverem intactas. Mas, após reduzir escudos e danificar módulos, o defensor poderá comprometer o núcleo e forçar uma retirada ou destruição.

A derrota de uma Stargrave deixará destroços recuperáveis e consequências persistentes, sem criar automaticamente uma catástrofe planetária irreversível.

9. Captura de uma estrela e construção
A decisão de uma estrela por Stargrave está fechada.

O que ainda precisamos especificar é como um império ganha o direito de capturá-la e quais consequências a operação causa ao sistema de origem.
Requisitos de elegibilidade
Eu proporia as seguintes restrições iniciais:
Condição	Regra proposta
Conhecimento	Estrela pesquisada e identificada
Tecnologia	Contenção, extração e engenharia estelar desbloqueadas
Presença territorial	Infraestrutura de captura em território próprio
Controle militar	Nenhuma ocupação hostil impeditiva
Sistema habitado	Não pode conter colônias de outros impérios
Mundo natal	Não pode ter sua estrela capturada
Colônias próprias	Exigem desocupação ou sustentação ambiental preparada
Estado estelar	Estrela já capturada ou comprometida não pode ser reutilizada

O universo atual possui propriedade planetária, não necessariamente um sistema completo de soberania estelar. Por isso, a futura regra de captura precisará verificar todas as colônias relevantes, não presumir que possuir um planeta concede automaticamente a estrela.
Construção em cinco fases
Fase	Projeto	Vulnerabilidade
I	Infraestrutura de captura	Plataformas podem ser atacadas
II	Estabilização da estrela	Processo pode ser interrompido
III	Montagem da contenção Dyson	Módulos precisam de transporte
IV	Integração da estrutura móvel	Sistema ainda não possui mobilidade completa
V	Armamento e comissionamento	Projeto torna-se uma unidade militar

O projeto pode continuar avançando offline, desde que tenha materiais, infraestrutura e condições operacionais.

Todas as transições deverão ser resolvidas pelo servidor, com custos debitados uma única vez e estados persistentes.
O destino do sistema estelar
Quando a estrela for efetivamente removida, o sistema original se tornará um sistema estelar desprovido de estrela central ativa.

Os planetas continuarão existindo, mas poderão perder progressivamente suas condições de habitabilidade e produção energética natural.

Isso cria novas oportunidades futuras, como colônias subterrâneas, habitats artificiais e infraestrutura de sustentação.

Não recomendo apagar os planetas nem mudar suas coordenadas. Também precisamos preservar suas identidades, propriedades e histórico.

A remoção de uma estrela e a movimentação de seu núcleo são tecnologias fictícias do STARZ. As consequências ambientais podem ter inspiração científica, mas não devemos tratá-las como uma simulação astrofísica rigorosa.

10. Balanceamento 1.0 — metas e fórmulas
Nesta fase, eu não fixaria definitivamente os custos da Stargrave ou os atributos das novas tecnologias.

Primeiro precisamos definir resultados desejados; depois calibrar os números para que esses resultados aconteçam.
Ritmo de progressão
Estes seriam alvos iniciais de playtesting para um jogador ativo em um servidor novo, sem aceleradores pagos:
Marco	Faixa inicial a investigar
Economia orbital funcional	Primeiras horas
Tier II consolidado	1–3 dias
Tier III e expansão colonial	4–10 dias
Tier IV e frotas avançadas	2–4 semanas
Tier V científico e militar	4–8 semanas
Primeira Stargrave	Aproximadamente 8–12 semanas

Não são prazos garantidos nem valores calculados a partir do balanceamento atual. São hipóteses para simulação.

A construção de uma segunda Stargrave, depois da perda da primeira, não deve exigir necessariamente repetir todo o processo científico. As tecnologias permanecem aprendidas, mas o jogador terá de adquirir outra estrela elegível e reconstruir a infraestrutura necessária.
Custo relativo das naves
O valor de uma nave precisa considerar mais do que seus materiais de construção.

Proponho esta relação conceitual:
\[
C_{\text{total}} =
C_{\text{construção}}+
C_{\text{operação}}+
C_{\text{reposição}}+
C_{\text{logística}}
\]

Assim, uma nave de combate barata pode tornar-se cara se consumir muito combustível ou exigir reposições constantes.

Uma nave avançada deve proporcionar vantagens relevantes, mas não necessariamente a melhor eficiência de custo em todos os confrontos.
Custo da Stargrave
Como ponto de partida, testaria um custo industrial equivalente a aproximadamente 30–50 Dominions, além da captura de uma estrela, tecnologias e infraestrutura especializadas.

Esse intervalo não será adotado diretamente no catálogo. Primeiro precisaremos medir a produção real de um império Tier V, a disponibilidade de recursos locais e o custo de transportá-los.

O objetivo é que construir uma Stargrave exija planejamento de longo prazo, sem obrigar o jogador a passar meses apenas esperando contadores crescerem.
Matriz de resultados militares desejados
Cenário	Resultado de referência
Stargrave contra pequenas frotas isoladas	Superioridade clara da Stargrave
Stargrave contra várias capitais sem contramedidas	Stargrave favorecida, mas sujeita a desgaste
Stargrave isolada contra frota antistargrave preparada	Possibilidade real de derrota ou retirada forçada
Stargrave com escolta e logística	Consideravelmente mais difícil de enfrentar
Bombardeio contra planeta desprotegido	Danos econômicos severos
Bombardeio contra defesa estelar preparada	Danos mitigáveis ou operação interrompida
Duas Stargraves adversárias	Resultado dependente de suporte, tecnologia e estado operacional

Esses resultados deverão ser verificados em simulações determinísticas com múltiplas composições de frota, níveis tecnológicos e condições de abastecimento.

Não basta que os atributos pareçam equilibrados em uma planilha.
11. Proteções do multiplayer persistente
A Stargrave precisa ser uma ameaça real, mas não pode tornar o universo inviável para jogadores novos ou ausentes.

Proponho as seguintes regras:
Situação	Proteção proposta
Conta recém-criada	Proteção inicial com prazo e critérios explícitos
Mundo natal	Proteção contra captura estelar e destruição planetária
Jogador offline	Operações prolongadas com avisos e tempo de reação
Bombardeio	Preparação interrompível e danos limitados por operação
Guerra encerrada	Revalidação da hostilidade antes da resolução
Stargrave derrotada	Perda real da unidade, com detritos e histórico
Exploração de captura	Verificação autoritativa de propriedade e elegibilidade

Não usaria uma imunidade permanente baseada apenas na diferença de poder entre os jogadores. Isso poderia criar outras formas de exploração.

Também é necessário impedir que um atacante repita bombardeios em sequência sem custos ou janelas de recuperação. O objetivo é permitir guerras devastadoras, mas não apagar semanas de progresso em segundos.
Limite de Stargraves
Minha proposta inicial é uma Stargrave operacional por império, sujeito à revisão de balanceamento.

Esse limite precisaria considerar unidades em construção, capturadas, danificadas ou abandonadas. Não deve ser possível contorná-lo por transações ou mudanças de estado.

No futuro, podemos estudar projetos especiais envolvendo várias Stargraves, mas não colocaria isso na primeira versão.

12. Arquitetura de dados e regras
A próxima implementação deverá ter uma única fonte autoritativa para cada definição de gameplay.
Contrato	Responsabilidade
TechnologyDefinition	Pesquisa, tier, requisitos, efeitos, desbloqueios
EconomicRecipe	Entradas, saídas, capacidade, energia e trabalho
ShipDefinition	Classe, atributos, custos, funções e capacidades
DefenseDefinition	Armas, proteção, munição e contramedidas
CombatRules	Resolução, modificadores, danos e resultados
StellarProjectDefinition	Etapas, recursos, elegibilidade e interrupções
StargraveState	Núcleo, módulos, energia, localização e integridade
BalanceScenario	Condições iniciais, estratégia e resultados esperados

Os nomes são contratos conceituais, não instruções para criar tabelas novas imediatamente.

É particularmente importante separar três conceitos:

Definição: quais são as regras e os custos de uma Stargrave.

Estado persistente: em que etapa está a Stargrave de um jogador e quais danos sofreu.

Representação visual: como o renderer transforma esse estado em uma nave visível.

A engine deve continuar sendo a autoridade sobre os estados. O Three.js apenas apresenta as informações permitidas ao jogador.
Compatibilidade com o jogo atual
O plano deverá preservar os IDs das 32 pesquisas, das dez naves e das seis defesas. Mudanças de pré-requisitos, efeitos ou limites precisarão de regras de migração versionadas.

Não podemos atualizar uma fórmula e deixar pesquisas anteriormente pagas, construções em andamento ou saves antigos em estados impossíveis.

13. Simulador de balanceamento
Antes da implementação da Stargrave, desenvolveria um simulador independente da interface gráfica.

Ele deverá testar a economia, a pesquisa, a evolução de impérios e os conflitos usando as mesmas regras da engine.
Cenários obrigatórios
Cenário	O que precisa demonstrar
Império industrial	Produção e expansão sustentáveis
Império científico	Avanço tecnológico competitivo
Império militar	Capacidade ofensiva com custos reais
Império equilibrado	Progresso consistente sem especialização extrema
Corrida para Stargrave	Sacrifícios econômicos e militares mensuráveis
Defesa antistargrave	Possibilidade de enfrentar uma unidade superior
Aliança de impérios menores	Coordenação capaz de desafiar grandes potências
Jogador inativo	Ausência de exploração abusiva de janelas offline
Império derrotado	Caminho viável para recuperação
Sistema sem estrela	Consequências persistentes sem corromper o universo

Métricas que precisamos acompanhar
Economia

Retorno do investimento

Tempo para recuperar custos produtivos


Pesquisa

Tempo de desbloqueio

Duração e custo de cada caminho tecnológico


Combate

Eficiência por custo

Danos, sobrevivência e reposição


Estratégia

Concentração de poder

Vantagem acumulada dos maiores impérios




Outra métrica fundamental será a viabilidade de contramedidas: um império que não pretende construir uma Stargrave consegue investir em pesquisa e infraestrutura suficientes para resistir a uma?

Se a resposta for sistematicamente não, a arquitetura está desequilibrada.

14. Decisões consolidadas e pendentes
Tema	Proposta de arquitetura	Estado
Stargrave móvel	Meganave interestelar	Definido
Núcleo energético	Uma estrela cativa	Definido
Principal capacidade	Bombardeio planetário devastador	Definido
Invulnerabilidade	Não; poderá ser derrotada	Definido
Destruição de planetas	Não será a função principal	Direção definida
Domínios científicos	Civil, Militar e Fundamental	Preservar
Progressão	Cinco tiers e especializações avançadas	Refinar
Custo da Stargrave	Extraordinário, com logística e manutenção	Balancear
Estrelas elegíveis	Controle territorial e restrições de captura	Refinar
Limite de unidades	Uma operacional por império inicialmente	Provisório
Bombardeio e contramedidas	Operações prolongadas e interrompíveis	Balancear
Ritmo de endgame	Progressão de semanas, não horas	Simular

15. Ordem recomendada de refinamento
Não pediria ainda ao Codex que implementasse esses sistemas. Primeiro precisamos transformar a proposta em um catálogo de design que possa ser balanceado.

A sequência recomendada é:
01

Research 3.0

Fechar todas as linhas, dependências, efeitos e desbloqueios.


02

Economy 3.0

Definir produção, consumo, especialização e logística.


03

Fleet & Defense 3.0

Fechar atributos, funções, relações de força e contramedidas.


04

Stargrave Design

Formalizar captura, construção, energia, combate e bombardeio.


05

Balance Simulator

Simular progressão e conflitos antes de implementar as novas regras.



Minha conclusão
A Stargrave está bem definida como conceito. Agora, o desafio é garantir que o caminho até ela seja tão interessante quanto a própria nave.

O STARZ não deve se resumir a quem consegue produzir mais recursos ou pesquisar primeiro o Tier V. Ele deve permitir impérios com identidades estratégicas distintas, frotas especializadas, economias interdependentes e guerras em que informação, preparação e logística tenham consequências reais.

Eu começaria fechando o Research 3.0, com uma matriz completa das 32 tecnologias atuais, as novas descobertas, seus pré-requisitos, efeitos e desbloqueios de cada nave, defesa e instalação — incluindo o caminho de construção e o caminho de combate contra a Stargrave.

Essa será a base para calcular custos e balancear toda a economia sem precisar refazer as árvores de pesquisa depois.