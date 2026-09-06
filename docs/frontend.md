# Frontend

Overview e Planet exibem um seletor dos mundos do império. A troca recarrega o
contexto planetário autorizado; stocks são locais ao planeta selecionado e pesquisa
continua global. Em Galaxy,
sistemas `SURVEYED` listam seus planetas, viabilidade e ownership. Selecionar um alvo
viável, uma fleet `ARRIVED` e um regime produz a ordem `COLONIZE` explícita.

## Estrutura da experiência

StarZ usa uma SPA pequena em TypeScript nativo. O shell persistente contém HUD global,
navegação lateral, conteúdo principal e contexto de filas/notices. Rotas hash mantêm
a view no refresh:

- `#/overview`: resumo operacional, planeta e prioridades;
- `#/planet`: propriedades físicas, distritos, construção e órbita;
- `#/economy`: stocks locais, flows e capacities separados;
- `#/research`: requisitos, status, trabalho restante, ETA e unlocks;
- `#/shipyard`: slots, escolha de casco/motor/combustível e montagens;
- `#/fleets`: posição, composição, missão e ETA;
- `#/galaxy`: conhecimento da vizinhança, recentralização, previews e despacho.

O Planet View é um command center de três regiões: hero espacial central, overlays de
operação sobre o canvas e inspector contextual à direita. A infraestrutura planetária
continua abaixo do hero; o planeta e a estrela são os elementos visuais dominantes.
O `PlanetRenderer` Three.js é somente a camada de apresentação. A cena recebe um
`PlanetVisualState` pronto do `main.ts`; não chama API e não decide regras do jogo. A
superfície é uma CanvasTexture equiretangular determinística, baseada em
`system + coordinates + planet_index`; água altera a proporção oceânica e temperatura
altera a paleta. Atmosfera, iluminação estelar, districts agregados, luzes noturnas
sutis, estaleiro orbital e fleets `ARRIVED` são representados por primitives. A
superfície usa FBM/value noise determinístico em CanvasTexture 1024×512; a textura de
relevo é apenas um bump map leve. A atmosfera usa um shader Fresnel simples, as luzes
noturnas usam um shader de pontos limitado ao hemisfério escuro e o fundo usa três
camadas de estrelas mais uma nebulosa discreta. Não há terrain simulation, física
orbital ou autoridade de gameplay no renderer.

O lifecycle é persistente enquanto a rota Planet permanece aberta: entrar cria o
renderer, polling/troca de estado chama `update()`, troca de planeta reconstrói apenas
o conteúdo visual, e qualquer outra rota chama `dispose()`. O canvas fica em um host
próprio para que a atualização da interface HTML não crie um novo WebGLRenderer. Isso
também evita canvas duplicado. `dispose()` cancela o frame loop, desconecta o
`ResizeObserver`, libera controls, geometrias, materiais, texturas e renderer. Se
WebGL falhar, o stage mantém a representação CSS anterior e os dados HTML continuam
disponíveis. `OrbitControls` permite rotação/zoom sem pan; a rotação automática é
reduzida com `prefers-reduced-motion`.

Os overlays mostram construção, pesquisa e frotas estacionadas com dados reais. O
inspector possui as abas Visão geral, Distritos, Órbita e Dados; cada aba expõe estado
existente e não cria regras paralelas.

## Dados e autoridade

`/api/catalog` expõe uma projeção read-only do catálogo YAML. Nomes, custos,
requirements, capacidades e compatibilidades não são duplicados no TypeScript.
`/api/galaxy?radius=2` gera somente a vizinhança visual, limitada pelo backend a raio
1–3. Nodes `UNKNOWN` não recebem estrela ou planeta; `SURVEYED` recebe detalhes
procedurais. O mapa pode ser centralizado no homeworld ou em frota `ARRIVED` e não
aceita coordenada arbitrária. Selecionar um node não cria descoberta nem materializa.

`/api/state?planet_id=...` retorna os stocks, população, distritos, energia e filas do
planeta ativo. Construções e montagem de nave enviam esse `planet_id`; a UI não soma
stocks imperiais para autorizar ações. Naves novas preservam sua origem planetária;
em uma frota existente, o planeta selecionado é a fonte econômica atual. Viagens
remotas sem planeta local usam somente a reserva embarcada.

Ao escolher um sistema desconhecido, o despacho é apresentado como **Explorar
sistema** e envia `mission=SURVEY`. Sistemas conhecidos usam `MOVE`. A chegada e a
mudança de knowledge continuam sob autoridade do backend. Horizon é exibida como
“Corveta · Exploração” a partir dos metadados YAML.

O frontend nunca autoriza ações. Build, research, ship build e travel são validados
pela engine. Erros de domínio viram toasts legíveis; loading e empty states explicam o
estado atual. Travel sempre usa previews retornados pelo backend.

## Tempo

No carregamento, catálogo, estado e mapa são buscados em paralelo. Após ações, o estado
é recarregado. Enquanto houver construção, pesquisa, nave em montagem ou frota em
trânsito, a UI sincroniza a cada 15 segundos quando a aba está visível. Countdowns e
barras entre sincronizações são apenas apresentação derivada dos timestamps. Não há
polling por frame, scheduler nem tick server-side.

## Build

`frontend/src/main.ts` é a fonte. `npm run build` executa typecheck e gera o bundle
local de Three.js em `frontend/app.js`; não edite o artefato manualmente. `npm test`
executa testes DOM leves e testes puros do visual sem dependência de navegador/WebGL.
