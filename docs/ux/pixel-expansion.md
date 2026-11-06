# Expansão pixel art — universo persistente

A direção do Centro de Comando foi aprovada pelo responsável. Esta etapa aplica a identidade ao universo persistente, mantendo composições próprias por sistema. Backend, regras, conteúdo, autenticação, bancos e geradores procedurais permanecem intactos.

## Sistema visual

`frontend/src/pixel-command/` concentra shell, dashboard, ícones, cadeia de pesquisa e estilos. `PixelTheme` adapta o Icon existente apenas dentro do jogo persistente. Labs e cenário opcional mantêm seus renderers e interfaces.

- Silkscreen local/SIL OFL apenas para títulos e rótulos curtos; descrições e números em system sans, normalmente 13–14px ou maiores. Texto não recebe filtro de pixelização.
- Paleta navy/grafite/marfim/ciano/âmbar; violeta discreto em pesquisa e verde em condições saudáveis.
- Ícones preenchidos em malha 16×16; molduras ortogonais com border-image 9-slice; controles com repouso, hover, pressão, seleção, indisponibilidade e foco visível.
- Recursos locais e energia no cabeçalho, sem duplicação no dashboard. Progresso usa valores reais; taxas declaradas continuam explicitamente nominais.
- Tutorial preservado em Ajuda, inclusive progresso salvo. Registros, retorno offline, erros e confirmação usam os fluxos existentes.

## Composições

| Sistema | Tratamento |
|---|---|
| Comando | Planeta procedural, instrumentos de capacidade, missão contextual, atividades e ordens rápidas |
| Construção | Catálogo de instalações + bancada de ampliação; entrada/instalação/resultado e custos reais |
| Pesquisa | Pré-requisitos navegáveis → tecnologia/nível → desbloqueios; efeitos e custos do próximo nível |
| Estaleiro | Catálogo, modelo procedural dominante e configuração de montagem; câmeras em português |
| Frotas | Viagem/localização, progresso temporal e composição real, com inspeção independente do modelo |
| Mapa | Área de exploração dominante, legenda, nós selecionáveis, dados estelares e planejamento de missão |
| Recursos | Estoque local, rede industrial e capacidades; seleção de recurso/instalação preservada |
| Diplomacia | Contatos e estado, ações de relação identificáveis; separada do mercado |
| Mercado | Oferta → troca → entrega; campos e ofertas reais, sem tabela genérica |
| Planeta | Hero existente enquadrado, overlays preservados e inspector legível com scroll próprio no desktop |
| Império | Contexto planetário procedural, indicadores agregados e seleção de mundos; sem copiar o dashboard |
| Missões | Composição → objetivo/destino → revisão/lançamento, sem alteração de payload |

Mobile possui dock de quatro destinos, menu de setores, estoques expansíveis, seletores horizontais e inspector em sequência. O item selecionado é revelado automaticamente nos seletores de construção/pesquisa. Scroll horizontal é deliberado apenas nos seletores/abas; não na página. No desktop, navegação lateral e áreas simultâneas.

## Validação

- Typecheck e build Vite no Docker isolado aprovados. Build no container evita sobrescrever `frontend/dist` servido por outro ambiente local.
- 235 testes Vitest + testes Node de planetas, registries, assets e ícones.
- Testes novos cobrem dados locais, progresso, fallback WebGL, ajuda persistida, recomendação, pré-requisitos/níveis, navegação Mercado/Diplomacia e disclosure de estoques.
- Chromium: todas as 12 telas em 1440×900 e 390×844. Centro de Comando adicional em 1920×1080 e 1366×768. Inspeção visual e refinamento de overflow, largura de recursos, seleção mobile, inspector planetário e textos secundários.
- Primeira sessão real no ambiente isolado: conta de QA criada, instalação ampliada, pesquisa iniciada/concluída offline, Horizon construída e missão SURVEY enviada. Requisitos de pesquisa e insuficiência de recursos verificados. Nenhuma alteração direta no banco para simular conclusão.
- Capturas/medidas em `tmp/pixel-expansion/after/`, galeria `index.html`; comparação do comando em `tmp/pixel-expansion/command/`; fluxo real em `tmp/ux-review/after/`. Esses arquivos locais não são dados de produção.

### Reproduzir

```sh
docker compose -f compose.persistent.yaml build universe-app
docker compose -f compose.persistent.yaml up -d --wait universe-app
npm run typecheck
npm test
git diff --check
```

Abrir `http://localhost:8030/#/universe`. `scripts/pixel_game_qa.cjs` e `scripts/pixel_command_qa.cjs` usam `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `STARZ_QA_STORAGE` (storageState privado de uma conta local de QA). O primeiro percorre todas as telas e gera a galeria; ambos são read-only em gameplay. `scripts/ux_first_session.cjs` cria uma conta isolada e executa ordens reais em localhost:8030.

## Limitações

Validação em Chromium com SwiftShader; não é benchmark de GPU nem teste em Safari/iOS físico. Abas e catálogos mobile usam rolagem lateral controlada. Telas densas mantêm rolagem vertical. Não foi repetida uma campanha completa de combate/comércio entre jogadores; as ações e validações existentes não foram alteradas. Aprovação artística final continua com o responsável. Não houve merge ou PR.
