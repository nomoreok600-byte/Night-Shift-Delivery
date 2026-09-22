// ============================================
// NIGHT SHIFT DELIVERY - 3D ISOMETRIC ENGINE
// Three.js setup, isometric camera, low-poly character,
// platform level, touch joystick movement
// ============================================

console.log('Game initializing...');
console.log('THREE.js version:', THREE.REVISION);

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 25, 60);

console.log('Scene created');

// --- ORTHOGRAPHIC CAMERA (ISOMETRIC VIEW) ---
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 20;

const camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,  // left
    (frustumSize * aspect) / 2,   // right
    frustumSize / 2,              // top
    frustumSize / -2,             // bottom
    0.1,                          // near
    1000                          // far
);

// Position for isometric view
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

console.log('Camera created at:', camera.position);

// --- RENDERER ---
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: false
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Append renderer canvas to body
document.body.appendChild(renderer.domElement);

console.log('Renderer created and appended to body');

// Handle window resize
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    
    camera.left = (frustumSize * aspect) / -2;
    camera.right = (frustumSize * aspect) / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    console.log('Window resized');
});

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0x6688aa, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(15, 25, 10);
directionalLight.castShadow = true;

directionalLight.shadow.camera.left = -25;
directionalLight.shadow.camera.right = 25;
directionalLight.shadow.camera.top = 25;
directionalLight.shadow.camera.bottom = -25;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 60;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.bias = -0.0001;

scene.add(directionalLight);

console.log('Lights added to scene');

// --- PLATFORM LEVEL (FLOATING STONE GRID) ---
const platformGroup = new THREE.Group();

const stoneGeometry = new THREE.BoxGeometry(1, 0.6, 1);
const stoneMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4a5568,
    roughness: 0.85,
    metalness: 0.15
});

// Create 12x12 platform grid
for (let x = -6; x <= 5; x++) {
    for (let z = -6; z <= 5; z++) {
        const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
        stone.position.set(x * 1.05, -0.3, z * 1.05);
        stone.castShadow = false;
        stone.receiveShadow = true;
        platformGroup.add(stone);
    }
}

scene.add(platformGroup);

console.log('Platform created with', platformGroup.children.length, 'blocks');

// --- PLAYER CHARACTER (LOW-POLY MALE PROTAGONIST) ---
const player = new THREE.Group();

// Body (torso)
const bodyGeometry = new THREE.BoxGeometry(0.7, 1.2, 0.5);
const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2d3e50,
    roughness: 0.7,
    metalness: 0.1
});
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.position.y = 0.9;
body.castShadow = true;
body.receiveShadow = true;
player.add(body);

// Head
const headGeometry = new THREE.BoxGeometry(0.45, 0.45, 0.45);
const headMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3a4f63,
    roughness: 0.6,
    metalness: 0.05
});
const head = new THREE.Mesh(headGeometry, headMaterial);
head.position.y = 1.75;
head.castShadow = true;
head.receiveShadow = true;
player.add(head);

// Arms
const armGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.25);
const armMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2d3e50,
    roughness: 0.7
});

const leftArm = new THREE.Mesh(armGeometry, armMaterial);
leftArm.position.set(-0.5, 0.9, 0);
leftArm.castShadow = true;
player.add(leftArm);

const rightArm = new THREE.Mesh(armGeometry, armMaterial);
rightArm.position.set(0.5, 0.9, 0);
rightArm.castShadow = true;
player.add(rightArm);

// Legs
const legGeometry = new THREE.BoxGeometry(0.28, 0.7, 0.28);
const legMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a2332,
    roughness: 0.8
});

const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
leftLeg.position.set(-0.18, 0.15, 0);
leftLeg.castShadow = true;
player.add(leftLeg);

const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
rightLeg.position.set(0.18, 0.15, 0);
rightLeg.castShadow = true;
player.add(rightLeg);

// Position player on platform
player.position.set(0, 0.3, 0);
scene.add(player);

console.log('Player character created and added to scene');

// --- PLAYER MOVEMENT STATE ---
const movement = {
    forward: 0,
    right: 0,
    speed: 0.12
};

// --- VIRTUAL JOYSTICK ---
const joystick = document.getElementById('joystick');
const joystickStick = document.getElementById('joystickStick');

let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };
const joystickMaxDistance = 42;

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

console.log('Joystick initialized');

// --- CAMERA FOLLOW ---
let cameraOffsetX = 20;
let cameraOffsetY = 20;
let cameraOffsetZ = 20;

// --- UPDATE LOOP ---
function updatePlayer() {
    // Move player
    player.position.x += movement.right * movement.speed;
    player.position.z += movement.forward * movement.speed;

    // Constrain to platform
    player.position.x = Math.max(-5.5, Math.min(5.5, player.position.x));
    player.position.z = Math.max(-5.5, Math.min(5.5, player.position.z));

    // Rotate player toward movement direction
    if (Math.abs(movement.forward) > 0.05 || Math.abs(movement.right) > 0.05) {
        const targetAngle = Math.atan2(movement.right, movement.forward);
        player.rotation.y = targetAngle;
    }

    // Subtle head bob animation
    const time = Date.now() * 0.002;
    head.position.y = 1.75 + Math.sin(time) * 0.04;
}

function updateCamera() {
    // Smooth camera follow
    const targetX = player.position.x + cameraOffsetX;
    const targetY = cameraOffsetY;
    const targetZ = player.position.z + cameraOffsetZ;
    
    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.y += (targetY - camera.position.y) * 0.08;
    camera.position.z += (targetZ - camera.position.z) * 0.08;
    
    camera.lookAt(player.position.x, 0, player.position.z);
}

// --- RENDER LOOP ---
let frameCount = 0;

function animate() {
    requestAnimationFrame(animate);
    
    frameCount++;
    
    updatePlayer();
    updateCamera();
    
    renderer.render(scene, camera);
    
    // Log first few frames to confirm render loop is running
    if (frameCount < 5) {
        console.log('Frame', frameCount, 'rendered');
    }
}

console.log('Starting animation loop...');
animate();
