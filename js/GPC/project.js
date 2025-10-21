let scene, camera, renderer, player, clock;
let playerVelocity = new THREE.Vector3();
let playerOnGround = false;
let gameSpeed = 13;
const gravity = -20;
const jumpForce = 12;
// Add lateral speed for arrow-key movement (prevents ReferenceError when pressing arrows)
const lateralSpeed = 12;
const pathSegments = [];
const segmentLength = 50;
const basePathWidth = 10;
const minPathWidth = 5;
// Jump responsiveness: buffer and coyote time (seconds)
const JUMP_BUFFER_TIME = 0.12;
const COYOTE_TIME = 0.12;
// Make gap platform spacing valid (used in spawnPlatformsAcrossGapChaos)
const minGapPlatformDistance = 4.5;
let currentDifficultyPathWidth = basePathWidth;
// Global path width (authoritative current path width)
let pathWidth = basePathWidth;
const worldObjects = [];
let particleSystems = [];
// Directional light refs to control shadow coverage ahead of the player
let dirLight = null, shadowTarget = null;
// Add a player-following spotlight to guarantee shadows right under the ball
let spotLight = null;

// controls
let inputLeft = false;
let inputRight = false;
// Jump buffering/coyote timers
let jumpBuffer = 0;
let coyoteTimer = 0;
// Start gate: game paused until Space starts countdown
let gameStarted = false;

let gameOver = false;
let score = 0;
let scoreDiv = null;
let gameOverDiv = null;

// Life system variables
let lives = 3;
let livesDiv = null;

// Pause/countdown state
let paused = false;
let countdownDiv = null;
let countdownNum = null;
let countdownRemaining = 0;
let countdownCallback = null;
// Track if a countdown is active to avoid auto-unpause at start
let countdownActive = false;

// Difficulty tuning
const shrinkStartScore = 150;
const shrinkFullScore = 1200;
const gapStartScore = 300;
const gapFullScore = 1500;
const maxGapProbability = 0.35;
const obstaclePatternStartScore = 40;
let lastSegmentWasGap = false;

// Neon palette and helpers
// Replace generic NEON_COLORS with explicit palette for other objects and fixed colors for ball/path
const BALL_COLOR = 0x00ff6a; // neon green for the player (unique)
const PATH_COLOR = 0x0b1026; // deep indigo for the path (unique)
const PATH_EMISSIVE = 0x101a40;

// Object palette: ranges of purple, blue, pink, gray and white (biased to vibrant colors)
const OBJECT_COLORS = [
  // purples
  0x8B26FF, 0x8B26FF, 0x965DD9, 0x7200FF, 0x9d4dff, 0xb26bff, 0x3C027A,
  // blues
  0x007bff, 0x1e90ff, 0x3399ff, 0x3aa0ff, 0x66aaff, 0x66ccff, 0x99ddff,
  // pinks
  0xD800DB, 0xD250D4, 0x942394, 0xFF45FF, 0xff77ff, 0xff99cc,
  // gray
  0x999999, 0xbbbbbb,
  // white
  0xffffff
];

function createNeonMaterial(colorHex, intensity = 1.4) {
  const effectiveEmissive = 0.2 + Math.min(intensity, 2.5) * 0.2; // caps around ~0.7
  return new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: effectiveEmissive,
    metalness: 0.25,
    roughness: 0.5
  });
}

function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

// New prefab sets
const prefabs = [
  // Replace the hard Laser Storm with easier gates, and add two new prefabs
  { name: "Neon Gates", spawn: spawnNeonGates },
  { name: "Sweeper Pair", spawn: spawnSweeperPair },
  { name: "Pulsing Rings", spawn: spawnPulsingRings },
  { name: "Stairs", spawn: spawnStairs },
  { name: "Wall Slalom", spawn: spawnWallSlalom },
  { name: "Floating Orbs", spawn: spawnFloatingOrbs }
];

