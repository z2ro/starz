# Research UX 2.1 and Planetary Defense 1.0

## Isolated development

```sh
docker compose -f compose.defense.yaml up -d --build --wait
```

Open http://localhost:8032/#/defenses (research: `#/research`). Register two accounts in separate browser profiles to test multiplayer. This Compose uses its own PostgreSQL database on 5547 and `starz-defense-1_defense-save` volume. It does not migrate the existing 8030/8031 services. Never remove volumes to update. App startup runs Alembic; migration `d04d00000001` adds planet-local JSONB defense state, preserving research levels and existing saves.

## Research planning

Selecting a technology highlights its ancestor chain, including cross-domain prerequisites. Four textual/visual states distinguish available, locked, active and completed projects. Domain capacity, tier access, local infrastructure, levels, costs and effects remain authoritative Research 2.0 quotes.

**Plan Research** accepts a target level. The server computes an ordered prerequisite list using actual technology requirements, required levels, tier advancement and unlock relations. Missing local facilities and empire domain capacity are listed separately. Already-paid active work has zero additional cost. The subtotal excludes construction and does not promise a fixed ETA at future research rates. Planning neither reserves resources nor starts projects; each research action still requires the player's explicit launch. Three independent active domains are preserved.

## Catalog and provisional balance

Numbers below are base values; alloy/components/volatiles are the real resource IDs. Duration is base seconds, divided by `1 + build_speed`, rounded upward. A batch occupies one shared construction slot for its total duration. Costs multiply by quantity and round upward once per resource.

| Structure ID | Cost alloy/components | Seconds | HP / damage / shield | Technology requirements | Effective industry | Energy / workers |
|---|---:|---:|---|---|---:|---:|
| point_defense | 18 / 6 | 30 | 100 / 12 / 0 | naval_doctrine 1 | 1 | 1 / 1 |
| orbital_missile_battery | 50 / 18 | 70 | 160 / 32 / 0 | Military II, sensor_array 1, weapons 2 | 2 | 2 / 2 |
| heavy_em_cannon | 100 / 35 | 120 | 300 / 70 / 0 | Military III, metallurgy 1, weapons 3 | 4 | 5 / 3 |
| planetary_shield | 90 / 45 | 150 | 200 / 0 / 350 | Military III, shields 2, energy_engineering 2 | 4 | 8 / 3 |
| orbital_platform | 200 / 90 | 240 | 600 / 85 / 0 | Military IV, capital_architecture 2 | 8 | 9 / 6 |
| missile_interceptor | 65 / 25 | 90 | 130 / 0 / 0 | Military III, computing 2, shields 1 | 3 | 3 / 2 |

The YAML is authoritative, including any additional `requires` relations. Effective industrial capacity and operation use the existing energy/workforce coverage. Pending structures reserve future demand at launch. Infrastructure is checked at construction start; paid jobs retain existing offline construction semantics if facilities are subsequently damaged.

Ammo is manufactured, stored and consumed on the specific planet:

| Recipe | Alloy / components / volatiles | Base seconds | Requirement |
|---|---:|---:|---|
| anti_ship_missile | 2 / 1 / 1 | 8 | Military II |
| interceptor_missile | 3 / 1 / 2 | 10 | Military III |
| strategic_missile | 6 / 2 / 5 | 20 | Military II, sensor_array |

Each recipe needs effective industry 2. Batteries fire one anti-ship missile per combat round; no ammunition means no shot. Each operational interceptor installation intercepts up to two strategic missiles per salvo, consuming one interceptor round per intercepted missile. It does not intercept ordinary ship weapon fire.

## Fleet combat

Attacks require war and a real target planet. War is rechecked at arrival. Actual ready local ships and surviving defenses participate, not every ship in the system. Fleet-to-planet assignment is explicit after a move to an owned world; legacy ships at their known creation location defend their origin planet only. Ships in transit do not defend. Returns deliver cargo to the exact origin planet, including multi-planet systems.

Combat resolves up to six simultaneous salvos. Every surviving unit selects targets according to its real class modifiers and projected remaining durability. Light/medium/capital profiles distinguish ship classes; point defense favors light ships (2×, 1×, 0.3×), EM cannons favor capitals (0.3×, 1×, 2×), batteries favor medium/capital targets (0.7×, 1.4×, 1.2×), and platforms cover all classes (1×, 1.3×, 1.3×).

