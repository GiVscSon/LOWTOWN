# Pedestrian review — 2026-09-21

Compared the supplied grok-workspace.zip source and its recorded lowtown-play.png screenshot. The archive was not run. Its screenshot shows a simpler, tile-based city and is not evidence of current LOWTOWN gameplay.

Useful ideas: one depth queue for buildings, vehicles, people and props; semantic walkable tiles; visible-world culling. Do not transplant its pedestrian code: it uses primitive body/head shapes, random frame-based turns and tile reversal instead of routes. Its contact rule also kills a pedestrian on foot-player contact without a speed requirement.

Implemented locally:
- Distance-driven footsteps, stationary and blocked poses, actual movement heading.
- Narrower head and longer legs, directional front/back shading, collar, seams, shoes, hands and accessories; camera zoom applies to the whole figure.
- Short local destinations and pauses instead of the horizontal time-based reversal and continuous vertical tether.
- NPC segment sampling against buildings, furniture, tree trunks and oriented vehicles; traffic approach response without the old 20-unit shove.
- Player tree-trunk collision and stationary animation reset.

Validation: production build; pedestrian-motion-regression; pedestrian-world-smoke; free-roam-render-smoke; free-roam-smoke; private-drive-smoke. Canvas smoke uses a mock drawing context, not visual evidence. The driving route test removes traffic and pedestrians, so it proves no crowd safety.

Publication: the earlier connector failure was resolved and the pedestrian update was published privately as version 21 on 2026-09-26. Cloud browser navigation to the supervised preview failed with ERR_BLOCKED_BY_CLIENT. No fresh visual QA or live driving session was completed.

Remaining work: unified depth composition including buildings and trees (vehicles and people now share a ground-depth pass); connected sidewalk navigation and legal crossings; recovery for existing invalid NPC spawns; stronger crowd avoidance; player interactions with moving traffic; compare actual rendered motion and silhouettes against the reference before claiming visual acceptance.
