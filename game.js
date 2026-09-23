// ============================================
// OPEN WORLD 3D - THIRD PERSON + CARS + SHOOTING
// Three.js, GLTF character, procedural city,
// orbit shoulder camera, raycast weapon, drivable cars
// ============================================

console.log('Initializing Open World Engine (Third Person)...');
console.log('THREE.js version:', THREE.REVISION);

// --- SCENE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 210);

// --- CAMERA ---
const camera = new THREE.PerspectiveCamera(
    68,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.rotation.order = 'YXZ';

// --- RENDERER ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(100, 150, 80);
sun.castShadow = true;
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 320;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);

// ============================================
// CITY GENERATION
// ============================================

const cityConfig = {
    blockSize: 30,
    roadWidth: 8,
    gridSize: 5,
    sidewalkWidth: 2
};

const collisionObjects = [];   // everything the player/cars collide with
const shootables = [];         // meshes the weapon raycast can hit

const cellSize = cityConfig.blockSize + cityConfig.roadWidth;
const groundSize = cityConfig.gridSize * cellSize + 50;

// Road centerlines, cached so cars can spawn on them
const roadLines = [];
for (let i = 0; i <= cityConfig.gridSize; i++) {
    roadLines.push(i * cellSize - groundSize / 2 + cityConfig.roadWidth / 2);
}

function blockCenter(index) {
    return index * cellSize - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;
}

// --- GROUND ---
const groundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.95 })
);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.receiveShadow = true;
scene.add(groundPlane);

// --- ROADS ---
// Shared materials/geometry keep the draw-call cost and GC pressure down.
const roadMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });
const curbMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });

function createRoad(x, z, width, depth) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, depth), roadMat);
    road.position.set(x, 0.05, z);
    road.receiveShadow = true;
    scene.add(road);
}

roadLines.forEach(z => createRoad(0, z, groundSize, cityConfig.roadWidth));
roadLines.forEach(x => createRoad(x, 0, cityConfig.roadWidth, groundSize));

// --- SIDEWALKS ---
function createSidewalk(x, z, width, depth) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), curbMat);
    curb.position.set(x, 0.15, z);
    curb.receiveShadow = true;
    scene.add(curb);
}

for (let row = 0; row < cityConfig.gridSize; row++) {
    for (let col = 0; col < cityConfig.gridSize; col++) {
        const bx = blockCenter(col);
        const bz = blockCenter(row);
        const half = cityConfig.blockSize / 2;
        const sw = cityConfig.sidewalkWidth;

        createSidewalk(bx, bz - half - sw / 2, cityConfig.blockSize, sw);
        createSidewalk(bx, bz + half + sw / 2, cityConfig.blockSize, sw);
        createSidewalk(bx - half - sw / 2, bz, sw, cityConfig.blockSize);
        createSidewalk(bx + half + sw / 2, bz, sw, cityConfig.blockSize);
    }
}

// --- BUILDINGS ---
const buildingColors = [
    0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181,
    0xaa96da, 0xfcbad3, 0xa8e6cf, 0xdcedc1, 0xffd3b6,
    0xffaaa5, 0xff8b94, 0xc7ceea, 0xffc8dd
];

function createBuilding(x, z, width, height, depth, color) {
    const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.75, metalness: 0.2 })
    );
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);

    collisionObjects.push({ type: 'box', x, z, width, depth, height });
    shootables.push(building);   // bullets stop on walls
    return building;
}

for (let row = 0; row < cityConfig.gridSize; row++) {
    for (let col = 0; col < cityConfig.gridSize; col++) {
        if (Math.random() < 0.15) continue;

        const bx = blockCenter(col);
        const bz = blockCenter(row);
        const count = Math.floor(Math.random() * 2) + 1;

        for (let i = 0; i < count; i++) {
            const w = 8 + Math.random() * 10;
            const h = 15 + Math.random() * 30;
            const d = 8 + Math.random() * 10;

            createBuilding(
                bx + (Math.random() - 0.5) * (cityConfig.blockSize - w - 4),
                bz + (Math.random() - 0.5) * (cityConfig.blockSize - d - 4),
                w, h, d,
                buildingColors[Math.floor(Math.random() * buildingColors.length)]
            );
        }
    }
}

// --- TREES ---
const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 6);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
const leavesGeo = new THREE.ConeGeometry(2, 5, 6);
const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });

function createTree(x, z) {
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);

    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 5.5;
    leaves.castShadow = true;
    tree.add(leaves);

    tree.position.set(x, 0, z);
    scene.add(tree);

    collisionObjects.push({ type: 'cylinder', x, z, radius: 0.8 });
    shootables.push(tree);
}