// --- Initialization ---
function init() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03030a);
  scene.fog = new THREE.Fog(0x03030a, 20, 200);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  // Lights
  const hemi = new THREE.HemisphereLight(0x4a64ff, 0x080818, 0.45);
  scene.add(hemi);
  // Directional light: follows player and points slightly ahead
  dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(0, 28, 8); // initial; updated per-frame
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 24;
  dirLight.shadow.camera.bottom = -12;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 90;
  dirLight.shadow.bias = -0.0006;
  dirLight.shadow.normalBias = 0.025;
  shadowTarget = new THREE.Object3D();
  shadowTarget.position.set(0, 0, -6); // aim slightly ahead along the lane
  dirLight.target = shadowTarget;
  scene.add(shadowTarget);
  scene.add(dirLight);

  // Spotlight: directly above player, tight cone for strong nearby shadows
  spotLight = new THREE.SpotLight(0xffffff, 0.9, 70, Math.PI/4, 0.35, 1.0);
  spotLight.position.set(0, 14, 4);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.set(1024, 1024);
  spotLight.shadow.bias = -0.0008;
  spotLight.shadow.normalBias = 0.03;
  scene.add(spotLight);
  scene.add(spotLight.target);

  // UI: use elements defined in HTML
  scoreDiv = document.getElementById('score-div');
  livesDiv = document.getElementById('lives-div');
  gameOverDiv = document.getElementById('game-over');
  countdownDiv = document.getElementById('countdown');
  countdownNum = document.getElementById('countdown-number');
  if (scoreDiv) scoreDiv.innerText = 'Score: 0';
  if (livesDiv) livesDiv.innerHTML = '🖤'.repeat(lives);

  createPlayer();

  // Create initial path segments so player stands on ground
  for (let i=0;i<12;i++){
    const s = createPathSegment(-i*segmentLength);
    configureSegmentDifficulty(s);
    // Make first rows safe: no gaps or objects near the start
    if (i < 4){
      if (s.userData.gapMeshes){
        for (const gm of s.userData.gapMeshes){
          try { scene.remove(gm); } catch(e){}
          const idx = worldObjects.indexOf(gm);
          if (idx !== -1) worldObjects.splice(idx,1);
        }
      }
      s.userData.gapMeshes = [];
      s.userData.gapZones = [];
    } else {
      spawnDynamicObjects(s);
    }
  }

  setupControls();
  window.addEventListener('resize', onWindowResize, false);

  // initial update to avoid fall-through
  scene.updateMatrixWorld(true);

  // Start paused; show hint and wait for Space to start countdown
  paused = true;
  countdownActive = false;
  if (countdownDiv) countdownDiv.style.display = 'block';
  if (countdownNum) countdownNum.textContent = 'Press SPACE to start';

  animate();
}

// --- Player & path ---
function createPlayer(){
  const g = new THREE.SphereGeometry(0.5, 48, 48);
  const m = createNeonMaterial(BALL_COLOR, 2.2);
  player = new THREE.Mesh(g,m);
  player.position.set(0,0.5,0);
  player.castShadow = true;
  player.name = "player";
  scene.add(player);
  worldObjects.push(player);

  // neon trail
  player.userData.trail = [];
  for (let i=0;i<8;i++){
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.52 - i*0.05, 8, 8), createNeonMaterial(BALL_COLOR, 1.2));
    t.material.transparent = true;
    t.material.opacity = 0.5 - i*0.06;
    t.visible = false;
    scene.add(t);
    player.userData.trail.push(t);
  }
}

function createPathSegment(zPos){
  const geometry = new THREE.PlaneGeometry(basePathWidth, segmentLength, 2, 2);
  const material = new THREE.MeshStandardMaterial({
    color: PATH_COLOR,
    emissive: PATH_EMISSIVE,
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide
  });
  // Ensure stable receiving under the player
  material.shadowSide = THREE.FrontSide;
  const segment = new THREE.Mesh(geometry, material);
  segment.rotation.x = -Math.PI/2;
  segment.position.set(0,0,zPos);
  segment.receiveShadow = true;
  segment.name = "path";
  segment.userData.width = basePathWidth;
  segment.userData.isGap = false;
  // track small gap zones and their visual meshes
  segment.userData.gapZones = [];  
  segment.userData.gapMeshes = [];  
  scene.add(segment);
  pathSegments.push(segment);
  worldObjects.push(segment);
  return segment;
}

function configureSegmentDifficulty(segment){
  currentDifficultyPathWidth = currentPathWidth();
  // Use global path width for all X-related computations
  pathWidth = currentPathWidth();
  currentDifficultyPathWidth = pathWidth; // keep old var in sync for safety
  segment.userData.width = pathWidth;
  segment.scale.x = pathWidth / basePathWidth;

  // clear previous small gaps
  if (segment.userData.gapMeshes && segment.userData.gapMeshes.length){
    for (const gm of segment.userData.gapMeshes){
      try { scene.remove(gm); } catch(e){}
      const idx = worldObjects.indexOf(gm);
      if (idx !== -1) worldObjects.splice(idx,1);
    }
  }
  segment.userData.gapZones = [];
  segment.userData.gapMeshes = [];

  // Disable small gaps entirely to ensure the path never disappears
  // (previously: probabilistic creation of gap strips)
  let createdGaps = false;

  // keep segment always visible and mark no gaps
  segment.visible = true;
  segment.userData.isGap = false;
  lastSegmentWasGap = createdGaps;

  // Fixed tint for path (no dynamic hue changes)
  if (segment.visible){
    segment.material.color.setHex(PATH_COLOR);
    segment.material.emissive.setHex(PATH_EMISSIVE);
    segment.material.emissiveIntensity = 0.35;
  }
}

function currentPathWidth(){ if (score < shrinkStartScore) return basePathWidth; const t = Math.min((score - shrinkStartScore)/(shrinkFullScore - shrinkStartScore),1); return basePathWidth - t*(basePathWidth-minPathWidth); }
function gapProbability(){ 
  // Force no gaps to be created anywhere
  return 0; 
}

// --- Spawning & prefabs () ---
function spawnDynamicObjects(segment){

  // increase prefab spawn chance a bit
  const prefabChance = clamp((score/200), 0.2, 0.75);
  if (Math.random() < prefabChance){
    const prefab = randChoice(prefabs);
    prefab.spawn(segment.position.z);
    return;
  }

  // more frequent random spawns
  spawnObject(segment.position.z - segmentLength*0.25);
  spawnObject(segment.position.z + segmentLength*0.25);
  if (Math.random() < 0.85) spawnObject(segment.position.z);
}

