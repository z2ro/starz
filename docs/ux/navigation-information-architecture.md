# Navegação do universo persistente

## Decisões

O menu passa de 12 destinos para 10, organizados em Visão geral, Planeta, Tecnologia, Espaço e Império. Instalações reúne desenvolvimento, população e trabalhadores; Produção explica a economia local. Colônias administra o conjunto de mundos. Frotas reúne inventário, viagens e planejamento. Galáxia escolhe o destino e encaminha a mesma composição para o planejador.

Os grupos e rótulos seguem a estrutura solicitada. A direção visual permanece a mesma. Acesso rápido mobile acompanha os novos nomes e a seleção ativa do planejador é Frotas.

## Compatibilidade e contexto

- `/universe`, `/development`, `/economy`, `/galaxy` e demais endereços existentes continuam válidos com novos rótulos.
- `/missions` redireciona para `/fleets?plan=1`, preservando os parâmetros de consulta.
- `/planet` continua acessível como tela detalhada compatível com favoritos antigos, sem entrada principal no menu.
- A visão geral leva à gestão de população em `/development?section=population`; selecionar uma colônia leva ao contexto da visão geral.
- O planejador guarda um rascunho por ID persistente de planeta no `sessionStorage` da aba: naves, missão, destino, índice e carga. Não mistura impérios/planetas e não persiste uma cotação antiga. Antes do envio é necessário calcular novamente.
- Contexto explícito de Galáxia ou frota substitui os campos correspondentes do rascunho. Coordenadas explícitas limpam um planeta de destino antigo, impedindo que este se sobreponha ao novo destino. Parâmetros contextuais são consumidos após salvar para não sobrescrever edições posteriores.
- Armazenamento indisponível não impede a navegação; nessa condição o rascunho não sobrevive ao fechamento do formulário.

## Validação

Typecheck, suíte frontend/Node, build Vite em `compose.persistent.yaml` e diff check. Browser Chromium, 1440×900 e 390×844: dez links, grupos, seleção ativa, alias antigo de missão, preservação de coordenadas editadas e naves entre abas/reload, Galáxia → planejador com novo destino, rota antiga de Planeta e ausência de overflow mobile. Nenhuma ordem de gameplay foi emitida nessa verificação.

Capturas em `tmp/navigation-review/`: `desktop-menu.png`, `mobile-menu.png` e `planner.png`. Resultado estruturado em `qa.json`. Backend, endpoints, regras e banco não foram alterados.

Não houve validação em dispositivos físicos, Safari ou Firefox. O rascunho é local à aba e não é sincronizado entre dispositivos.
