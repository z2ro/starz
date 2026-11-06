# STARZ — Persistent Universe experiment

Base: `experiment/complete-game` (`a164425`). Branch: `experiment/persistent-universe`.
O modo principal deste experimento é um universo assíncrono compartilhado. Não possui
turnos, ordens por turno, prazo final, objetivo obrigatório ou derrota de campanha.
Concordat continua opcional, no seu Compose e banco separados.

## Rodar e jogar com duas pessoas

Requisitos: Docker + Compose.

```bash
git switch experiment/persistent-universe
docker compose -f compose.persistent.yaml up -d --build --wait
```

Abra **http://localhost:8030/#/universe**. Crie uma conta (nome de 3–24 caracteres,
senha de pelo menos 12). Abra uma janela anônima, outro perfil ou outro navegador
para criar o segundo jogador. Duas abas do mesmo perfil compartilham o cookie e,
portanto, a mesma conta. Cada conta possui um império e um homeworld diferentes,
no mesmo universo procedural. Não há seleção global de save neste modo.

O banco usa **5545**, serviços `universe-app`/`universe-db`, projeto
`starz-persistent-universe` e volume exclusivo `starz-persistent-universe_universe-save`.
Não usa o banco original nem o de Concordat (8020/5544). `down` preserva os saves;
**não use `down -v`**. Reconstruir/reiniciar retoma contas, níveis, frotas e recursos.
O Compose original e as branches anteriores não são alterados.

Para a versão opcional Concordat: `docker compose -f compose.experiment.yaml up -d --build --wait`.
Não compile `frontend/dist` no checkout compartilhado para testar esta versão:
o app original pode servir esse diretório. O build experimental fica na imagem Docker.

## Abertura e desenvolvimento

O homeworld começa com extração, processamento, combustível, pesquisa e estaleiro
funcionais. Recursos são **locais**. Amplie energia e habitação antes de comprometer
trabalhadores e tripulações. O console Universo apresenta custos reais por nível;
Economia mostra fluxos nominais já modificados pela tecnologia. Energia/workforce
continuam reduzindo produção e throughput de pesquisa quando insuficientes.

Acolhimento populacional custa 2 voláteis + 0,2 componentes por pessoa (o custo de
voláteis é reduzido por Apoio populacional). Respeita a capacidade habitacional.
Não existe crescimento gratuito fora da engine. Construa Horizon para levantamentos,
Wayfarer para frete e Odyssey para expedições científicas com carga. As dez classes
convencionais são construíveis através dos desbloqueios; Stargrave continua um design
experimental, não um casco convencional.

- **Pesquisa:** um programa ativo por domínio (Civil, Militar e Fundamental), pago com estoques do planeta escolhido;
  trabalho compartilhado pelos laboratórios de suas colônias. Níveis persistidos
  separadamente da lista de primeiros desbloqueios.
- **Construção:** custo base × `1,6^nívelAtual`; duração base × `1,4^nívelAtual` /
  `(1 + engenharia de construção)`. Construções pendentes contam no preço do próximo nível.
- **Produção:** nível × `1,08^(nível−1)` × bônus tecnológico da atividade. Automação
  aumenta outputs do processamento sem aumentar os inputs; mineração aumenta extração;
  metalurgia/componentes multiplicam seu output específico. Não há produção gratuita
  quando faltam inputs. Energia e força de trabalho crescem linearmente por nível.
- **Pesquisa por nível:** custo base × `1,7^nívelAtual`; trabalho base × `1,55^nívelAtual`.
  Pré-requisitos possuem níveis explícitos e infraestrutura local. Preview explica custo,
  trabalho, ETA e modificadores atuais/próximos antes de pagar.
- **Capacidade:** 2 + Computação frotas simultâneas em trânsito; 1 + Astrofísica mundos
  possuídos ou em colonização. Slots não limitam frotas estacionadas.
- **Armazenamento:** 100.000 unidades por recurso × `1,7^nívelArmazenamento`.
  Excedentes de produção são descartados no limite; transferências também ficam
  sujeitas ao limite no próximo avanço. Não há armazém imperial compartilhado.
- Limite técnico de segurança deste protótipo: **50 níveis** por linha/estrutura,
  100 naves selecionáveis por missão. Não é uma campanha com final obrigatório.

## Missões e interação humana

Selecione entidades reais no console Universo. As quantidades por classe são contagens
dessas entidades, não frotas fictícias. Uma frota pode conter várias naves com o mesmo
motor/combustível. A nave mais lenta define a duração; o custo de combustível soma
as naves. Navegação divide tempo por `(1 + bônus de velocidade)` e consumo por
`(1 + eficiência + bônus de transporte quando aplicável)`. O preview mostra ETA,
combustível e carga. As reservas de retorno são físicas e persistidas.

- **MOVE:** permanece no sistema de destino. Pode voltar usando a reserva; não pode
  dividir frota remota sem abastecimento.
