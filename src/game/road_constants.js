// Single source of truth for all road/bridge/corridor widths and lane geometry.
// Every other module (physics, navigation, visuals, islands) must derive its
// widths from here — either directly or via road_geometry.js. No module may
// declare its own independent lane/sidewalk/corridor magic numbers.

export const LANE_WIDTH = 23;
export const SIDEWALK_WIDTH = 14;
export const CURB_MARGIN = 6;
export const SHOULDER_WIDTH = 6;

export const CLASS_MIN_CARRIAGEWAY = Object.freeze({
  ARTERIAL: 66,
  AVENUE: 52,
  STREET: 40,
  SERVICE: 30
});

export const VISUAL_CLASS_SCALE = Object.freeze({
  ARTERIAL: 1.0,
  AVENUE: 0.89,
  STREET: 0.65,
  SERVICE: 0.5
});

// --- Deprecated flat constants -------------------------------------------
// Kept only so existing callers do not break during the migration to
// road_geometry.js. New code must not read these directly; use
// road_geometry.collisionHalfWidth(road) / visualHalfWidth(road) instead.
export const CARRIAGEWAY_WIDTH = 92;
export const BRIDGE_DECK_WIDTH = 104;
export const COLLISION_HALF_WIDTH = 46;
export const VISUAL_HALF_WIDTH = 46;
export const VISUAL_CLASS = VISUAL_CLASS_SCALE;

export function sidewalkOffset(lanes) {
  return lanes * LANE_WIDTH + SIDEWALK_WIDTH;
}