// spawn platform clusters across gap 
function spawnPlatformsAcrossGap(segment){
  const usableLength = segmentLength*0.95;
  const startZ = segment.position.z - usableLength/2;
  const endZ = segment.position.z + usableLength/2;
  let currentZ = startZ;
  const jumpHeight = (jumpForce*jumpForce)/(2*Math.abs(gravity));
  const idealD = Math.max(minGapPlatformDistance, jumpHeight*0.9);

  while (currentZ < endZ-3){
    if (Math.random() < 0.6){
      // cluster
      const clusterCount = 1 + Math.floor(Math.random()*2);
      for (let i=0;i<clusterCount;i++){
        const x = (Math.random()-0.5)*(pathWidth*0.7);
        const y = 1.5 + Math.random()*3.0;
        spawnObject(currentZ + i*3, true, { x: x, y: y, size:{w:2,h:0.45,d:2} });
      }
      currentZ += idealD + 2 + Math.random()*2;
    } else {
      const x = (Math.random()-0.5)*(pathWidth*0.7);
      spawnObject(currentZ, true, { x: x, y: 1.8 + Math.random()*2.2 });
      currentZ += idealD*(0.9 + Math.random()*0.8);
    }
  }
}

// Basic random object spawn
function spawnObject(zPos, forcedPlatform=false, patternObj=null){
  const width = pathWidth;
  let x = patternObj && typeof patternObj.x !== 'undefined' ? patternObj.x : (Math.random()*2-1)*(width/2 - 0.9);
  let type = patternObj && patternObj.type ? patternObj.type : (forcedPlatform ? 'platform' : (Math.random()<0.65 ? 'platform':'obstacle'));
  let obj = null;

  if (type === 'platform'){
    const h = patternObj && patternObj.y ? patternObj.y : 1 + Math.random()*3.0;
    const size = patternObj && patternObj.size ? patternObj.size : { w: 2, h:0.45, d: 2 };
    const geom = new THREE.BoxGeometry(size.w, size.h, size.d);
    const mat = createNeonMaterial(randChoice(OBJECT_COLORS), 1.8);
    obj = new THREE.Mesh(geom, mat);
    obj.position.set(x, h, zPos + (patternObj && patternObj.z?patternObj.z:0));
    obj.name = 'platform';
    // floating movement for 
    if (Math.random()<0.25){
      obj.userData.isMoving = true;
      obj.userData.movementType = 'vertical';
      obj.userData.initialY = obj.position.y;
      obj.userData.speed = 1.2 + Math.random()*2.0; // was 0.8..2.4
      obj.userData.range = 0.9 + Math.random()*1.8; // slightly larger motion
    }
    // sometimes make it crumble
    if (Math.random() < 0.15){
      makePlatformCrumble(obj);
    }
  } else {
    // obstacle - cube or small pillar
    if (Math.random() < 0.45){
      const geom = new THREE.CylinderGeometry(0.5,0.5,1.2,12);
      const mat = createNeonMaterial(randChoice(OBJECT_COLORS), 2.0);
      obj = new THREE.Mesh(geom, mat);
      obj.position.set(x, 0.6, zPos);
      obj.name = 'obstacle';
    } else {
      // Create a row of cubes that fills the path width without exceeding it
      const cubeW = 1.2;
      const cubeH = 1.2;
      const spacing = 0.2;
      const halfW = pathWidth / 2;
      const safeMargin = 0.1; 
      const usable = Math.max(0, pathWidth - safeMargin*2);
      const count = Math.max(1, Math.floor((usable + spacing) / (cubeW + spacing)));
      const totalWidth = (count * cubeW) + ((count - 1) * spacing);
      const startX = -totalWidth/2;

      // Randomly decide whether this row will move and which way 
      const rowMoves = Math.random() < 0.8;
      const rowMoveType = Math.random() < 0.5 ? 'horizontal' : 'vertical';
      const baseSpeed = 1.2 + Math.random()*0.8;
      const staggerInterval = 0.22 + Math.random()*0.18;

      for (let i = 0; i < count; i++){
        const cx = startX + i * (cubeW + spacing);
        const geom = new THREE.BoxGeometry(cubeW, cubeH, 1.2);
        const mat = createNeonMaterial(randChoice(OBJECT_COLORS), 2.0);
        const cube = new THREE.Mesh(geom, mat);
        // position on path and clamp inside margins
        const clampedX = THREE.MathUtils.clamp(cx, -halfW + safeMargin + cubeW/2, halfW - safeMargin - cubeW/2);
        cube.position.set(clampedX, cubeH/2, zPos);
        cube.name = 'obstacle';
        cube.castShadow = true;
        cube.receiveShadow = true;

        if (rowMoves){
          cube.userData.isMoving = true;
          cube.userData.movementType = rowMoveType;
          cube.userData.initialX = cube.position.x;
          cube.userData.initialY = cube.position.y;
          cube.userData.speed = baseSpeed * (0.95 + Math.random()*0.1);
          // safe horizontal range based on proximity to edges; vertical uses a gentle bob
          if (rowMoveType === 'horizontal'){
            const leftEdge = -halfW + safeMargin + cubeW/2;
            const rightEdge = halfW - safeMargin - cubeW/2;
            const distLeft = cube.position.x - leftEdge;
            const distRight = rightEdge - cube.position.x;
            const maxRange = Math.max(0.3, Math.min(distLeft, distRight, 1.5));
            cube.userData.range = maxRange;
          } else {
            cube.userData.range = 0.6 + Math.random()*1.8;
          }
          // sequential start: each cube starts after a small per-index delay
          cube.userData.staggerStartTime = (typeof clock !== 'undefined' && clock) ? (clock.elapsedTime + i * staggerInterval) : (i * staggerInterval);
          cube.userData.phase = 0;
        }

        scene.add(cube);
        worldObjects.push(cube);
      }
      // Already spawned the row; do not proceed with single-object flow
      return;
    }
    // moving obstacles often, faster and a bit larger range
    if (Math.random() < 0.7){
      obj.userData.isMoving = true;
      obj.userData.movementType = Math.random()<0.6 ? 'horizontal' : 'vertical';
      obj.userData.initialX = obj.position.x;
      obj.userData.initialY = obj.position.y;
      obj.userData.speed = 1.8 + Math.random()*2.2;
      obj.userData.range = 0.0 + Math.random()*2.8;
    }
  }

  if (!obj) return;
  obj.castShadow = true;
  obj.receiveShadow = true;
  scene.add(obj);
  worldObjects.push(obj);
}

