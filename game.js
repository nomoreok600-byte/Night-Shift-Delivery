// ============================================
// NIGHT SHIFT DELIVERY - CORE ENGINE (STEP 2)
// Canvas setup, game loop, player movement, wall collision
// ============================================

// --- CANVAS SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resize canvas to fill the screen (handles mobile viewport + orientation changes)
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generateWalls(); // Re-position walls proportionally on resize/rotation
}
window.addEventListener('resize', resizeCanvas);

// --- PLAYER OBJECT ---
const player = {
    x: 0,
    y: 0,
    radius: 20,
    speed: 4,
    color: '#3399ff',
    targetX: 0,
    targetY: 0,
    isTouching: false
};

// ============================================
// WALLS / OBSTACLES
// ============================================

let walls = [];

// Generates walls proportionally based on current canvas size
// so obstacles stay reasonably placed across different screen sizes.
function generateWalls() {
    walls = [
        {
            x: canvas.width * 0.15,
            y: canvas.height * 0.20,
            w: canvas.width * 0.25,
            h: canvas.height * 0.08
        },
        {
            x: canvas.width * 0.55,
            y: canvas.height * 0.45,
            w: canvas.width * 0.30,
            h: canvas.height * 0.10
        },
        {
            x: canvas.width * 0.10,
            y: canvas.height * 0.65,
            w: canvas.width * 0.20,
            h: canvas.height * 0.20
        }
    ];
}

// Initial setup
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
generateWalls();

// Start player in the center of the screen
player.x = canvas.width / 2;
player.y = canvas.height / 2;
player.targetX = player.x;
player.targetY = player.y;

// ============================================
// TOUCH INPUT HANDLING
// ============================================

function getTouchPos(touch) {
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
}, { passive: false });

// ============================================
// COLLISION DETECTION (Circle vs AABB)
// ============================================

// Resolves collision between a circle (player) and a rectangle (wall).
// If overlapping, pushes the circle out along the shortest axis so it
// cannot pass through the wall.
function resolveCircleRectCollision(circle, rect) {
    // Find the closest point on the rectangle to the circle's center
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));

    // Vector from closest point to circle center
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distanceSquared = dx * dx + dy * dy;

    // No collision if distance is greater than radius
    if (distanceSquared >= circle.radius * circle.radius) {
        return;
    }

    const distance = Math.sqrt(distanceSquared);

    if (distance === 0) {
        // Circle center is exactly on the rectangle edge/corner (rare edge case).
        // Push out upward by default to avoid division by zero.
        circle.y -= circle.radius;
        return;
    }

    // Calculate overlap amount and push the circle out along the normal vector
    const overlap = circle.radius - distance;
    const pushX = (dx / distance) * overlap;
    const pushY = (dy / distance) * overlap;

    circle.x += pushX;
    circle.y += pushY;
}

// Runs collision checks against every wall in the level
function handleWallCollisions() {
    for (let i = 0; i < walls.length; i++) {
        resolveCircleRectCollision(player, walls[i]);
    }
}

// ============================================
// UPDATE LOGIC
// ============================================

function update() {
    // Move player smoothly toward target position (finger location)
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > player.speed) {
        const moveX = (dx / distance) * player.speed;
        const moveY = (dy / distance) * player.speed;
        player.x += moveX;
        player.y += moveY;
    } else {
        player.x = player.targetX;
        player.y = player.targetY;
    }

    // After moving, check and resolve any wall collisions
    handleWallCollisions();
}

// ============================================
// RENDER LOGIC
// ============================================

function drawWalls() {
    for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];

        // Fill: dark purple body
        ctx.fillStyle = '#2a0d3d';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

        // Border: neon magenta/cyan glow effect
        ctx.strokeStyle = '#ff2fd6';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff2fd6';
        ctx.shadowBlur = 8;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

        // Reset shadow so it doesn't bleed into other draw calls
        ctx.shadowBlur = 0;
    }
}

function render() {
    // Clear screen with black background (night setting)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw obstacles first (so player renders on top)
    drawWalls();

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
