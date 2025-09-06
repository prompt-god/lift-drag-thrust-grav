# lift-drag-thrust-grav - Design and Architecture

## Vision
Skillful 2D flight runner about energy management. Fly farther to earn coins and upgrade aero. Single-button friendly with depth.

## Stack
- Rendering: PixiJS 8
- Physics: planck.js (Box2D)
- Audio: WebAudio (Pixi sound later)
- Deploy: Static (S3 + CloudFront)

## Structure
assets/             # art, fonts, sfx
public/             # deployable static site (MVP)
  index.html
  app.js
  styles.css
src/                # future code (when we add bundling)
  app/
  render/
  physics/
  game/
    systems/
    data/
    state/
    ui/
  util/

## Loops
- Fixed physics step at 60 Hz; render on vsync.
- Deterministic RNG per run for replays.
- Object pooling; avoid per-frame allocations.

## Rendering
- Layers: background, world, vfx, ui.
- Camera follows player; parallax moves.
- Debug overlay: bodies, forces, contacts.

## Physics
- Scale: 50 px = 1 m. Player uses CCD.
- Sensors for thermals, wind, pickups.
- Sleep off-screen; prune far behind.

## Flight Model
MVP (Arcade):
- Horizontal speed plus drag; hold to pitch up torque.
- Thermals give vertical impulses; headwinds reduce forward velocity.

Aero (Next):
- Airspeed from body velocity; angle of attack vs velocity.
- Lift = 0.5 * rho * v^2 * S * CL(alpha)
- Drag = 0.5 * rho * v^2 * S * CD(alpha)
- Curves: linear near 0 deg, stall after threshold; induced drag ~ k * CL^2.

## World Content
- Thermals, wind bands, coins; hazards later.

## Economy
- Distance yields coins; upgrades: Lift, Drag, Control, Engine, Wind, Start Alt.
- Cost: base * 1.25^level; soft caps.

## State
- LocalStorage blob with schema version; store run seed.

## Tuning
- Cap forces/velocities; sub-step if unstable.
- Profile on mid phones (update < 2 ms, render < 4 ms budget).
