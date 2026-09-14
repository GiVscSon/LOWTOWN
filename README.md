# LOWTOWN

A browser-based 1990s crime-city driving prototype with a grimy night-city presentation and strict top-down gameplay view.

## Vertical prototype: 0.1

The first playable slice is intentionally small and self-contained:

- top-down night-city block rendered on Canvas
- free driving with WASD / arrow keys
- steering, acceleration, braking and handbrake
- follow camera
- amber mission marker
- simple job completion state
- responsive HUD
- traffic and pedestrians
- no external game assets required

## What is a job?

A **job** is a player-facing mission task with a clear objective and destination. The player starts the job, drives to its goal, and completes it when the required gameplay condition is satisfied. Prototype 0.2 expands this into three chained jobs with simple rewards.

## Win condition

For the current prototype, a job is won when its active mission objective is completed. The Prototype 0.2 gameplay milestone is won when the player completes the full chain **Job 1 -> Job 2 -> Job 3** and receives the associated economy/score rewards.

## Current limitations

- static world collision with buildings and curbs is still being hardened for Prototype 0.2
- the economy/score and three-job chain are not yet shipped
- persistent save state is not yet shipped
- pedestrian/police reactions are currently limited and will be expanded with deterministic scripted reactions
- autonomous AI-driver development is intentionally a separate track and is not the current gameplay priority

## Gameplay roadmap

See [`ROADMAP_GAMEPLAY.md`](./ROADMAP_GAMEPLAY.md) for the Prototype 0.2 gameplay sequence and acceptance guardrails.

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

## Direction

LOWTOWN is deliberately moving toward a grimy, wet, sodium-lit 1990s crime-racer mood rather than neon cyberpunk. The gameplay layer is being synchronized around one top-down world geometry contract for rendering, driving, traffic, pedestrians, collisions and mission targets.