// ---  prefabs implementations ---

// 1) Neon Gates: gentle gates near the edges leaving a wide center lane
function spawnNeonGates(centerZ){
  const steps = 4 + Math.floor(Math.random()*2);
  const gapZ = 10 ;
  const pillarW = Math.max(0.7, pathWidth * 0.12);
  const pillarH = 1.6;
  const halfW = pathWidth/2;
  for (let i=0;i<steps;i++){
    const z = centerZ + (i - steps/2)*gapZ;
    // left and right pillars
    const geom = new THREE.BoxGeometry(pillarW, pillarH, 0.5);
    const mat = createNeonMaterial(randChoice(OBJECT_COLORS), 2.2);
    const left = new THREE.Mesh(geom, mat);
    left.position.set(-halfW + pillarW/2 + 0.2, pillarH/2, z);
    left.castShadow = true; left.receiveShadow = true; left.name = 'gate';
    const right = new THREE.Mesh(geom, mat.clone());
    right.position.set(halfW - pillarW/2 - 0.2, pillarH/2, z);
    right.castShadow = true; right.receiveShadow = true; right.name = 'gate';
    scene.add(left); scene.add(right);
    worldObjects.push(left); worldObjects.push(right);
    const topBeam = new THREE.Mesh(
      new THREE.BoxGeometry(pathWidth - pillarW*2 - 0.6, 0.2, 0.4),
      createNeonMaterial(randChoice(OBJECT_COLORS), 1.8)
    );
    if (steps % 2 === 0){
        topBeam.position.set(0, pillarH + 0.3, z);
    } else {
        topBeam.position.set(0, 0.3, z);
    }
    topBeam.castShadow = true; topBeam.receiveShadow = true; topBeam.name = 'gate';
    scene.add(topBeam); worldObjects.push(topBeam);
  }
}

// 2) Sweeper Pair: two side sweepers moving slowly near edges, leaving a safe middle lane
function spawnSweeperPair(centerZ){
  const halfW = pathWidth/2;
  const len = 2.6;
  const barGeom = new THREE.BoxGeometry(1.6, 0.2, len);
  const mat = createNeonMaterial(randChoice(OBJECT_COLORS), 2.5);

  const makeSweeper = (side)=> {
    const bar = new THREE.Mesh(barGeom, mat.clone());
    const range = Math.max(0.8, pathWidth * 0.25);
    bar.position.set(side * (halfW - 1.2), 0.9, centerZ);
    bar.castShadow = true; bar.receiveShadow = true; bar.name = 'sweeper';
    bar.userData.isMoving = true;
    bar.userData.movementType = 'horizontal';
    bar.userData.initialX = bar.position.x;
    bar.userData.range = range * 0.7;
    bar.userData.speed = 1.4 + Math.random()*2.0; // faster
    bar.userData.phase = side > 0 ? 0 : Math.PI; // alternate
    scene.add(bar); worldObjects.push(bar);
  };

  makeSweeper(-1);
  makeSweeper(1);
}

// 3) Pulsing Rings: static rings that gently pulse in size and sit slightly above ground
function spawnPulsingRings(centerZ){
  const count = 2 + Math.floor(Math.random()*2);
  for (let i=0;i<count;i++){
    const x = (Math.random()*2-1)*(pathWidth/2 - 1.4);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.08, 10, 18),
      createNeonMaterial(randChoice(OBJECT_COLORS), 2.8)
    );
    ring.position.set(x, 0.5, centerZ + (i - (count/2))*3.0);
    ring.rotation.x = Math.PI/2;
    ring.castShadow = true; ring.receiveShadow = true;
    ring.name = 'ring';
    ring.userData.pulse = true;
    ring.userData.pulseSpeed = 1.5 + Math.random();
    ring.userData.phase = Math.random()*Math.PI*2;
    scene.add(ring); worldObjects.push(ring);
  }
}

