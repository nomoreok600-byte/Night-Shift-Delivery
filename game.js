// ============================================
// OPEN WORLD 3D ENGINE - FIRST-PERSON CITY
// Three.js, GLTF character, procedural city grid,
// buildings, trees, NPC pedestrians with collision
// ============================================

console.log('Initializing Open World Engine (FPS City)...');
console.log('THREE.js version:', THREE.REVISION);

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

// --- PERSPECTIVE CAMERA ---
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.rotation.order = 'YXZ';

// --- RENDERER ---
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
});

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(100, 150, 80);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -150;
directionalLight.shadow.camera.right = 150;
directionalLight.shadow.camera.top = 150;
directionalLight.shadow.camera.bottom = -150;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 300;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// ============================================
// CITY GENERATION
// ============================================

const cityConfig = {
    blockSize: 30,      // width/depth of one city block
    roadWidth: 8,       // street width
    gridSize: 5,        // 5x5 grid of blocks
    sidewalkWidth: 2
};

const collisionObjects = [];  // buildings, trees, NPCs for collision checks

// --- GROUND BASE ---
const groundSize = cityConfig.gridSize * (cityConfig.blockSize + cityConfig.roadWidth) + 50;
const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
const groundMat = new THREE.MeshStandardMaterial({ 
    color: 0x2a2a2a, 
    roughness: 0.95 
});
const groundPlane = new THREE.Mesh(groundGeo, groundMat);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.receiveShadow = true;
scene.add(groundPlane);

console.log('Ground plane created');

// --- ROADS (ASPHALT) ---
function createRoad(x, z, width, depth) {
    const road = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.1, depth),
        new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 })
    );
    road.position.set(x, 0.05, z);
    road.receiveShadow = true;
    scene.add(road);
}

// Horizontal roads
for (let row = 0; row <= cityConfig.gridSize; row++) {
    const z = row * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth / 2;
    createRoad(0, z, groundSize, cityConfig.roadWidth);
}

// Vertical roads
for (let col = 0; col <= cityConfig.gridSize; col++) {
    const x = col * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth / 2;
    createRoad(x, 0, cityConfig.roadWidth, groundSize);
}

console.log('City roads created');

// --- SIDEWALK CURBS ---
function createSidewalk(x, z, width, depth) {
    const curb = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.3, depth),
        new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 })
    );
    curb.position.set(x, 0.15, z);
    curb.receiveShadow = true;
    scene.add(curb);
}

for (let row = 0; row < cityConfig.gridSize; row++) {
    for (let col = 0; col < cityConfig.gridSize; col++) {
        const blockX = col * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;
        const blockZ = row * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;

        // Top sidewalk
        createSidewalk(blockX, blockZ - cityConfig.blockSize / 2 - cityConfig.sidewalkWidth / 2, cityConfig.blockSize, cityConfig.sidewalkWidth);
        // Bottom sidewalk
        createSidewalk(blockX, blockZ + cityConfig.blockSize / 2 + cityConfig.sidewalkWidth / 2, cityConfig.blockSize, cityConfig.sidewalkWidth);
        // Left sidewalk
        createSidewalk(blockX - cityConfig.blockSize / 2 - cityConfig.sidewalkWidth / 2, blockZ, cityConfig.sidewalkWidth, cityConfig.blockSize);
        // Right sidewalk
        createSidewalk(blockX + cityConfig.blockSize / 2 + cityConfig.sidewalkWidth / 2, blockZ, cityConfig.sidewalkWidth, cityConfig.blockSize);
    }
}

console.log('Sidewalks created');

// --- PROCEDURAL BUILDINGS ---
const buildingColors = [
    0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 
    0xaa96da, 0xfcbad3, 0xa8e6cf, 0xdcedc1, 0xffd3b6, 
    0xffaaa5, 0xff8b94, 0xc7ceea, 0xffc8dd
];

function createBuilding(x, z, width, height, depth, color) {
    const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: 0.75, 
            metalness: 0.2 
        })
    );
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);

    // Store collision bounds
    collisionObjects.push({
        type: 'box',
        x: x,
        z: z,
        width: width,
        depth: depth,
        height: height
    });

    return building;
}

