import { CITY_ROADS } from './city_semantics.js';
import { BRIDGES, isLand } from './islands.js';
import { WORLD } from './world.js';
import {
  buildGeometryAuthority,
  collisionHalfWidth,
  sampleRoadCorridor,
  sampleBridgeCorridor,
  bridgePoints,
  findSegmentIntersections,
  buildingIntersectsRoad
} from './road_geometry.js';

const EPSILON = 0.001;
const PROXIMITY_RADIUS = 90;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function roadNodes() {
  return CITY_ROADS.flatMap(road => road.points.map((raw, index) => ({
    id: `${road.id}:${index}`, roadId: road.id, index, x: raw[0], y: raw[1]
  })));
}

function proximityCandidates(nodes) {
  const candidates = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i], b = nodes[j];
      if (a.roadId === b.roadId) continue;
      const d = distance(a, b);
      if (d > EPSILON && d < PROXIMITY_RADIUS) candidates.push({
        a: a.id, b: b.id, aRoad: a.roadId, bRoad: b.roadId, distance: d
      });
    }
  }
  return candidates;
}

function bridgeEndpointBindings(nodes) {
  return BRIDGES.map(bridge => {
    const points = bridgePoints(bridge);
    const endpoints = [
      { name: 'a', x: points[0]?.[0], y: points[0]?.[1] },
      { name: 'b', x: points.at(-1)?.[0], y: points.at(-1)?.[1] }
    ];
    return {
      bridgeId: bridge.id,
      width: bridge.width,
      endpoints: endpoints.map(endpoint => {
        const nearest = nodes.reduce((best, node) => {
          const d = distance(endpoint, node);
          return !best || d < best.distance
            ? { nodeId: node.id, roadId: node.roadId, index: node.index, distance: d }
            : best;
        }, null);
        return { ...endpoint, nearest };
      })
    };
  });
}

function buildingRoadConflicts() {
  const conflicts = [];
  for (const [buildingIndex, building] of WORLD.buildings.entries()) {
    for (const road of CITY_ROADS) {
      if (buildingIntersectsRoad(building, road)) conflicts.push({
        buildingIndex,
        building,
        roadId: road.id,
        clearance: collisionHalfWidth(road)
      });
    }
  }
  return conflicts;
}

function roadCorridorGaps() {
  const gaps = [];
  for (const road of CITY_ROADS) {
    for (const sample of sampleRoadCorridor(road, { step: 20, edgeSamples: 3 })) {
      if (!isLand(sample.x, sample.y)) gaps.push({
        roadId: road.id,
        x: sample.x,
        y: sample.y,
        offset: sample.offset
      });
    }
  }
  return gaps;
}

function bridgeCorridorGaps() {
  const gaps = [];
  for (const bridge of BRIDGES) {
    for (const sample of sampleBridgeCorridor(bridge, { step: 20, edgeSamples: 3 })) {
      if (!isLand(sample.x, sample.y)) gaps.push({
        bridgeId: bridge.id,
        x: sample.x,
        y: sample.y,
        offset: sample.offset
      });
    }
  }
  return gaps;
}

export function buildWorldGeometryDiagnostic() {
  const nodes = roadNodes();
  const authority = buildGeometryAuthority(CITY_ROADS);
  const { unmarked, allowed } = findSegmentIntersections(CITY_ROADS);
  return {
    metadata: {
      proximityRadius: PROXIMITY_RADIUS,
      epsilon: EPSILON,
      geometryAuthority: 'CITY_ROADS → segments → intersections → corridor',
      roadWidths: 'per-road from road_geometry.js'
    },
    counts: {
      roads: CITY_ROADS.length,
      roadNodes: nodes.length,
      authorityNodes: authority.length,
      bridges: BRIDGES.length,
      buildings: WORLD.buildings.length,
      unmarkedIntersections: unmarked.length,
      allowedGradeSeparatedIntersections: allowed.length
    },
    proximityCandidates: proximityCandidates(nodes),
    unmarkedIntersections: unmarked,
    allowedIntersections: allowed,
    bridgeEndpointBindings: bridgeEndpointBindings(authority),
    buildingRoadConflicts: buildingRoadConflicts(),
    roadCorridorGaps: roadCorridorGaps(),
    bridgeCorridorGaps: bridgeCorridorGaps()
  };
}
