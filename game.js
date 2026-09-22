// ============================================
// OPEN WORLD 3D ENGINE - MULTI-TOUCH + ACTIONS
// Three.js, GLTF character, sprint/jump mechanics,
// true multi-touch support for mobile
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

console.log('Renderer initialized');

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

console.log('Lighting setup complete');

// --- GROUND PLANE (ASPHALT) ---
const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3a3a3a,
    roughness: 0.9,
    metalness: 0.1
});

const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

console.log('Ground plane created');

// --- CITY BUILDINGS ---
const buildingColors = [
    0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3,
    0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf,
    0xdcedc1, 0xffd3b6, 0xffaaa5, 0xff8b94
];

function createBuilding(x, z, width, height, depth, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: 0.7,
        metalness: 0.2
    });
    
    const building = new THREE.Mesh(geometry, material);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    
    return building;
}

const buildings = [];

buildings.push(createBuilding(-40, -40, 15, 25, 15, buildingColors[0]));
buildings.push(createBuilding(-40, -10, 12, 30, 12, buildingColors[1]));
buildings.push(createBuilding(-40, 20, 18, 20, 14, buildingColors[2]));
buildings.push(createBuilding(-40, 50, 10, 35, 10, buildingColors[3]));

buildings.push(createBuilding(40, -40, 20, 22, 20, buildingColors[4]));
buildings.push(createBuilding(40, -10, 14, 28, 16, buildingColors[5]));
buildings.push(createBuilding(40, 20, 16, 32, 12, buildingColors[6]));
buildings.push(createBuilding(40, 50, 12, 18, 14, buildingColors[7]));

buildings.push(createBuilding(0, 60, 25, 40, 25, buildingColors[8]));
buildings.push(createBuilding(-20, 80, 15, 24, 15, buildingColors[9]));
buildings.push(createBuilding(20, 80, 18, 28, 18, buildingColors[10]));

buildings.push(createBuilding(0, -60, 30, 35, 20, buildingColors[11]));

buildings.forEach(building => scene.add(building));

console.log('City buildings generated:', buildings.length);

// --- PLAYER CHARACTER (GLTF MODEL) ---
let player = new THREE.Group();
let playerModel = null;
let mixer = null;
let animations = {};
let currentAction = null;
let isPlayerLoaded = false;

player.position.set(0, 0, 0);
scene.add(player);

// --- PLAYER PHYSICS ---
const physics = {
    yVelocity: 0,
    gravity: -0.025,
    jumpStrength: 0.5,
    isGrounded: true,
    groundLevel: 0
};

// --- ANIMATION SYSTEM ---
function setupAnimations(gltf) {
    mixer = new THREE.AnimationMixer(gltf.scene);
    
    gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        animations[clip.name] = action;
        console.log('Animation loaded:', clip.name);
    });

    if (animations['Idle'] || animations['idle']) {
        currentAction = animations['Idle'] || animations['idle'];
        currentAction.play();
        console.log('Playing Idle animation');
    } else if (gltf.animations.length > 0) {
        currentAction = mixer.clipAction(gltf.animations[0]);
        currentAction.play();
        console.log('Playing first available animation:', gltf.animations[0].name);
    }
}

function switchAnimation(toAnimationName, duration = 0.25) {
    if (!mixer || !animations[toAnimationName]) {
        return;
    }

    const toAction = animations[toAnimationName];

    if (currentAction === toAction) return;

    if (currentAction) {
        currentAction.fadeOut(duration);
    }

    toAction.reset().fadeIn(duration).play();
    currentAction = toAction;
}

// --- LOAD GLTF MODEL ---
const loader = new THREE.GLTFLoader();

console.log('Loading character model: Mainmc1.glb');

loader.load(
    'Mainmc1.glb',
    function (gltf) {
        console.log('GLTF model loaded successfully');
        
        playerModel = gltf.scene;
        
        playerModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        playerModel.scale.set(1, 1, 1);
        
        player.add(playerModel);
        
        if (gltf.animations && gltf.animations.length > 0) {
            console.log('Found', gltf.animations.length, 'animations in model');
            setupAnimations(gltf);
        } else {
            console.warn('No animations found in GLTF model');
        }
        
        isPlayerLoaded = true;
        console.log('Player ready');
    },
    function (xhr) {
        const percentComplete = (xhr.loaded / xhr.total) * 100;
        console.log('Loading progress:', Math.round(percentComplete) + '%');
    },
    function (error) {
        console.error('Error loading GLTF model:', error);
    }
);

// --- PLAYER MOVEMENT STATE ---
const movement = {
    forward: 0,
    right: 0,
    walkSpeed: 0.12,
    runSpeed: 0.24,
    currentSpeed: 0.12,
    isMoving: false,
    isRunning: false
};

// --- CAMERA CONTROL STATE ---
const cameraControl = {
    distance: 8,
    height: 4,
    yaw: 0,
    pitch: 0.3,
    minPitch: -0.5,
    maxPitch: 1.2,
    sensitivity: 0.003
};

// --- MULTI-TOUCH STATE TRACKING ---
const touches = {
    joystick: null,
    camera: null
};

