# LOWTOWN

A browser-based 1990s crime-city driving prototype with a grimy night-city presentation and strict top-down gameplay view.

## Vertical prototype: 0.2 gameplay track

Prototype 0.2 is now the primary development track. It is deliberately focused on player-facing gameplay rather than autonomous AI-driver research.

## What is a job?

A **job** is a player-facing mission with a defined objective, destination and completion condition. Jobs are chained: completing one unlocks the next, and each successful job awards deterministic money/score.

The current chain is:

1. **JOB 01: SHAKE THE NIGHT**
2. **JOB 02: THROUGH THE BLOCKS**
3. **JOB 03: LOSE THE TAIL**

The prototype chain is complete only after Job 3 is completed.

## Win condition

The current gameplay milestone is won by completing **Job 1 -> Job 2 -> Job 3** in order and receiving all three rewards: $250 + $450 + $700 = **$1,400**.

## Persistence

Prototype 0.2 stores completed-job progress and money in browser `localStorage`, so a reload can continue the gameplay progression. A fresh reset remains available for development/testing.

## Current limitations

- static building/land collision is implemented through a shared world-geometry contract; curb/road-edge behavior is still being hardened
- the three-job economy chain is prototype-simple and has no inventory or shop system
- pedestrian and police reactions are scripted prototype behaviors, not a full wanted/police simulation
- combat/fight is scoped and approved in Issue #1 but is not yet part of the shipped 0.2 gameplay layer
- autonomous AI-driver development is intentionally a separate track and is not the current gameplay priority

## Gameplay roadmap

See [`ROADMAP_GAMEPLAY.md`](./ROADMAP_GAMEPLAY.md) for the player-facing Prototype 0.2 sequence and acceptance criteria.

## AI driver roadmap

AI-driver research and testing are isolated in [`LOWTOWN_AI_ROADMAP.md`](./LOWTOWN_AI_ROADMAP.md). Do not expand that track during gameplay sessions unless explicitly requested.

## Run locally

```bash
npm install
npm run dev
```

Then open the Vite URL shown in the terminal.

## Controls

- W / Arrow Up: accelerate
- S / Arrow Down: reverse / brake
- A,D / Arrow Left,Right: steer
- Space: handbrake / tighter steering
- R: reset car and job
- N: advance to the next completed job during prototype testing
- I: toggle AI driver for regression testing only

## Direction

LOWTOWN is deliberately moving toward a grimy, wet, sodium-lit 1990s crime-racer mood rather than neon cyberpunk. The gameplay layer is synchronized around one top-down world-coordinate contract for rendering, driving, traffic, pedestrians, collisions and mission targets.
