# Game Engine Architecture

## Overview

This flight game is built using two powerful JavaScript frameworks working together:
- **PixiJS 8**: High-performance 2D rendering engine using WebGL
- **Planck.js**: JavaScript port of Box2D physics engine

## Framework Capabilities & Usage

### PixiJS 8 - Rendering Engine

**What PixiJS Excels At:**
- Hardware-accelerated 2D graphics via WebGL
- Efficient sprite batching and texture management
- Scene graph with containers, transforms, and layers
- Built-in text rendering with styling
- Interactive object system with event handling
- Filters and effects (blur, glow, etc.)

**How We Use PixiJS:**
```javascript
// Application setup with automatic canvas management
const app = new PIXI.Application();
app.init({ backgroundAlpha: 0, resizeTo: container, antialias: true });

// Scene graph organization
stage
├── background (Container)     // Sky gradient
├── ground (Container)         // Terrain and objects  
├── gameLayer (Container)      // Game world objects
└── uiLayer (Container)        // UI overlays
    ├── mainMenuContainer
    ├── launchingContainer
    ├── flyingContainer
    └── shopContainer
```

**Graphics Rendering:**
```javascript
// Procedural graphics (no sprites needed)
const sky = new PIXI.Graphics();
sky.beginFill(0x1e3a8a);  // Deep blue
sky.drawRect(x, y, width, height);

// Text with advanced styling
const title = new PIXI.Text({
  text: 'lift-drag-thrust-grav',
  style: {
    fill: 0xFFFFFF,
    dropShadow: true,
    dropShadowBlur: 4
  }
});
```

### Planck.js - Physics Engine

**What Planck.js/Box2D Excels At:**
- Rigid body dynamics with accurate collision detection
- Continuous collision detection (CCD) for fast-moving objects
- Realistic physics: gravity, friction, restitution, forces
- Constraint system: joints, motors, springs
- Efficient broad-phase collision detection
- Stable numerical integration

**How We Use Planck.js:**
```javascript
// World creation with gravity
const world = new planck.World({ x: 0, y: GRAVITY });

// Static ground bodies
const groundBody = world.createBody({
  type: 'static',
  position: { x: i * 10, y: -2 }
});
groundBody.createFixture({
  shape: planck.Box(5, 1),  // 5x1 meter box
  friction: 0.7,
  restitution: 0.1
});

// Dynamic player body with CCD
const playerBody = world.createBody({
  type: 'dynamic',
  position: { x: 0, y: 2 },
  bullet: true  // Enables continuous collision detection
});
```

## Game Engine Architecture

### 1. Coordinate Systems

**PixiJS Screen Coordinates:**
- Origin (0,0) at top-left
- Y increases downward
- Units in pixels

**Planck.js Physics Coordinates:**
- Origin (0,0) at center
- Y increases upward (standard physics)
- Units in meters

**Conversion:**
```javascript
const PHYSICS_SCALE = 50; // 50 pixels = 1 meter

// Physics to screen
screenX = physicsX * PHYSICS_SCALE - camera.x;
screenY = -physicsY * PHYSICS_SCALE - camera.y;  // Note the Y flip
```

### 2. Game Loop Architecture

```javascript
app.ticker.add((ticker) => {
  const deltaTime = ticker.deltaMS / 1000;  // Convert to seconds
  
  updateInput(deltaTime);     // Handle keyboard/mouse
  updatePhysics(deltaTime);   // Step physics world
  updateGameLogic(deltaTime); // Game-specific updates
  render();                   // Update visual representation
});
```

**Fixed Timestep Physics:**
```javascript
function updatePhysics(deltaTime) {
  if (gameState === 'flying' && world) {
    world.step(1/60);  // Always step at 60Hz regardless of framerate
  }
}
```

### 3. State Management

**Game States:**
- `mainMenu`: Show title and options
- `launching`: Power charging and angle adjustment
- `flying`: Physics simulation active
- `shop`: Upgrade purchasing
- `gameOver`: Results and options

**State Transitions:**
```javascript
function updateUI() {
  // Hide all containers
  mainMenuContainer.visible = gameState === 'mainMenu';
  launchingContainer.visible = gameState === 'launching';
  flyingContainer.visible = gameState === 'flying';
  shopContainer.visible = gameState === 'shop';
  gameOverContainer.visible = gameState === 'gameOver';
  
  // Rebuild UI for current state
  if (gameState === 'mainMenu') createMainMenu();
  // ... etc
}
```

### 4. Physics Integration

**Body Creation:**
```javascript
function createPlayer() {
  playerBody = world.createBody({
    type: 'dynamic',
    position: { x: 0, y: 2 },
    bullet: true  // Fast-moving object needs CCD
  });
  
  playerBody.createFixture({
    shape: planck.Circle(0.3),  // 0.3 meter radius
    density: 1,
    friction: 0.3,
    restitution: 0.2
  });
}
```