// Place trees just outside the block edge, on the sidewalk ring
for (let i = 0; i < 36; i++) {
    const bx = blockCenter(Math.floor(Math.random() * cityConfig.gridSize));
    const bz = blockCenter(Math.floor(Math.random() * cityConfig.gridSize));
    const half = cityConfig.blockSize / 2;
    const spread = cityConfig.blockSize * 0.8;

    switch (Math.floor(Math.random() * 4)) {
        case 0: createTree(bx + (Math.random() - 0.5) * spread, bz - half - 2); break;
        case 1: createTree(bx + (Math.random() - 0.5) * spread, bz + half + 2); break;
        case 2: createTree(bx - half - 2, bz + (Math.random() - 0.5) * spread); break;
        case 3: createTree(bx + half + 2, bz + (Math.random() - 0.5) * spread); break;
    }
}

// ============================================
// NPCs
// ============================================

const npcs = [];

const npcBodyGeo = new THREE.BoxGeometry(0.6, 1.2, 0.4);
const npcHeadGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const npcLegGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
const npcHeadMat = new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: 0.6 });
const npcLegMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 });

function createNPC(x, z) {
    const mesh = new THREE.Group();

    const body = new THREE.Mesh(
        npcBodyGeo,
        new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff, roughness: 0.7 })
    );
    body.position.y = 0.9;
    body.castShadow = true;
    mesh.add(body);

    const head = new THREE.Mesh(npcHeadGeo, npcHeadMat);
    head.position.y = 1.7;
    head.castShadow = true;
    mesh.add(head);

    const leftLeg = new THREE.Mesh(npcLegGeo, npcLegMat);
    leftLeg.position.set(-0.15, 0.3, 0);
    leftLeg.castShadow = true;
    mesh.add(leftLeg);

    const rightLeg = new THREE.Mesh(npcLegGeo, npcLegMat);
    rightLeg.position.set(0.15, 0.3, 0);
    rightLeg.castShadow = true;
    mesh.add(rightLeg);

    mesh.position.set(x, 0, z);
    scene.add(mesh);

    const npc = {
        mesh, x, z,
        legs: [leftLeg, rightLeg],
        speed: 0.02 + Math.random() * 0.02,
        direction: Math.random() * Math.PI * 2,
        turnTimer: 0,
        turnInterval: 3 + Math.random() * 4,
        walkPhase: Math.random() * Math.PI * 2,
        radius: 0.5,
        health: 2,
        dead: false,
        deadTimer: 0
    };

    // Back-reference so a raycast hit can find the NPC record
    mesh.userData.npc = npc;

    npcs.push(npc);
    collisionObjects.push({ type: 'npc', data: npc });
    shootables.push(mesh);
    return npc;
}

for (let i = 0; i < 10; i++) {
    const bx = blockCenter(Math.floor(Math.random() * cityConfig.gridSize));
    const bz = blockCenter(Math.floor(Math.random() * cityConfig.gridSize));
    const half = cityConfig.blockSize / 2;
    const spread = cityConfig.blockSize * 0.7;

    switch (Math.floor(Math.random() * 4)) {
        case 0: createNPC(bx + (Math.random() - 0.5) * spread, bz - half - 1); break;
        case 1: createNPC(bx + (Math.random() - 0.5) * spread, bz + half + 1); break;
        case 2: createNPC(bx - half - 1, bz + (Math.random() - 0.5) * spread); break;
        case 3: createNPC(bx + half + 1, bz + (Math.random() - 0.5) * spread); break;
    }
}

// ============================================
// CARS
// ============================================

const cars = [];
let currentCar = null;   // the car being driven, or null on foot

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({
    color: 0x223344, roughness: 0.2, metalness: 0.6
});

const carColors = [0xd62828, 0x2a9d8f, 0xf4a261, 0x264653, 0xe9c46a, 0x8e7dbe, 0xf1faee];

function createCar(x, z, yaw) {
    const mesh = new THREE.Group();
    const color = carColors[Math.floor(Math.random() * carColors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color, roughness: 0.45, metalness: 0.45
    });

    // Lower body
    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.2), bodyMat);
    lower.position.y = 0.72;
    lower.castShadow = true;
    lower.receiveShadow = true;
    mesh.add(lower);

    // Cabin, pushed back so the hood reads as the front (+Z)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.62, 2.0), bodyMat);
    cabin.position.set(0, 1.36, -0.25);
    cabin.castShadow = true;
    mesh.add(cabin);

    // Windshield
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.12), glassMat);
    glass.position.set(0, 1.36, 0.78);
    mesh.add(glass);

    // Wheels
    const wheelPos = [
        [-1.0, 0.42, 1.35], [1.0, 0.42, 1.35],
        [-1.0, 0.42, -1.35], [1.0, 0.42, -1.35]
    ];
    const wheels = [];
    wheelPos.forEach(p => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;   // lay the cylinder on its side
        wheel.position.set(p[0], p[1], p[2]);
        wheel.castShadow = true;
        mesh.add(wheel);
        wheels.push(wheel);
    });

    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);

    const car = {
        mesh, wheels,
        x, z, yaw,
        speed: 0,
        maxSpeed: 0.75,
        maxReverse: 0.28,
        accel: 0.016,
        brake: 0.035,
        drag: 0.986,
        turnRate: 0.032,
        radius: 2.1,
        occupied: false
    };

    cars.push(car);
    collisionObjects.push({ type: 'car', data: car });
    shootables.push(mesh);
    return car;
}