// Generate buildings in each block
for (let row = 0; row < cityConfig.gridSize; row++) {
    for (let col = 0; col < cityConfig.gridSize; col++) {
        const blockX = col * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;
        const blockZ = row * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;

        // Skip some blocks randomly to create variation
        if (Math.random() < 0.15) continue;

        // Place 1-3 buildings per block
        const numBuildings = Math.floor(Math.random() * 2) + 1;
        
        for (let i = 0; i < numBuildings; i++) {
            const bWidth = 8 + Math.random() * 10;
            const bHeight = 15 + Math.random() * 30;
            const bDepth = 8 + Math.random() * 10;
            
            const offsetX = (Math.random() - 0.5) * (cityConfig.blockSize - bWidth - 4);
            const offsetZ = (Math.random() - 0.5) * (cityConfig.blockSize - bDepth - 4);
            
            const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
            
            createBuilding(
                blockX + offsetX,
                blockZ + offsetZ,
                bWidth,
                bHeight,
                bDepth,
                color
            );
        }
    }
}

console.log('Buildings generated:', collisionObjects.length);

// --- LOW-POLY TREES ---
function createTree(x, z) {
    const tree = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Leaves (cone)
    const leavesGeo = new THREE.ConeGeometry(2, 5, 6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 5.5;
    leaves.castShadow = true;
    tree.add(leaves);

    tree.position.set(x, 0, z);
    scene.add(tree);

    // Collision
    collisionObjects.push({
        type: 'cylinder',
        x: x,
        z: z,
        radius: 0.8
    });

    return tree;
}

// Scatter trees around sidewalks
for (let i = 0; i < 40; i++) {
    const row = Math.floor(Math.random() * cityConfig.gridSize);
    const col = Math.floor(Math.random() * cityConfig.gridSize);
    
    const blockX = col * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;
    const blockZ = row * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;

    const side = Math.floor(Math.random() * 4);
    let treeX, treeZ;

    switch(side) {
        case 0: // top
            treeX = blockX + (Math.random() - 0.5) * cityConfig.blockSize * 0.8;
            treeZ = blockZ - cityConfig.blockSize / 2 - 2;
            break;
        case 1: // bottom
            treeX = blockX + (Math.random() - 0.5) * cityConfig.blockSize * 0.8;
            treeZ = blockZ + cityConfig.blockSize / 2 + 2;
            break;
        case 2: // left
            treeX = blockX - cityConfig.blockSize / 2 - 2;
            treeZ = blockZ + (Math.random() - 0.5) * cityConfig.blockSize * 0.8;
            break;
        case 3: // right
            treeX = blockX + cityConfig.blockSize / 2 + 2;
            treeZ = blockZ + (Math.random() - 0.5) * cityConfig.blockSize * 0.8;
            break;
    }

    createTree(treeX, treeZ);
}

console.log('Trees scattered');

// --- SIMPLE NPCs (PEDESTRIANS) ---
const npcs = [];

function createNPC(x, z) {
    const npc = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.2, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: Math.random() * 0xffffff,
        roughness: 0.7 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    npc.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshStandardMaterial({ 
        color: 0xf5deb3,
        roughness: 0.6 
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.7;
    head.castShadow = true;
    npc.add(head);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legMat = new THREE.MeshStandardMaterial({ 
        color: 0x2c3e50,
        roughness: 0.8 
    });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.3, 0);
    leftLeg.castShadow = true;
    npc.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.3, 0);
    rightLeg.castShadow = true;
    npc.add(rightLeg);

    npc.position.set(x, 0, z);
    scene.add(npc);

    // NPC AI state
    const npcData = {
        mesh: npc,
        x: x,
        z: z,
        speed: 0.02 + Math.random() * 0.02,
        direction: Math.random() * Math.PI * 2,
        turnTimer: 0,
        turnInterval: 3 + Math.random() * 4,
        radius: 0.5
    };

    npcs.push(npcData);
    
    // Add to collision
    collisionObjects.push({
        type: 'npc',
        data: npcData
    });

    return npc;
}

// Spawn NPCs on sidewalks
for (let i = 0; i < 10; i++) {
    const row = Math.floor(Math.random() * cityConfig.gridSize);
    const col = Math.floor(Math.random() * cityConfig.gridSize);
    
    const blockX = col * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;
    const blockZ = row * (cityConfig.blockSize + cityConfig.roadWidth) - groundSize / 2 + cityConfig.roadWidth + cityConfig.blockSize / 2;

    const side = Math.floor(Math.random() * 4);
    let npcX, npcZ;

    switch(side) {
        case 0:
            npcX = blockX + (Math.random() - 0.5) * cityConfig.blockSize * 0.7;
            npcZ = blockZ - cityConfig.blockSize / 2 - 1;
            break;
        case 1:
            npcX = blockX + (Math.random() - 0.5) * cityConfig.blockSize * 0.7;
            npcZ = blockZ + cityConfig.blockSize / 2 + 1;
            break;
        case 2:
            npcX = blockX - cityConfig.blockSize / 2 - 1;
            npcZ = blockZ + (Math.random() - 0.5) * cityConfig.blockSize * 0.7;
            break;
        case 3:
            npcX = blockX + cityConfig.blockSize / 2 + 1;
            npcZ = blockZ + (Math.random() - 0.5) * cityConfig.blockSize * 0.7;
            break;
    }

    createNPC(npcX, npcZ);
}

console.log('NPCs spawned:', npcs.length);

// ============================================
// COLLISION DETECTION
// ============================================

function checkCollision(x, z, radius) {
    for (let obj of collisionObjects) {
        if (obj.type === 'box') {
            // AABB collision with buildings
            const halfW = obj.width / 2;
            const halfD = obj.depth / 2;
            
            const closestX = Math.max(obj.x - halfW, Math.min(x, obj.x + halfW));
            const closestZ = Math.max(obj.z - halfD, Math.min(z, obj.z + halfD));
            
            const dx = x - closestX;
            const dz = z - closestZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < radius) {
                return { collision: true, nx: dx / dist, nz: dz / dist };
            }
        } else if (obj.type === 'cylinder') {
            // Circle collision with trees
            const dx = x - obj.x;
            const dz = z - obj.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < radius + obj.radius) {
                return { collision: true, nx: dx / dist, nz: dz / dist };
            }
        } else if (obj.type === 'npc') {
            // Circle collision with NPCs
            const npc = obj.data;
            const dx = x - npc.x;
            const dz = z - npc.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < radius + npc.radius) {
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
player.position.set(0, 0, 0);
scene.add(player);

let playerModel = null;
let mixer = null;
let isPlayerLoaded = false;

const clips = {
    idleGun: null,
    walk: null,
    run: null,
    roll: null,
    gunShoot: null,
    runShoot: null
};

let currentAction = null;

const look = {
    yaw: 0,
    pitch: 0,
    minPitch: -Math.PI / 2,
    maxPitch: Math.PI / 2,
    sensitivity: 0.004
};

const fpsView = {
    cameraHeight: 1.55
};

const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();

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
    gltf.animations.forEach(clip => {
        byName[clip.name] = clip;
    });

    Object.keys(CLIP_NAMES).forEach(key => {
        const clip = byName[CLIP_NAMES[key]];
        if (clip) {
            clips[key] = mixer.clipAction(clip);
        }
    });

    if (clips.roll) {
        clips.roll.setLoop(THREE.LoopOnce, 1);
        clips.roll.clampWhenFinished = true;
        physics.rollDuration = clips.roll.getClip().duration || physics.rollDuration;
    }

    if (clips.gunShoot) clips.gunShoot.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.runShoot) clips.runShoot.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.idleGun) clips.idleGun.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.walk) clips.walk.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.run) clips.run.setLoop(THREE.LoopRepeat, Infinity);

    if (clips.idleGun) {
        currentAction = clips.idleGun;
        currentAction.play();
    }
}

