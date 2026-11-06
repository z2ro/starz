# Fleet Combat & Intelligence 2.0

This increment reuses the persistent Research 2.0, planetary-defense inventories and per-unit salvo combat introduced in 66b171e. It adds private historical intelligence, deliberate mission planning, reinforcement/recall and a viewport-locked game shell. No ship geometry, shaders, economic formulas or old saves are replaced.

## Run in isolation

```sh
docker compose -f compose.warfare.yaml up -d --build --wait
```

Open **http://localhost:8033/**. Use separate profiles/incognito contexts for two players. Database: localhost 5548, dedicated `starz-warfare-2` Compose project/volume. Existing 8030–8032 services are not restarted or migrated. The same Alembic chain runs on a clean database. New intelligence and report fields are additive JSONB in the existing empire-progress contract; older saves default to empty observations, and old reports remain readable. No relational schema change is needed for this release.

## Intelligence

- **RECON**: an exploration/science ship visits a foreign occupied planet. Available without Intelligence research, but has a 0.75 strength multiplier and deliberately limited information.
- **ESPIONAGE**: still requires Intelligence 1 and exploration/science capability. It uses the full strength and may reveal more information with technology specialization.
- Strength is `(1 + espionage_bonus) × (1 + sensors_bonus) × (1 + min(1, science_ship_bonus_sum / 2))`. Protection is `1 + counter_intelligence_bonus + sensors_bonus / 4`. All bonuses use the existing centralized technology evaluator.
- Strength/protection below 0.7 yields quality 0; otherwise 1, at least 1.3 yields 2, and at least 2 yields 3. Reconnaissance is deterministic; repeat missions do not reroll for a lucky result.
- A ratio below 1.5 is detected and warns the defender with the observed attacker's identity and target. Detected quality-0 advanced espionage takes 20% of each probe's base hull HP in electronic-countermeasure damage, bounded to retain at least 1 HP. Damage persists and uses existing local yard maintenance after return. This does not declare war automatically.
- Quality 1 estimates local ship and defense counts. Quality 2 confirms those observed counts and estimates stocks/ammunition. Quality 3 confirms stocks/ammunition and estimates infrastructure/technology. Estimated ranges are `[floor(0.5 × observed), floor(1.5 × observed) + 1]`, never asserted exact values.
- Unknown fields are explicitly `UNKNOWN` with `value: null`. Empty observed inventories describe the time of observation, not perpetual safety. Fleet presence uses the same planet-local association as combat, never every ship in the target system.
- Validity is `300 + 300 × quality` seconds. Expired observations remain inspectable as `OUTDATED`. Neither expiration nor opening a report refreshes it from another player's private state.
- Each empire retains its last 50 structured observations. Only the owning account can access them. Mission previews consult **the requester's saved observations**, never live enemy inventories.

A public diplomacy directory exposes empire names and occupied coordinates for discovery; it does not expose private stocks, fleet composition or defenses. Diplomacy and Galaxy links preserve the target planet in the planner. Intelligence is not a guarantee: reinforcement and construction after collection can change the battle.

## Fleet operations

The planner has explicit composition, destination and confirmation steps, quantity selectors backed by actual ship IDs, real fuel/cargo/ETA quotes and historical threat information. Changing an input invalidates the quote; dispatch remains an explicit paid action. All selected ships must be ready, unique, co-located and compatible in propulsion/fuel. The selected paying world must actually host the ships; a second planet in the same system cannot pay for unrelated deployed ships.

Existing survey, expedition, transport, colonization, move and attack retain their rules. **REINFORCE** explicitly deploys to another owned planet and assigns its surviving ships to that planet's defense. Allied foreign garrisons are not implemented or silently counted. Deployment has no automatic return.

**Recall / Return** is authoritative and serialized with dispatch/arrival. During a still-outbound mission it resolves the old order, spends the reserved return fuel and creates one return order. Travel back takes the elapsed outbound time (minimum 1 second); fuel accounting conservatively charges the reserved quoted return leg. Undelivered transport cargo returns to its exact source planet. Arrived remote fleets can request return using real travel/fuel calculations. An order already returning or a committed colonization cannot be recalled. Calls made after arrival settlement follow the actual current state, not a stale button. Repeated recall and foreign-fleet requests cannot create extra returns or spend another owner's resources.

Intermediate in-flight coordinates are not modeled as occupied systems; recall changes the return order without inventing a tactical position. Existing timestamp settlement continues while offline. No fleet collision, tactical formations or automatic docking are introduced.

## Combat and reports