// Spawn cars along road centerlines, offset into a lane
for (let i = 0; i < 9; i++) {
    const line = roadLines[Math.floor(Math.random() * roadLines.length)];
    const along = (Math.random() - 0.5) * (groundSize - 40);
    const lane = (Math.random() < 0.5 ? -1 : 1) * 1.9;

    if (Math.random() < 0.5) {
        // On a horizontal road: fixed z, varying x, facing along X
        createCar(along, line + lane, Math.PI / 2);
    } else {
        // On a vertical road: fixed x, varying z, facing along Z
        createCar(line + lane, along, 0);
    }
}

console.log('World built — collision objects:', collisionObjects.length, '| cars:', cars.length);

// ============================================
// COLLISION
// ============================================

// Circle-vs-world sweep. `skip` lets the driven car ignore itself.
function checkCollision(x, z, radius, skip) {
    for (let i = 0; i < collisionObjects.length; i++) {
        const obj = collisionObjects[i];

        if (obj.type === 'box') {
            const halfW = obj.width / 2;
            const halfD = obj.depth / 2;
            const closestX = Math.max(obj.x - halfW, Math.min(x, obj.x + halfW));
            const closestZ = Math.max(obj.z - halfD, Math.min(z, obj.z + halfD));
            const dx = x - closestX;
            const dz = z - closestZ;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < radius) {
                if (dist < 0.0001) return { collision: true, nx: 1, nz: 0 };
                return { collision: true, nx: dx / dist, nz: dz / dist };
            }

        } else if (obj.type === 'cylinder') {
            const dx = x - obj.x;
            const dz = z - obj.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < radius + obj.radius) {
                if (dist < 0.0001) return { collision: true, nx: 1, nz: 0 };
                return { collision: true, nx: dx / dist, nz: dz / dist };
            }

        } else if (obj.type === 'npc') {
            const npc = obj.data;
            if (npc.dead) continue;
            const dx = x - npc.x;
            const dz = z - npc.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < radius + npc.radius) {
                if (dist < 0.0001) return { collision: true, nx: 1, nz: 0 };
                return { collision: true, nx: dx / dist, nz: dz / dist };
            }

        } else if (obj.type === 'car') {
            const car = obj.data;
            if (car === skip) continue;
            const dx = x - car.x;
            const dz = z - car.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < radius + car.radius) {
                if (dist < 0.0001) return { collision: true, nx: 1, nz: 0 };
                return { collision: true, nx: dx / dist, nz: dz / dist };
            }
        }
    }
    return { collision: false };
}

// ============================================
// PLAYER
// ============================================

const player = new THREE.Group();
player.position.set(-2, 0, -2);   // start on a road intersection
scene.add(player);

let playerModel = null;
let mixer = null;
let isPlayerLoaded = false;

const clips = {
    idleGun: null, walk: null, run: null,
    roll: null, gunShoot: null, runShoot: null
};
let currentAction = null;

// --- THIRD-PERSON RIG ---
// look.yaw drives the camera, the character's facing, and the movement
// basis, so the view and the walk direction can never disagree.
const look = {
    yaw: 0,
    pitch: 0.18,
    minPitch: -0.55,      // limited, unlike the FPS build — the body is on screen
    maxPitch: 1.05,
    sensitivity: 0.004
};

const tpView = {
    distance: 5.2,
    minDistance: 1.2,
    currentDistance: 5.2,
    targetHeight: 1.55,   // look-at point, roughly the shoulders
    shoulderOffset: 0.55, // push right for the over-the-shoulder framing
    carDistance: 8.5,
    carHeight: 2.6
};

const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();

// Three.js cameras look down -Z
function getForwardVector(target) {
    target.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw));
    return target;
}
function getRightVector(target) {
    target.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
    return target;
}

const physics = {
    yVelocity: 0,
    gravity: -0.025,
    jumpStrength: 0.45,
    isGrounded: true,
    groundLevel: 0,
    isRolling: false,
    rollTimer: 0,
    rollDuration: 0.7,
    rollBoost: 0.42,
    rollDirX: 0,
    rollDirZ: 0
};

const movement = {
    forward: 0,
    right: 0,
    walkSpeed: 0.12,
    runSpeed: 0.24,
    isMoving: false,
    isRunning: false,
    isFiring: false
};

// ============================================
// WEAPON
// ============================================

const weapon = {
    magSize: 30,
    ammo: 30,
    fireInterval: 0.11,   // seconds between shots, held = full auto
    fireTimer: 0,
    reloadTime: 1.6,
    reloadTimer: 0,
    isReloading: false,
    range: 220,
    damage: 1,
    spread: 0.006         // radians of random cone, keeps auto fire from laser-beaming
};

let kills = 0;

const ammoEl = document.getElementById('ammo');
const killsEl = document.getElementById('kills');
const speedoEl = document.getElementById('speedo');
const crosshairEl = document.getElementById('crosshair');
const hitmarkerEl = document.getElementById('hitmarker');

