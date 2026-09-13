import { CITY_DESTINATIONS, destinationPoint, vehicleRoute } from './city_semantics.js';

export function createMissionSystem(world) {
  const destination = id => destinationPoint(id) || { x: world.mission.x, y: world.mission.y, radius: world.mission.radius || 70 };
  const templates = [
    { id: 'DROP', title: 'SHAKE THE NIGHT', text: 'Take the package from the apartments to Market Hall.', reward: 250, route: ['LOWTOWN_APARTMENTS', 'MARKET_HALL'] },
    { id: 'RUN', title: 'THROUGH THE BLOCKS', text: 'Hit Garage, City Hall and Old Foundry in one run.', reward: 450, route: ['CENTRAL_GARAGE', 'CITY_HALL', 'OLD_FOUNDRY'] },
    { id: 'GETAWAY', title: 'LOSE THE TAIL', text: 'Run from Dock Works through Freight Depot to the motel.', reward: 700, route: ['DOCK_WORKS', 'FREIGHT_DEPOT', 'NORTH_RIDGE_MOTEL'] }
  ];
  let active = 0, stage = 0, complete = false, started = false;
  function current() { return templates[active]; }
  function target() { const m = current(); return destination(m.route[stage % m.route.length]); }
  function routePreview() {
    const m = current(); if (m.route.length < 2) return [];
    const from = destination(m.route[Math.min(stage, m.route.length - 1)]);
    const to = destination(m.route[Math.min(stage + 1, m.route.length - 1)]);
    return vehicleRoute(from, to);
  }
  function update(car) {
    if (complete) return false;
    const p = target();
    if (Math.hypot(car.x - p.x, car.y - p.y) < (p.radius || 55)) {
      started = true; stage++;
      if (stage >= current().route.length) { complete = true; return true; }
    }
    return false;
  }
  function next() { active = (active + 1) % templates.length; stage = 0; complete = false; started = false; }
  function reset() { stage = 0; complete = false; started = false; }
  function state() {
    const mission = current();
    return { ...mission, stage, totalStages: mission.route.length, started, complete, target: target(), routePreview: routePreview(), destinationCount: CITY_DESTINATIONS.length };
  }
  return { templates, update, next, reset, state };
}
