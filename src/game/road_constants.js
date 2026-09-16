// Single source of truth for all road/bridge/corridor widths
// All other modules must import from here.

export const CARRIAGEWAY_WIDTH = 92;
export const LANE_WIDTH = 23;
export const SIDEWALK_WIDTH = 14;
export const CURB_MARGIN = 6;
export const SHOULDER_WIDTH = 6;
export const BRIDGE_DECK_WIDTH = 104;
export const COLLISION_HALF_WIDTH = 46;
export const VISUAL_HALF_WIDTH = 46;
export const VISUAL_CLASS = Object.freeze({ ARTERIAL: 1.0, AVENUE: 0.89, STREET: 0.65, SERVICE: 0.5 });
export function sidewalkOffset(lanes) { return lanes * 23 + 14; }
