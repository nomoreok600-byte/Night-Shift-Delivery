// ============================================
// NIGHT SHIFT DELIVERY - 3D ISOMETRIC ENGINE
// Three.js setup, isometric camera, low-poly character,
// platform level, touch joystick movement
// ============================================

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f); // Dark atmospheric background
scene.fog = new THREE.Fog(0x0a0a0f, 20, 50); // Distance fog for atmosphere

// --- ORTHOGRAPHIC CAMERA (ISOMETRIC VIEW) ---
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 15;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
);

// Position camera for perfect isometric angle (45° horizontal, 35.264° vertical)
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);

// --- RENDERER ---
const container = document.getElementById('gameContainer');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Handle window resize / rotation
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- LIGHTING ---
// Ambient light (soft global illumination)
const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambientLight);

// Directional light (sun-like, casts shadows)
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 8);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// --- PLATFORM LEVEL (FLOATING STONE GRID) ---
const platformGrid = new THREE.Group();

const stoneGeometry = new THREE.BoxGeometry(1, 0.5, 1);
const stoneMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x5a5a6e,
    roughness: 0.8,
    metalness: 0.2
});

// Create 10x10 grid of stone cubes
for (let x = -5; x < 5; x++) {
    for (let z = -5; z < 5; z++) {
        const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
        stone.position.set(x * 1.1, -0.25, z * 1.1);
        stone.castShadow = false;
        stone.receiveShadow = true;
        platformGrid.add(stone);
    }
}

scene.add(platformGrid);

// --- PLAYER CHARACTER (LOW-POLY MALE PROTAGONIST) ---
const player = new THREE.Group();

// Body (torso)
const bodyGeometry = new THREE.BoxGeometry(0.6, 1.0, 0.4);
const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2a3f5f,
    roughness: 0.7
});
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.position.y = 0.5;
body.castShadow = true;
body.receiveShadow = true;
player.add(body);

// Head
const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const headMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3d5066,
    roughness: 0.6
});
const head = new THREE.Mesh(headGeometry, headMaterial);
head.position.y = 1.2;
head.castShadow = true;
head.receiveShadow = true;
player.add(head);

// Legs (two small boxes)
const legGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.3);
const legMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a2a3f,
    roughness: 0.8
});

const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
leftLeg.position.set(-0.15, 0.0, 0);
leftLeg.castShadow = true;
player.add(leftLeg);

const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
rightLeg.position.set(0.15, 0.0, 0);
rightLeg.castShadow = true;
player.add(rightLeg);

// Start position
player.position.set(0, 0.6, 0);
scene.add(player);

// --- PLAYER MOVEMENT STATE ---
const movement = {
    forward: 0,  // -1 to 1 (Z axis)
    right: 0,    // -1 to 1 (X axis)
    speed: 0.08
};

// --- VIRTUAL JOYSTICK ---
const joystick = document.getElementById('joystick');
const joystickStick = document.getElementById('joystickStick');

let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };
const joystickMaxDistance = 35;

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

    // Update visual stick position
    joystickStick.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

    // Map to movement input (isometric axes)
    // In isometric view, screen up/down controls Z, left/right controls X
    movement.right = clampedX / joystickMaxDistance;
    movement.forward = -clampedY / joystickMaxDistance; // Negative because screen Y is inverted
}

function resetJoystick() {
    joystickStick.style.transform = 'translate(-50%, -50%)';
    movement.forward = 0;
    movement.right = 0;
    joystickActive = false;
}

joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    updateJoystickCenter();
    const touch = e.touches[0];
    handleJoystickMove(touch.clientX, touch.clientY);
}, { passive: false });

joystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (joystickActive) {
        const touch = e.touches[0];
        handleJoystickMove(touch.clientX, touch.clientY);
    }
}, { passive: false });

joystick.addEventListener('touchend', (e) => {
    e.preventDefault();
    resetJoystick();
}, { passive: false });

// --- UPDATE LOOP ---
function updatePlayer() {
    // Move player based on joystick input
    player.position.x += movement.right * movement.speed;
    player.position.z += movement.forward * movement.speed;

    // Keep player within platform bounds
    player.position.x = Math.max(-4.5, Math.min(4.5, player.position.x));
    player.position.z = Math.max(-4.5, Math.min(4.5, player.position.z));

    // Rotate player to face movement direction (if moving)
    if (Math.abs(movement.forward) > 0.1 || Math.abs(movement.right) > 0.1) {
        const targetAngle = Math.atan2(movement.right, movement.forward);
        player.rotation.y = targetAngle;
    }

    // Simple idle animation (head bob)
    head.position.y = 1.2 + Math.sin(Date.now() * 0.003) * 0.05;
}

function updateCamera() {
    // Camera follows player with smooth offset
    const targetX = player.position.x + 10;
    const targetZ = player.position.z + 10;
    
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    
    camera.lookAt(player.position.x, 0, player.position.z);
}

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    updatePlayer();
    updateCamera();
    
    renderer.render(scene, camera);
}

animate();