// 5) Stairs: a series of small platforms ascending in height
function spawnStairs(centerZ){
  const steps = 5 + Math.floor(Math.random()*3); // 5..7 steps
  const stepDepth = 5;                          // z size of each step
  const stepSpacing = 5;                        // z spacing between step centers
  const baseY = 0.6;                              // starting height
  const risePerStep = 0.55;                       // height increment per step
  const w = pathWidth;                            // full path width
  const h = 0.45;                                 // platform thickness

  for (let i = steps; i > 0; i--){
    const z = centerZ + (i - Math.floor(steps/2)) * stepSpacing;
    const y = baseY + (risePerStep * steps) - i * risePerStep;

    const geom = new THREE.BoxGeometry(w, h, stepDepth);
    const mat = createNeonMaterial(randChoice(OBJECT_COLORS), 2.0);
    const platform = new THREE.Mesh(geom, mat);
    platform.position.set(0, y, z);
    platform.name = 'platform'; // keep as a stable landing surface (no crumble)
    platform.castShadow = true;
    platform.receiveShadow = true;

    scene.add(platform);
    worldObjects.push(platform);
  }
}

function makePlatformCrumble(platform){
  platform.userData.crumble = true;
  platform.userData.crumbleTriggered = false;
  // reduce crumble glow so it doesn't blast brightness
  platform.material.emissiveIntensity = 0.8;
}

// 6) Wall Slalom: alternating walls creating narrow S path
function spawnWallSlalom(centerZ){
  const steps = 5 + Math.floor(Math.random()*4);
  const gap = 8;
  for (let i=0;i<steps;i++){
    const side = (i%2===0)? -1 : 1;
    const w = pathWidth*0.35;
    const geom = new THREE.BoxGeometry(w,1.5, gap-0.4);
    const mat = createNeonMaterial(randChoice(OBJECT_COLORS),2.5);
    const wall = new THREE.Mesh(geom, mat);
    const x = side*(pathWidth/2 - w/2 - 0.3);
    const z = centerZ + (i-steps/2)*gap;
    wall.position.set(x, 0.9, z);
    wall.name = 'wall';
    scene.add(wall);
    worldObjects.push(wall);
  }
}

// 7) Floating Orbs: moving spheres that chase slightly horizontally
function spawnFloatingOrbs(centerZ){
  const cnt = 3 + Math.floor(Math.random()*6);
  for (let i=0;i<cnt;i++){
    const geom = new THREE.SphereGeometry(0.45, 12, 12);
    const mat = createNeonMaterial(randChoice(OBJECT_COLORS), 3.0);
    const orb = new THREE.Mesh(geom, mat);
    const x = (Math.random()*2-1)*(pathWidth - 0.8);
    orb.position.set(x, 1.2 + Math.random()*1.6, centerZ + (i-(cnt/2))*3.2);
    orb.name = 'orb';
    orb.userData.isFloating = true;
    orb.userData.speed = 1.2 + Math.random()*1.6; // faster bob/drift
    orb.userData.range = 1.4 + Math.random()*2.0;
    orb.userData.phase = Math.random()*Math.PI*2;
    // ensure we have a baseline for vertical oscillation
    orb.userData.initialY = orb.position.y;
    scene.add(orb);
    worldObjects.push(orb);
  }
}

// --- Particle & FX helpers ---
function spawnParticleBurst(zPos, amount=10){
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(amount*3);
  for (let i=0;i<amount;i++){
    positions[i*3+0] = (Math.random()*2-1)*2;
    positions[i*3+1] = Math.random()*2;
    positions[i*3+2] = (Math.random()*2-1)*2;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.08,
    color: randChoice(OBJECT_COLORS),
    transparent:true,
    opacity:0.9
  });
  const pts = new THREE.Points(geom, mat);
  pts.position.set(0,1.2,zPos);
  pts.userData.life = 0.8;
  scene.add(pts);
  particleSystems.push(pts);
}

// --- Collision, update, life & respawn ---
function hasGroundUnderPlayer(){
  const px = player.position.x;
  const pz = player.position.z;
  for (const seg of pathSegments){
    // ignore full gaps (not used anymore), keep check by z and width
    const z0 = seg.position.z - segmentLength/2;
    const z1 = seg.position.z + segmentLength/2;
    if (pz >= z0 && pz <= z1){
      const halfW = seg.userData.width/2;
      if (px >= -halfW && px <= halfW){
        // check if inside any small gap strip on this segment
        if (seg.userData && Array.isArray(seg.userData.gapZones)){
          for (const gz of seg.userData.gapZones){
            if (pz >= gz.z0 && pz <= gz.z1){
              return false; // over a small gap -> no ground
            }
          }
        }
        return true;
      }
    }
  }
  return false;
}

