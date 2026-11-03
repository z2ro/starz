# Visual State Adapter 01

Pure offline `createVisualDescriptor(state, catalog?, { observedAt? })` in
`frontend/src/visual-state/VisualStateAdapter.ts`. Base: main `d0dfd86`, PR #7 merged.
No API calls, DOM, Three.js objects, mutation, clock, random, UI or route integration.
The labs and their generators are unchanged. Fixtures are test inputs, never live data.

## Contract audit

Sources: `starz/api.py:state_snapshot/planet_list`, `starz/universe.py:generate_system`,
`starz/db/models.py`, `starz/db/store.py:load_state`, `starz/simulation.py`,
`game_data/{planets,stars,districts,ships,colonization}` and `docs/data-driven.md`.

| Gameplay field | Entity / origin / persistence / unit | Visual field / rule | Provenance |
| --- | --- | --- | --- |
| `active_planet.id` | Selected planet UUID, PostgreSQL `planet_state` | Primary planet identity | GROUNDED |
| `system.id`, `system.planet.id` | Procedural IDs, regenerated from universe seed/coordinates/catalog; not DB UUIDs | System key; secondary planet identity | GROUNDED |
| `system.x/y`, `active_planet.planet_index` | Integer grid coordinates and zero-based index; persisted system + planet row | Identity fallback, never array position | GROUNDED |
| `system.planet.water` | Procedural percentage, 0–100 per data validator/UI; not a liquid-water map or ice inventory | `/100` becomes sea-level slider, **not actual ocean fraction** | HEURISTIC |
| `system.planet.temperature` | Positive generated scalar; UI contract displays K (`PlanetInspector`), not a temperature map | Visual thermal transfer below | HEURISTIC |
| `geological_activity` | Nonnegative procedural scalar; current YAML range 0–1, not a universally enforced upper bound | Only calibrated 0–1 accepted; relief `.25 + .65*a` | HEURISTIC |
| `atmosphere` | Procedural profile string from YAML | Explicit profile strength, family palette | HEURISTIC / DEFAULT |
| `gravity`, `usable_surface` | UI conventions g and percent; procedural, not independently persisted | Retained environmental facts; no geometry rescaling | GROUNDED |
| `mass`, `radius`, `orbital_distance`, `radiation`, `magnetic_field`, `mineral_profile` | Generated scalars; backend has no explicit physical unit metadata | Retained finite values; no invented km, Earth/Solar units, radiation units or abundance conversion | GROUNDED |
| `system.star.*` | Class, mass, luminosity, age, activity generated from stellar YAML | Retained facts; **not** converted to photometric lighting | GROUNDED |
| `population.total` | Current selected planet count, loaded from `planet_state.population_total`, API transaction advances engine | Presence and bounded light hint; never imperial sum | GROUNDED / HEURISTIC |
| `planets[].population_total` | Persisted per-world roster snapshot; may lag active engine state | Fallback only for matching UUID when direct total is absent | GROUNDED |
| `districts` | Current selected planet levels, `planet_district`; not imperial | Known local levels support a small light-intensity increment | HEURISTIC |
| `ships` | **Imperial inventory**, snapshots of hull/crew/mass, readiness epoch seconds; persistent | Unique real ship IDs, explicit design mapping | GROUNDED / HEURISTIC |
| `ships.system_x/y`, `origin_planet_id` | Nullable persisted construction location/origin, passed through API, omitted from legacy frontend `Ship` type | Optional adapter input extension; origin is historical, not current orbit | GROUNDED |
| `fleets.ship_ids`, `status`, `x/y` | Imperial persistent membership/status; ARRIVED position is current system, TRANSIT position remains origin until arrival | Local system presence only; no persistent planet orbit | GROUNDED |
| `destination_x/y`, `arrival_at`, `mission`, `target_planet_index` | Destination/contracted epoch seconds and order; target index only for COLONIZE | Never used to claim current presence at destination | GROUNDED |
| `districts.orbital_shipyard` + catalog | Explicit district description says orbital construction structure | Infrastructure evidence; does **not** map to lab service outpost | GROUNDED / UNKNOWN |
| `shipyard_slots` | Derived local capability, not an entity | Ignored as station evidence | UNKNOWN |
| Moon / station entity / actual planet orbit | No matching persistent entity or API contract | UNKNOWN, presentation hidden | UNKNOWN |
| Sun direction, scale, cloud coverage, moisture, warp | No measured data in snapshot | Existing lab defaults, explicitly identified | DEFAULT |