- **SURVEY:** exploradora/científica revela geografia real e retorna.
- **COLONIZE:** exploradora/logística parte de mundo próprio selecionado; exige
  levantamento, viabilidade física, capacidade colonial, pessoas e pacote de recursos.
  A reivindicação e a chegada são serializadas entre jogadores.
- **TRANSPORT:** carrega recursos locais e entrega em planeta colonizado, inclusive
  de outro jogador. Capacidade vem dos hulls e de Logística. Retorno automático.
- **ESPIONAGE:** requer Inteligência 1, exploradora/científica e planeta de outro
  jogador. Inteligência + sensores confrontam contrainteligência; o relatório de
  estoques/distritos fica privado. O alvo recebe aviso. Retorno automático.
- **EXPEDITION:** requer Ciência de expedições 1 e exploradora/científica com carga
  (Odyssey). Coleta mineral/voláteis limitada à capacidade, com bônus científico,
  e só credita recursos ao retornar. Não usa loot aleatório nem artefatos de campanha.
- **ATTACK:** exige guerra declarada e alvo humano real. Paz/aliança aceita durante
  trânsito impede combate. Defendem naves prontas estacionadas no sistema e baterias
  do planeta. Não existem formações ou posições táticas inventadas.

Poder = soma de poder dos hulls + alas abstratas dos carriers, com bônus de armas,
blindagem e escudos. Cada nível de bateria fornece 12 de poder, modificado por defesa
/escudos. Baixas determinísticas proporcionais à relação de força removem naves e
associações SQL de verdade. Uma derrota perde pelo menos uma atacante. Vitória pode
remover um nível defensivo e saquear até 25% de cada estoque, limitado à carga
sobrevivente. O saque só entra no estoque ao retorno. Não captura planetas nem
elimina permanentemente uma conta. É combate estratégico agregado, não combate 3D.

Diplomacia permite declarar guerra, propor aliança/paz e aceitar a proposta da outra
parte. Nenhuma dessas operações pode agir como outro império. O mercado usa escrow:
a oferta retira recursos; aceitar paga a contraparte atomicamente; duas entregas
por timestamp têm taxa explícita de 10% e duração por distância. É um **contrato de
courier**, não uma nave visual do jogador. Cancelar oferta aberta devolve o depósito
no planeta de origem. Logística 1 é exigida para aceitar.

## Persistência e segurança