function updatePlayer(delta){
  prevPlayerY = player.position.y;
  if (!playerOnGround) playerVelocity.y += gravity*delta;
  player.position.y += playerVelocity.y*delta;

  // clamp to ground if a non-gap segment below
  if (player.position.y <= player.geometry.parameters.radius && hasGroundUnderPlayer()){
    player.position.y = player.geometry.parameters.radius;
    playerVelocity.y = 0;
    playerOnGround = true;
  } else if (playerVelocity.y === 0 && !hasGroundUnderPlayer()){
    playerOnGround = false;
  } else if (player.position.y > player.geometry.parameters.radius){
    playerOnGround = false;
  }

  // update trail
  const trail = player.userData.trail;
  for (let i=trail.length-1;i>0;i--){
    const a = trail[i-1], b = trail[i];
    b.position.copy(a.position);
    b.visible = a.visible;
    b.material.emissive.copy(a.material.emissive);
  }
  // head of trail
  trail[0].position.copy(player.position);
  trail[0].visible = true;
  trail[0].material.emissive.copy(player.material.emissive);

  // collision
  const playerBox = new THREE.Box3().setFromObject(player);
  for (const obj of worldObjects){
    if (obj === player) continue;
    if (obj.name === 'path') continue;
    // skip removed
    if (!obj.parent) continue;
    const objBox = new THREE.Box3().setFromObject(obj);
    if (!playerBox.intersectsBox(objBox)) continue;

    // special handling
    if (obj.name === 'platform' || obj.name === 'crumble_platform'){
      const topY = obj.position.y + (obj.geometry.parameters.height || obj.geometry.parameters.depth || 0)/2;
      const r = player.geometry.parameters.radius;
      if (playerVelocity.y <= 0 && (prevPlayerY - r) >= topY - 0.15 && (player.position.y - r) <= topY + 0.2){
        player.position.y = topY + r;
        playerVelocity.y = 0;
        playerOnGround = true;
        // crumble logic
        if (obj.userData.crumble && !obj.userData.crumbleTriggered){
          obj.userData.crumbleTriggered = true;
          setTimeout(()=>{ // fall after short delay
            // drop animation
            const fallVel = { v:0 };
            // remove collision by setting name and making invisible to ground check
            obj.name = 'falling';
            obj.userData.isFalling = true;
            // let physics in animate handle dropping and removal
          }, 600 + Math.random()*700);
        }
      } else {
        loseLife();
        return;
      }
    } else {
      // other hazards
      loseLife();
      return;
    }
  }

  if (player.position.y < -20) loseLife();
}

// lose life & respawn
function loseLife(){
  if (gameOver || paused || player.userData.invincible) return;
  lives--;
  if (livesDiv) livesDiv.innerHTML = '🖤'.repeat(Math.max(0, lives));
  spawnParticleBurst(player.position.z, 18);
  if (lives > 0) {
    // Start 3-second countdown, then respawn and resume
    startCountdown(3, () => respawnPlayer());
  } else {
    gameOver = true; showGameOver();
  }
}

function startCountdown(seconds, onComplete){
  paused = true;
  countdownActive = true;
  countdownRemaining = Math.max(0, seconds);
  countdownCallback = onComplete;
  if (countdownDiv) countdownDiv.style.display = 'block';
  if (countdownNum) countdownNum.textContent = Math.ceil(countdownRemaining).toString();
}

function updateCountdown(delta){
  if (!paused || !countdownActive) return;
  countdownRemaining -= delta;
  if (countdownNum) countdownNum.textContent = Math.max(1, Math.ceil(countdownRemaining)).toString();
  if (countdownRemaining <= 0){
    if (countdownDiv) countdownDiv.style.display = 'none';
    paused = false;
    countdownActive = false;
    const cb = countdownCallback; countdownCallback = null;
    if (typeof cb === 'function') cb();
  }
}

function respawnPlayer(){
  player.position.set(0,0.5,0);
  playerVelocity.set(0,0,0);
  playerOnGround = true;
  player.userData.invincible = true;
  setTimeout(()=>{ player.userData.invincible = false; }, 900);
  // remove non-path objects in immediate area to avoid unfair spawn
  for (let i=worldObjects.length-1;i>=0;i--){
    const o = worldObjects[i];
    if (!o.parent) continue;
    if (o.name !== 'player' && o.name !== 'path' && Math.abs(o.position.z) < 30){
      scene.remove(o);
      worldObjects.splice(i,1);
    }
  }
  // reconfigure segments nearby to be safer briefly
  pathSegments.forEach(s=>{ configureSegmentDifficulty(s); });
  // ensure HUD reflects current lives after respawn invincibility
  if (livesDiv) livesDiv.innerHTML = '🖤'.repeat(Math.max(0, lives));
}