The physical world is regenerated from universe seed and YAML on each read; changing
catalog archetypes can change it. The adapter's seed controls a new visual geography,
not an undisclosed canonical terrain map. Snapshot time, universe UUID/seed, atmospheric
pressure and satellite/orbital slots are **not** exposed. `apiRequest<T>` is a cast,
not schema validation; the adapter checks the numerical domains it consumes but is
not a general JSON parser. Typed input remains required for object/array shapes.

## Descriptor and provenance

Full exported types: `frontend/src/visual-state/types.ts`:

- `identity`: nullable system key, planet key and stable visual seed.
- `planet`: nullable family, complete finite generator parameters, nullable environment,
  atmospheric visibility/color/strength.
- `star`: nullable class and scalar values, without inferred units.
- `civilization`: PRESENT/ABSENT/UNKNOWN, nullable local population/level signal,
  light permission and bounded intensity.
- `ships`: inventory coverage, unique entities with ID/hull/fleet, quantity 1,
  current-system/transit/remote/unknown presence, context, design, visibility and reason.
- `infrastructure`: grounded district evidence plus UNKNOWN, nonrepresentable station.
- `moon`: UNKNOWN and hidden.
- `presentation`: geographic enable flag, fallback family, lighting/scale defaults.
- `diagnostics`: field, source paths, rule, serializable result and provenance status.

GROUNDED is an input fact. HEURISTIC is a documented visual interpretation. DEFAULT
is a presentation choice. UNKNOWN is unavailable/invalid/ambiguous information.
`visible: false` is a presentation decision, not proof of physical absence. Only
an explicit local population of zero becomes ABSENT. Empty known ship inventory
differs from unavailable inventory. Missing IDs do not get invented identities.

## Mapping rules v1

Identity precedence: persistent active planet UUID > procedural planet ID > integer
system coordinates + planet index. System uses API ID, else coordinates. Seed is
`starz:visual:v1:` plus the JSON tuple `[systemKey, planetKey]`; no hash collision
is introduced here, and the generator already hashes strings. Display names,
population and districts do not participate. A contradictory matching roster row
invalidates planet identity and local civilization context. A missing identity
hides the planet. Promoting a fallback identity to a newly available UUID changes
the seed; runtime integration must keep the identity source stable. No universe
namespace is available, so procedural-only fallbacks can coincide across universes.

Family precedence: valid temperature below **273.15 K -> Frozen**, even if water is
unknown. Otherwise require valid temperature and water: **>=75% Oceanic**, **<=20%
Desert**, else Terran. Missing/invalid values -> unknown family. These thresholds
are an artistic taxonomy, not the colonization engine's viability rules. A fallback
Terran preset remains tagged DEFAULT; it does not establish an Earth-like world.

Water is validated in [0,100], then clamped after division by 100. Temperature is
positive finite K, transferred by `clamp((T-180)/160, 0, 1)`; Frozen capped at 0.28
for visible ice. Geological activity must be in the current calibrated [0,1];
out-of-range values become unknown, not silently accepted as physical facts.
Missing values use existing family parameters. Cloud/moisture/continent/warp defaults
are not climate measurements. Glacier/ice or actual ocean-area fractions require
sampling the generator later; this adapter computes neither.

Atmospheric profiles: `thin nitrogen -> .45`, `temperate nitrogen -> 1`,
`dense methane -> .8`. Those are artistic strengths, not pressure measurements;
color comes from existing family palettes. Unsupported/missing profile is retained
as a fact when available but its atmospheric presentation is hidden/UNKNOWN.
No radiation-to-opacity or luminosity-to-exposure formula is assumed.

