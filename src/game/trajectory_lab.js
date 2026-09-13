const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function createTrajectoryLab({ simulate, trafficRisk, blocked = () => false } = {}) {
  if (typeof simulate !== 'function') throw new TypeError('trajectory lab requires simulate()');
  if (typeof trafficRisk !== 'function') throw new TypeError('trajectory lab requires trafficRisk()');

  function maneuverClass({ headingError = 0, curvature = 0 } = {}) {
    if (Math.abs(headingError) > 2.2 || curvature > 2.35) return 'TURN_AROUND';
    if (curvature > 0.9) return 'HARD_CORNER';
    if (curvature > 0.45) return 'CORNER';
    return 'CRUISE';
  }

  function buildCandidates({ headingError = 0, baseSteer = 0, speed = 0, curvature = 0 } = {}) {
    const turn = maneuverClass({ headingError, curvature });
    const sign = headingError >= 0 ? 1 : -1;
    const turnSpeed = clamp(speed, 0, 120);
    if (turn === 'TURN_AROUND') {
      const lowSpeedTurn = speed < 75;
      const turnThrottle = speed < 25 ? 0.72 : speed < 50 ? 0.65 : speed < 75 ? 0.58 : 0.35;
      return [
        { id: 'TURN_LEFT', steer: sign * 1, throttle: turnThrottle, brake: 0, horizon: lowSpeedTurn ? 0.85 : 1.0, maneuver: 'TURN_AROUND' },
        { id: 'TURN_RIGHT', steer: -sign * 1, throttle: turnThrottle, brake: 0, horizon: lowSpeedTurn ? 0.85 : 1.0, maneuver: 'TURN_AROUND' },
        { id: 'BRAKE_TURN', steer: sign * 0.8, throttle: lowSpeedTurn ? Math.min(0.62, turnThrottle) : 0.18, brake: lowSpeedTurn ? 0 : 0.85, horizon: 1.0, maneuver: 'TURN_AROUND' },
        { id: 'COAST_ALIGN', steer: sign * 0.55, throttle: lowSpeedTurn ? Math.min(0.55, turnThrottle) : 0.18, brake: lowSpeedTurn ? 0 : 0.25, horizon: 1.2, maneuver: 'TURN_AROUND' },
        { id: 'FULL_BRAKE', steer: 0, throttle: 0, brake: 1, horizon: 0.8, maneuver: 'STOP' }
      ];
    }
    return [
      { id: 'KEEP', steer: baseSteer, throttle: speed < 80 ? 0.45 : 0.25, brake: 0, horizon: 0.9, maneuver: 'KEEP' },
      { id: 'BRAKE', steer: baseSteer * 0.7, throttle: 0, brake: clamp((speed - turnSpeed) / 120, 0.25, 1), horizon: 0.9, maneuver: 'BRAKE' },
      { id: 'LEFT', steer: clamp(baseSteer - 0.38, -1, 1), throttle: 0.35, brake: 0, horizon: 0.9, maneuver: 'STEER_LEFT' },
      { id: 'RIGHT', steer: clamp(baseSteer + 0.38, -1, 1), throttle: 0.35, brake: 0, horizon: 0.9, maneuver: 'STEER_RIGHT' },
      { id: 'GENTLE', steer: baseSteer * 0.45, throttle: 0.3, brake: 0, horizon: 1.2, maneuver: 'GENTLE' }
    ];
  }

  function evaluate(car, options = {}) {
    const headingError = Number(options.headingError) || 0;
    const curvature = Number(options.curvature) || 0;
    const baseSteer = clamp(Number(options.baseSteer) || 0, -1, 1);
    const speed = Math.max(0, Number(options.speed) || 0);
    const hazards = Array.isArray(options.hazards) ? options.hazards : [];
    const candidates = buildCandidates({ headingError, baseSteer, speed, curvature });
    const target = options.target || null;
    const className = maneuverClass({ headingError, curvature });

    const evaluated = candidates.map(candidate => {
      const result = simulate(car, candidate.horizon, candidate.steer, candidate.throttle, candidate.brake);
      const risk = trafficRisk(result, hazards);
      const targetDistance = target ? Math.hypot(result.x - target.x, result.y - target.y) : 0;
      const alignment = target ? Math.abs(wrap(Math.atan2(target.y - result.y, target.x - result.x) - (car.a || 0))) : Math.abs(headingError);
      const wallPenalty = Math.max(0, 70 - result.minWall) * 5;
      const collisionPenalty = result.safe ? 0 : 100000 + (candidate.horizon - result.collisionT) * 8000;
      const turnBonus = className === 'TURN_AROUND' && candidate.maneuver === 'TURN_AROUND' ? 120 : 0;
      const directionBonus = className === 'TURN_AROUND' ? (candidate.steer * headingError > 0 ? 190 : candidate.steer === 0 ? 30 : -70) : 0;
      const lowSpeedTurnBonus = className === 'TURN_AROUND' && speed < 75 && candidate.throttle > 0.55 && candidate.steer * headingError > 0 ? 150 : 0;
      const stopBonus = className === 'TURN_AROUND' && candidate.id === 'FULL_BRAKE' && speed > 180 ? 80 : 0;
      const progress = target ? -targetDistance * 0.75 : result.speed * 0.12;
      const score = progress + turnBonus + directionBonus + lowSpeedTurnBonus + stopBonus - wallPenalty - risk.risk * 5 - collisionPenalty - alignment * 12 - Math.abs(candidate.steer) * 8;
      return { ...candidate, safe: !!result.safe, x: result.x, y: result.y, speed: result.speed, minWall: result.minWall, collisionT: result.collisionT, trafficRisk: risk.risk, ttc: risk.minTtc, targetDistance, alignment, score };
    });

    const safe = evaluated.filter(c => c.safe && Number.isFinite(c.score));
    const pool = safe.length ? safe : evaluated.filter(c => Number.isFinite(c.score));
    pool.sort((a, b) => b.score - a.score);
    const selected = pool[0] || evaluated[0] || null;
    const rejectedUnsafe = evaluated.length - safe.length;
    let reason = 'BEST_SAFE_TRAJECTORY';
    let cause = 'NORMAL_MOTION';
    if (className === 'TURN_AROUND') {
      reason = selected?.id === 'FULL_BRAKE' ? 'CONTROLLED_STOP_BEFORE_TURN' : (speed < 75 ? 'LOW_SPEED_TURN_AUTHORITY' : 'CONTROLLED_TURN_AROUND');
      cause = `HEADING_ERROR_${Math.abs(headingError).toFixed(2)}_RAD`;
    } else if (rejectedUnsafe > 0) {
      reason = 'UNSAFE_TRAJECTORIES_REJECTED';
      cause = 'COLLISION_OR_WALL_RISK';
    } else if (curvature > 0.9) {
      reason = 'HARD_CORNER_SELECTION';
      cause = `CURVATURE_${curvature.toFixed(2)}`;
    }

    return { maneuver: className, selected: selected ? { ...selected } : null, candidates: evaluated, safeCandidates: safe.length, candidateCount: evaluated.length, risk: selected ? selected.trafficRisk : Infinity, reason, cause, rejectedUnsafe };
  }

  return { evaluate, maneuverClass, buildCandidates };
}
