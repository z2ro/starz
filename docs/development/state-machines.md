# STARZ state machine inventory

This is a navigation aid for the current code, not an executable specification or permission to change rules. Several states are inferred from timestamps, null fields, ownership, or combinations of records; a status string alone is not a complete machine. Recheck the linked code and tests before changing transitions. This inventory groups related local UI states rather than claiming every boolean is enumerated.

## Server-authoritative persistent universe

| Machine | State and transitions | Authority / evidence |
|---|---|---|
| Account and session | Unauthenticated → account/session → expired or revoked; ownership derives from the session, not a client-selected empire. | `starz/persistent/routes.py`, `starz/persistent/security.py`, `starz/api.py` |
| Planet construction | Absent → queued with `complete_at` → level increased and queue entry removed. Timing is advanced offline. | `Engine.build`, `Engine._complete_construction` in `starz/simulation.py`; `Construction` in `starz/db/models.py` |
| Research per domain | Idle → active work → completed level → idle; active work can have no ETA when effective rate is zero. Three domains can progress independently. | `Engine.research`, `_research_eta`, `_complete_events` in `starz/simulation.py`; `starz/progression.py` |
| Ship assembly | Building → ready, inferred from `ready_at`; readiness also depends on fleet/order context. | `Engine.build_ship`, fleet validation in `starz/simulation.py` and `starz/persistent/service.py` |
| Fleet movement and missions | `ARRIVED` ↔ `TRANSIT`; mission orders separately encode outbound, return, recall and mission-specific resolution. An arrival can create a successor order. | `Engine._complete_events` in `starz/simulation.py`; `dispatch`, `resolve`, `recall` in `starz/persistent/service.py` |
| Scheduled universe orders | Unresolved → due → resolved within the locked transaction; payload may carry additional idempotency and domain state. | `PersistentStore.settle`, `resolve` in `starz/persistent/service.py`; `UniverseOrder` in `starz/db/models.py` |
| Exploration / colonization | System knowledge is `UNKNOWN` or `SURVEYED`; colonization eligibility is separately derived from knowledge, capacity, ownership and stellar reservations. | `knowledge_level`, `colonization_status`, `_survey`, `_found_colony` in `starz/simulation.py` |
| Defense construction, repairs and ammunition | Queue entry → completed unit, repair, ammunition or failed repair if the unit was destroyed; platform mode `defense` ↔ `interdiction` has technology and resource guards. | `starz/defenses.py`; `PlanetDefenseState` in `starz/db/models.py` |
| Intelligence | Field visibility `UNKNOWN` / `ESTIMATED` / `CONFIRMED` is distinct from report freshness `CURRENT` / `OUTDATED`; expiration does not create new observation. | `starz/persistent/intelligence.py`; `frontend/src/universe/IntelligenceReport.tsx` |
| Diplomacy | Relation status and pending proposal are separate dimensions; declaration, proposal and acceptance are server-validated. | `PersistentStore.diplomacy`, `relation` in `starz/persistent/service.py` |
| Market and delivery | Offer `open` → `cancelled` or `matched`; matching creates timed `trade_delivery` orders, so matched is not equivalent to delivered. | `PersistentStore.market`, `resolve` in `starz/persistent/service.py` |
| Stellar source and project | Source can be available, reserved or removed; project `reserved` → `building` → `commissioned`, or `reserved` → `cancelled` under guards. Phase records and source removal are separate. | `starz/persistent/stellar.py`; `StellarSource`, `StellarProject` in `starz/db/models.py` |
| Stellar module / logistics | `manufacturing` → `ready` → `transit` → `delivered` → `committed` → `consumed`; recall and other transport paths can return modules to `ready`. The current planet, fleet, project and operation are part of validity. | `starz/persistent/stellar.py`, `stellar_delivery.py`, `stellar_transport.py`; `StellarModule` in `starz/db/models.py` |
| Stargrave unit | `operational`, `damaged`, `incapacitated`, `transit`, `sealed_wreck`, `rebuilding`, `repatriating`, `core_transit`, `sealed_relic`, `reinstalled`; damage, active orders, location and subsystem health constrain transitions. | `starz/persistent/stargrave.py`, `stellar_custody.py`, `stellar_transport.py`; `StellarUnit` in `starz/db/models.py` |
| Custody and core transport | Operation `pending`, `offered`, `working`, `transit`, `returning` or terminal `completed`, `cancelled`, `contested`, `failed`. Custody version, actor, recipient, location, fleet, ledger and unit state are separate constraints. | `starz/persistent/stellar_custody.py`, `stellar_transport.py`; `StellarOperation`, `StellarLedger` in `starz/db/models.py` |
| Orbital combat / bombardment | Orders and combat rounds resolve through server-side snapshots; Stargrave preparation, arrival, cancellation and damage affect unit and order state. | `starz/persistent/combat.py`, `stargrave.py`, `service.py` |
| Optional Concordat campaign | `phase` and turn-based jobs/events/outcome are separate from the persistent-universe rules. | `starz/campaign.py`, `Campaign` in `starz/db/models.py` |