function crossFadeTo(target, duration = 0.25) {
    if (!mixer || !target || currentAction === target) return;

    if (currentAction) {
        currentAction.fadeOut(duration);
    }

    target.reset();
    target.setEffectiveTimeScale(1);
    target.setEffectiveWeight(1);
    target.fadeIn(duration);
    target.play();

    currentAction = target;
}

function updateAnimationState() {
    if (!mixer || !isPlayerLoaded) return;

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

    if (clips.idleGun) {
        crossFadeTo(clips.idleGun, 0.3);
    }
}

const loader = new THREE.GLTFLoader();

loader.load(
    'Mainmc1.glb',
    function (gltf) {
        playerModel = gltf.scene;

        const headKeywords = ['head'];

        playerModel.traverse(child => {
            if (child.isMesh) {
                const nameLower = child.name.toLowerCase();

                let isHead = false;
                for (let keyword of headKeywords) {
                    if (nameLower.includes(keyword)) {
                        isHead = true;
                        break;
                    }
                }

                if (isHead) {
                    child.visible = false;
                    console.log('Hidden head mesh:', child.name);
                } else {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }

                child.frustumCulled = false;
            }
        });

        playerModel.scale.set(1, 1, 1);
        player.add(playerModel);

        if (gltf.animations && gltf.animations.length > 0) {
            setupAnimations(gltf);
        }

        isPlayerLoaded = true;
        console.log('Player ready');
    },
    undefined,
    function (error) {
        console.error('Error loading Mainmc1.glb:', error);
    }
);

