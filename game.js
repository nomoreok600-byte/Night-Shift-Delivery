// ============================================
// OPEN WORLD 3D ENGINE - FIRST-PERSON (BODY VISIBLE)
// Three.js, GLTF character with head hidden,
// gun stance, roll/jump split, shooting states
// ============================================

console.log('Initializing Open World Engine (FPS)...');
console.log('THREE.js version:', THREE.REVISION);

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 300);

// --- PERSPECTIVE CAMERA ---
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

// YXZ order: yaw applied first, then pitch relative to yawed frame
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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 200;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// --- GROUND PLANE ---
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9, metalness: 0.1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- CITY BUILDINGS ---
const buildingColors = [
    0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3,
    0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf,
    0xdcedc1, 0xffd3b6, 0xffaaa5, 0xff8b94
];

function createBuilding(x, z, width, height, depth, color) {
    const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.2 })
    );
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    return building;
}

const buildings = [
    createBuilding(-40, -40, 15, 25, 15, buildingColors[0]),
    createBuilding(-40, -10, 12, 30, 12, buildingColors[1]),
    createBuilding(-40, 20, 18, 20, 14, buildingColors[2]),
    createBuilding(-40, 50, 10, 35, 10, buildingColors[3]),
    createBuilding(40, -40, 20, 22, 20, buildingColors[4]),
    createBuilding(40, -10, 14, 28, 16, buildingColors[5]),
    createBuilding(40, 20, 16, 32, 12, buildingColors[6]),
    createBuilding(40, 50, 12, 18, 14, buildingColors[7]),
    createBuilding(0, 60, 25, 40, 25, buildingColors[8]),
    createBuilding(-20, 80, 15, 24, 15, buildingColors[9]),
    createBuilding(20, 80, 18, 28, 18, buildingColors[10]),
    createBuilding(0, -60, 30, 35, 20, buildingColors[11])
];

buildings.forEach(b => scene.add(b));

// --- PLAYER CONTAINER ---
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

// ============================================
// FIRST-PERSON VIEW STATE
// ============================================

const look = {
    yaw: 0,                       // horizontal facing (player body rotation)
    pitch: 0,                     // vertical look (camera only)
    minPitch: -Math.PI / 2,       // straight down
    maxPitch: Math.PI / 2,        // straight up
    sensitivity: 0.004
};

const fpsView = {
    cameraHeight: 1.55            // neck/shoulder height above player origin
};

// Reused vectors
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();

// Camera looks down -Z, so forward is (-sin yaw, 0, -cos yaw)
function getForwardVector(target) {
    target.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw));
    return target;
}

// Right = forward × up
function getRightVector(target) {
    target.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
    return target;
}

// --- PLAYER PHYSICS ---
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

// --- MOVEMENT STATE ---
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
// ANIMATION SYSTEM
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
    gltf.animations.forEach(clip => {
        byName[clip.name] = clip;
    });

    Object.keys(CLIP_NAMES).forEach(key => {
        const clip = byName[CLIP_NAMES[key]];
        if (clip) {
            clips[key] = mixer.clipAction(clip);
            console.log('Mapped', key, '->', CLIP_NAMES[key]);
        } else {
            console.warn('Missing clip:', CLIP_NAMES[key]);
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

// ============================================
// MODEL LOADING & HEAD HIDING
// ============================================

const loader = new THREE.GLTFLoader();

loader.load(
    'Mainmc1.glb',
    function (gltf) {
        playerModel = gltf.scene;

        // Hide the head mesh to prevent first-person clipping
        // Common head mesh names: "Head", "head", "HEAD", "mixamorigHead", etc.
        const headKeywords = ['head'];

        playerModel.traverse(child => {
            if (child.isMesh) {
                const nameLower = child.name.toLowerCase();

                // Check if this mesh is the head
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

                // Prevent culling when camera is inside body bounds
                child.frustumCulled = false;
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
        console.log('Player ready (FPS mode with body visible)');
    },
    function (xhr) {
        if (xhr.total) {
            console.log('Loading:', Math.round((xhr.loaded / xhr.total) * 100) + '%');
        }
    },
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

// --- JOYSTICK (LEFT) ---
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

// --- FPS LOOK (RIGHT SIDE DRAG) ---
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

            // YAW: rotates player body (Y-axis), so arms and body turn
            look.yaw -= deltaX * look.sensitivity;

            // PITCH: camera X-axis only, look up/down
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

// --- RUN (hold) ---
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

// --- JUMP / ROLL ---
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

// --- FIRE (hold) ---
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

// --- RELOAD (placeholder) ---
btnReload.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Reload');
}, { passive: false });

// ============================================
// UPDATE
// ============================================

function updatePlayer(deltaTime) {
    if (!isPlayerLoaded) return;

    // Player body rotates with yaw (horizontal look)
    // Camera looks down -Z, player mesh forward is +Z, hence the PI correction
    player.rotation.y = look.yaw + Math.PI;

    // --- Roll dash ---
    if (physics.isRolling) {
        physics.rollTimer += deltaTime;

        const progress = Math.min(physics.rollTimer / physics.rollDuration, 1);
        const dash = physics.rollBoost * (1 - progress);

        player.position.x += physics.rollDirX * dash;
        player.position.z += physics.rollDirZ * dash;

        if (physics.rollTimer >= physics.rollDuration) {
            physics.isRolling = false;
            physics.rollTimer = 0;
            updateAnimationState();
        }
    }

    // --- Gravity / jump ---
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

    // --- Horizontal movement ---
    if (!physics.isRolling &&
        (Math.abs(movement.forward) > 0.01 || Math.abs(movement.right) > 0.01)) {

        getForwardVector(forwardVec);
        getRightVector(rightVec);

        const speed = movement.isRunning ? movement.runSpeed : movement.walkSpeed;

        player.position.x +=
            (forwardVec.x * movement.forward + rightVec.x * movement.right) * speed;
        player.position.z +=
            (forwardVec.z * movement.forward + rightVec.z * movement.right) * speed;
    }

    if (mixer) {
        mixer.update(deltaTime);
    }
}

function updateCamera() {
    if (!isPlayerLoaded) return;

    // Lock camera to player X/Z at neck/shoulder height
    camera.position.set(
        player.position.x,
        player.position.y + fpsView.cameraHeight,
        player.position.z
    );

    // Direct Euler assignment: yaw from player body, pitch camera-only
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
    updatePlayer(deltaTime);
    updateCamera();
    renderer.render(scene, camera);
}

animate();
