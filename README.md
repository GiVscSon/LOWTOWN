# LOWTOWN

A browser-based isometric 1990s crime-city driving prototype.

## Vertical prototype: 0.1

The first playable slice is intentionally small and self-contained:

- isometric night-city block rendered on Canvas
- free driving with WASD / arrow keys
- steering, acceleration, braking and handbrake
- follow camera
- amber mission marker
- simple job completion state
- responsive HUD
- no external game assets required

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

LOWTOWN is deliberately moving toward a grimy, wet, sodium-lit 1990s crime-racer mood rather than neon cyberpunk. The next layer can replace the procedural placeholder city with authored streets, traffic, pedestrians, collisions, missions and persistent world state.
