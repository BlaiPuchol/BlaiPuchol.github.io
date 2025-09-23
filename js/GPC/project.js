// Global variables
let scene, camera, renderer, player, clock;
let playerVelocity = new THREE.Vector3();
let playerOnGround = false;
let gameSpeed = 10;
const gravity = -20;
const jumpForce = 12;
const pathSegments = [];
const segmentLength = 50;
const basePathWidth = 10;
const minPathWidth = 3;
let currentDifficultyPathWidth = basePathWidth;
const worldObjects = [];

let gameOver = false;
let score = 0;
let scoreDiv = null;
let gameOverDiv = null;
let prevPlayerY = 0;

// Difficulty tuning
const shrinkStartScore = 150;      // when shrinking begins
const shrinkFullScore = 1200;      // score where min width reached
const gapStartScore = 300;         // when gaps can begin
const gapFullScore = 1500;         // max gap probability reached
const maxGapProbability = 0.35;    // never above this
let lastSegmentWasGap = false;

// New neon palette + material helper
const NEON_COLORS = [0x00eaff, 0xff2bff, 0x9d4dff, 0xff5fa2, 0x007bff];
function createNeonMaterial(colorHex, intensity = 1.4) {
    return new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: new THREE.Color(colorHex),
        emissiveIntensity: intensity,
        metalness: 0.65,
        roughness: 0.25
    });
}

// New: minimum Z spacing between platforms on gap (invisible) segments
const minGapPlatformDistance = 6; // adjust as desired

function platformProbability() {
    // Increased base and max so platforms appear more often (was 0.7..0.9)
    return 0.85 + Math.min(score / 1200, 1) * 0.12; // 0.85 → 0.97
}

function currentPathWidth() {
    if (score < shrinkStartScore) return basePathWidth;
    const t = Math.min((score - shrinkStartScore) / (shrinkFullScore - shrinkStartScore), 1);
    return basePathWidth - t * (basePathWidth - minPathWidth);
}

function gapProbability() {
    if (score < gapStartScore) return 0;
    const t = Math.min((score - gapStartScore) / (gapFullScore - gapStartScore), 1);
    return t * maxGapProbability;
}

// Initialize
function init() {
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050611);
    scene.fog = new THREE.Fog(0x050611, 15, 140);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.physicallyCorrectLights = true;
    document.body.appendChild(renderer.domElement);

    // Replace lights with futuristic setup
    const hemiLight = new THREE.HemisphereLight(0x4a64ff, 0x080818, 0.6);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 50, 10); 
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    directionalLight.shadow.bias = -0.0005;

    // Define the area for shadow casting to be larger
    const shadowFrustumSize = 50;
    directionalLight.shadow.camera.left = -shadowFrustumSize;
    directionalLight.shadow.camera.right = shadowFrustumSize;
    directionalLight.shadow.camera.top = shadowFrustumSize;
    directionalLight.shadow.camera.bottom = -shadowFrustumSize;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;

    scene.add(directionalLight);

    const pointA = new THREE.PointLight(0xff2bff, 6, 60, 2);
    pointA.position.set(-6, 8, -10);
    scene.add(pointA);

    const pointB = new THREE.PointLight(0x00eaff, 5, 55, 2);
    pointB.position.set(6, 6, -30);
    scene.add(pointB);

    const pointC = new THREE.PointLight(0x9d4dff, 4, 45, 2);
    pointC.position.set(0, 10, -55);
    scene.add(pointC);

    scoreDiv = document.createElement('div');
    scoreDiv.style.position = 'absolute';
    scoreDiv.style.top = '10px';
    scoreDiv.style.left = '20px';
    scoreDiv.style.color = '#fff';
    scoreDiv.style.font = '20px Arial';
    scoreDiv.style.textShadow = '0 0 4px #000';
    scoreDiv.innerText = 'Score: 0';
    document.body.appendChild(scoreDiv);

    createPlayer();

    // Initial path (no gaps early)
    for (let i = 0; i < 10; i++) {
        const seg = createPathSegment(-i * segmentLength, { allowGap: false });
        if (i > 1 && i % 2 === 0) {
            spawnDynamicObjectsForSegment(seg, false);
        }
    }

    setupControls();
    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function createPlayer() {
    const geometry = new THREE.SphereGeometry(0.5, 48, 48);
    const material = createNeonMaterial(0x007cf0, 1.8);
    material.roughness = 0.15;
    material.metalness = 0.0;
    player = new THREE.Mesh(geometry, material);
    player.position.set(0, 0.5, 0);
    player.castShadow = true;
    player.name = "player";
    scene.add(player);
}

