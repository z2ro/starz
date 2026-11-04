# Fleet Gameplay Integration 01

Base: main `520ff30` (PR #11). Branch: `feat/fleet-gameplay-integration`.

## Contratos e balanceamento provisório

Dez hulls convencionais em `game_data/ships/ships.yaml`; Horizon não teve valores
alterados. As nove adições são **PROVISÓRIAS**. Só existem duas tecnologias navais:
Engenharia orbital e Propulsão nuclear. Não foram criadas tecnologias ou habilidades.

| Classe / hull ID | Massa¹ | Tripulação | Construção (s) | Liga / Componentes | Propulsão | Pesquisa requerida² |
|---|---:|---:|---:|---:|---|---|
| Horizon / scout_hull | 10 | 3 | 30 | 16 / 8 | Química ou nuclear | Estaleiro existente |
| Wayfarer / wayfarer_hull | 24 | 8 | 60 | 36 / 18 | Química ou nuclear | Orbital |
| Vanguard / vanguard_hull | 32 | 10 | 90 | 54 / 28 | Química ou nuclear | Orbital |
| Sentinel / sentinel_hull | 52 | 16 | 150 | 90 / 48 | Nuclear | Nuclear |
| Odyssey / odyssey_hull | 65 | 12 | 180 | 110 / 70 | Nuclear | Nuclear |
| Aegis / aegis_hull | 85 | 24 | 240 | 160 / 90 | Nuclear | Nuclear |
| Spearhead / spearhead_hull | 120 | 32 | 330 | 230 / 130 | Nuclear | Nuclear |
| Leviathan / leviathan_hull | 190 | 48 | 480 | 360 / 210 | Nuclear | Nuclear |
| Atlas / atlas_hull | 210 | 60 | 540 | 400 / 260 | Nuclear | Nuclear |
| Dominion / dominion_hull | 320 | 90 | 720 | 620 / 400 | Nuclear | Nuclear |

¹ Valor de domínio sem unidade física declarada. Massa já influencia consumo de
viagem na engine. ² Todos exigem distrito `orbital_shipyard`; propulsor e combustível
mantêm seus próprios desbloqueios. A engine exige pelo menos uma unidade de combustível
local para construir, mas não a desconta nessa ação. Só o custo do hull é cobrado.
Duração é tempo fixo de montagem, não trabalho industrial. Cada montagem ocupa um slot.

As funções militares/científicas/logísticas são identidade da classe: não concedem
armas, dano, escudos, carga, pesquisa extra ou strike craft. A engine ainda suporta
uma nave por frota. Stargrave continua apenas na galeria, sem hull, motor ou combustível.

## Correspondência e renderização

`visual/ShipDesignRegistry.ts` é o contrato puro de 11 designs: ID de hull + classificação
+ função exatos. Stargrave possui hull nulo. IDs desconhecidos ou metadados divergentes
não recebem outro modelo. O adapter continua puro, serializável e sem Three/API.
As factories aprovadas de `FleetStudy` são reutilizadas, sem alterações em geometrias,
paleta, materiais ou shaders.

Estaleiro: lista data-driven, atributos/custos/requisitos reais, compatibilidade em
cascata hull → propulsão → combustível, custo/crew/slot local e busy. A ação continua
`execute('build-ship', {planet_id, hull_id, propulsion_id, fuel_id})`. Backend é autoridade.
Preview lazy usa o renderer/pipeline existente, câmeras de inspeção e cache por design.
Somente modelos inspecionados são alocados; o lab preserva sua galeria completa padrão.
Falha WebGL mantém os atributos e a construção disponíveis, com aviso explícito.

Frotas: a inspeção usa o hull da nave encontrada pelo ID persistente em `fleet.ship_ids`;
status, coordenadas, missão e destino permanecem os da API. Também há inventário sem
frota, sem alegar presença local. Preview não é formação, órbita ou posição real.

Planet View/Space Scene Live: o adapter reconhece os dez hulls. Mantém um representante
identificado de presença comprovada no sistema; escala/posição são apresentação DEFAULT,
não mecânica orbital. Trocar hull/população não recria o planeta. Cada modelo inspecionado
é cacheado e descartado no unmount. Lua/estação continuam UNKNOWN e ocultas. IMAGE,
persistência da preferência, fallback e controle de snapshots permanecem intactos.

Sem timestamp no snapshot da API, naves sem frota e sem `observedAt` explícito continuam
UNKNOWN para presença pronta. TRANSIT, sistema remoto, IDs conflitantes e hull desconhecido
ficam ocultos. Presença no sistema não prova órbita do planeta selecionado.

## Validação

`npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
`TEST_DATABASE_URL=... .venv/bin/python -m unittest discover -s tests -v`.
Os testes PostgreSQL criam/removem schemas próprios. Catálogo, construção das dez
classes, custos, bloqueios, propulsão/fuel, slots, persistência/reload e viagens são
cobertos. Fixtures em `tests/fixtures/fleet-api-catalog.json` são verificadas contra o YAML.
Testes React/CPU cobrem seleção/payload, registro, trânsito, cache, geografia e disposal.

Browser QA usa Chromium/SwiftShader, API real e PostgreSQL com schema descartável.
Fixtures têm pesquisas, recursos, tripulação e reservas de combustível preparados
somente nesse schema; construção e viagens usam a engine existente. Não são saves reais.
Capturas desktop/mobile de Wayfarer, Atlas e Dominion: `tmp/fleet-gameplay-integration-qa/`.
Serviço temporário de QA em 8011; o serviço existente em 8010 não é interrompido.
Sem benchmark de GPU física. Aprovação artística e do balanceamento é do responsável.

Resultado final: 214 testes Vitest + 11 Node, 75 testes Python (incluindo PostgreSQL),
typecheck, build, validação de 35 itens de conteúdo e diff check passaram.
Browser QA em 1920×1080, 1440×900, 1366×768 e 390×844: 40 capturas, construção HTTP
200, mesmo canvas entre seleções, sem overflow horizontal ou erros JS/shader registrados.
A galeria original também foi conferida no browser (`lab-regression.png`).
A revisão motivou o preview fixo durante scroll de Frotas, correção do badge herdado
e identificação visível do modelo no preview.

Deploy: reiniciar o processo da API para reler o YAML e recarregar o frontend para
renovar o catálogo em cache. Não há migrations nem alterações no código da engine/API.
Os novos valores ainda exigem revisão de balanceamento; a aprovação artística não
é substituída pelos testes. O build mantém o aviso de chunk maior que 500 kB.
