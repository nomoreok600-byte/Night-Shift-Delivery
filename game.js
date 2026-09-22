// ============================================
// OPEN WORLD 3D ENGINE - GTA-STYLE THIRD-PERSON
// Three.js, low-poly character, city buildings,
// dual mobile touch controls (joystick + camera drag)
// ============================================

console.log('Initializing Open World Engine...');
console.log('THREE.js version:', THREE.REVISION);

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue
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

// Handle window resize
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
    0xff6b6b, // Coral red
    0x4ecdc4, // Turquoise
    0xffe66d, // Yellow
    0x95e1d3, // Mint
    0xf38181, // Pink
    0xaa96da, // Lavender
    0xfcbad3, // Light pink
    0xa8e6cf, // Seafoam
    0xdcedc1, // Light green
    0xffd3b6, // Peach
    0xffaaa5, // Salmon
    0xff8b94  // Rose
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

// Generate city blocks
const buildings = [];

// Block 1 (left side)
buildings.push(createBuilding(-40, -40, 15, 25, 15, buildingColors[0]));
buildings.push(createBuilding(-40, -10, 12, 30, 12, buildingColors[1]));
buildings.push(createBuilding(-40, 20, 18, 20, 14, buildingColors[2]));
buildings.push(createBuilding(-40, 50, 10, 35, 10, buildingColors[3]));

// Block 2 (right side)
buildings.push(createBuilding(40, -40, 20, 22, 20, buildingColors[4]));
buildings.push(createBuilding(40, -10, 14, 28, 16, buildingColors[5]));
buildings.push(createBuilding(40, 20, 16, 32, 12, buildingColors[6]));
buildings.push(createBuilding(40, 50, 12, 18, 14, buildingColors[7]));

// Block 3 (center forward)
buildings.push(createBuilding(0, 60, 25, 40, 25, buildingColors[8]));
buildings.push(createBuilding(-20, 80, 15, 24, 15, buildingColors[9]));
buildings.push(createBuilding(20, 80, 18, 28, 18, buildingColors[10]));

// Block 4 (far back)
buildings.push(createBuilding(0, -60, 30, 35, 20, buildingColors[11]));

buildings.forEach(building => scene.add(building));

console.log('City buildings generated:', buildings.length);

// --- PLAYER CHARACTER (LOW-POLY MALE) ---
const player = new THREE.Group();

// Torso
const torsoGeometry = new THREE.BoxGeometry(1.2, 1.6, 0.6);
const torsoMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2c3e50,
    roughness: 0.7
});
const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
torso.position.y = 1.5;
torso.castShadow = true;
player.add(torso);

// Head
const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const headMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xd4a373,
    roughness: 0.6
});
const head = new THREE.Mesh(headGeometry, headMaterial);
head.position.y = 2.6;
head.castShadow = true;
player.add(head);

// Arms
const armGeometry = new THREE.BoxGeometry(0.3, 1.2, 0.3);
const armMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x34495e,
    roughness: 0.7
});

const leftArm = new THREE.Mesh(armGeometry, armMaterial);
leftArm.position.set(-0.75, 1.5, 0);
leftArm.castShadow = true;
player.add(leftArm);

const rightArm = new THREE.Mesh(armGeometry, armMaterial);
rightArm.position.set(0.75, 1.5, 0);
rightArm.castShadow = true;
player.add(rightArm);

// Legs
const legGeometry = new THREE.BoxGeometry(0.4, 1.2, 0.4);
const legMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x7f8c8d,
    roughness: 0.8
});

const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
leftLeg.position.set(-0.3, 0.6, 0);
leftLeg.castShadow = true;
player.add(leftLeg);

const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
rightLeg.position.set(0.3, 0.6, 0);
rightLeg.castShadow = true;
player.add(rightLeg);

player.position.set(0, 0, 0);
scene.add(player);

console.log('Player character created');

// --- PLAYER MOVEMENT STATE ---
const movement = {
    forward: 0,
    right: 0,
    speed: 0.15,
    rotationSpeed: 0.05
};

// --- CAMERA CONTROL STATE ---
const cameraControl = {
    distance: 8,
    height: 4,
    yaw: 0,        // Horizontal rotation around player
    pitch: 0.3,    // Vertical angle (looking down slightly)
    minPitch: -0.5,
    maxPitch: 1.2,
    sensitivity: 0.003
};

// --- VIRTUAL JOYSTICK (LEFT SIDE) ---
const joystick = document.getElementById('joystick');
const joystickStick = document.getElementById('joystickStick');

let joystickActive = false;
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

// --- CAMERA CONTROL (RIGHT SIDE DRAG) ---
const cameraControlZone = document.getElementById('cameraControl');

let cameraDragActive = false;
let lastCameraTouchX = 0;
let lastCameraTouchY = 0;

cameraControlZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    cameraDragActive = true;
    const touch = e.touches[0];
    lastCameraTouchX = touch.clientX;
    lastCameraTouchY = touch.clientY;
}, { passive: false });

cameraControlZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (cameraDragActive) {
        const touch = e.touches[0];
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
    }
}, { passive: false });

cameraControlZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    cameraDragActive = false;
}, { passive: false });

console.log('Camera control initialized');

// --- UPDATE PLAYER ---
function updatePlayer() {
    if (Math.abs(movement.forward) > 0.01 || Math.abs(movement.right) > 0.01) {
        // Calculate movement direction relative to camera's yaw
        const cameraYawAngle = cameraControl.yaw;
        
        const forwardX = Math.sin(cameraYawAngle) * movement.forward;
        const forwardZ = Math.cos(cameraYawAngle) * movement.forward;
        
        const rightX = Math.sin(cameraYawAngle + Math.PI / 2) * movement.right;
        const rightZ = Math.cos(cameraYawAngle + Math.PI / 2) * movement.right;
        
        const moveX = (forwardX + rightX) * movement.speed;
        const moveZ = (forwardZ + rightZ) * movement.speed;
        
        player.position.x += moveX;
        player.position.z += moveZ;
        
        // Rotate player to face movement direction
        const moveAngle = Math.atan2(moveX, moveZ);
        player.rotation.y = moveAngle;
        
        // Simple walk animation (bob head and arms)
        const time = Date.now() * 0.008;
        head.position.y = 2.6 + Math.sin(time) * 0.05;
        leftArm.rotation.x = Math.sin(time) * 0.3;
        rightArm.rotation.x = Math.sin(time + Math.PI) * 0.3;
        leftLeg.rotation.x = Math.sin(time + Math.PI) * 0.4;
        rightLeg.rotation.x = Math.sin(time) * 0.4;
    } else {
        // Reset to idle pose
        head.position.y = 2.6;
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
    }
}

// --- UPDATE CAMERA (THIRD-PERSON FOLLOW) ---
function updateCamera() {
    const offsetX = Math.sin(cameraControl.yaw) * cameraControl.distance * Math.cos(cameraControl.pitch);
    const offsetY = cameraControl.height + Math.sin(cameraControl.pitch) * cameraControl.distance;
    const offsetZ = Math.cos(cameraControl.yaw) * cameraControl.distance * Math.cos(cameraControl.pitch);

    camera.position.x = player.position.x - offsetX;
    camera.position.y = player.position.y + offsetY;
    camera.position.z = player.position.z - offsetZ;

    camera.lookAt(
        player.position.x,
        player.position.y + 1.5,
        player.position.z
    );
}

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    updatePlayer();
    updateCamera();
    
    renderer.render(scene, camera);
}

console.log('Starting render loop...');
animate();