function createPathSegment(zPos, opts = {}) {
    const geometry = new THREE.PlaneGeometry(basePathWidth, segmentLength);
    const material = new THREE.MeshStandardMaterial({
        color: 0x2b0f55,
        emissive: 0x441e88,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide
    });
    const segment = new THREE.Mesh(geometry, material);
    segment.rotation.x = -Math.PI / 2;
    segment.position.set(0, 0, zPos);
    segment.receiveShadow = true;
    segment.name = "path";
    segment.userData.width = basePathWidth;
    segment.userData.isGap = false;
    scene.add(segment);
    pathSegments.push(segment);
    worldObjects.push(segment);
    return segment;
}

// Apply difficulty to a recycled/new segment
function configureSegmentDifficulty(segment) {
    currentDifficultyPathWidth = currentPathWidth();
    segment.userData.width = currentDifficultyPathWidth;
    segment.scale.x = currentDifficultyPathWidth / basePathWidth;

    // Decide gap
    let makeGap = false;
    if (!lastSegmentWasGap && Math.random() < gapProbability()) {
        makeGap = true;
    }
    if (makeGap) {
        segment.visible = false;
        segment.userData.isGap = true;
        lastSegmentWasGap = true;
        // Color (invisible anyway)
    } else {
        segment.visible = true;
        segment.userData.isGap = false;
        segment.material.color.setHex(0x008800);
        lastSegmentWasGap = false;
    }

    if (segment.visible) {
        // Dynamic hue shift based on width (narrower = hotter color)
        const t = (segment.userData.width - minPathWidth) / (basePathWidth - minPathWidth);
        // Interpolate between purple and cyan
        const color = new THREE.Color().setHSL(0.72 - 0.22 * t, 0.85, 0.42 + 0.1 * (1 - t));
        segment.material.color.copy(color);
        segment.material.emissive.copy(color).multiplyScalar(1.6);
    }
}

// Spawn objects for a segment (either normal or gap)
function spawnDynamicObjectsForSegment(segment, isRecycled) {
    if (segment.userData.isGap) {
        // Reworked: generate a spaced sequence of platforms across the gap
        spawnPlatformsAcrossGap(segment);
    } else {
        // Normal segment: attempt more platform-friendly spawns (probability already higher)
        spawnObject(segment.position.z - segmentLength * 0.25);
        spawnObject(segment.position.z + segmentLength * 0.25);
        // Extra spawn now slightly more likely on narrow paths
        if (segment.userData.width < 6 && Math.random() < 0.75) {
            spawnObject(segment.position.z);
        }
    }
}

// New helper: spaced platforms across a gap
function spawnPlatformsAcrossGap(segment) {
    const usableLength = segmentLength * 0.8;
    const startZ = segment.position.z - usableLength / 2;
    const endZ = segment.position.z + usableLength / 2;
    let z = startZ;
    while (z <= endZ) {
        spawnObject(z, true); // forced platform
        // Advance by at least the minimum spacing, add slight variation
        z += minGapPlatformDistance + Math.random() * (minGapPlatformDistance * 0.5);
    }
}

// Create a random obstacle or platform (forcedPlatform = true overrides)
function spawnObject(zPos, forcedPlatform = false) {
    const width = currentDifficultyPathWidth;
    const lateralLimit = width / 2 - 0.8;
    const x = (Math.random() * 2 - 1) * lateralLimit;
    const pProb = platformProbability();
    const makePlatform = forcedPlatform || Math.random() < pProb;

    if (makePlatform) {
        const platformHeightCenter = 1 + Math.random() * 3.5;
        const geometry = new THREE.BoxGeometry(2, 0.5, 2);
        const neonColor = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
        const material = createNeonMaterial(neonColor, 1.9);
        const platform = new THREE.Mesh(geometry, material);
        platform.position.set(x, platformHeightCenter, zPos);
        platform.castShadow = true;
        platform.receiveShadow = true;
        platform.name = "platform";
        scene.add(platform);
        worldObjects.push(platform);
    } else {
        // Obstacle: keep red but make it glow
        const geometry = new THREE.BoxGeometry(1, 1.2, 1);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0x990000,
            emissiveIntensity: 4,
            metalness: 0.4,
            roughness: 0.3
        });
        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(x, 0.6, zPos);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        obstacle.name = "obstacle";
        scene.add(obstacle);
        worldObjects.push(obstacle);
    }
}