// ============================================
// MULTI-TOUCH INPUT
// ============================================

const touches = {
    joystick: null,
    camera: null
};

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

const cameraControlZone = document.getElementById('cameraControl');

let lastLookX = 0;
let lastLookY = 0;

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

btnRun.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    movement.isRunning = true;
    btnRun.classList.add('active');
    updateAnimationState();
}, { passive: false });

function releaseRun(e) {
    e.preventDefault();
    e.stopPropagation();
    movement.isRunning = false;
    btnRun.classList.remove('active');
    updateAnimationState();
}

btnRun.addEventListener('touchend', releaseRun, { passive: false });
btnRun.addEventListener('touchcancel', releaseRun, { passive: false });

btnJump.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();

    if (!physics.isGrounded || physics.isRolling) return;

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

    if (currentAction && currentAction !== clips.roll) {
        currentAction.fadeOut(0.1);
    }
    clips.roll.reset();
    clips.roll.setEffectiveTimeScale(1);
    clips.roll.setEffectiveWeight(1);
    clips.roll.fadeIn(0.1);
    clips.roll.play();
    currentAction = clips.roll;
}

btnFire.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    movement.isFiring = true;
    btnFire.classList.add('active');
    updateAnimationState();
}, { passive: false });

function releaseFire(e) {
    e.preventDefault();
    e.stopPropagation();
    movement.isFiring = false;
    btnFire.classList.remove('active');
    updateAnimationState();
}

btnFire.addEventListener('touchend', releaseFire, { passive: false });
btnFire.addEventListener('touchcancel', releaseFire, { passive: false });

btnReload.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Reload');
}, { passive: false });

// ============================================
// UPDATE
// ============================================

function updateNPCs(deltaTime) {
    npcs.forEach(npc => {
        npc.turnTimer += deltaTime;

        if (npc.turnTimer >= npc.turnInterval) {
            npc.direction += (Math.random() - 0.5) * Math.PI;
            npc.turnTimer = 0;
        }

        const moveX = Math.cos(npc.direction) * npc.speed;
        const moveZ = Math.sin(npc.direction) * npc.speed;

        const newX = npc.x + moveX;
        const newZ = npc.z + moveZ;

        // Simple boundary check to keep NPCs in city
        if (Math.abs(newX) < groundSize / 2 - 10 && Math.abs(newZ) < groundSize / 2 - 10) {
            npc.x = newX;
            npc.z = newZ;
            npc.mesh.position.set(npc.x, 0, npc.z);
            npc.mesh.rotation.y = npc.direction;
        } else {
            npc.direction += Math.PI;
        }
    });
}

function updatePlayer(deltaTime) {
    if (!isPlayerLoaded) return;

    player.rotation.y = look.yaw + Math.PI;

    if (physics.isRolling) {
        physics.rollTimer += deltaTime;

        const progress = Math.min(physics.rollTimer / physics.rollDuration, 1);
        const dash = physics.rollBoost * (1 - progress);

        const newX = player.position.x + physics.rollDirX * dash;
        const newZ = player.position.z + physics.rollDirZ * dash;

        const collision = checkCollision(newX, newZ, 0.5);
        if (!collision.collision) {
            player.position.x = newX;
            player.position.z = newZ;
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

        const newX = player.position.x + moveX;
        const newZ = player.position.z + moveZ;

        const collision = checkCollision(newX, newZ, 0.5);

        if (!collision.collision) {
            player.position.x = newX;
            player.position.z = newZ;
        } else {
            // Slide along wall
            const slideX = player.position.x + moveX * (1 - Math.abs(collision.nx));
            const slideZ = player.position.z + moveZ * (1 - Math.abs(collision.nz));
            
            const slideCheck = checkCollision(slideX, slideZ, 0.5);
            if (!slideCheck.collision) {
                player.position.x = slideX;
                player.position.z = slideZ;
            }
        }
    }

    if (mixer) {
        mixer.update(deltaTime);
    }
}

function updateCamera() {
    if (!isPlayerLoaded) return;

    camera.position.set(
        player.position.x,
        player.position.y + fpsView.cameraHeight,
        player.position.z
    );

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
    const deltaTime = clock.getDelta();
    updateNPCs(deltaTime);
    updatePlayer(deltaTime);
    updateCamera();
    renderer.render(scene, camera);
}

animate();