// --- Animate loop ---
function animate(){
  if (gameOver) return;
  scene.updateMatrixWorld(true);
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // If paused, only update countdown and render frame (no world/score updates)
  if (paused){
    updateCountdown(delta);
    renderer.render(scene, camera);
    return;
  }

  score += delta*12;
  if (scoreDiv) scoreDiv.innerText = 'Score: '+Math.floor(score);

  // pulse background color with score/time for 
  const hue = (Math.sin(clock.elapsedTime*0.6) + 1)/2 * 0.08; // small hue shift
  scene.background = new THREE.Color().setHSL(0.63 - hue, 0.6, 0.03 + 0.02*Math.sin(clock.elapsedTime*1.2 + score*0.002));

  // Update current path width once per frame
  pathWidth = currentPathWidth();
  currentDifficultyPathWidth = pathWidth; // keep legacy var in sync

  // update world objects movement & cleanup
  const removeSet = new Set();
  for (let i=0;i<worldObjects.length;i++){
    const obj = worldObjects[i];
    if (obj === player) continue;
    // remove if flagged and out of view
    if (!obj.parent){ removeSet.add(obj); continue; }
    // Movement behaviors
    if (obj.userData.isMoving){
      // support staggered sequential starts
      const startT = obj.userData.staggerStartTime || 0;
      const localT = Math.max(0, clock.elapsedTime - startT);
      if (obj.userData.movementType === 'horizontal'){
        const phase = (localT * obj.userData.speed) + (obj.userData.phase || 0);
        const desiredX = obj.userData.initialX + Math.sin(phase) * obj.userData.range;
        const halfW = pathWidth/2;
        const margin = 0.6;
        obj.position.x = clamp(desiredX, -halfW + margin, halfW - margin);
      } else if (obj.userData.movementType === 'vertical'){
        obj.position.y = obj.userData.initialY + Math.abs(Math.sin(localT * obj.userData.speed)) * obj.userData.range;
      }
    }
    if (obj.userData.isRotating){
      obj.rotation.z += obj.userData.spinSpeed * delta;
      // orbit blades slowly
      if (obj.userData.orbitRadius){
        const t = clock.elapsedTime * obj.userData.orbitSpeed;
        obj.position.x = Math.cos(t) * obj.userData.orbitRadius;
        obj.position.z = obj.userData.orbitCenterZ + Math.sin(t) * (obj.userData.orbitRadius*0.6);
      }
    }
    if (obj.userData.isFloating){
      obj.position.x += Math.sin(clock.elapsedTime*obj.userData.speed + (obj.userData.phase||0))*0.005;
      obj.position.y = obj.userData.initialY + Math.sin(clock.elapsedTime*obj.userData.speed + (obj.userData.phase||0))*obj.userData.range*0.45;
    }
    if (obj.userData.isFalling){
      // apply simple fall
      obj.position.y += (playerVelocity.y - 9.8) * delta;
      obj.position.z += gameSpeed * delta * 0.1;
      if (obj.position.y < -30) { removeSet.add(obj); }
    }
    // Pulsing ring scale animation
    if (obj.userData && obj.userData.pulse){
      const s = 1 + Math.sin(clock.elapsedTime * obj.userData.pulseSpeed + (obj.userData.phase||0))*0.2;
      obj.scale.set(s, s, s);
    }

    // Make the entire world move toward the player/camera
    obj.position.z += gameSpeed * delta;

    // blade collision special: blades are groups; build bounding box
    if (obj.name === 'blade'){
      const box = new THREE.Box3().setFromObject(obj);
      // simple rotation visual handled above
    }

    // recycle path segments
    if (obj.name === 'path' && obj.position.z > camera.position.z + segmentLength){
      let minZ = Infinity;
      for (const s of pathSegments) if (s !== obj && s.position.z < minZ) minZ = s.position.z;
      obj.position.z = minZ - segmentLength;
      configureSegmentDifficulty(obj);
      spawnDynamicObjects(obj);
    } else if (obj.name !== 'path' && obj.position.z > camera.position.z + 12){
      removeSet.add(obj);
    }
  }

  // cleanup removals
  if (removeSet.size > 0){
    for (const r of removeSet){
      try { scene.remove(r); } catch(e){}
      const idx = worldObjects.indexOf(r);
      if (idx !== -1) worldObjects.splice(idx,1);
    }
  }

  // update particle systems (fade & remove)
  for (let i=particleSystems.length-1;i>=0;i--){
    const p = particleSystems[i];
    p.userData.life -= delta;
    p.position.y += delta*0.2;
    // move FX with the world so they flow toward the player
    p.position.z += gameSpeed * delta;
    if (p.userData.life <= 0){ scene.remove(p); particleSystems.splice(i,1); }
  }

  // Jump buffer + coyote time (process before physics integration)
  if (jumpBuffer > 0) jumpBuffer -= delta;
  if (playerOnGround) {
    coyoteTimer = COYOTE_TIME;        // refresh while grounded
  } else {
    coyoteTimer = Math.max(0, coyoteTimer - delta);
  }
  if (jumpBuffer > 0 && (playerOnGround || coyoteTimer > 0)) {
    playerVelocity.y = jumpForce;
    playerOnGround = false;
    jumpBuffer = 0;
    coyoteTimer = 0;
  }

  // update player & collisions
  updatePlayer(delta);

  // Arrow keys horizontal movement (in addition to mouse control)
  const axis = (inputRight ? 1 : 0) - (inputLeft ? 1 : 0);
  if (axis !== 0){
    const halfW = pathWidth / 2;
    player.position.x = clamp(
      player.position.x + axis * lateralSpeed * delta,
      -halfW + 0.6,
      halfW - 0.6
    );
  }

  // camera follows player
  const targetCameraY = player.position.y + 4;
  camera.position.y += (targetCameraY - camera.position.y) * 0.12;

  // Update lights to follow the player every frame
  if (player){
    // Directional light: above and slightly behind, aiming a bit forward
    if (dirLight && shadowTarget){
      const above = 22;
      const lookAhead = 6;
      shadowTarget.position.set(player.position.x, 0, player.position.z - lookAhead);
      dirLight.position.set(player.position.x + 6, player.position.y + above, player.position.z + 10);
      dirLight.shadow.camera.updateProjectionMatrix();
    }
    // Spotlight: straight above player, aiming right at the player
    if (spotLight){
      spotLight.position.set(player.position.x, player.position.y + 12, player.position.z + 3);
      spotLight.target.position.set(player.position.x, player.position.y, player.position.z);
    }
  }

  // increase game speed aggressively for 
  gameSpeed += delta * (0.06 + Math.min(score/5000,0.2));

  renderer.render(scene, camera);
}