function updateHUD() {
    if (weapon.isReloading) {
        ammoEl.innerHTML = 'RELOAD<span class="mag"> ...</span>';
    } else {
        ammoEl.innerHTML = weapon.ammo + '<span class="mag"> / ' + weapon.magSize + '</span>';
    }
    killsEl.textContent = 'KILLS ' + kills;
}
updateHUD();

let hitmarkerTimer = 0;
function showHitmarker() {
    hitmarkerEl.classList.add('show');
    hitmarkerTimer = 0.12;
}

// --- TRACER POOL ---
// Pre-allocated lines, recycled per shot so firing never allocates.
const TRACER_COUNT = 14;
const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({
    color: 0xffee88, transparent: true, opacity: 0.9
});

for (let i = 0; i < TRACER_COUNT; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, tracerMat.clone());
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
}
let tracerIndex = 0;

function spawnTracer(from, to) {
    const t = tracers[tracerIndex];
    tracerIndex = (tracerIndex + 1) % TRACER_COUNT;

    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;

    t.line.visible = true;
    t.line.material.opacity = 0.9;
    t.life = 0.07;
}

function updateTracers(dt) {
    for (let i = 0; i < tracers.length; i++) {
        const t = tracers[i];
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) {
            t.line.visible = false;
        } else {
            t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
        }
    }
}

// --- FIRING ---
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
const muzzlePoint = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
const shootDir = new THREE.Vector3();

function fireShot() {
    if (weapon.isReloading || weapon.ammo <= 0 || currentCar) return;

    weapon.ammo--;
    updateHUD();

    // Aim from the camera through the crosshair — what's centered is what's hit.
    raycaster.setFromCamera(screenCenter, camera);
    raycaster.far = weapon.range;

    shootDir.copy(raycaster.ray.direction);
    shootDir.x += (Math.random() - 0.5) * weapon.spread;
    shootDir.y += (Math.random() - 0.5) * weapon.spread;
    shootDir.z += (Math.random() - 0.5) * weapon.spread;
    shootDir.normalize();
    raycaster.ray.direction.copy(shootDir);

    // Tracer starts near the character's gun hand rather than the lens,
    // otherwise the line is invisible (it begins behind the near plane).
    getForwardVector(forwardVec);
    getRightVector(rightVec);
    muzzlePoint.set(
        player.position.x + rightVec.x * 0.32 + forwardVec.x * 0.5,
        player.position.y + 1.35,
        player.position.z + rightVec.z * 0.32 + forwardVec.z * 0.5
    );

    const hits = raycaster.intersectObjects(shootables, true);

    if (hits.length > 0) {
        const hit = hits[0];
        hitPoint.copy(hit.point);

        // Walk up the hierarchy to find an NPC record, if any
        let node = hit.object;
        let npc = null;
        while (node) {
            if (node.userData && node.userData.npc) {
                npc = node.userData.npc;
                break;
            }
            node = node.parent;
        }

        if (npc && !npc.dead) {
            npc.health -= weapon.damage;
            showHitmarker();

            if (npc.health <= 0) {
                npc.dead = true;
                npc.deadTimer = 0;
                kills++;
                updateHUD();
            }
        }
    } else {
        // Nothing hit: draw the tracer out to max range
        hitPoint.copy(raycaster.ray.origin)
            .add(shootDir.clone().multiplyScalar(weapon.range));
    }

    spawnTracer(muzzlePoint, hitPoint);

    if (weapon.ammo <= 0) startReload();
}

function startReload() {
    if (weapon.isReloading || weapon.ammo === weapon.magSize) return;
    weapon.isReloading = true;
    weapon.reloadTimer = 0;
    updateHUD();
}

function updateWeapon(dt) {
    if (weapon.isReloading) {
        weapon.reloadTimer += dt;
        if (weapon.reloadTimer >= weapon.reloadTime) {
            weapon.isReloading = false;
            weapon.ammo = weapon.magSize;
            updateHUD();
        }
        return;
    }

    weapon.fireTimer -= dt;

    if (movement.isFiring && !currentCar && weapon.fireTimer <= 0) {
        fireShot();
        weapon.fireTimer = weapon.fireInterval;
    }

    if (hitmarkerTimer > 0) {
        hitmarkerTimer -= dt;
        if (hitmarkerTimer <= 0) hitmarkerEl.classList.remove('show');
    }
}

// ============================================
// ANIMATION
// ============================================

const CLIP_NAMES = {
    idleGun: 'Idle_Gun',
    walk: 'Walk',
    run: 'Run',
    roll: 'Roll',
    gunShoot: 'Gun_Shoot',
    runShoot: 'Run_Shoot'
};

