// ============================================
// NIGHT SHIFT DELIVERY - CORE ENGINE (STEP 1)
// Canvas setup, game loop, player movement via touch
// ============================================

// --- CANVAS SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resize canvas to fill the screen (handles mobile viewport + orientation changes)
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- PLAYER OBJECT ---
const player = {
    x: 0,          // set below once we know canvas size
    y: 0,
    radius: 20,
    speed: 4,       // max movement speed per frame
    color: '#3399ff',
    targetX: 0,     // where the player is trying to move to (finger position)
    targetY: 0,
    isTouching: false
};

// Start player in the center of the screen
player.x = canvas.width / 2;
player.y = canvas.height / 2;
player.targetX = player.x;
player.targetY = player.y;

// ============================================
// TOUCH INPUT HANDLING
// Drag/swipe finger anywhere on screen to move player toward it
// ============================================

function getTouchPos(touch) {
    // touch.clientX/Y already relative to viewport, canvas is full screen so no offset needed
    return {
        x: touch.clientX,
        y: touch.clientY
    };
}

canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getTouchPos(touch);
    player.targetX = pos.x;
    player.targetY = pos.y;
    player.isTouching = true;
}, { passive: false });

canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getTouchPos(touch);
    player.targetX = pos.x;
    player.targetY = pos.y;
}, { passive: false });

canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    player.isTouching = false;
    // Player keeps moving toward last known target until it arrives,
    // then naturally stops (see update() logic below).
}, { passive: false });

// ============================================
// UPDATE LOGIC
// ============================================

function update() {
    // Move player smoothly toward target position (finger location)
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > player.speed) {
        // Normalize direction vector and move at fixed speed
        const moveX = (dx / distance) * player.speed;
        const moveY = (dy / distance) * player.speed;
        player.x += moveX;
        player.y += moveY;
    } else {
        // Snap to target if within one step (prevents jittering)
        player.x = player.targetX;
        player.y = player.targetY;
    }
}

// ============================================
// RENDER LOGIC
// ============================================

function render() {
    // Clear screen with black background (night setting)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw player as blue circle placeholder
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();
}

// ============================================
// MAIN GAME LOOP
// ============================================

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Start the loop
requestAnimationFrame(gameLoop);
