# Permanent viewport workspace contract

Persistent STARZ is a strategy-game shell, not a document layout. New gameplay screens must preserve these rules.

- `AppShell`/`PixelShell` occupy **100dvh**. Root/body do not scroll. Masthead, local resources and primary navigation remain outside the content scroller.
- `.px-layout` and `.px-page` use `min-height: 0`, `min-width: 0` and `minmax(0, 1fr)`; `.px-view` owns the single general-purpose workspace scroll. Content is not clipped to fake compliance.
- Long lists use the existing filters, selection and explicit subviews. Defense separates building, garrison, missiles and battles. Mission planning separates composition, destination and confirmation. Reports expand within their workspace. Installations, research and shipyard retain their selection model.
- Desktop inspector/list height derives from the **remaining measured viewport space**, using ResizeObserver, not an assumed monitor resolution. Primary inspector actions remain sticky inside that bounded panel. Overflow in map/list/inspector is intentional; avoid adding another independent scroll wrapper without a reason.
- Research and Galaxy share `MapViewport`: local zoom, pointer pan, touch scrolling and keyboard-scrollable workspaces. Zoom preserves map contents/selection and does not modify game state.
- Below 700px, contextual tabs navigate planet/situation, installation/amplification/population, research map/inspector, ship models/presentation/build, production subviews and map/system. Selecting an object opens the corresponding detail subview without discarding form state. Defense has its own catalog/detail subviews. Text remains readable rather than being scaled down to fit desktop columns.
- Operations expand as a bounded overlay, not a permanent tall column. Records, Help and the mobile sector menu use native modal dialogs with focus containment, Escape and an explicit close action. Records links to actual intelligence and battle history.
- Keyboard tabs support arrows/Home/End and visible focus. Shared shells and component state are retained; switching subviews does not recreate the canvas, procedural geography or mission draft.
- Tests must check document scrollWidth/scrollHeight against the viewport, **and** exercise navigation, dialogs, inspectors and primary actions. Zero document overflow alone does not prove content is accessible.

Initial audit at 1440×900 found document overflow in 9/12 routes: overview, installations, production, research, defenses, shipyard, galaxy, colonies and market (up to 1,977px document height). Evidence: `tmp/warfare-2/audit.json` and `before-desktop.png`. Final checks use `scripts/warfare_qa.cjs` in the isolated environment. Experimental labs and the optional Concordat presentation are not converted into persistent-game views by this change.
