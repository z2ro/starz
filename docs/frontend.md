# Frontend

## Estrutura da experiência

StarZ usa uma SPA pequena em TypeScript nativo. O shell persistente contém HUD global,
navegação lateral, conteúdo principal e contexto de filas/notices. Rotas hash mantêm
a view no refresh:

- `#/overview`: resumo operacional, planeta e prioridades;
- `#/planet`: propriedades físicas, distritos, construção e órbita;
- `#/economy`: stocks, flows e capacities separados;
- `#/research`: requisitos, status, trabalho restante, ETA e unlocks;
- `#/shipyard`: slots, escolha de casco/motor/combustível e montagens;
- `#/fleets`: posição, composição, missão e ETA;
- `#/galaxy`: vizinhança, destino visual, previews e despacho.

O planeta usa CSS e estado real: distritos geram marcadores por categoria, o estaleiro
gera estrutura orbital e frotas presentes geram marcador. A representação é agregada,
não uma simulação urbana. Cores são semânticas e discretas; foco de teclado e redução
de movimento respeitam preferências do sistema.

## Dados e autoridade

`/api/catalog` expõe uma projeção read-only do catálogo YAML. Nomes, custos,
requirements, capacidades e compatibilidades não são duplicados no TypeScript.
`/api/galaxy?radius=2` gera somente a vizinhança visual, limitada pelo backend a raio
1–3. Selecionar um node não cria descoberta nem materializa o sistema.

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

`frontend/src/main.ts` é a fonte. `npm run build` gera `frontend/app.js`; não edite o
artefato manualmente. `npm test` executa testes DOM leves sem dependência de navegador.