function setupControls() {
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            if (gameOver) { restartGame(); return; }
            if (playerOnGround) {
                playerVelocity.y = jumpForce;
                playerOnGround = false;
            }
        }
    });
    document.addEventListener('mousemove', (event) => {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        // Clamp to current difficulty path width (not base)
        const halfW = currentDifficultyPathWidth / 2;
        player.position.x = THREE.MathUtils.clamp(mouseX * (basePathWidth / 2), -halfW + 0.6, halfW - 0.6);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Check if player is above a non-gap path surface
function hasGroundUnderPlayer() {
    const px = player.position.x;
    const pz = player.position.z;
    for (const seg of pathSegments) {
        if (seg.userData.isGap) continue;
        const z0 = seg.position.z - segmentLength / 2;
        const z1 = seg.position.z + segmentLength / 2;
        if (pz >= z0 && pz <= z1) {
            const halfW = seg.userData.width / 2;
            if (px >= -halfW && px <= halfW) return true;
        }
    }
    return false;
}

function updatePlayer(delta) {
    prevPlayerY = player.position.y;
    if (!playerOnGround) playerVelocity.y += gravity * delta;
    player.position.y += playerVelocity.y * delta;

    // Only clamp to ground if a non-gap path is below
    if (player.position.y <= player.geometry.parameters.radius && hasGroundUnderPlayer()) {
        player.position.y = player.geometry.parameters.radius;
        playerVelocity.y = 0;
        playerOnGround = true;
    } else if (playerVelocity.y === 0 && !hasGroundUnderPlayer()) {
        // If we were grounded but ground disappeared (gap), start falling
        playerOnGround = false;
    } else if (player.position.y > player.geometry.parameters.radius) {
        playerOnGround = false;
    }

    const playerBox = new THREE.Box3().setFromObject(player);
    for (const obj of worldObjects) {
        if (obj === player) continue;
        if (obj.name === "path") continue;
        const objBox = new THREE.Box3().setFromObject(obj);
        if (!playerBox.intersectsBox(objBox)) continue;

        if (obj.name === "obstacle") {
            endGame();
            return;
        }
        if (obj.name === "platform") {
            const topY = obj.position.y + obj.geometry.parameters.height / 2;
            const radius = player.geometry.parameters.radius;
            if (playerVelocity.y <= 0 &&
                (prevPlayerY - radius) >= topY - 0.05 &&
                (player.position.y - radius) <= topY + 0.15) {
                player.position.y = topY + radius;
                playerVelocity.y = 0;
                playerOnGround = true;
            } else {
                // Side hit
                endGame();
                return;
            }
        }
    }

    if (player.position.y < -15) endGame();
}

function endGame() {
    if (gameOver) return;
    gameOver = true;
    console.log("Game Over! Final Score:", Math.floor(score));
    gameOverDiv = document.createElement('div');
    gameOverDiv.style.position = 'absolute';
    gameOverDiv.style.width = '100%';
    gameOverDiv.style.textAlign = 'center';
    gameOverDiv.style.top = '40%';
    gameOverDiv.style.fontSize = '50px';
    gameOverDiv.style.color = 'white';
    gameOverDiv.style.textShadow = '0 0 10px #000';
    gameOverDiv.innerHTML = `GAME OVER<br>Score: ${Math.floor(score)}<br><span style="font-size:24px;">Press SPACE to restart</span>`;
    document.body.appendChild(gameOverDiv);
}

function restartGame() {
    for (let i = worldObjects.length - 1; i >= 0; i--) {
        const o = worldObjects[i];
        if (o.name === "platform" || o.name === "obstacle" || o.name === "path") {
            scene.remove(o);
            worldObjects.splice(i, 1);
        }
    }
    pathSegments.length = 0;
    lastSegmentWasGap = false;

    for (let i = 0; i < 10; i++) {
        const seg = createPathSegment(-i * segmentLength, { allowGap: false });
        configureSegmentDifficulty(seg);
        if (!seg.userData.isGap) spawnDynamicObjectsForSegment(seg, false);
        else spawnDynamicObjectsForSegment(seg, false);
    }

    player.position.set(0, 0.5, 0);
    playerVelocity.set(0, 0, 0);
    playerOnGround = true;
    gameSpeed = 10;
    score = 0;
    if (gameOverDiv) { gameOverDiv.remove(); gameOverDiv = null; }
    gameOver = false;
    clock.getDelta();
    animate();
}

function animate() {
    if (gameOver) return;
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    score += delta * 10;
    if (scoreDiv) scoreDiv.innerText = 'Score: ' + Math.floor(score);

    currentDifficultyPathWidth = currentPathWidth();

    const objectsToRemove = [];
    for (let i = 0; i < worldObjects.length; i++) {
        const obj = worldObjects[i];
        if (obj.name === "player") continue;
        obj.position.z += gameSpeed * delta;

        if (obj.name === "path" && obj.position.z > camera.position.z + segmentLength) {
            // recycle
            let minZ = Infinity;
            for (const ps of pathSegments) {
                if (ps !== obj && ps.position.z < minZ) minZ = ps.position.z;
            }
            obj.position.z = minZ - segmentLength;
            configureSegmentDifficulty(obj);
            spawnDynamicObjectsForSegment(obj, true);
        } else if (obj.name !== "path" && obj.position.z > camera.position.z + 5) {
            objectsToRemove.push(i);
            scene.remove(obj);
        }
    }
    for (let i = objectsToRemove.length - 1; i >= 0; i--) {
        worldObjects.splice(objectsToRemove[i], 1);
    }

    updatePlayer(delta);

    const targetCameraY = player.position.y + 4;
    camera.position.y += (targetCameraY - camera.position.y) * 0.1;

    gameSpeed += delta * 0.05;
    renderer.render(scene, camera);
}

init();