Ship damage is `(weapon_damage + carrier_capacity × 5 × (1 + carrier_bonus)) × (1 + weapons_bonus)`. Defense damage additionally multiplies by `(1 + defense_bonus)` and local operational coverage. Planetary shield charge absorbs incoming damage first, then personal ship shields, then hull damage divided by `(1 + armor_bonus)`. Personal ship shields reset per engagement; planetary charge persists and regenerates at the catalog rate (initially 1/s per generator), scaled by coverage. Shield capacity includes actual shield research.

Surviving hull HP and defense HP persist; destroyed entities are removed. Fortification repair costs/time are `ceil(base × 0.5 × missing_HP_fraction)`. A destroyed repair target is never resurrected. Docked ships receive shared passive yard maintenance of 2 raw HP/s per shipyard level, scaled by coverage; there is no separate repair invoice. Fleet rows display damage and explain maintenance.

Only surviving attackers with no remaining local opposition can loot, capped at 25% of each stock and surviving cargo capacity. Loot is credited on return, never immediately. No planet capture, tactical formations or 3D combat are introduced.

## Strategic missile attacks

A powered missile battery, manufactured ammunition, war and another owner's planet are required. Range is catalog range (12 systems) × `(1 + sensors_bonus)`. Travel seconds are `max(30, ceil(distance × 45 / (1 + speed_bonus)))`. A salvo contains 1–50 rounds. Ammo is spent atomically at dispatch; peace before arrival causes self-destruction, not a surprise attack.

After interception, each missile deals catalog damage (100) × `(1 + weapons_bonus)`. Planetary shields absorb first; surviving forts take armor-adjusted damage, prioritizing the selected type if present. Once no forts remain, additional penetrating damage destroys ordinary building levels at 200 damage per level; housing is excluded. Strategic strikes do not loot.

## Persistence and concurrency

Each planet has quantities represented by individually identified HP/charge records, an ammunition inventory and paid timestamped jobs. UUIDs and job completion are persisted exactly once. Legacy orbital battery levels convert once into point-defense units and clear the old district contribution; existing paid battery jobs finish as point defenses. The old build endpoint remains an alias rather than creating duplicate defenses.

The existing universe transaction advisory lock serializes spending, attacks and settlement across owners. Ownership is checked on every operation. Defense completion timestamps join global event boundaries, so a remote colony's new energy/workforce demand cannot retrospectively affect research. Reports retain actual before/after units, losses, absorbed damage, ammunition and loot (last 30 per empire).

Limits: 50 units per batch/salvo, 1,000 structures per planet, 10,000 rounds per ammo type. Balance is provisional. The global lock favors correctness over MMO throughput. Stargrave and advanced megastructures remain outside conventional construction.

## Validation

```sh
npm run typecheck
npm test
# If procedural geometry tests hit their existing timeout under parallel load:
npx vitest run --config vitest.config.ts --maxWorkers=1
PERSISTENT_TEST_DATABASE_URL=postgresql+psycopg://defense:defense_local_only@localhost:5547/defense \
  .venv/bin/python -m unittest discover -s tests -p test_planetary_defense.py
.venv/bin/python -m unittest discover -s tests
# Isolated Vite build, preserving the original service's frontend/dist:
docker compose -f compose.defense.yaml build universe-app
git diff --check
```

SQL tests create temporary schemas in the isolated database. They exercise two owners, concurrent spending, offline quantities, idempotence, missile ammunition/interception, real fleet losses, exact target planet selection and global research boundaries. CPU tests cover planning, class modifiers, shield absorption, repairs and locality. UI tests cover plan requests, real batch payloads and blocked requirements.

`scripts/defense_qa.cjs` creates isolated accounts at 8032 and waits for a real research project and two defense constructions through the UI, with no clock/resource injection. Supply `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` for installed Playwright/Chromium. Captures are in `tmp/defense-1/`. Browser PvP combat was not played manually; its transaction/timestamp path was exercised by SQL tests. Physical mobile devices and long-term balance remain unverified.

Release checks: 251 frontend tests passed with one Vitest worker, plus all four Node visual/asset/icon suites. Plain Python discovery ran 109 tests (29 environment-dependent skips); the isolated PostgreSQL defense suite separately passed all 11 tests, and the five existing persistent-universe PostgreSQL regressions passed. Typecheck and the Docker/Vite production build passed. The initial parallel frontend run hit the existing 5-second procedural scene timeout; no test timeout or generator was changed. Chromium verified the real research-to-two-defenses workflow and ownership rejection, then read-only desktop/mobile captures of the final UI. Combat and interception were verified through actual engine/store transactions in disposable SQL schemas, not a manually played browser war.