**Force Application:**
```javascript
// Launch impulse
const vx = Math.cos(launchAngle) * power;
const vy = Math.sin(launchAngle) * power;
playerBody.setLinearVelocity({ x: vx, y: vy });

// Continuous forces (flight control)
playerBody.applyForceToCenter({ x: 0, y: controlForce });

// Air resistance
const vel = playerBody.getLinearVelocity();
const dragForce = speed * speed * 0.01;
playerBody.applyForceToCenter({ x: -dragX, y: -dragY });
```

**Collision Detection:**
```javascript
world.on('begin-contact', function(contact) {
  const bodyA = contact.getFixtureA().getBody();
  const bodyB = contact.getFixtureB().getBody();
  
  if ((bodyA === playerBody && groundBodies.includes(bodyB)) ||
      (bodyB === playerBody && groundBodies.includes(bodyA))) {
    // Handle collision
  }
});
```

### 5. Camera System

**Following Camera:**
```javascript
function updateCamera() {
  const pos = playerBody.getPosition();
  
  // Horizontal following
  camera.x = pos.x * PHYSICS_SCALE - app.renderer.width * 0.3;
  
  // Vertical: only scroll up, never down
  const baseY = app.renderer.height * 0.7;
  const playerScreenY = -pos.y * PHYSICS_SCALE + baseY;
  camera.y = Math.min(0, playerScreenY - baseY);
}
```

**World Rendering with Camera:**
```javascript
function renderWorld() {
  groundBodies.forEach(body => {
    const pos = body.getPosition();
    groundTile.drawRect(
      pos.x * PHYSICS_SCALE - camera.x,  // Apply camera offset
      -pos.y * PHYSICS_SCALE - camera.y, // Flip Y and apply offset
      width, height
    );
  });
}
```

### 6. Performance Optimizations

**Object Pooling:**
```javascript
// Instead of creating/destroying graphics each frame
const graphicsPool = [];
function getGraphics() {
  return graphicsPool.pop() || new PIXI.Graphics();
}
function returnGraphics(g) {
  g.clear();
  graphicsPool.push(g);
}
```

**Efficient Collision Detection:**
```javascript
// Broad phase: only check collisions for nearby objects
// Planck.js handles this automatically with spatial partitioning

// Sleep inactive bodies to save CPU
// Planck.js automatically sleeps stationary bodies
```

**Batch Rendering:**
```javascript
// Group similar graphics operations
groundLayer.removeChildren();  // Clear once
groundBodies.forEach(body => {
  // Add all ground tiles to same container
  groundLayer.addChild(groundTile);
});
```

## Current Architecture Issues & Solutions

### Issue 1: Collision Detection Not Working

**Problem:** Game doesn't end when player hits ground

**Debugging Steps:**
```javascript
// Add logging to collision callback
world.on('begin-contact', function(contact) {
  console.log('Collision detected!', contact);
  // Check if bodies are what we expect
});

// Verify ground bodies are created correctly
console.log('Ground bodies:', groundBodies.length);

// Check player position
console.log('Player Y:', playerBody.getPosition().y);
```

**Potential Fixes:**
1. **Verify Body References:** Ensure `groundBodies` array contains actual body references
2. **Check Physics Scale:** Collision might happen at different Y than expected
3. **Add Visual Debug:** Render physics body outlines to see actual collision shapes
4. **Alternative Detection:** Use position-based detection as backup

### Issue 2: Performance Optimization

**Current:** Recreating graphics every frame
```javascript
// Inefficient
function createLaunching() {
  launchingContainer.removeChildren();  // Destroys objects
  // Recreate everything...
}
```

**Better:** Update existing objects
```javascript
// Efficient
function updatePowerMeter() {
  powerFill.clear();
  powerFill.beginFill(color);
  powerFill.drawRect(x, y, width * power, height);
}
```

## Advanced Features We Could Add

### 1. Particle Systems
```javascript
// Trail behind player
const trail = new PIXI.ParticleContainer(1000, {
  position: true,
  rotation: true,
  alpha: true
});
```

### 2. Physics Joints
```javascript
// Rope/chain physics
const ropeJoint = planck.RopeJoint({
  bodyA: playerBody,
  bodyB: anchorBody,
  maxLength: 10
});
world.createJoint(ropeJoint);
```

### 3. Advanced Collision Filtering
```javascript
// Category-based collision filtering
fixture.setFilterData({
  categoryBits: 0x0001,    // What am I?
  maskBits: 0x0002,        // What do I collide with?
  groupIndex: 0            // Group behavior
});
```

This architecture leverages both frameworks' strengths: PixiJS for smooth 60fps rendering and rich UI, Planck.js for realistic physics simulation. The key is keeping them synchronized through proper coordinate conversion and timing.
