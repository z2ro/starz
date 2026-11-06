# STARZ Research 2.0

## Audit and scope

The persistent universe already had 32 repeatable IDs, exponential quotes, local stock spending, empire levels in PostgreSQL `empire_progress.payload`, a relational completed-discovery set and one relational active research row. Production, combat, travel, colonization and ship construction already consume the central `effect()` evaluator. This release extends those mechanisms rather than replacing them. Optional Concordat and the original one-shot catalog retain their execution path.

The design takes infrastructure-gated progression from the [official Sins II research overview](https://forums.sinsofasolarempire.com/532748/video-blog-technological-domination) and combines it with repeatable progression. All thresholds, costs and effects below are STARZ balance decisions, not copied game rules.

## Scientific organization

Civil: industry, logistics and development. Military: naval doctrine, combat protection and capital architecture. Fundamental: energy, computation, materials, sensors and stellar science.

32 existing research lines retain their IDs and levels. Twelve one-time advancement projects add tiers II–V in each domain. Tier I is the starting foundation, requiring capacity 1; it has no additional paid advancement project. Tiers II–V require capacity 3/6/10/15, at least one specialized facility in the empire, and their advancement project. Advancements themselves require their target capacity, the preceding advancement, and a founding line at levels 1/2/3/4. High tiers add explicit cross-domain dependencies. Technologies remain inspectable at all tiers.

One active program per domain, at most three simultaneous programs. These are active slots, not a future-order backlog. No cancellation or speculative spending queue. Resources are deducted once from the selected owned planet. Research progress and benefits belong to the empire.

## Infrastructure and rates

| Stable ID | Presentation | Domain capacity per level | Base rate per level | Workers / energy |
|---|---|---|---|---|
| research_lab | Planetary Research Center | +1 in each domain | Existing catalog rate, divided equally across three domains | Existing costs/constraints retained |
| civil_lab | Civil Engineering Laboratory | +1 Civil | 1.5 work/s Civil | 6 / 4 |
| military_lab | Military Research Complex | +1 Military | 1.5 work/s Military | 6 / 4 |
| fundamental_lab | Fundamental Science Institute | +1 Fundamental | 1.5 work/s Fundamental | 6 / 4 |

Each specialized building costs 35 alloy + 12 components and takes 45 base seconds. It requires an existing local research center. Building levels use the existing progressive construction formulas. Capacity and effective work rates aggregate across owned planets. Each planet contributes `(general_work / 3 + specialized_work) × (1 + research_bonus) × min(energy_coverage, workforce_coverage)`. Idle domains do not loan their allocated general work to active domains. This keeps concurrent throughput bounded and specialization meaningful. Capacity remains installed capacity; insufficient energy/workers can pause actual throughput.

Existing explicit per-technology `infrastructure` requirements remain local to the paying planet. Domain access and speed aggregate empire-wide. Active programs continue offline with available infrastructure; capacity and gates are checked on launch, not used to erase paid progress later.

## Formulas and real effects

`next_cost[r] = ceil(base_cost[r] × cost_growth^current_level)`; `work = ceil(base_work × work_growth^current_level)`; ETA is remaining work / effective domain rate (or paused). Repeatable level cap 50, breakthroughs cap 1. Default growths 1.7 and 1.55. Advancement projects have one-time base costs. Effects are additive across technologies, including unlocked milestone contributions. Quotes and the engine share `technology_effects()`.

| Effect | Engine consequence |
|---|---|
| mining, processing, alloy, components | Real resource outputs, constrained by inputs/energy/workforce |
| energy | Energy generation × (1 + bonus) |
| energy_efficiency | Energy demand ÷ (1 + bonus) |
| workforce | Industrial workforce demand ÷ (1 + bonus) |
| research | Scientific work rate × (1 + bonus) |
| build_speed, ship_speed | Building / ship assembly duration ÷ (1 + bonus) |
| fleet_slots | + operational fleet slots |
| speed | Actual mission travel time ÷ (1 + bonus) |
| weapons, armor, shields | Combat power multiplier `1 + weapons + armor/2 + shields/2` |
| defense | Existing battery contribution; no new defense system |
| carrier | Existing carrier wing power contribution |
| cargo, fuel, transport | Real cargo capacity / launch fuel, with transport-specific fuel bonus |
| sensors, espionage, counter_intelligence | Real intelligence report strength / opposition |
| colonies | Empire colony limit |
| population, recruitment | Population capacity / recruitment cost |
| expedition | Real expedition yield |
| storage | Per-resource ceiling `100000 × 1.7^(4 × storage_bonus)` |

Extraction, weapons, energy and logistics have additional cumulative milestones at levels 3 and 5. A milestone adds the declared bonus once, not once per subsequent level. Costs, rates and losses remain provisional balance; full late-game pacing requires playtesting.

## Unlocks and future contracts

Buildings retain real prerequisites, including automation → manufacturing and engineering → shipyard. Advanced hulls explicitly require advancement projects: Vanguard/Sentinel Military II; Odyssey Fundamental III; Aegis Military III; Spearhead/Leviathan Military IV; Atlas/Dominion Military V, plus their existing technology/facility requirements. `unlocks` is generated from these explicit relations and shown as consequences; all required conditions still apply. Horizon and Wayfarer retain the early opening.

Typed `future_unlocks` reserve four names: planetary_shields, missile_defense, orbital_platforms, stellar_megastructures. They are labeled unimplemented contracts, never build buttons or current gameplay capabilities. Existing battery mechanics are preserved. Stargrave is not added as a conventional hull or assigned fuel/engines.

## Persistence, migration and concurrency

Alembic revision `d03c00000001` versions the existing JSONB research payload; no new parallel level store or account selector is introduced. On first authoritative load, the deterministic adapter moves a legacy active job into its declared domain with exactly the same remaining work. A legacy rate flag retains its previous full research rate until that job finishes. Existing levels imply completed advancement projects up to the highest previously reached tier in that domain. A paid legacy advanced project also grants its implied tiers when it completes. Existing ships, buildings and discoveries are not removed. Normalized jobs are persisted in the same empire progress transaction.

The relational research row remains a compatibility projection of the earliest finishing program. New consumers use `research_domains`; shared operations and the research UI show all domains. Completion updates levels and the relational completed set exactly once, then clears the job. The universe transaction lock continues to serialize spending and cross-empire settlement. Ownership validation remains per request. Settlement uses the earliest event boundary; newly completed bonuses do not retroactively apply to colony production before that boundary.

Downgrade only removes the schema marker; do not run an old engine against unresolved multi-domain programs. Drain programs or restore a backup when rolling back executable code. Future domain reassignment needs a versioned data migration, not a casual content edit.

## Validation and isolated startup

`docker compose -f compose.research.yaml up -d --build --wait` opens **http://localhost:8031/#/research**, with a dedicated PostgreSQL database on 5546 and separate volume. The existing 8030 universe and its saves are not migrated by validation. From a clean checkout the app runs Alembic on startup. No new npm dependencies.

Focused rules cover domain occupancy, atomic spending, milestones, real facility construction, all five tiers, all ten conventional ship builds, legacy remaining work and idempotent completion. PostgreSQL tests use temporary schemas in the isolated research database: independent accounts, concurrent requests, offline completion, migrations and ownership. Frontend tests cover parallel domain actions, real payloads, locked inspection and cross-domain dependencies.

Commands: `npm run typecheck`, `npm test`, Docker build, `git diff --check`; Python unit discovery and `PERSISTENT_TEST_DATABASE_URL=... .venv/bin/python -m unittest discover -s tests -p test_persistent_universe.py`. Screenshots and browser results: `tmp/research-2/`. Browser QA starts three real projects and inspects blocked advanced nodes at 1440×900 and 390×844. No GPU benchmark or screenshot matrix.

## Complete catalog and provisional balance

All costs below are level-zero alloy/components. Work is base work, not fixed seconds. Add the matching tier advancement to ordinary lines above tier I. `A:B` means technology A at level B. Additional local facility requirements appear in the last column.

| ID / name | Domain / tier | Kind | Alloy / components | Base work | Explicit prerequisites / infrastructure |
|---|---|---|---|---|---|
| `energy_engineering` · Engenharia energética | fundamental 1 | repeatable | 20 / 8 | 60 | Foundation |
| `extraction` · Extração mineral | civil 1 | repeatable | 25 / 11 | 80 | Foundation |
| `industrial_automation` · Automação industrial | civil 2 | repeatable | 30 / 14 | 100 | extraction:2 |
| `advanced_manufacturing` · Manufatura avançada | civil 3 | repeatable | 35 / 17 | 120 | industrial_automation:2, local processor:2 |
| `computing` · Computação de frotas | fundamental 1 | repeatable | 40 / 8 | 140 | Foundation |
| `sensor_array` · Sensores de longo alcance | fundamental 2 | repeatable | 20 / 11 | 60 | computing:1 |
| `intelligence` · Inteligência e espionagem | fundamental 3 | repeatable | 25 / 14 | 80 | sensor_array:2 |
| `counter_intelligence` · Contrainteligência | fundamental 3 | repeatable | 30 / 17 | 100 | computing:2 |
| `nuclear_propulsion` · Propulsão nuclear | fundamental 2 | repeatable | 35 / 8 | 120 | orbital_engineering:2 |
| `navigation` · Navegação interestelar | fundamental 2 | repeatable | 40 / 11 | 140 | computing:2 |
| `weapons` · Sistemas de armas | military 1 | repeatable | 20 / 14 | 60 | naval_doctrine:1 |
| `shields` · Escudos energéticos | military 3 | repeatable | 25 / 17 | 80 | energy_engineering:3, local research_lab:2 |
| `armor` · Blindagem estrutural | military 2 | repeatable | 30 / 8 | 100 | metallurgy:2 |
| `logistics` · Logística de carga | civil 1 | repeatable | 35 / 11 | 120 | Foundation |
| `fuel_efficiency` · Economia de combustível | civil 2 | repeatable | 40 / 14 | 140 | logistics:2 |
| `astrophysics` · Astrofísica colonial | civil 3 | repeatable | 20 / 17 | 60 | orbital_engineering:1 |
| `infrastructure` · Infraestrutura automatizada | civil 3 | repeatable | 25 / 8 | 80 | industrial_automation:1 |
| `survey_network` · Rede científica | fundamental 3 | repeatable | 30 / 11 | 100 | sensor_array:2 |
| `science_infrastructure` · Infraestrutura científica | fundamental 4 | repeatable | 35 / 14 | 120 | survey_network:2, local research_lab:3 |
| `orbital_engineering` · Engenharia orbital | fundamental 1 | repeatable | 40 / 17 | 140 | Foundation |
| `capital_architecture` · Arquitetura capital | military 4 | repeatable | 20 / 8 | 60 | naval_doctrine:3, nuclear_propulsion:2, local orbital_shipyard:2 |
| `carrier_operations` · Operações embarcadas | military 5 | repeatable | 25 / 11 | 80 | capital_architecture:2, local orbital_shipyard:3 |
| `stellar_containment` · Contenção estelar | fundamental 5 | repeatable | 30 / 14 | 100 | carrier_operations:3, science_infrastructure:3, local research_lab:4 |
| `diplomatic_charter` · Carta interestelar | civil 4 | repeatable | 35 / 17 | 120 | computing:1 |
| `construction_engineering` · Engenharia de construção | civil 1 | repeatable | 40 / 8 | 140 | Foundation |
| `metallurgy` · Metalurgia | fundamental 2 | repeatable | 20 / 11 | 60 | extraction:1 |
| `habitation` · Habitação planetária | civil 1 | repeatable | 25 / 14 | 80 | Foundation |
| `naval_doctrine` · Doutrina naval | military 1 | repeatable | 30 / 17 | 100 | orbital_engineering:1 |
| `expedition_science` · Ciência de expedições | fundamental 4 | repeatable | 35 / 8 | 120 | survey_network:1 |
| `storage` · Armazenamento modular | civil 2 | repeatable | 40 / 11 | 140 | logistics:1 |
| `maintenance` · Manutenção naval | civil 5 | repeatable | 20 / 14 | 60 | industrial_automation:1 |
| `recruitment` · Apoio populacional | civil 3 | repeatable | 25 / 17 | 80 | habitation:1 |
| `civil_tier_2` · Avanço Civil 2 | civil 2 | breakthrough | 40 / 20 | 120 | construction_engineering:1 |
| `civil_tier_3` · Avanço Civil 3 | civil 3 | breakthrough | 120 / 60 | 360 | civil_tier_2:1, construction_engineering:2 |
| `civil_tier_4` · Avanço Civil 4 | civil 4 | breakthrough | 360 / 180 | 1080 | civil_tier_3:1, construction_engineering:3, fundamental_tier_3:1 |
| `civil_tier_5` · Avanço Civil 5 | civil 5 | breakthrough | 1080 / 540 | 3240 | civil_tier_4:1, construction_engineering:4, fundamental_tier_4:1 |
| `military_tier_2` · Avanço Militar 2 | military 2 | breakthrough | 40 / 20 | 120 | naval_doctrine:1 |
| `military_tier_3` · Avanço Militar 3 | military 3 | breakthrough | 120 / 60 | 360 | military_tier_2:1, naval_doctrine:2 |
| `military_tier_4` · Avanço Militar 4 | military 4 | breakthrough | 360 / 180 | 1080 | military_tier_3:1, naval_doctrine:3, fundamental_tier_3:1 |
| `military_tier_5` · Avanço Militar 5 | military 5 | breakthrough | 1080 / 540 | 3240 | military_tier_4:1, naval_doctrine:4, fundamental_tier_4:1 |
| `fundamental_tier_2` · Avanço Fundamental 2 | fundamental 2 | breakthrough | 40 / 20 | 120 | energy_engineering:1 |
| `fundamental_tier_3` · Avanço Fundamental 3 | fundamental 3 | breakthrough | 120 / 60 | 360 | fundamental_tier_2:1, energy_engineering:2 |
| `fundamental_tier_4` · Avanço Fundamental 4 | fundamental 4 | breakthrough | 360 / 180 | 1080 | fundamental_tier_3:1, energy_engineering:3, civil_tier_3:1 |
| `fundamental_tier_5` · Avanço Fundamental 5 | fundamental 5 | breakthrough | 1080 / 540 | 3240 | fundamental_tier_4:1, energy_engineering:4, military_tier_4:1 |

## Limits

No pending research backlog, physical server scaling benchmark, new defense mechanics, megastructure construction or cancellation. Capacity/cost pacing and milestone strength remain provisional. Browser validation is Chromium emulation, not physical mobile devices. Existing saves retain their levels, so established empires can legitimately hold tiers that new empires must develop.

## Release verification

- 248 Vitest tests and all four Node asset/planet/icon suites passed. A pre-existing 5-second procedural geometry timeout occurred under parallel load; final verification used one worker, without modifying that test or its timeout.
- 98 Python tests discovered, with 26 environment-dependent tests skipped in plain discovery. The dedicated PostgreSQL suite separately passed all five tests in temporary schemas, including Alembic upgrade/check, independent owners, concurrent domain starts, legacy-job promotion, offline completion, and the colony production boundary regression. The six focused Research 2.0 rule tests also passed.
- Typecheck, isolated Docker/Vite build and diff check passed.
- Chromium started three real programs through the UI, inspected advanced blocked research, verified a second account cannot read the first account's planet, and checked mobile overflow. A previously started account completed all three programs with the browser closed across an application restart, using real elapsed time.
- Screenshots: `tmp/research-2/desktop.png` and `mobile.png`; structured browser and real offline results are alongside them. `scripts/research_qa.cjs` reproduces the brief UI check on newly created accounts at localhost:8031, with `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` supplied for the installed browser tooling.