// --- VIRTUAL JOYSTICK (LEFT SIDE) ---
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

    joystickStick.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

    movement.right = clampedX / joystickMaxDistance;
    movement.forward = -clampedY / joystickMaxDistance;
    
    const isNowMoving = Math.abs(movement.forward) > 0.1 || Math.abs(movement.right) > 0.1;
    
    if (isNowMoving !== movement.isMoving) {
        movement.isMoving = isNowMoving;
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

function updateAnimationState() {
    if (!movement.isMoving) {
        if (animations['Idle']) switchAnimation('Idle', 0.2);
        else if (animations['idle']) switchAnimation('idle', 0.2);
    } else {
        if (movement.isRunning) {
            if (animations['Run']) switchAnimation('Run', 0.2);
            else if (animations['run']) switchAnimation('run', 0.2);
            else if (animations['Running']) switchAnimation('Running', 0.2);
        } else {
            if (animations['Walk']) switchAnimation('Walk', 0.2);
            else if (animations['walk']) switchAnimation('walk', 0.2);
            else if (animations['Run']) switchAnimation('Run', 0.2);
            else if (animations['run']) switchAnimation('run', 0.2);
        }
    }
}

joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touches.joystick = touch.identifier;
    updateJoystickCenter();
    handleJoystickMove(touch.clientX, touch.clientY);
}, { passive: false });

joystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === touches.joystick) {
            handleJoystickMove(touch.clientX, touch.clientY);
            break;
        }
    }
}, { passive: false });

joystick.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touches.joystick) {
            touches.joystick = null;
            resetJoystick();
            break;
        }
    }
}, { passive: false });

console.log('Joystick initialized');

// --- CAMERA CONTROL (RIGHT SIDE DRAG) ---
const cameraControlZone = document.getElementById('cameraControl');

let lastCameraTouchX = 0;
let lastCameraTouchY = 0;

cameraControlZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touches.camera = touch.identifier;
    lastCameraTouchX = touch.clientX;
    lastCameraTouchY = touch.clientY;
}, { passive: false });

cameraControlZone.addEventListener('touchmove', (e) => {
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

cameraControlZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touches.camera) {
            touches.camera = null;
            break;
        }
    }
}, { passive: false });

console.log('Camera control initialized');

// --- ACTION BUTTONS ---
const btnRun = document.getElementById('btnRun');
const btnJump = document.getElementById('btnJump');
const btnFire = document.getElementById('btnFire');
const btnReload = document.getElementById('btnReload');

// RUN BUTTON (Hold to sprint)
btnRun.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    movement.isRunning = true;
    movement.currentSpeed = movement.runSpeed;
    btnRun.classList.add('active');
    updateAnimationState();
}, { passive: false });

btnRun.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    movement.isRunning = false;
    movement.currentSpeed = movement.walkSpeed;
    btnRun.classList.remove('active');
    updateAnimationState();
}, { passive: false });

// JUMP BUTTON
btnJump.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (physics.isGrounded) {
        physics.yVelocity = physics.jumpStrength;
        physics.isGrounded = false;
        console.log('Jump!');
    }
}, { passive: false });

// FIRE BUTTON (placeholder)
btnFire.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Fire!');
}, { passive: false });

// RELOAD BUTTON (placeholder)
btnReload.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Reload!');
}, { passive: false });

console.log('Action buttons initialized');

// --- UPDATE PLAYER ---
function updatePlayer(deltaTime) {
    if (!isPlayerLoaded) return;

    // Apply gravity and jump physics
    if (!physics.isGrounded || player.position.y > physics.groundLevel) {
        physics.yVelocity += physics.gravity;
        player.position.y += physics.yVelocity;

        if (player.position.y <= physics.groundLevel) {
            player.position.y = physics.groundLevel;
            physics.yVelocity = 0;
            physics.isGrounded = true;
        }
    }

    // Horizontal movement
    if (Math.abs(movement.forward) > 0.01 || Math.abs(movement.right) > 0.01) {
        const cameraYawAngle = cameraControl.yaw;
        
        const forwardX = Math.sin(cameraYawAngle) * movement.forward;
        const forwardZ = Math.cos(cameraYawAngle) * movement.forward;
        
        const rightX = Math.sin(cameraYawAngle + Math.PI / 2) * movement.right;
        const rightZ = Math.cos(cameraYawAngle + Math.PI / 2) * movement.right;
        
        const moveX = (forwardX + rightX) * movement.currentSpeed;
        const moveZ = (forwardZ + rightZ) * movement.currentSpeed;
        
        player.position.x += moveX;
        player.position.z += moveZ;
        
        const moveAngle = Math.atan2(moveX, moveZ);
        player.rotation.y = moveAngle;
    }

    if (mixer) {
        mixer.update(deltaTime);
    }
}

// --- UPDATE CAMERA (THIRD-PERSON FOLLOW) ---
function updateCamera() {
    if (!isPlayerLoaded) return;

    const offsetX = Math.sin(cameraControl.yaw) * cameraControl.distance * Math.cos(cameraControl.pitch);
    const offsetY = cameraControl.height + Math.sin(cameraControl.pitch) * cameraControl.distance;
    const offsetZ = Math.cos(cameraControl.yaw) * cameraControl.distance * Math.cos(cameraControl.pitch);

    camera.position.x = player.position.x - offsetX;
    camera.position.y = player.position.y + offsetY;
    camera.position.z = player.position.z - offsetZ;

    camera.lookAt(
        player.position.x,
        player.position.y + 2,
        player.position.z
    );
}

// --- RENDER LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    
    updatePlayer(deltaTime);
    updateCamera();
    
    renderer.render(scene, camera);
}

console.log('Starting render loop...');
animate();