## Client and presentation state

| Machine / family | State and important boundary | Evidence |
|---|---|---|
| Session gate | Configuration loading/failure, authenticated, unauthenticated (HTTP 401), account-check failure/retry; registration/login submissions have separate pending/error state. | `frontend/src/universe/SessionGate.tsx`, `frontend/src/api/client.ts` |
| Server queries and mutations | Loading, success, failure and background refresh; identity and selected planet are part of query keys. Do not treat cached information as authorization. | `frontend/src/api/queries.ts`, `frontend/src/api/client.ts`, `frontend/src/components/shell/AppShell.tsx` |
| Active planet and navigation | Route, selected planet, mobile workspace panel, filters, pagination and selected entities interact; planet changes must not mix snapshots. | `frontend/src/pixel-command/ViewportWorkspace.tsx`, `frontend/src/universe/DevelopmentView.tsx`, `frontend/src/views/GalaxyView.tsx` |
| Tutorial and return summary | Guide steps can be detected, skipped or hidden; progress and visit snapshots are local presentation data, not proof of server actions. | `frontend/src/universe/experience.ts`, `FirstSessionGuide.tsx`, `ReturnSummary.tsx` |
| Research, defenses, fleets, market and stellar forms | Draft/selection, quote/requirements, pending submission, error and success; some operations retain idempotency keys across retries. Server revalidates actions. | `frontend/src/universe/LevelResearch.tsx`, `DefenseView.tsx`, `OperationsView.tsx`, `StellarView.tsx` |
| Visual renderers and labs | Image/procedural selection, renderer initialization, running/paused, error/fallback, context loss and disposal are presentation lifecycle states. | `frontend/src/components/planet/PlanetProceduralView.tsx`, `PlanetThreeView.tsx`, `frontend/src/space-scene-live/LiveSceneRenderer.ts` |

## Change policy

- Keep persistence, authorization and transition guards on the server; do not replace real states with frontend approximations.
- For a proposed change, list sources, events, guards, durable effects, terminal states, retry/idempotency behavior and client-visible outcomes. Cover illegal transitions and interruption/retry paths in focused tests.
- Introduce a shared explicit transition type or table only where it removes a demonstrated inconsistency; avoid a second state engine or a bulk migration of existing saves.
- Inventory is based on code inspection, not an exhaustive reachability proof. Renderer/lab controls, edge-case payloads and combinations of parallel state dimensions need further subsystem-specific review.

### Discovery pointers

The local UI-state search `rg -l 'useState|useReducer|useQuery|useMutation' frontend/src --glob '*.{ts,tsx}'` currently identifies 38 files. In addition to the feature views above, it includes `api/mutations.ts`, `api/queries.ts`, `components/shell/AppShell.tsx`, `pixel-command/ContentPages.tsx`, `PixelCommand.tsx`, `PixelShell.tsx`, `ViewportWorkspace.tsx`, `components/ui/MapViewport.tsx`, `galaxy/OrbitalSystemScene.tsx`, `components/ships/ShipPreviewScene.tsx`, `campaign/CampaignView.tsx`, and the Planet, Ship Geometry, Space Scene and Live labs. UI state can also live in refs, URL parameters, storage and Three.js objects, so hook search alone is not exhaustive.
