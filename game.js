// ============================================
// OPEN WORLD 3D ENGINE - ADVANCED STATE MACHINE
// Three.js, GLTF character, gun stance, roll/jump split,
// shooting states, true multi-touch for mobile
// ============================================

console.log('Initializing Open World Engine...');
console.log('THREE.js version:', THREE.REVISION);

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 300);

// --- PERSPECTIVE CAMERA ---
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

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

// Named animation actions
const clips = {
    idleGun: null,
    walk: null,
    run: null,
    roll: null,
    gunShoot: null,
    runShoot: null
};

let currentAction = null;

// --- PLAYER PHYSICS ---
const physics = {
    yVelocity: 0,
    gravity: -0.025,
    jumpStrength: 0.45,
    isGrounded: true,
    groundLevel: 0,
    // Roll dash state
    isRolling: false,
    rollTimer: 0,
    rollDuration: 0.7,        // seconds, overwritten by clip length if available
    rollBoost: 0.42,          // forward units per frame at roll start
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

// --- CAMERA ORBIT STATE ---
const cameraControl = {
    distance: 8,
    height: 4,
    yaw: 0,
    pitch: 0.3,
    minPitch: -0.5,
    maxPitch: 1.2,
    sensitivity: 0.003
};

// ============================================
// ANIMATION SYSTEM
// ============================================

// Exact clip names present in Mainmc1.glb
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

    // Build a lookup of clips by exact name
    const byName = {};
    gltf.animations.forEach(clip => {
        byName[clip.name] = clip;
        console.log('Found clip:', clip.name);
    });

    // Map each state to its action
    Object.keys(CLIP_NAMES).forEach(key => {
        const clipName = CLIP_NAMES[key];
        const clip = byName[clipName];
        if (clip) {
            clips[key] = mixer.clipAction(clip);
            console.log('Mapped', key, '->', clipName);
        } else {
            console.warn('Missing clip:', clipName);
        }
    });

    // Roll plays once and holds its final frame, so we can time the dash to it
    if (clips.roll) {
        clips.roll.setLoop(THREE.LoopOnce, 1);
        clips.roll.clampWhenFinished = true;
        physics.rollDuration = clips.roll.getClip().duration || physics.rollDuration;
    }

    // Shooting clips loop while the fire button is held
    if (clips.gunShoot) clips.gunShoot.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.runShoot) clips.runShoot.setLoop(THREE.LoopRepeat, Infinity);

    // Locomotion loops
    if (clips.idleGun) clips.idleGun.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.walk) clips.walk.setLoop(THREE.LoopRepeat, Infinity);
    if (clips.run) clips.run.setLoop(THREE.LoopRepeat, Infinity);

    // Default stance
    if (clips.idleGun) {
        currentAction = clips.idleGun;
        currentAction.play();
    }
}

// Smooth blend between two actions. Falls back silently if the clip is missing.
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

// ============================================
// STATE MACHINE
// Priority: Roll > Shooting > Run > Walk > Idle_Gun
// Jumping deliberately does NOT change the clip — the current
// frame carries through the air as specified.
// ============================================
function updateAnimationState() {
    if (!mixer || !isPlayerLoaded) return;

    // 1. Roll owns the character until it finishes
    if (physics.isRolling) {
        return;
    }

    // 2. Airborne (non-roll jump): hold whatever is playing
    if (!physics.isGrounded) {
        return;
    }

    // 3. Shooting variants
    if (movement.isFiring) {
        if (movement.isMoving && movement.isRunning && clips.runShoot) {
            crossFadeTo(clips.runShoot, 0.15);
        } else if (clips.gunShoot) {
            crossFadeTo(clips.gunShoot, 0.15);
        }
        return;
    }

    // 4. Locomotion
    if (movement.isMoving) {
        if (movement.isRunning && clips.run) {
            crossFadeTo(clips.run, 0.25);
        } else if (clips.walk) {
            crossFadeTo(clips.walk, 0.25);
        }
        return;
    }

    // 5. Default stance
    if (clips.idleGun) {
        crossFadeTo(clips.idleGun, 0.3);
    }
}

// ============================================
// MODEL LOADING
// ============================================
const loader = new THREE.GLTFLoader();