// Helper: start game countdown on Space from initial state
function startGameCountdown(){
  if (gameStarted) return;
  // Ensure nearby area is clear just in case
  for (let i=worldObjects.length-1;i>=0;i--){
    const o = worldObjects[i];
    if (!o.parent) continue;
    if (o.name !== 'player' && o.name !== 'path' && Math.abs(o.position.z) < 40){
      scene.remove(o);
      worldObjects.splice(i,1);
    }
  }
  startCountdown(3, ()=>{
    gameStarted = true;
    paused = false;
  });
}

// --- Controls & misc ---
function setupControls(){
  document.addEventListener('keydown', (e)=>{
    if (e.code === 'Space'){
      if (gameOver){ restart(); return; }
      if (!gameStarted){
        startGameCountdown();
        e.preventDefault();
        return;
      }
      if (!paused){
        // Fill jump buffer; jump will trigger as soon as allowed
        jumpBuffer = JUMP_BUFFER_TIME;
      }
      e.preventDefault();
    }
    // Arrow keys: set input axis
    if (e.code === 'ArrowLeft'){ inputLeft = true; e.preventDefault(); }
    if (e.code === 'ArrowRight'){ inputRight = true; e.preventDefault(); }
  });
  document.addEventListener('keyup', (e)=>{
    if (e.code === 'ArrowLeft'){ inputLeft = false; e.preventDefault(); }
    if (e.code === 'ArrowRight'){ inputRight = false; e.preventDefault(); }
  });
  // Mouse click to jump (like Space)
  document.addEventListener('mousedown', (e)=>{
    if (gameOver || paused || !gameStarted) return;
    if (e.button === 0){
      // Use jump buffer for same responsiveness as Space
      jumpBuffer = JUMP_BUFFER_TIME;
    }
  });
  document.addEventListener('mousemove', (e)=>{
    if (gameOver || paused) return;
    const mx = (e.clientX / window.innerWidth)*2 - 1;
    const halfW = pathWidth/2;
    // Map to current path width instead of base width
    player.position.x = clamp(mx * (pathWidth/2), -halfW + 0.6, halfW - 0.6);
  });
}

function onWindowResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function showGameOverChaos(){
  // Reveal existing game-over panel and update the score
  const finalScore = document.getElementById('final-score');
  if (finalScore) finalScore.textContent = `Score: ${Math.floor(score)}`;
  if (gameOverDiv) gameOverDiv.style.display = 'block';
}

function restart(){
  // remove everything except camera/renderer
  for (let i=worldObjects.length-1;i>=0;i--){
    const o = worldObjects[i];
    if (o.name !== 'player') { try{ scene.remove(o); }catch(e){}; worldObjects.splice(i,1); }
  }
  for (let i=pathSegments.length-1;i>=0;i--){ pathSegments.splice(i,1); }
  // recreate segments
  lives = 3; if (livesDiv) livesDiv.innerHTML = '🖤'.repeat(lives);
  score = 0;
  gameSpeed = 13;
  player.position.set(0,0.5,0);
  playerVelocity.set(0,0,0);
  playerOnGround = true;
  if (gameOverDiv) { gameOverDiv.style.display = 'none'; }
  gameOver = false;

  for (let i=0;i<12;i++){
    const s = createPathSegment(-i*segmentLength);
    configureSegmentDifficulty(s);
    // Safe start again on restart
    if (i < 4){
      if (s.userData.gapMeshes){
        for (const gm of s.userData.gapMeshes){
          try{ scene.remove(gm);}catch(e){}
          const idx = worldObjects.indexOf(gm);
          if (idx !== -1) worldObjects.splice(idx,1);
        }
      }
      s.userData.gapMeshes = [];
      s.userData.gapZones = [];
    } else {
      spawnDynamicObjects(s);
    }
  }

  scene.updateMatrixWorld(true);

  // Go back to "press Space to start" flow
  paused = true;
  gameStarted = false;
  countdownActive = false;
  if (countdownDiv) countdownDiv.style.display = 'block';
  if (countdownNum) countdownNum.textContent = 'Press SPACE to start';

  animate();
}

// Provide alias used by loseLife to avoid runtime error
function showGameOver(){ return showGameOverChaos(); }

init()