The per-unit combat from [Planetary Defense](planetary-defense.md) remains authoritative: actual class composition, six simultaneous salvos, research-derived weapons/armor/shields, local defenses, ammunition consumption, shield charge, persistent hull damage/losses and cargo-limited looting. No scalar power comparison replaces it.

New reports include participant names and IDs, actual target planet, timestamp/result, original/surviving fleet composition, defensive inventory and losses, per-round damage/absorption, ammunition before/after/consumed and the actual contributing technology levels/effects applicable to the participating units. Unused carrier/defense research is not disclosed by an unrelated fleet engagement. Economic loss is the catalog base replacement cost of destroyed units, explicitly not a reimbursement. Captured resources are removed from the victim at battle settlement and credited only when surviving attackers return. Both participants receive their authorized battle report; unrelated players do not.

There are no random salvage payouts. In-flight transport interception and wreck recovery are not implemented. Carriers retain their existing abstract wing contribution. Missile ammunition/interception and war rechecks from Defense 1.0 remain unchanged. Research, ship/defense costs and conventional models are preserved.

## Defense UX

The six defenses have distinct filled pixel icons and human-readable requirements. A compact readiness overview shows unit count, HP, shield charge, ammunition and free energy. Missing scientific/industrial/energy/workforce requirements link to the actual relevant Research or Installations context. Construction, garrison/repairs, missiles and battles are separate subviews; the underlying paid queues and unit IDs remain intact.

## Validation and remaining limits

```sh
npm run typecheck
npx vitest run --config vitest.config.ts --maxWorkers=1
.venv/bin/python -m unittest discover -s tests
PERSISTENT_TEST_DATABASE_URL=postgresql+psycopg://warfare:warfare_local_only@localhost:5548/warfare \
  .venv/bin/python -m unittest discover -s tests -p test_fleet_intelligence.py
docker compose -f compose.warfare.yaml build universe-app
git diff --check
```

`python scripts/warfare_smoke.py` creates two fresh accounts at 8033, builds eight scouts and a freighter, researches the defender's naval doctrine, builds a local cannon and ship, sends reconnaissance, reviews the actual resulting threat, declares war, attacks, checks both owners' reports/losses and waits for return. It uses normal HTTP actions and real elapsed time, with no database injection or accelerated clock. Allow roughly 20 minutes depending on actual homeworld separation. `--resume` can reuse the local QA accounts during setup; do not replay a completed operation as if it were a fresh scenario.

`scripts/warfare_qa.cjs` validates the 12 requested main sections plus the contextual Planet View at 1920×1080, 1440×900, 1366×768 and 390×844, plus dialogs and reports. Supply installed `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. Screenshots/results are under `tmp/warfare-2/`; account credentials there are local test artifacts, not committed content.

Balance thresholds, TTL, countermeasure damage and replacement-cost valuations are provisional. The coarse universe lock remains a local-experiment scalability limit. The browser smoke uses early reconnaissance; advanced espionage quality/countermeasures are covered by engine tests rather than an entire late-tier playthrough. No physical GPU benchmarking is implied.

## Observed release operation

The isolated HTTP smoke completed with normal timestamps and two independent accounts: eight Horizon plus one Wayfarer attacked a world with one Horizon and one point-defense cannon after a detected quality-1 reconnaissance. The attacker won, lost one Horizon, destroyed the defending ship and cannon, and returned with 180 total resource units constrained by surviving cargo capacity. Both accounts retained the same battle result. The defender subsequently rebuilt a cannon through the normal paid endpoint. `tmp/warfare-2/smoke.json` contains the actual observation, quotes, unit IDs and battle rounds; no database fixture was inserted into these accounts.

Focused SQL validation also covers advanced espionage arrival, expired observations, foreign ownership rejection, simultaneous duplicate dispatch, recall cargo conservation and exact-planet reinforcement. Strong/weak intelligence and countermeasure damage are tested without claiming an advanced-tech manual browser campaign.

Release verification: typecheck and the isolated Docker/Vite build passed. The frontend suite passed 255 tests; focused UI tests were repeated after the final inspector/map refinements, and all four existing Node visual/asset/icon suites passed. Plain Python discovery ran 115 tests with 32 environment-dependent skips. With PostgreSQL enabled, the intelligence suite passed 6 tests, the defense suite 11 and the existing persistent-universe suite 5. Their disposable schemas are separate from the real HTTP smoke accounts. Chromium checked 13 routes in all four required sizes, zero document/workspace horizontal overflow, inspector action visibility, keyboard map pan/zoom, mobile sector navigation, modal Escape and an injected API-error layout. This is browser emulation, not a physical-mobile or GPU performance benchmark.
