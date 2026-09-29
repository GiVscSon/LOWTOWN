const INCIDENTS = Object.freeze({
  robbery: { title: 'ОГРАБЛЕНИЕ', mark: '$', dangerRadius: 150, audienceRadius: 470, interest: 0.62, duration: 17 },
  fight: { title: 'ДРАКА', mark: '!', dangerRadius: 145, audienceRadius: 390, interest: 0.55, duration: 14 },
  carTheft: { title: 'УГОН', mark: 'C', dangerRadius: 125, audienceRadius: 420, interest: 0.48, duration: 15 },
  killing: { title: 'НАПАДЕНИЕ', mark: '!', dangerRadius: 195, audienceRadius: 560, interest: 0.74, duration: 20 },
  fire: { title: 'ПОЖАР', mark: 'F', dangerRadius: 205, audienceRadius: 570, interest: 0.82, duration: 22 },
  crash: { title: 'АВАРИЯ', mark: 'X', dangerRadius: 155, audienceRadius: 500, interest: 0.68, duration: 16 }
});

const INCIDENT_IDS = Object.keys(INCIDENTS);

function createSceneActors(kind,x,y){
  const person=(role,dx,dy,shirt,stance,reaction)=>({
    x:x+dx,y:y+dy,role,stance,reaction,visualScale:.91,
    shirt,pants:'#24282c',skin:'#cda883',hair:'#211b17',gait:reaction==='fleeing'?1:0,walkPhase:2.1
  });
  if(kind==='robbery')return [person('suspect',-22,-5,'#5b2925','fighting','fleeing'),person('victim',20,7,'#c1a168','handsUp','curious')];
  if(kind==='fight')return [person('attacker',-17,0,'#743e32','fighting','fleeing'),person('defender',18,4,'#42596a','handsUp','curious')];
  if(kind==='carTheft')return [person('suspect',-18,-8,'#34383d','fighting','fleeing'),person('owner',34,13,'#98774d','handsUp','curious')];
  if(kind==='killing')return [person('suspect',-26,-8,'#3e3030','fighting','fleeing'),person('victim',15,6,'#5a6266','down','calm')];
  if(kind==='crash')return [person('injured',-6,8,'#9b5b4e','down','calm'),person('witness',45,24,'#526a57','handsUp','curious')];
  if(kind==='fire')return [person('evacuee',52,28,'#9a6741','handsUp','fleeing'),person('injured',-34,18,'#815a4d','down','calm')];
  return [];
}

export function createCityIncidentDirector({ nodes = [], random = Math.random, initialDelay = 24, minDelay = 30, maxDelay = 54, activeDuration = 18, radius = 1500 } = {}) {
  const state = { active: null, cooldown: Math.max(0, initialDelay), completed: 0, started: 0, last: null };
  let sequence = 0;

  function start(kind, anchor, options = {}) {
    if (!INCIDENTS[kind] || !anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return null;
    const profile = INCIDENTS[kind];
    state.active = {
      id: ++sequence,
      kind,
      title: profile.title,
      mark: profile.mark,
      x: anchor.x,
      y: anchor.y,
      dangerRadius: profile.dangerRadius,
      audienceRadius: profile.audienceRadius,
      interest: profile.interest,
      actors: createSceneActors(kind,anchor.x,anchor.y),
      wrecks: kind==='crash'||kind==='carTheft'?[{x:anchor.x+9,y:anchor.y-14,angle:.28,type:'sedan',color:kind==='crash'?'#554b45':'#32383b',width:48,height:24,damaged:true}]:[],
      timer: Number.isFinite(options.duration) ? Math.max(0.5, options.duration) : Math.min(activeDuration, profile.duration),
      witnessCount: 0,
      reported: false,
      reportTimer: 1.2
    };
    state.started++;
    return state.active;
  }

  function finish() {
    if (!state.active) return null;
    state.last = { id: state.active.id, kind: state.active.kind, reported: state.active.reported };
    state.active = null;
    state.completed++;
    state.cooldown = minDelay + random() * Math.max(0, maxDelay - minDelay);
    return state.last;
  }

  function update(dt, { player, people = [] } = {}) {
    const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
    if (state.active) {
      state.active.timer -= step;
      if (state.active.timer <= 0) finish();
      return state.active;
    }

    state.cooldown = Math.max(0, state.cooldown - step);
    if (state.cooldown > 0 || !player || !nodes.length) return null;

    const nearby = nodes.filter(node => Number.isFinite(node.x) && Number.isFinite(node.y) &&
      Math.hypot(node.x - player.x, node.y - player.y) <= radius &&
      people.some(person => Math.hypot(person.x - node.x, person.y - node.y) < 300));
    if (!nearby.length) {
      state.cooldown = 4;
      return null;
    }
    const anchor = nearby[Math.floor(random() * nearby.length) % nearby.length];
    const kind = INCIDENT_IDS[Math.floor(random() * INCIDENT_IDS.length) % INCIDENT_IDS.length];
    return start(kind, anchor);
  }

  function current() { return state.active; }
  return { state, start, finish, update, current };
}

function reactionRoll(person, index, incidentId) {
  const identity = Number.isFinite(person.id) ? person.id : index;
  let value = Math.imul((identity + 1) | 0, 0x45d9f3b) ^ Math.imul((incidentId + 11) | 0, 0x119de1f3);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 0x100000000;
}

export function updateCrowdReactions(people, incident, dt = 0) {
  const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
  let fleeing = 0, curious = 0, witnesses = 0;
  const danger = [];

  if (incident) {
    for (let index = 0; index < people.length; index++) {
      const person = people[index];
      const distance = Math.hypot(person.x - incident.x, person.y - incident.y);
      if (distance <= incident.dangerRadius) danger.push({ person, distance });
    }
  }

  for (let index = 0; index < people.length; index++) {
    const person = people[index];
    person.reaction = 'calm';
    person.lookAt = null;

    if (incident) {
      const dx = person.x - incident.x, dy = person.y - incident.y;
      const distance = Math.hypot(dx, dy);
      const isInDanger = distance <= incident.dangerRadius;
      const panicNearby = !isInDanger && danger.some(entry =>
        Math.hypot(person.x - entry.person.x, person.y - entry.person.y) < 82);

      if (isInDanger || panicNearby) {
        const away = Math.hypot(dx, dy) || 1;
        person.eventFleeX = dx / away;
        person.eventFleeY = dy / away;
        person.eventFleeTimer = Math.max(person.eventFleeTimer || 0, isInDanger ? 1.25 : 0.85);
      }

      if ((person.eventFleeTimer || 0) > 0) {
        person.reaction = 'fleeing';
        person.eventFleeTimer = Math.max(0, person.eventFleeTimer - step);
        fleeing++;
      } else if (distance <= incident.audienceRadius &&
        reactionRoll(person, index, incident.id) < incident.interest) {
        person.reaction = 'curious';
        person.lookAt = { x: incident.x, y: incident.y };
        curious++;
        witnesses++;
      }
    } else if ((person.eventFleeTimer || 0) > 0) {
      person.reaction = 'fleeing';
      person.eventFleeTimer = Math.max(0, person.eventFleeTimer - step);
      fleeing++;
    }
  }

  if (incident) {
    incident.witnessCount = witnesses;
    if (witnesses > 0) {
      incident.reportTimer = Math.max(0, (incident.reportTimer ?? 1.2) - step);
      if (incident.reportTimer === 0) incident.reported = true;
    } else if (!incident.reported) {
      incident.reportTimer = 1.2;
    }
  }

  return { fleeing, curious, witnesses, reported: !!incident?.reported };
}