loader.load(
    'Mainmc1.glb',
    function (gltf) {
        playerModel = gltf.scene;

        playerModel.traverse(child => {
            if (child.isMesh) {
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
        console.log('Player ready');
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
// Each control tracks its own touch.identifier so the left thumb
// and right thumb never steal each other's events.
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

// --- CAMERA DRAG (RIGHT) ---
const cameraControlZone = document.getElementById('cameraControl');

let lastCameraTouchX = 0;
let lastCameraTouchY = 0;

cameraControlZone.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touches.camera = touch.identifier;
    lastCameraTouchX = touch.clientX;
    lastCameraTouchY = touch.clientY;
}, { passive: false });

cameraControlZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === touches.camera) {
            const deltaX = touch.clientX - lastCameraTouchX;
            const deltaY = touch.clientY - lastCameraTouchY;

            cameraControl.yaw -= deltaX * cameraControl.sensitivity;
            cameraControl.pitch += deltaY * cameraControl.sensitivity;
            cameraControl.pitch = Math.max(
                cameraControl.minPitch,
                Math.min(cameraControl.maxPitch, cameraControl.pitch)
            );

            lastCameraTouchX = touch.clientX;
            lastCameraTouchY = touch.clientY;
            break;
        }
    }
}, { passive: false });

function endCameraTouch(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touches.camera) {
            touches.camera = null;
            break;
        }
    }
}

cameraControlZone.addEventListener('touchend', endCameraTouch, { passive: false });
cameraControlZone.addEventListener('touchcancel', endCameraTouch, { passive: false });

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
// Running + Jump = Roll (forward dash, plays once)
// Not running + Jump = vertical hop, current clip frame carries through the air
btnJump.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();

    if (!physics.isGrounded || physics.isRolling) return;

    if (movement.isRunning && clips.roll) {
        startRoll();
    } else {
        physics.yVelocity = physics.jumpStrength;
        physics.isGrounded = false;
        // No animation change — the airborne frame is whatever was playing.
    }
}, { passive: false });

function startRoll() {
    physics.isRolling = true;
    physics.rollTimer = 0;

    // Dash along the direction the character is currently facing
    physics.rollDirX = Math.sin(player.rotation.y);
    physics.rollDirZ = Math.cos(player.rotation.y);

    // Roll clip overrides the state machine for its full duration
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
    // State machine picks Run / Walk / Idle_Gun based on current inputs
    updateAnimationState();
}

btnFire.addEventListener('touchend', releaseFire, { passive: false });
btnFire.addEventListener('touchcancel', releaseFire, { passive: false });

// --- RELOAD (placeholder until a Reload clip exists) ---
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

    // --- Roll dash ---
    if (physics.isRolling) {
        physics.rollTimer += deltaTime;

        // Ease the dash out over the clip's duration so it decelerates naturally
        const progress = Math.min(physics.rollTimer / physics.rollDuration, 1);
        const falloff = 1 - progress;
        const dash = physics.rollBoost * falloff;

        player.position.x += physics.rollDirX * dash;
        player.position.z += physics.rollDirZ * dash;

        if (physics.rollTimer >= physics.rollDuration) {
            physics.isRolling = false;
            physics.rollTimer = 0;
            updateAnimationState();
        }
    }

    // --- Gravity / jump arc ---
    if (!physics.isGrounded || player.position.y > physics.groundLevel) {
        physics.yVelocity += physics.gravity;
        player.position.y += physics.yVelocity;

        if (player.position.y <= physics.groundLevel) {
            player.position.y = physics.groundLevel;
            physics.yVelocity = 0;
            physics.isGrounded = true;
            // Resume ground state machine on landing
            updateAnimationState();
        }
    }

    // --- Horizontal movement (blocked during roll so the dash reads cleanly) ---
    if (!physics.isRolling &&
        (Math.abs(movement.forward) > 0.01 || Math.abs(movement.right) > 0.01)) {

        const yaw = cameraControl.yaw;
        const speed = movement.isRunning ? movement.runSpeed : movement.walkSpeed;

        const forwardX = Math.sin(yaw) * movement.forward;
        const forwardZ = Math.cos(yaw) * movement.forward;
        const rightX = Math.sin(yaw + Math.PI / 2) * movement.right;
        const rightZ = Math.cos(yaw + Math.PI / 2) * movement.right;

        const moveX = (forwardX + rightX) * speed;
        const moveZ = (forwardZ + rightZ) * speed;

        player.position.x += moveX;
        player.position.z += moveZ;
        player.rotation.y = Math.atan2(moveX, moveZ);
    }

    if (mixer) {
        mixer.update(deltaTime);
    }
}

function updateCamera() {
    if (!isPlayerLoaded) return;

    const cosPitch = Math.cos(cameraControl.pitch);
    const offsetX = Math.sin(cameraControl.yaw) * cameraControl.distance * cosPitch;
    const offsetY = cameraControl.height + Math.sin(cameraControl.pitch) * cameraControl.distance;
    const offsetZ = Math.cos(cameraControl.yaw) * cameraControl.distance * cosPitch;

    camera.position.x = player.position.x - offsetX;
    camera.position.y = player.position.y + offsetY;
    camera.position.z = player.position.z - offsetZ;

    camera.lookAt(player.position.x, player.position.y + 2, player.position.z);
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
