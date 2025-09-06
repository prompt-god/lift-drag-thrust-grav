# Flight Mechanics & Graphics Plan

## Core Flight Components

### 1. Launcher System
**Fixed Angle Launcher (MVP):**
- Default launch angle: 45° 
- Power meter: hold space to charge, release to launch
- Visual: simple cannon/launcher sprite
- Physics: initial velocity = power * base_speed * angle_vector

**Upgrades:**
- `launcherAngle`: Unlock adjustable launch angle (arrow keys up/down)
- `launcherPower`: Increase max launch power
- `launcherControl`: Finer angle control (smaller increments)

### 2. Flight Controls
**Basic Flight:**
- No mid-flight control initially
- Gravity + air resistance only
- Simple ballistic trajectory

**Upgrades:**
- `flightControl`: Unlock pitch adjustment during flight
- `controlPower`: Stronger pitch control authority
- `controlDuration`: Longer control time/fuel

**Controls:**
- Space: Launch (hold to charge power)
- Up/Down arrows: Adjust launch angle (if upgraded) OR flight pitch (if in flight + upgraded)

### 3. Physics System (planck.js)

**World Setup:**
- Scale: 50 pixels = 1 meter (as planned)
- Gravity: -9.8 m/s² (or tuned for game feel)
- Ground collision detection
- Air resistance/drag simulation

**Player Body:**
- Dynamic body with bullet CCD
- Simple shape: circle or small polygon
- Mass affects momentum vs control authority

**Forces:**
- Gravity (constant downward)
- Air drag (velocity-dependent)
- Control forces (if upgraded, limited duration/fuel)

## Graphics Architecture

### 1. Asset Loading System
```javascript
const AssetManager = {
  sprites: new Map(),
  
  async load(manifest) {
    // Load sprites, set up atlases, handle fallbacks
  },
  
  get(name) {
    // Return sprite or fallback placeholder
  }
}
```

**Asset Manifest (JSON):**
```json
{
  "player": { "src": "player.png", "fallback": "circle" },
  "launcher": { "src": "launcher.png", "fallback": "rectangle" },
  "ground": { "src": "ground-tile.png", "fallback": "rectangle" },
  "background": { "src": "sky.png", "fallback": "gradient" }
}
```

### 2. Rendering Layers
```
Layer 5: UI (distance, power meter, controls)
Layer 4: Particles (smoke, debris)  
Layer 3: Player
Layer 2: Foreground objects (obstacles later)
Layer 1: Ground
Layer 0: Background (sky, clouds)
```

### 3. Camera System
**Horizontal Scrolling:**
- Camera follows player with offset
- Ground tiles repeat/stream
- Background parallax (slower movement)
- Smooth camera interpolation

**Fallback Graphics (No Assets):**
- Player: Yellow circle
- Launcher: Gray rectangle
- Ground: Brown rectangles
- Background: Gradient sky
- Particles: Colored circles

### 4. Scalable Development
**Phase 1 (Geometric shapes):**
- Colored PIXI.Graphics primitives
- Focus on mechanics and feel

**Phase 2 (Simple sprites):**
- Basic pixel art or simple PNGs
- Replace shapes one-by-one

**Phase 3 (Polish):**
- Detailed sprites, animations
- Particle effects, screen shake
- Sound effects integration

## Implementation Order

### MVP (Geometric Flight)
1. Remove test upgrades, add real upgrade structure
2. Add planck.js physics world
3. Create launcher with power meter
4. Implement basic flight physics
5. Add ground collision and distance measurement
6. Simple scrolling camera

### Upgrades System Redesign
```javascript
const UPGRADES = {
  launcherPower: { 
    name: "Launch Power", 
    baseCost: 10, 
    effect: (level) => 1 + level * 0.2 
  },
  launcherAngle: { 
    name: "Angle Control", 
    baseCost: 50, 
    unlockOnly: true,
    description: "Adjust launch angle with arrow keys"
  },
  flightControl: { 
    name: "Flight Control", 
    baseCost: 100, 
    unlockOnly: true,
    description: "Pitch control during flight"
  }
}
```

### Graphics Integration Points
- `AssetManager.get('player')` returns sprite or fallback
- Easy to swap assets without changing game logic
- Graceful degradation if assets fail to load
- Hot-swappable for rapid iteration

## Technical Notes

**Performance Targets:**
- 60 FPS on mobile
- Physics step: 1/60s fixed timestep
- Render interpolation for smooth visuals
- Object pooling for particles/effects

**Physics Tuning:**
- Adjust gravity for game feel (maybe -6 instead of -9.8)
- Air resistance curve for realistic but fun trajectory
- Ground "bounce" vs "stick" behavior
- Control force limits to prevent overpowered flight

**Camera Behavior:**
- Lead the player slightly (anticipate movement)
- Zoom out slightly as speed increases
- Return to launch position after crash
- Smooth transitions between game states

This plan gives us a solid foundation that starts simple but scales up beautifully as we add assets and polish.
