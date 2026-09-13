export function createMissionSystem(world) {
  const templates = [
    { id: 'DROP', title: 'SHAKE THE NIGHT', text: 'Reach the amber drop point.', reward: 250 },
    { id: 'RUN', title: 'THROUGH THE BLOCKS', text: 'Hit three checkpoints without stopping.', reward: 400 },
    { id: 'GETAWAY', title: 'LOSE THE TAIL', text: 'Stay moving and reach the safehouse.', reward: 600 }
  ];
  let active = 0;
  let stage = 0;
  let complete = false;
  const points = [world.mission, { x: -900, y: 280, radius: 52 }, { x: 900, y: 760, radius: 52 }, { x: -740, y: -760, radius: 52 }];
  function current() { return templates[active]; }
  function target() { return points[(active + stage) % points.length]; }
  function update(car) {
    if (complete) return false;
    const p = target();
    if (Math.hypot(car.x - p.x, car.y - p.y) < p.radius) {
      stage++;
      if (stage >= (active === 0 ? 1 : active === 1 ? 3 : 2)) {
        complete = true;
        return true;
      }
    }
    return false;
  }
  function next() {
    active = (active + 1) % templates.length;
    stage = 0;
    complete = false;
  }
  function state() { return { ...current(), stage, target: target(), complete }; }
  return { templates, update, next, state };
}