function setupAnimations(gltf) {
    mixer = new THREE.AnimationMixer(gltf.scene);

    const byName = {};
    gltf.animations.forEach(clip => { byName[clip.name] = clip; });

    Object.keys(CLIP_NAMES).forEach(key => {
        const clip = byName[CLIP_NAMES[key]];
        if (clip) {
            clips[key] = mixer.clipAction(clip);
        } else {
            console.warn('Missing clip:', CLIP_NAMES[key]);
        }
    });

    if (clips.roll) {
        clips.roll.setLoop(THREE.LoopOnce, 1);
        clips.roll.clampWhenFinished = true;
        physics.rollDuration = clips.roll.getClip().duration || physics.rollDuration;
    }

    ['gunShoot', 'runShoot', 'idleGun', 'walk', 'run'].forEach(key => {
        if (clips[key]) clips[key].setLoop(THREE.LoopRepeat, Infinity);
    });

    if (clips.idleGun) {
        currentAction = clips.idleGun;
        currentAction.play();
    }
}

function crossFadeTo(target, duration = 0.25) {
    if (!mixer || !target || currentAction === target) return;

    if (currentAction) currentAction.fadeOut(duration);

    target.reset();
    target.setEffectiveTimeScale(1);
    target.setEffectiveWeight(1);
    target.fadeIn(duration);
    target.play();

    currentAction = target;
}

// Priority: driving > roll > airborne hold > shooting > run > walk > idle
function updateAnimationState() {
    if (!mixer || !isPlayerLoaded) return;

    if (currentCar) {
        if (clips.idleGun) crossFadeTo(clips.idleGun, 0.2);
        return;
    }

    if (physics.isRolling) return;
    if (!physics.isGrounded) return;

    if (movement.isFiring) {
        if (movement.isMoving && movement.isRunning && clips.runShoot) {
            crossFadeTo(clips.runShoot, 0.15);
        } else if (clips.gunShoot) {
            crossFadeTo(clips.gunShoot, 0.15);
        }
        return;
    }

    if (movement.isMoving) {
        if (movement.isRunning && clips.run) {
            crossFadeTo(clips.run, 0.25);
        } else if (clips.walk) {
            crossFadeTo(clips.walk, 0.25);
        }
        return;
    }

    if (clips.idleGun) crossFadeTo(clips.idleGun, 0.3);
}

// ============================================
// MODEL LOADING
// ============================================

const loader = new THREE.GLTFLoader();

