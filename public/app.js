(() => {
  const appContainer = document.getElementById('app');
  const app = new PIXI.Application();
  globalThis.__PIXI_APP__ = app;

  // Game state
  let gameState = 'mainMenu'; // 'mainMenu', 'launching', 'flying', 'shop', 'gameOver'
  let coins = 0;
  let distance = 0;
  let recordDistance = 0;
  let launchPower = 0;
  let launchAngle = Math.PI / 4; // 45 degrees default
  let isCharging = false;
  let flightEnded = false;

  // Physics constants
  const PHYSICS_SCALE = 50; // 50 pixels = 1 meter
  const GRAVITY = -6; // Tuned for game feel
  const MAX_LAUNCH_POWER = 25; // m/s
  const POWER_CHARGE_RATE = 0.8; // power per second

  // Upgrades system
  const UPGRADES = {
    launcherPower: { 
      name: "Launch Power", 
      baseCost: 15,
      maxLevel: 10,
      effect: (level) => 1 + level * 0.3
    },
    launcherAngle: { 
      name: "Angle Control", 
      baseCost: 50, 
      maxLevel: 1,
      unlockOnly: true,
      description: "Adjust launch angle with arrow keys"
    },
    flightControl: { 
      name: "Flight Control", 
      baseCost: 150, 
      maxLevel: 1,
      unlockOnly: true,
      description: "Pitch control during flight"
    },
    controlPower: {
      name: "Control Authority",
      baseCost: 75,
      maxLevel: 5,
      effect: (level) => level * 0.5,
      requires: 'flightControl'
    }
  };

  let upgrades = {
    launcherPower: 0,
    launcherAngle: 0,
    flightControl: 0,
    controlPower: 0
  };

  // Physics world
  let world;
  let playerBody;
  let groundBodies = [];
  let camera = { x: 0, y: 0 };

  // Game objects
  let launcher;
  let player;
  let ground;
  let background;

  // Load/Save system
  function loadGameData() {
    try {
      const saved = localStorage.getItem('lift-drag-thrust-grav');
      if (saved) {
        const data = JSON.parse(saved);
        coins = data.coins || 0;
        recordDistance = data.recordDistance || 0;
        upgrades = { ...upgrades, ...data.upgrades };
      }
    } catch (e) {
      console.log('No saved data found');
    }
  }

  function saveGameData() {
    try {
      const data = {
        coins,
        recordDistance,
        upgrades,
        version: 1
      };
      localStorage.setItem('lift-drag-thrust-grav', JSON.stringify(data));
    } catch (e) {
      console.log('Failed to save data');
    }
  }

  // Physics helpers
  function createPhysicsWorld() {
    world = new planck.World({ x: 0, y: GRAVITY });
    
    // Create ground
    createGround();
    
    // Create player
    createPlayer();
    
    // Add collision detection
    world.on('begin-contact', function(contact) {
      const bodyA = contact.getFixtureA().getBody();
      const bodyB = contact.getFixtureB().getBody();
      
      // Check if player hit ground
      if ((bodyA === playerBody && groundBodies.includes(bodyB)) ||
          (bodyB === playerBody && groundBodies.includes(bodyA))) {
        if (gameState === 'flying' && !flightEnded) {
          console.log('Ground collision detected!');
          flightEnded = true;
          endFlight();
        }
      }
    });
  }

  function createGround() {
    groundBodies = [];
    
    // Create multiple ground segments
    for (let i = -5; i < 50; i++) {
      const groundBody = world.createBody({
        type: 'static',
        position: { x: i * 10, y: -2 }
      });
      
      groundBody.createFixture({
        shape: planck.Box(5, 1),
        friction: 0.7,
        restitution: 0.1
      });
      
      groundBodies.push(groundBody);
    }
    
    console.log('Created ground bodies:', groundBodies.length);
  }

  function createPlayer() {
    if (playerBody) {
      world.destroyBody(playerBody);
    }
    
    playerBody = world.createBody({
      type: 'dynamic',
      position: { x: 0, y: 2 },
      bullet: true
    });
    
    playerBody.createFixture({
      shape: planck.Circle(0.3),
      density: 1,
      friction: 0.3,
      restitution: 0.2
    });
    
    console.log('Created player body at:', playerBody.getPosition());
  }

  function resetPlayerPosition() {
    if (playerBody) {
      playerBody.setTransform({ x: 0, y: 2 }, 0);
      playerBody.setLinearVelocity({ x: 0, y: 0 });
      playerBody.setAngularVelocity(0);
    }
  }

  function launchPlayer() {
    if (!playerBody) return;
    
    const power = launchPower * MAX_LAUNCH_POWER * UPGRADES.launcherPower.effect(upgrades.launcherPower);
    const vx = Math.cos(launchAngle) * power;
    const vy = Math.sin(launchAngle) * power;
    
    playerBody.setLinearVelocity({ x: vx, y: vy });
    
    gameState = 'flying';
    distance = 0;
    flightEnded = false; // Reset flight ended flag
    updateUI();
  }

  function updatePhysics(deltaTime) {
    if (gameState === 'flying' && world) {
      // Step physics
      world.step(1/60);
      
      // Update distance
      if (playerBody) {
        const pos = playerBody.getPosition();
        distance = Math.max(distance, pos.x);
        
        // Update camera to follow player (horizontal + upward only)
        camera.x = pos.x * PHYSICS_SCALE - app.renderer.width * 0.3;
        
        // Only scroll up, never down from initial position
        const baseY = app.renderer.height * 0.7;
        const playerScreenY = -pos.y * PHYSICS_SCALE + baseY;
        camera.y = Math.min(0, playerScreenY - baseY); // Only allow upward scrolling
        
        // Check if player hit ground or went too low (more reliable detection)
        // Ground is at y = -2, player radius is 0.3, so collision at y = -1.7
        if (pos.y <= -1.5 && !flightEnded) {
          console.log('Player hit ground at y:', pos.y, 'Distance achieved:', distance);
          flightEnded = true;
          endFlight();
        }
        
        // Also check if player is moving very slowly (stuck)
        const vel = playerBody.getLinearVelocity();
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed < 0.5 && pos.y < 0 && !flightEnded) {
          console.log('Player stopped moving, ending flight. Speed:', speed, 'Y:', pos.y);
          flightEnded = true;
          endFlight();
        }
      }
      
      // Apply air resistance
      if (playerBody) {
        const vel = playerBody.getLinearVelocity();
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        const dragForce = speed * speed * 0.01; // Quadratic drag
        
        if (speed > 0) {
          const dragX = -(vel.x / speed) * dragForce;
          const dragY = -(vel.y / speed) * dragForce;
          playerBody.applyForceToCenter({ x: dragX, y: dragY });
        }
      }
    }
  }

  function endFlight() {
    coins += Math.floor(distance * 2); // 2 coins per meter
    
    if (distance > recordDistance) {
      recordDistance = distance;
    }
    
    saveGameData();
    gameState = 'gameOver';
    updateUI();
  }

  // Input handling
  let keys = {};
  
  function setupInput() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'launching') {
          isCharging = true;
        }
      }
    });
    
    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'launching' && isCharging) {
          isCharging = false;
          launchPlayer();
        }
      }
    });
  }

  function updateInput(deltaTime) {
    if (gameState === 'launching') {
      // Charge power
      if (isCharging && launchPower < 1) {
        launchPower += POWER_CHARGE_RATE * deltaTime;
        launchPower = Math.min(launchPower, 1);
      }
      
      // Adjust angle if upgraded
      if (upgrades.launcherAngle > 0) {
        if (keys['ArrowUp'] && launchAngle < Math.PI * 0.4) {
          launchAngle += Math.PI * 0.5 * deltaTime;
        }
        if (keys['ArrowDown'] && launchAngle > Math.PI * 0.1) {
          launchAngle -= Math.PI * 0.5 * deltaTime;
        }
      }
    }
    
    if (gameState === 'flying' && upgrades.flightControl > 0 && playerBody) {
      // Flight control
      const controlForce = 2 + upgrades.controlPower;
      
      if (keys['ArrowUp']) {
        playerBody.applyForceToCenter({ x: 0, y: controlForce });
      }
      if (keys['ArrowDown']) {
        playerBody.applyForceToCenter({ x: 0, y: -controlForce });
      }
    }
  }

  app.init({
    backgroundAlpha: 0,
    resizeTo: appContainer,
    antialias: true,
  }).then(() => {
    appContainer.appendChild(app.canvas);
    const stage = app.stage;

    // Create layers
    background = new PIXI.Container();
    ground = new PIXI.Container();
    const gameLayer = new PIXI.Container();
    const uiLayer = new PIXI.Container();
    
    stage.addChild(background);
    stage.addChild(ground);
    stage.addChild(gameLayer);
    stage.addChild(uiLayer);

    // UI containers
    const mainMenuContainer = new PIXI.Container();
    const launchingContainer = new PIXI.Container();
    const flyingContainer = new PIXI.Container();
    const shopContainer = new PIXI.Container();
    const gameOverContainer = new PIXI.Container();
    
    uiLayer.addChild(mainMenuContainer);
    uiLayer.addChild(launchingContainer);
    uiLayer.addChild(flyingContainer);
    uiLayer.addChild(shopContainer);
    uiLayer.addChild(gameOverContainer);

    // UI Styles
    const buttonStyle = {
      fill: 0xFFFFFF,
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
      fontSize: 24,
      fontWeight: '600',
    };
    
    const titleStyle = {
      fill: 0xFFFFFF,
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
      fontSize: 48,
      fontWeight: '700',
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowColor: 0x000000,
      dropShadowDistance: 2,
    };
    
    const textStyle = {
      fill: 0xFFFFFF,
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
      fontSize: 18,
      dropShadow: true,
      dropShadowBlur: 2,
      dropShadowColor: 0x000000,
      dropShadowDistance: 1,
    };

    // Create main menu
    function createMainMenu() {
      mainMenuContainer.removeChildren();
      
      const title = new PIXI.Text({
        text: 'lift-drag-thrust-grav',
        style: titleStyle,
      });
      title.anchor.set(0.5);
      title.x = app.renderer.width * 0.5;
      title.y = app.renderer.height * 0.25;
      mainMenuContainer.addChild(title);

      const startButton = new PIXI.Text({
        text: 'START FLIGHT',
        style: buttonStyle,
      });
      startButton.anchor.set(0.5);
      startButton.x = app.renderer.width * 0.5;
      startButton.y = app.renderer.height * 0.45;
      startButton.interactive = true;
      startButton.cursor = 'pointer';
      startButton.on('pointerdown', () => {
        gameState = 'launching';
        launchPower = 0;
        flightEnded = false;
        resetPlayerPosition();
        updateUI();
      });
      mainMenuContainer.addChild(startButton);

      const shopButton = new PIXI.Text({
        text: 'SHOP',
        style: buttonStyle,
      });
      shopButton.anchor.set(0.5);
      shopButton.x = app.renderer.width * 0.5;
      shopButton.y = app.renderer.height * 0.55;
      shopButton.interactive = true;
      shopButton.cursor = 'pointer';
      shopButton.on('pointerdown', () => {
        gameState = 'shop';
        updateUI();
      });
      mainMenuContainer.addChild(shopButton);

      const coinsText = new PIXI.Text({
        text: `💰 Coins: ${coins}`,
        style: { ...textStyle, fill: 0xFFD700 },
      });
      coinsText.anchor.set(0.5);
      coinsText.x = app.renderer.width * 0.5;
      coinsText.y = app.renderer.height * 0.7;
      mainMenuContainer.addChild(coinsText);

      const recordText = new PIXI.Text({
        text: `🏆 Record: ${Math.floor(recordDistance)}m`,
        style: { ...textStyle, fill: 0x00FF00 },
      });
      recordText.anchor.set(0.5);
      recordText.x = app.renderer.width * 0.5;
      recordText.y = app.renderer.height * 0.8;
      mainMenuContainer.addChild(recordText);
    }

    // Create launching screen
    function createLaunching() {
      launchingContainer.removeChildren();
      
      const instructions = new PIXI.Text({
        text: upgrades.launcherAngle > 0 ? 
          '🚀 Hold SPACE to charge power, Arrow keys to adjust angle' :
          '🚀 Hold SPACE to charge power, release to launch!',
        style: { ...textStyle, fontSize: 20 },
      });
      instructions.anchor.set(0.5);
      instructions.x = app.renderer.width * 0.5;
      instructions.y = 50;
      launchingContainer.addChild(instructions);

      // Power meter background
      const powerBg = new PIXI.Graphics();
      powerBg.beginFill(0x1f2937);
      powerBg.drawRect(app.renderer.width * 0.5 - 100, app.renderer.height - 80, 200, 24);
      powerBg.endFill();
      
      // Power meter border
      powerBg.lineStyle(2, 0xFFFFFF);
      powerBg.drawRect(app.renderer.width * 0.5 - 100, app.renderer.height - 80, 200, 24);
      launchingContainer.addChild(powerBg);

      // Power meter fill (green to red based on power)
      const powerFill = new PIXI.Graphics();
      const powerColor = launchPower < 0.5 ? 0x22c55e : launchPower < 0.8 ? 0xf59e0b : 0xef4444;
      powerFill.beginFill(powerColor);
      powerFill.drawRect(app.renderer.width * 0.5 - 98, app.renderer.height - 78, 196 * launchPower, 20);
      powerFill.endFill();
      launchingContainer.addChild(powerFill);
      
      // Power percentage text
      const powerText = new PIXI.Text({
        text: `${Math.floor(launchPower * 100)}%`,
        style: { ...textStyle, fontSize: 16 },
      });
      powerText.anchor.set(0.5);
      powerText.x = app.renderer.width * 0.5;
      powerText.y = app.renderer.height - 68;
      launchingContainer.addChild(powerText);

      // Angle display
      if (upgrades.launcherAngle > 0) {
        const angleText = new PIXI.Text({
          text: `📐 Angle: ${Math.round(launchAngle * 180 / Math.PI)}°`,
          style: { ...textStyle, fontSize: 16 },
        });
        angleText.anchor.set(0.5);
        angleText.x = app.renderer.width * 0.5;
        angleText.y = app.renderer.height - 120;
        launchingContainer.addChild(angleText);
      }
    }

    // Create flying screen
    function createFlying() {
      flyingContainer.removeChildren();
      
      const distanceText = new PIXI.Text({
        text: `📏 Distance: ${Math.floor(distance)}m`,
        style: { ...textStyle, fontSize: 24, fill: 0xFFD700 },
      });
      distanceText.x = 20;
      distanceText.y = 20;
      flyingContainer.addChild(distanceText);

      // Speed indicator
      if (playerBody) {
        const vel = playerBody.getLinearVelocity();
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        const speedText = new PIXI.Text({
          text: `⚡ Speed: ${Math.floor(speed * 3.6)}km/h`,
          style: { ...textStyle, fontSize: 18, fill: 0x00FF00 },
        });
        speedText.x = 20;
        speedText.y = 50;
        flyingContainer.addChild(speedText);
      }

      if (upgrades.flightControl > 0) {
        const controlText = new PIXI.Text({
          text: '🎮 Arrow keys for flight control',
          style: { ...textStyle, fontSize: 14 },
        });
        controlText.x = 20;
        controlText.y = 80;
        flyingContainer.addChild(controlText);
      }
    }

    // Create shop
    function createShop() {
      shopContainer.removeChildren();
      
      const title = new PIXI.Text({
        text: '🛒 SHOP',
        style: { ...titleStyle, fontSize: 36 },
      });
      title.anchor.set(0.5);
      title.x = app.renderer.width * 0.5;
      title.y = app.renderer.height * 0.1;
      shopContainer.addChild(title);

      let yOffset = 0;
      Object.entries(UPGRADES).forEach(([key, upgrade]) => {
        const level = upgrades[key];
        
        // Check requirements
        if (upgrade.requires && upgrades[upgrade.requires] === 0) {
          return; // Skip if requirement not met
        }
        
        // Check if maxed out
        if (upgrade.maxLevel && level >= upgrade.maxLevel) {
          const maxText = new PIXI.Text({
            text: `${upgrade.name} - MAXED`,
            style: {
              fill: 0x666666,
              fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
              fontSize: 16,
            },
          });
          maxText.anchor.set(0.5);
          maxText.x = app.renderer.width * 0.5;
          maxText.y = app.renderer.height * 0.25 + yOffset * 35;
          shopContainer.addChild(maxText);
          yOffset++;
          return;
        }
        
        const cost = upgrade.baseCost * Math.pow(1.5, level);
        const canAfford = coins >= cost;
        
        let displayText = `${upgrade.name}`;
        if (upgrade.unlockOnly) {
          displayText += level > 0 ? ' - UNLOCKED' : ` - ${Math.floor(cost)} coins`;
        } else {
          displayText += ` (Lv.${level}) - ${Math.floor(cost)} coins`;
        }
        
        if (upgrade.description && level === 0) {
          displayText += `\n${upgrade.description}`;
        }
        
        const upgradeText = new PIXI.Text({
          text: displayText,
          style: {
            ...textStyle,
            fill: canAfford ? 0xFFFFFF : 0x9CA3AF,
            fontSize: 16,
            align: 'center'
          },
        });
        upgradeText.anchor.set(0.5);
        upgradeText.x = app.renderer.width * 0.5;
        upgradeText.y = app.renderer.height * 0.25 + yOffset * 45;
        upgradeText.interactive = canAfford;
        upgradeText.cursor = canAfford ? 'pointer' : 'default';
        
        if (canAfford) {
          upgradeText.on('pointerdown', () => {
            coins -= Math.floor(cost);
            upgrades[key]++;
            saveGameData();
            createShop(); // Refresh shop
          });
        }
        shopContainer.addChild(upgradeText);
        yOffset++;
      });

      const backButton = new PIXI.Text({
        text: 'BACK TO MENU',
        style: buttonStyle,
      });
      backButton.anchor.set(0.5);
      backButton.x = app.renderer.width * 0.5;
      backButton.y = app.renderer.height * 0.9;
      backButton.interactive = true;
      backButton.cursor = 'pointer';
      backButton.on('pointerdown', () => {
        gameState = 'mainMenu';
        updateUI();
      });
      shopContainer.addChild(backButton);
    }

    // Create game over screen
    function createGameOver() {
      gameOverContainer.removeChildren();
      
      const title = new PIXI.Text({
        text: 'FLIGHT COMPLETE',
        style: {
          fill: 0xe8eefc,
          fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
          fontSize: 36,
          fontWeight: '700',
        },
      });
      title.anchor.set(0.5);
      title.x = app.renderer.width * 0.5;
      title.y = app.renderer.height * 0.25;
      gameOverContainer.addChild(title);

      const distanceText = new PIXI.Text({
        text: `Distance: ${Math.floor(distance)}m`,
        style: {
          fill: 0xaec7ff,
          fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
          fontSize: 24,
        },
      });
      distanceText.anchor.set(0.5);
      distanceText.x = app.renderer.width * 0.5;
      distanceText.y = app.renderer.height * 0.35;
      gameOverContainer.addChild(distanceText);

      const coinsEarned = new PIXI.Text({
        text: `Coins Earned: ${Math.floor(distance * 2)}`,
        style: {
          fill: 0xffe066,
          fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
          fontSize: 20,
        },
      });
      coinsEarned.anchor.set(0.5);
      coinsEarned.x = app.renderer.width * 0.5;
      coinsEarned.y = app.renderer.height * 0.45;
      gameOverContainer.addChild(coinsEarned);

      if (distance >= recordDistance - 0.1) {
        const newRecord = new PIXI.Text({
          text: 'NEW RECORD!',
          style: {
            fill: 0x4a90e2,
            fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
            fontSize: 18,
            fontWeight: '700',
          },
        });
        newRecord.anchor.set(0.5);
        newRecord.x = app.renderer.width * 0.5;
        newRecord.y = app.renderer.height * 0.55;
        gameOverContainer.addChild(newRecord);
      }

      const playAgainButton = new PIXI.Text({
        text: 'FLY AGAIN',
        style: buttonStyle,
      });
      playAgainButton.anchor.set(0.5);
      playAgainButton.x = app.renderer.width * 0.5;
      playAgainButton.y = app.renderer.height * 0.65;
      playAgainButton.interactive = true;
      playAgainButton.cursor = 'pointer';
      playAgainButton.on('pointerdown', () => {
        gameState = 'launching';
        launchPower = 0;
        flightEnded = false;
        resetPlayerPosition();
        updateUI();
      });
      gameOverContainer.addChild(playAgainButton);

      const shopButton = new PIXI.Text({
        text: 'SHOP',
        style: buttonStyle,
      });
      shopButton.anchor.set(0.5);
      shopButton.x = app.renderer.width * 0.5;
      shopButton.y = app.renderer.height * 0.75;
      shopButton.interactive = true;
      shopButton.cursor = 'pointer';
      shopButton.on('pointerdown', () => {
        gameState = 'shop';
        updateUI();
      });
      gameOverContainer.addChild(shopButton);

      const menuButton = new PIXI.Text({
        text: 'MAIN MENU',
        style: buttonStyle,
      });
      menuButton.anchor.set(0.5);
      menuButton.x = app.renderer.width * 0.5;
      menuButton.y = app.renderer.height * 0.85;
      menuButton.interactive = true;
      menuButton.cursor = 'pointer';
      menuButton.on('pointerdown', () => {
        gameState = 'mainMenu';
        updateUI();
      });
      gameOverContainer.addChild(menuButton);
    }

    // Render game world
    function renderWorld() {
      background.removeChildren();
      ground.removeChildren();
      
      // Sky gradient background (much better colors)
      const sky = new PIXI.Graphics();
      // Top sky - deep blue
      sky.beginFill(0x1e3a8a);
      sky.drawRect(-camera.x, -camera.y, app.renderer.width * 2, app.renderer.height * 0.6);
      sky.endFill();
      // Middle sky - lighter blue
      sky.beginFill(0x3b82f6);
      sky.drawRect(-camera.x, -camera.y + app.renderer.height * 0.6, app.renderer.width * 2, app.renderer.height * 0.2);
      sky.endFill();
      // Horizon - light blue
      sky.beginFill(0x93c5fd);
      sky.drawRect(-camera.x, -camera.y + app.renderer.height * 0.8, app.renderer.width * 2, app.renderer.height * 0.2);
      sky.endFill();
      background.addChild(sky);
      
      // Render ground (better colors and grass)
      groundBodies.forEach(body => {
        const pos = body.getPosition();
        const groundTile = new PIXI.Graphics();
        
        // Dirt
        groundTile.beginFill(0x8B4513);
        groundTile.drawRect(
          pos.x * PHYSICS_SCALE - 5 * PHYSICS_SCALE - camera.x,
          -pos.y * PHYSICS_SCALE - PHYSICS_SCALE - camera.y,
          10 * PHYSICS_SCALE,
          2 * PHYSICS_SCALE
        );
        groundTile.endFill();
        
        // Grass on top
        groundTile.beginFill(0x22c55e);
        groundTile.drawRect(
          pos.x * PHYSICS_SCALE - 5 * PHYSICS_SCALE - camera.x,
          -pos.y * PHYSICS_SCALE - PHYSICS_SCALE - camera.y,
          10 * PHYSICS_SCALE,
          4
        );
        groundTile.endFill();
        
        ground.addChild(groundTile);
      });
      
      // Render launcher (much more visible)
      if (gameState === 'launching') {
        const launcherGraphics = new PIXI.Graphics();
        
        // Launcher base (dark gray)
        launcherGraphics.beginFill(0x374151);
        launcherGraphics.drawRect(-camera.x - 40, -camera.y + app.renderer.height * 0.7, 80, 30);
        launcherGraphics.endFill();
        
        // Launcher barrel (bright orange for visibility)
        const barrelLength = 60;
        const barrelX = Math.cos(launchAngle) * barrelLength;
        const barrelY = -Math.sin(launchAngle) * barrelLength;
        
        launcherGraphics.lineStyle(12, 0xf97316);
        launcherGraphics.moveTo(-camera.x, -camera.y + app.renderer.height * 0.7);
        launcherGraphics.lineTo(-camera.x + barrelX, -camera.y + app.renderer.height * 0.7 + barrelY);
        
        ground.addChild(launcherGraphics);
      }
      
      // Render player (bright and visible)
      if (playerBody && (gameState === 'launching' || gameState === 'flying')) {
        const pos = playerBody.getPosition();
        const playerGraphics = new PIXI.Graphics();
        
        // Player body (bright red for visibility)
        playerGraphics.beginFill(0xef4444);
        playerGraphics.drawCircle(
          pos.x * PHYSICS_SCALE - camera.x,
          -pos.y * PHYSICS_SCALE - camera.y,
          0.3 * PHYSICS_SCALE
        );
        playerGraphics.endFill();
        
        // White outline for even better visibility
        playerGraphics.lineStyle(2, 0xFFFFFF);
        playerGraphics.drawCircle(
          pos.x * PHYSICS_SCALE - camera.x,
          -pos.y * PHYSICS_SCALE - camera.y,
          0.3 * PHYSICS_SCALE
        );
        
        // Debug: show player physics position as text
        if (gameState === 'flying') {
          console.log('Player position:', pos.x.toFixed(2), pos.y.toFixed(2));
        }
        
        ground.addChild(playerGraphics);
      }
    }

    // Update UI based on current state
    function updateUI() {
      mainMenuContainer.visible = gameState === 'mainMenu';
      launchingContainer.visible = gameState === 'launching';
      flyingContainer.visible = gameState === 'flying';
      shopContainer.visible = gameState === 'shop';
      gameOverContainer.visible = gameState === 'gameOver';

      if (gameState === 'mainMenu') {
        createMainMenu();
        camera.x = 0;
        camera.y = 0;
      } else if (gameState === 'launching') {
        createLaunching();
        camera.x = 0;
        camera.y = 0;
      } else if (gameState === 'flying') {
        createFlying();
      } else if (gameState === 'shop') {
        createShop();
      } else if (gameState === 'gameOver') {
        createGameOver();
      }
      
      renderWorld();
    }

    // Initialize everything
    createPhysicsWorld();
    setupInput();
    loadGameData();
    updateUI();

    // Resize handler
    function layout() {
      updateUI();
    }
    window.addEventListener('resize', layout);

    // Main game loop
    app.ticker.add((ticker) => {
      const deltaTime = ticker.deltaMS / 1000;
      
      updateInput(deltaTime);
      updatePhysics(deltaTime);
      
      // Update launching screen power meter
      if (gameState === 'launching') {
        createLaunching();
      }
      
      // Update flying screen distance
      if (gameState === 'flying') {
        createFlying();
      }
      
      renderWorld();
    });
  });
})();