PostgreSQL é autoritativo. Cada requisição resolve a conta pelo cookie opaco revogável
(`HttpOnly`, `SameSite=Strict`, `Secure` sob HTTPS); apenas o hash do token fica no
banco. Senhas usam PBKDF2-HMAC-SHA256 com salt aleatório e 600.000 iterações.
Mutações exigem header `X-Starz-Request: 1` e validam Origin quando presente.
Login/registro têm limitação local de tentativas. Não há CORS liberado.
Referências de API: [hashlib](https://docs.python.org/3/library/hashlib.html),
[cookies Starlette](https://starlette.dev/responses/#set-cookie).

Migração Alembic adiciona contas, sessões, progresso e ordens sem apagar as tabelas
ou saves anteriores. Os níveis são do império; distritos/estoques são do planeta.
Todas as ações/ticks obtêm o mesmo advisory lock transacional do universo: impede
gasto duplo, ataque com snapshots divergentes e dupla aceitação de oferta. É uma
escolha de correção para a escala local, não arquitetura de MMO de alta concorrência.

Um heartbeat a cada 2 segundos resolve indústria, pesquisa e missões mesmo sem
navegador aberto. Se o servidor ficar desligado, o próximo tick/requisição reconcilia
os timestamps. Chegadas, pesquisa e construções são processadas em ordem temporal;
não se gera um tick por segundo offline. Reiniciar não reinicia o universo.

Os geradores, modelos, shaders e paleta aprovados permanecem os mesmos. Planet View
mantém IMAGE/PROCEDURAL e fallback. O console também tem imagem de fallback.
Presença de naves depende das entidades reais; lua/estação UNKNOWN não aparecem.

## Validação

```bash
npm run typecheck
npm test
# Build isolado, sem sobrescrever o dist servido pelo app original:
docker compose -f compose.persistent.yaml build
PERSISTENT_TEST_DATABASE_URL=postgresql+psycopg://universe:universe_local_only@localhost:5545/universe \
  .venv/bin/python -m unittest tests.test_persistent_universe -v
.venv/bin/python -m unittest tests.test_campaign tests.test_fleet_integration -q
.venv/bin/python scripts/persistent_smoke.py
git diff --check
```

Os testes SQL usam **schema único e descartável** no novo banco. O smoke HTTP cria
duas contas novas no servidor isolado, espera relógio real para dois níveis de
pesquisa e duas naves, despacha e espera chegada, negocia aliança e verifica
revogação/isolamento de sessão. Pode levar cerca de 7–10 minutos. Não acelera o tempo
nem injeta recursos. Não rode contra outro ambiente.

## Limitações deliberadas

Experimento local, não pronto para exposição pública. Sem recuperação de senha,
verificação de e-mail, sessões por dispositivo na UI ou rate limiter distribuído.
Credenciais Compose são somente de desenvolvimento. Um universo por instalação;
sem chat, alianças multilaterais, ranking, guildas, mercado automático ou conquista
territorial. Reservas não se abastecem sozinhas. Não há cancelamento/recall em trânsito.

Não há NPC neste universo por padrão. A IA estratégica anterior continua no cenário
Concordat opcional; ela não é apresentada como jogador humano. Carriers usam alas
abstratas; não há strike craft independentes. Expedições são uma coleta simples,
sem gerador de eventos próprio. Balanceamento de longo prazo ainda é provisório.

## Linhas de pesquisa

Research 2.0 mantém os 32 IDs e acrescenta projetos de tier, capacidade por domínio e marcos de nível. A tabela abaixo registra bônus-base; o catálogo completo e as fórmulas atuais estão em [Research 2.0](research-2.md).


| Linha | Efeito por nível |
|---|---|
| Engenharia energética (`energy_engineering`) | energy: +0.08 |
| Extração mineral (`extraction`) | mining: +0.08 |
| Automação industrial (`industrial_automation`) | processing: +0.06 |
| Manufatura avançada (`advanced_manufacturing`) | components: +0.06 |
| Computação de frotas (`computing`) | fleet_slots: +1 |
| Sensores de longo alcance (`sensor_array`) | sensors: +0.1 |
| Inteligência e espionagem (`intelligence`) | espionage: +0.15 |
| Contrainteligência (`counter_intelligence`) | counter_intelligence: +0.15 |
| Propulsão nuclear (`nuclear_propulsion`) | speed: +0.08 |
| Navegação interestelar (`navigation`) | speed: +0.04 |
| Sistemas de armas (`weapons`) | weapons: +0.08 |
| Escudos energéticos (`shields`) | shields: +0.07 |
| Blindagem estrutural (`armor`) | armor: +0.08 |
| Logística de carga (`logistics`) | cargo: +0.1 |
| Economia de combustível (`fuel_efficiency`) | fuel: +0.06 |
| Astrofísica colonial (`astrophysics`) | colonies: +1 |
| Infraestrutura automatizada (`infrastructure`) | workforce: +0.05 |
| Rede científica (`survey_network`) | research: +0.08 |
| Infraestrutura científica (`science_infrastructure`) | research: +0.08 |
| Engenharia orbital (`orbital_engineering`) | ship_speed: +0.05 |
| Arquitetura capital (`capital_architecture`) | defense: +0.06 |
| Operações embarcadas (`carrier_operations`) | carrier: +0.08 |
| Contenção estelar (`stellar_containment`) | energy: +0.06 |
| Carta interestelar (`diplomatic_charter`) | transport: +0.04 |
| Engenharia de construção (`construction_engineering`) | build_speed: +0.06 |
| Metalurgia (`metallurgy`) | alloy: +0.06 |
| Habitação planetária (`habitation`) | population: +0.1 |
| Doutrina naval (`naval_doctrine`) | weapons: +0.05 |
| Ciência de expedições (`expedition_science`) | expedition: +0.1 |
| Armazenamento modular (`storage`) | storage: +0.25 |
| Manutenção naval (`maintenance`) | fuel: +0.08 |
| Apoio populacional (`recruitment`) | recruitment: +0.08 |

## Resultado verificado nesta entrega

- Typecheck e build Docker passaram; serviços novos ficaram healthy.
- 221 testes React/Vitest e os testes Node de assets/visuais passaram. A última
  alteração de navegação também passou pelo typecheck e pelos testes focados.
- 13 testes anteriores de campanha/frota passaram. Três testes Python novos cobrem
  conteúdo/segurança, efeitos reais e um fluxo SQL com dois impérios, pesquisa nível
  2, espionagem, frete, batalha/baixas, concorrência, escrow e segunda colônia.
- Migração em schema descartável e `alembic check`: sem diferenças pendentes.
- Verificação HTTP real: duas contas novas, isolamento de planeta, CSRF, produção
  contínua, dois níveis de Computação, frota de duas naves e chegada pelo relógio
  normal, aliança bilateral, logout/revogação e login retomando o mesmo planeta.
- Chromium com dois contextos independentes: console, pesquisa, Estaleiro e Planet
  View procedural em 1440×900; console mobile em 390×844, sem overflow horizontal.
  Nenhum erro de página. SwiftShader foi usado apenas para funcionamento visual.
- Capturas locais em `tmp/persistent-universe-qa/`: `player-1.png`, `player-2.png`,
  `research.png`, `shipyard.png`, `planet.png`, `mobile.png`, `browser.json`.
  Não são dados de produção nem benchmark de GPU. Aprovação artística continua humana.

Não houve auditoria de segurança de produção, teste de carga, balanceamento de
meses ou campanha militar manual completa pelo browser. Esses trabalhos continuam
necessários antes de qualquer exposição pública.