loader.load(
    'Mainmc1.glb',
    function (gltf) {
        playerModel = gltf.scene;

        // Head stays visible now that the camera is outside the body
        playerModel.traverse(child => {
            if (child.isMesh) {
                child.visible = true;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        playerModel.scale.set(1, 1, 1);
        player.add(playerModel);

        if (gltf.animations && gltf.animations.length > 0) {
            setupAnimations(gltf);
        } else {
            console.warn('No animations in model');
        }

        isPlayerLoaded = true;
        console.log('Player ready (third person)');
    },
    function (xhr) {
        if (xhr.total) console.log('Loading:', Math.round((xhr.loaded / xhr.total) * 100) + '%');
    },
    function (error) {
        console.error('Error loading Mainmc1.glb:', error);
    }
);

// ============================================
// INPUT — MULTI-TOUCH
// ============================================

const touches = { joystick: null, camera: null };

const joystick = document.getElementById('joystick');
const joystickStick = document.getElementById('joystickStick');

let joystickCenter = { x: 0, y: 0 };
const joystickMaxDistance = 50;

function updateJoystickCenter() {
    const rect = joystick.getBoundingClientRect();
    joystickCenter.x = rect.left + rect.width / 2;
    joystickCenter.y = rect.top + rect.height / 2;
}
updateJoystickCenter();
window.addEventListener('resize', updateJoystickCenter);

function handleJoystickMove(touchX, touchY) {
    const dx = touchX - joystickCenter.x;
    const dy = touchY - joystickCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let clampedX = dx;
    let clampedY = dy;
    if (distance > joystickMaxDistance) {
        clampedX = (dx / distance) * joystickMaxDistance;
        clampedY = (dy / distance) * joystickMaxDistance;
    }

    joystickStick.style.transform =
        `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

    movement.right = clampedX / joystickMaxDistance;
    movement.forward = -clampedY / joystickMaxDistance;

    const nowMoving = Math.abs(movement.forward) > 0.1 || Math.abs(movement.right) > 0.1;
    if (nowMoving !== movement.isMoving) {
        movement.isMoving = nowMoving;
        updateAnimationState();
    }
}

function resetJoystick() {
    joystickStick.style.transform = 'translate(-50%, -50%)';
    movement.forward = 0;
    movement.right = 0;
    if (movement.isMoving) {
        movement.isMoving = false;
        updateAnimationState();
    }
}

joystick.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touches.joystick = touch.identifier;
    updateJoystickCenter();
    handleJoystickMove(touch.clientX, touch.clientY);
}, { passive: false });

joystick.addEventListener('touchmove', e => {
    e.preventDefault();
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touches.joystick) {
            handleJoystickMove(e.touches[i].clientX, e.touches[i].clientY);
            break;
        }
    }
}, { passive: false });

function endJoystickTouch(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touches.joystick) {
            touches.joystick = null;
            resetJoystick();
            break;
        }
    }
}
joystick.addEventListener('touchend', endJoystickTouch, { passive: false });
joystick.addEventListener('touchcancel', endJoystickTouch, { passive: false });

// --- CAMERA ORBIT (RIGHT SIDE DRAG) ---
const cameraControlZone = document.getElementById('cameraControl');
let lastLookX = 0;
let lastLookY = 0;
let manualLookTimer = 0;   // pauses the driving auto-follow after a manual drag

cameraControlZone.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touches.camera = touch.identifier;
    lastLookX = touch.clientX;
    lastLookY = touch.clientY;
}, { passive: false });

cameraControlZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === touches.camera) {
            const deltaX = touch.clientX - lastLookX;
            const deltaY = touch.clientY - lastLookY;

            look.yaw -= deltaX * look.sensitivity;
            look.pitch -= deltaY * look.sensitivity;
            look.pitch = Math.max(look.minPitch, Math.min(look.maxPitch, look.pitch));

            manualLookTimer = 1.5;

            lastLookX = touch.clientX;
            lastLookY = touch.clientY;
            break;
        }
    }
}, { passive: false });

function endLookTouch(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touches.camera) {
            touches.camera = null;
            break;
        }
    }
}
cameraControlZone.addEventListener('touchend', endLookTouch, { passive: false });
cameraControlZone.addEventListener('touchcancel', endLookTouch, { passive: false });

// ============================================
// ACTION BUTTONS
// ============================================

const btnRun = document.getElementById('btnRun');
const btnJump = document.getElementById('btnJump');
const btnFire = document.getElementById('btnFire');
const btnReload = document.getElementById('btnReload');
const btnCar = document.getElementById('btnCar');

btnRun.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    movement.isRunning = true;
    btnRun.classList.add('active');
    updateAnimationState();
}, { passive: false });

function releaseRun(e) {
    e.preventDefault(); e.stopPropagation();
    movement.isRunning = false;
    btnRun.classList.remove('active');
    updateAnimationState();
}
btnRun.addEventListener('touchend', releaseRun, { passive: false });
btnRun.addEventListener('touchcancel', releaseRun, { passive: false });

btnJump.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (currentCar || !physics.isGrounded || physics.isRolling) return;

    if (movement.isRunning && clips.roll) {
        startRoll();
    } else {
        physics.yVelocity = physics.jumpStrength;
        physics.isGrounded = false;
    }
}, { passive: false });

function startRoll() {
    physics.isRolling = true;
    physics.rollTimer = 0;

    getForwardVector(forwardVec);
    physics.rollDirX = forwardVec.x;
    physics.rollDirZ = forwardVec.z;

    if (currentAction && currentAction !== clips.roll) currentAction.fadeOut(0.1);
    clips.roll.reset();
    clips.roll.setEffectiveTimeScale(1);
    clips.roll.setEffectiveWeight(1);
    clips.roll.fadeIn(0.1);
    clips.roll.play();
    currentAction = clips.roll;
}

btnFire.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (currentCar) return;
    movement.isFiring = true;
    btnFire.classList.add('active');
    weapon.fireTimer = 0;   // fire immediately on press, then auto
    updateAnimationState();
}, { passive: false });

function releaseFire(e) {
    e.preventDefault(); e.stopPropagation();
    movement.isFiring = false;
    btnFire.classList.remove('active');
    updateAnimationState();
}
btnFire.addEventListener('touchend', releaseFire, { passive: false });
btnFire.addEventListener('touchcancel', releaseFire, { passive: false });

btnReload.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    startReload();
}, { passive: false });

// --- ENTER / EXIT VEHICLE ---
let nearestCar = null;

btnCar.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (currentCar) {
        exitCar();
    } else if (nearestCar) {
        enterCar(nearestCar);
    }
}, { passive: false });

function enterCar(car) {
    currentCar = car;
    car.occupied = true;

    // Hide the character and stop foot input bleeding through
    if (playerModel) playerModel.visible = false;
    movement.isFiring = false;
    movement.isRunning = false;
    btnFire.classList.remove('active');
    btnRun.classList.remove('active');
    resetJoystick();

    document.body.classList.add('driving');
    crosshairEl.classList.add('hidden');
    speedoEl.style.display = 'block';
    btnCar.textContent = 'EXIT';

    tpView.currentDistance = tpView.carDistance;
    updateAnimationState();
}

function exitCar() {
    if (!currentCar) return;
    const car = currentCar;

    // Drop the player beside the driver's door, nudging out if that's blocked
    const sideX = Math.cos(car.yaw);
    const sideZ = -Math.sin(car.yaw);

    let placed = false;
    for (let d = 2.4; d <= 4.5; d += 0.7) {
        const tx = car.x + sideX * d;
        const tz = car.z + sideZ * d;
        if (!checkCollision(tx, tz, 0.5, car).collision) {
            player.position.set(tx, 0, tz);
            placed = true;
            break;
        }
    }
    if (!placed) player.position.set(car.x + sideX * 2.6, 0, car.z + sideZ * 2.6);

    car.speed = 0;
    car.occupied = false;
    currentCar = null;

    if (playerModel) playerModel.visible = true;
    resetJoystick();

    document.body.classList.remove('driving');
    crosshairEl.classList.remove('hidden');
    speedoEl.style.display = 'none';
    btnCar.textContent = 'ENTER';

    tpView.currentDistance = tpView.distance;
    updateAnimationState();
}

// ============================================
// UPDATE — NPCs
// ============================================

function updateNPCs(dt) {
    const limit = groundSize / 2 - 10;

    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];

        if (npc.dead) {
            // Tip over, then sink and stop being a target
            npc.deadTimer += dt;
            if (npc.mesh.rotation.x > -Math.PI / 2) {
                npc.mesh.rotation.x -= dt * 4;
            }
            if (npc.deadTimer > 6 && npc.mesh.visible) {
                npc.mesh.visible = false;
                const si = shootables.indexOf(npc.mesh);
                if (si !== -1) shootables.splice(si, 1);
            }
            continue;
        }

        npc.turnTimer += dt;
        if (npc.turnTimer >= npc.turnInterval) {
            npc.direction += (Math.random() - 0.5) * Math.PI;
            npc.turnTimer = 0;
        }

        const nx = npc.x + Math.cos(npc.direction) * npc.speed;
        const nz = npc.z + Math.sin(npc.direction) * npc.speed;

        if (Math.abs(nx) < limit && Math.abs(nz) < limit) {
            npc.x = nx;
            npc.z = nz;
            npc.mesh.position.set(nx, 0, nz);
            npc.mesh.rotation.y = -npc.direction + Math.PI / 2;

            // Cheap leg swing so they read as walking
            npc.walkPhase += dt * 9;
            npc.legs[0].rotation.x = Math.sin(npc.walkPhase) * 0.5;
            npc.legs[1].rotation.x = Math.sin(npc.walkPhase + Math.PI) * 0.5;
        } else {
            npc.direction += Math.PI;
        }
    }
}

// ============================================
// UPDATE — CAR
// ============================================

function shortestAngle(from, to) {
    let diff = (to - from) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
}

function updateCar(dt) {
    const car = currentCar;

    // Joystick forward = throttle, back = brake/reverse, sideways = steering
    const throttle = movement.forward;
    const steer = movement.right;

    if (throttle > 0.1) {
        car.speed += car.accel * throttle;
    } else if (throttle < -0.1) {
        car.speed -= (car.speed > 0 ? car.brake : car.accel * 0.7) * -throttle;
    } else {
        car.speed *= car.drag;
        if (Math.abs(car.speed) < 0.004) car.speed = 0;
    }

    car.speed = Math.max(-car.maxReverse, Math.min(car.maxSpeed, car.speed));

    // Steering scales with speed and flips in reverse, like a real car
    if (Math.abs(car.speed) > 0.01) {
        const grip = Math.min(1, Math.abs(car.speed) / (car.maxSpeed * 0.45));
        car.yaw -= steer * car.turnRate * grip * Math.sign(car.speed);
    }

    // Car forward is +Z in local space
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);

    const nx = car.x + fx * car.speed;
    const nz = car.z + fz * car.speed;

    const hit = checkCollision(nx, nz, car.radius, car);
    if (hit.collision) {
        // Crunch: kill most of the momentum and bounce back slightly
        car.speed *= -0.22;
        car.x += hit.nx * 0.12;
        car.z += hit.nz * 0.12;
    } else {
        car.x = nx;
        car.z = nz;
    }

    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.yaw;

    // Spin wheels proportional to travel
    const spin = car.speed / 0.42;
    for (let i = 0; i < car.wheels.length; i++) {
        car.wheels[i].rotation.x += spin;
    }

    // Keep the player record with the car so exiting lands correctly
    player.position.set(car.x, 0, car.z);

    // Camera drifts back behind the car unless recently dragged
    if (manualLookTimer <= 0) {
        const targetYaw = car.yaw + Math.PI;
        look.yaw += shortestAngle(look.yaw, targetYaw) * Math.min(1, dt * 3.5);
    }

    speedoEl.textContent = Math.round(Math.abs(car.speed) * 190) + ' km/h';
}

// ============================================
// UPDATE — PLAYER ON FOOT
// ============================================

function updatePlayer(dt) {
    if (!isPlayerLoaded) return;

    // Character faces the same direction as the camera
    player.rotation.y = look.yaw + Math.PI;

    if (physics.isRolling) {
        physics.rollTimer += dt;
        const progress = Math.min(physics.rollTimer / physics.rollDuration, 1);
        const dash = physics.rollBoost * (1 - progress);

        const nx = player.position.x + physics.rollDirX * dash;
        const nz = player.position.z + physics.rollDirZ * dash;
        if (!checkCollision(nx, nz, 0.5).collision) {
            player.position.x = nx;
            player.position.z = nz;
        }

        if (physics.rollTimer >= physics.rollDuration) {
            physics.isRolling = false;
            physics.rollTimer = 0;
            updateAnimationState();
        }
    }

    if (!physics.isGrounded || player.position.y > physics.groundLevel) {
        physics.yVelocity += physics.gravity;
        player.position.y += physics.yVelocity;

        if (player.position.y <= physics.groundLevel) {
            player.position.y = physics.groundLevel;
            physics.yVelocity = 0;
            physics.isGrounded = true;
            updateAnimationState();
        }
    }

    if (!physics.isRolling &&
        (Math.abs(movement.forward) > 0.01 || Math.abs(movement.right) > 0.01)) {

        getForwardVector(forwardVec);
        getRightVector(rightVec);

        const speed = movement.isRunning ? movement.runSpeed : movement.walkSpeed;
        const moveX = (forwardVec.x * movement.forward + rightVec.x * movement.right) * speed;
        const moveZ = (forwardVec.z * movement.forward + rightVec.z * movement.right) * speed;

        const nx = player.position.x + moveX;
        const nz = player.position.z + moveZ;
        const hit = checkCollision(nx, nz, 0.5);

        if (!hit.collision) {
            player.position.x = nx;
            player.position.z = nz;
        } else {
            // Slide along the surface instead of sticking to it
            const slideX = player.position.x + moveX * (1 - Math.abs(hit.nx));
            const slideZ = player.position.z + moveZ * (1 - Math.abs(hit.nz));
            if (!checkCollision(slideX, slideZ, 0.5).collision) {
                player.position.x = slideX;
                player.position.z = slideZ;
            }
        }
    }
}

// ============================================
// UPDATE — VEHICLE PROXIMITY PROMPT
// ============================================

function updateCarPrompt() {
    if (currentCar) {
        btnCar.classList.add('visible');
        return;
    }

    let best = null;
    let bestDist = 4.2;   // interaction range

    for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const dx = car.x - player.position.x;
        const dz = car.z - player.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < bestDist) {
            bestDist = dist;
            best = car;
        }
    }

    nearestCar = best;
    if (best) btnCar.classList.add('visible');
    else btnCar.classList.remove('visible');
}

// ============================================
// UPDATE — CAMERA
// ============================================

const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
const camDir = new THREE.Vector3();

function updateCamera(dt) {
    if (!isPlayerLoaded) return;

    const baseHeight = currentCar ? tpView.carHeight : tpView.targetHeight;
    const baseDist = currentCar ? tpView.carDistance : tpView.distance;

    getRightVector(rightVec);

    // Look-at point: shoulders on foot, roof height in a car.
    // Shoulder offset is dropped while driving so the car stays centered.
    const shoulder = currentCar ? 0 : tpView.shoulderOffset;
    camTarget.set(
        player.position.x + rightVec.x * shoulder,
        player.position.y + baseHeight,
        player.position.z + rightVec.z * shoulder
    );

    // View direction from yaw/pitch
    const cosPitch = Math.cos(look.pitch);
    camDir.set(
        -Math.sin(look.yaw) * cosPitch,
        Math.sin(look.pitch),
        -Math.cos(look.yaw) * cosPitch
    );

    // Pull the camera in if a building is behind us, so it doesn't clip inside
    let allowed = baseDist;
    for (let step = baseDist; step > tpView.minDistance; step -= 0.6) {
        const testX = camTarget.x - camDir.x * step;
        const testZ = camTarget.z - camDir.z * step;
        if (!checkCollision(testX, testZ, 0.45, currentCar).collision) {
            allowed = step;
            break;
        }
        allowed = step;
    }

    // Snap in fast, ease out slow — prevents a wall popping the view
    if (allowed < tpView.currentDistance) {
        tpView.currentDistance = allowed;
    } else {
        tpView.currentDistance += (allowed - tpView.currentDistance) * Math.min(1, dt * 4);
    }

    camDesired.set(
        camTarget.x - camDir.x * tpView.currentDistance,
        camTarget.y - camDir.y * tpView.currentDistance,
        camTarget.z - camDir.z * tpView.currentDistance
    );

    // Never let the camera drop below street level
    if (camDesired.y < 0.6) camDesired.y = 0.6;

    camera.position.copy(camDesired);
    camera.rotation.y = look.yaw;
    camera.rotation.x = look.pitch;
    camera.rotation.z = 0;
}

// ============================================
// RENDER LOOP
// ============================================

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    // Clamp dt so a backgrounded tab doesn't teleport everything on return
    const dt = Math.min(clock.getDelta(), 0.05);

    if (manualLookTimer > 0) manualLookTimer -= dt;

    updateNPCs(dt);

    if (currentCar) {
        updateCar(dt);
    } else {
        updatePlayer(dt);
    }

    updateCarPrompt();
    updateWeapon(dt);
    updateTracers(dt);
    updateCamera(dt);

    if (mixer) mixer.update(dt);

    renderer.render(scene, camera);
}

animate();