Civilization needs a safely identified active context. Direct local total wins;
matching roster is used only if the total is absent, not if it is invalid. Only
nonnegative safe-integer counts are accepted. Positive `p` permits sparse simulated
lights, not a claim that inhabitants live in cities. Intensity:
`min(1.2, .08 + .85*p/(p+100) + .15*d/(d+5))`, with `d` the sum of known valid local
district levels capped at 1000 (missing `d` contributes zero, stays UNKNOWN).
Zero/unknown population hides lights with intensity 0. This uses the current 100-person
homeworld and 20-person colony scale, not a millions-of-people assumption.
The lab light generator still filters eligible land; Frozen currently emits none.

Ships are deduplicated by persistent ID and sorted. Conflicting duplicates or more
than one fleet association fail closed. ARRIVED coordinates identify local/remote
system; TRANSIT never becomes a parked ship, even at the selected destination.
Fleet membership implies an operational ship via backend validation. Unassigned
ships require persisted `system_x/y`, `ready_at` and explicit `options.observedAt`
(epoch seconds) to prove readiness. The adapter never reads the clock. A future
`ready_at` contradicting a local arrived snapshot also hides the entity.

Only catalog ID **scout_hull**, classification **corvette**, role **exploration**
maps to **horizon-prototype**, an experimental visual stand-in, not a canonical
Horizon geometry claim. Every other hull remains UNKNOWN_DESIGN with its real ID,
quantity and context preserved, without substituting the prototype. `visible` means
eligible for **system-context** presentation, never proof of a current planet orbit.
Origin planet is historical. Fleet targets are orders, not presence.

## Fixtures and usage

`tests/fixtures/visualState.ts` contains eight test scenarios: inhabited homeworld,
zero-population world, 20-person colony, hostile uninhabited world, system with real
fleet membership, empty system, unmapped hull and incomplete observation. Hull metadata
uses the current Horizon; the unmapped model is explicitly synthetic fixture catalog
content. No fixture is imported by production code, persisted or exposed as live state.

```ts
const descriptor = createVisualDescriptor(state, catalog);
const serialized = JSON.stringify(descriptor); // tested lossless, no NaN/undefined
```

Serialized excerpt for the inhabited-homeworld fixture (complete structure is typed
above; environment, parameters, star, presentation and diagnostics omitted here):

```json
{
  "version": 1,
  "identity": {
    "systemKey": "system-0-0",
    "planetKey": "11111111-1111-4111-8111-111111111111",
    "seed": "starz:visual:v1:[\"system-0-0\",\"11111111-1111-4111-8111-111111111111\"]"
  },
  "civilization": {
    "presence": "PRESENT", "population": 100, "infrastructureLevels": 2,
    "lightsEnabled": true, "intensity": 0.5478571428571428
  },
  "ships": { "coverage": "KNOWN", "entities": [], "visibleCount": 0 },
  "infrastructure": {
    "evidence": [], "station": { "presence": "UNKNOWN", "visible": false, "model": null }
  },
  "moon": { "presence": "UNKNOWN", "visible": false }
}
```

## Validation and next integration requirements

Run `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
Tests cover boundaries, eight fixtures, invalid numbers, explicit unknowns, association
errors, prototype-safe profile lookup, serialization, frozen input, no clock/random,
population-independent geography and existing lab regressions without GPU.
Validation: 133 Vitest tests + 11 Node tests passed. The new test/fixture types were
also checked explicitly with TypeScript. Existing Planet Lab 02, Ship Geometry Lab 01
and Space Scene Lab 02 were opened in Chromium/SwiftShader at 1366×768 with one canvas
per route, functional pause and no JS/shader startup errors. This is regression QA,
not a new artistic approval; the adapter is not imported by any runtime route.

Next integration must validate descriptors with real snapshot fixtures, preserve stable
identity, explicitly opt into presentation defaults, keep system-only ship placement
honest, and obtain a trustworthy observation time for unassigned ship readiness.
Actual planet-specific orbits, stations, moons, atmospheric pressure, universe identity
or canonical terrain require new authoritative data contracts, not renderer guesses.
No live integration, backend, save, game_data, generator or shader change in this slice.
