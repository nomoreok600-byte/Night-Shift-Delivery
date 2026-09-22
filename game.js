// ============================================
// NIGHT SHIFT DELIVERY - CORE ENGINE (STEP 3)
// Canvas setup, game loop, player movement, walls,
// streetlight raycasting/shadows, exposure meter
// ============================================

// --- CANVAS SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generateWalls();
    generateLights();
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

// Returns the 4 corner points of a wall rectangle
function getWallCorners(wall) {
    return [
        { x: wall.x, y: wall.y },
        { x: wall.x + wall.w, y: wall.y },
        { x: wall.x + wall.w, y: wall.y + wall.h },
        { x: wall.x, y: wall.y + wall.h }
    ];
}

// Returns the 4 edges (as {a, b} point pairs) of a wall rectangle
function getWallEdges(wall) {
    const c = getWallCorners(wall);
    return [
        { a: c[0], b: c[1] },
        { a: c[1], b: c[2] },
        { a: c[2], b: c[3] },
        { a: c[3], b: c[0] }
    ];
}

// ============================================
// STREETLIGHT / LIGHTING SYSTEM
// ============================================

let streetlight = {};

// Positions the streetlight proportionally near the second wall
function generateLights() {
    streetlight = {
        x: canvas.width * 0.62,
        y: canvas.height * 0.30,
        radius: Math.max(canvas.width, canvas.height) * 0.30,
        color: 'rgba(255, 230, 120, 0.9)'
    };
}

// Ray-vs-segment intersection.
// Ray: O + t*D (t >= 0), Segment: A -> B (u in [0,1])
// Returns distance t along the ray if intersecting, otherwise null.
function raySegmentIntersect(ox, oy, dx, dy, ax, ay, bx, by) {
    const ex = bx - ax;
    const ey = by - ay;
    const denom = dx * ey - dy * ex;

    if (Math.abs(denom) < 1e-10) return null; // parallel, no intersection

    const t = ((ax - ox) * ey - (ay - oy) * ex) / denom;
    const u = ((ax - ox) * dy - (ay - oy) * dx) / denom;

    if (t >= 0 && u >= 0 && u <= 1) {
        return t;
    }
    return null;
}

// Casts a single ray from the light in direction (dx, dy),
// returns the closest hit point (either a wall or the light's max radius)
function castRayToClosest(light, dx, dy, wallList) {
    let minT = light.radius;

    for (let i = 0; i < wallList.length; i++) {
        const edges = getWallEdges(wallList[i]);
        for (let j = 0; j < edges.length; j++) {
            const e = edges[j];
            const t = raySegmentIntersect(light.x, light.y, dx, dy, e.a.x, e.a.y, e.b.x, e.b.y);
            if (t !== null && t < minT) {
                minT = t;
            }
        }
    }

    return {
        x: light.x + dx * minT,
        y: light.y + dy * minT
    };
}

// Builds a visibility polygon for a light source, accounting for wall occlusion.
// Casts rays toward every wall corner (with tiny angle offsets to catch edges),
// sorts them by angle, then connects the resulting hit points into a polygon.
function computeLightPolygon(light, wallList) {
    const EPS = 0.00005;
    let angles = [];

    for (let i = 0; i < wallList.length; i++) {
        const corners = getWallCorners(wallList[i]);
        for (let j = 0; j < corners.length; j++) {
            const c = corners[j];
            const a = Math.atan2(c.y - light.y, c.x - light.x);
            angles.push(a - EPS, a, a + EPS);
        }
    }

    // Also include a base ring of angles so the light still looks circular
    // when nothing is nearby (smooths out the polygon on open ground).
    const RING_STEPS = 32;
    for (let i = 0; i < RING_STEPS; i++) {
        angles.push((i / RING_STEPS) * Math.PI * 2);
    }

    angles.sort((a, b) => a - b);

    const polygon = [];
    for (let i = 0; i < angles.length; i++) {
        const dx = Math.cos(angles[i]);
        const dy = Math.sin(angles[i]);
        polygon.push(castRayToClosest(light, dx, dy, wallList));
    }

    return polygon;
}

// Determines whether the player currently stands inside the lit area
// (within light radius AND not blocked by a wall).
function isPlayerLit(light, target, wallList) {
    const dx = target.x - light.x;
    const dy = target.y - light.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > light.radius) return false;
    if (dist === 0) return true;

    const ndx = dx / dist;
    const ndy = dy / dist;

    let closestWallT = Infinity;
    for (let i = 0; i < wallList.length; i++) {
        const edges = getWallEdges(wallList[i]);
        for (let j = 0; j < edges.length; j++) {
            const e = edges[j];
            const t = raySegmentIntersect(light.x, light.y, ndx, ndy, e.a.x, e.a.y, e.b.x, e.b.y);
            if (t !== null && t < closestWallT) {
                closestWallT = t;
            }
        }
    }

    // If a wall intersects the ray before reaching the player, they're shadowed
    if (closestWallT < dist - 1) return false;

    return true;
}

// ============================================
// EXPOSURE METER
// ============================================

let exposure = 0; // 0 - 100
const EXPOSURE_FILL_RATE = 0.6;
const EXPOSURE_DRAIN_RATE = 0.4;

function updateExposure() {
    const lit = isPlayerLit(streetlight, player, walls);

    if (lit) {
        exposure += EXPOSURE_FILL_RATE;
    } else {
        exposure -= EXPOSURE_DRAIN_RATE;
    }

    exposure = Math.max(0, Math.min(100, exposure));
}

function drawExposureMeter() {
    const barWidth = canvas.width * 0.6;
    const barHeight = 18;
    const barX = (canvas.width - barWidth) / 2;
    const barY = 24;

    // Background track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Fill color shifts White -> Yellow -> Red as exposure rises
    let fillColor;
    if (exposure < 50) {
        fillColor = '#f5f5f5';
    } else if (exposure < 80) {
        fillColor = '#ffee33';
    } else {
        fillColor = '#ff2b2b';
    }

    const fillWidth = barWidth * (exposure / 100);
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText('EXPOSURE', barX, barY - 6);
}

// --- INITIAL SETUP (after functions are defined) ---
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
generateWalls();
generateLights();

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

function resolveCircleRectCollision(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));

    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared >= circle.radius * circle.radius) {
        return;
    }

    const distance = Math.sqrt(distanceSquared);

    if (distance === 0) {
        circle.y -= circle.radius;
        return;
    }

    const overlap = circle.radius - distance;
    const pushX = (dx / distance) * overlap;
    const pushY = (dy / distance) * overlap;

    circle.x += pushX;
    circle.y += pushY;
}

function handleWallCollisions() {
    for (let i = 0; i < walls.length; i++) {
        resolveCircleRectCollision(player, walls[i]);
    }
}

// ============================================
// UPDATE LOGIC
// ============================================

function update() {
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

    handleWallCollisions();
    updateExposure();
}

// ============================================
// RENDER LOGIC
// ============================================

function drawLight(light, wallList) {
    const polygon = computeLightPolygon(light, wallList);
    if (polygon.length === 0) return;

    ctx.save();

    // Clip drawing to the visibility polygon so light can't bleed past walls
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
        ctx.lineTo(polygon[i].x, polygon[i].y);
    }
    ctx.closePath();
    ctx.clip();

    // Radial gradient glow, bright at the source, fading toward the edge
    const gradient = ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, light.radius
    );
    gradient.addColorStop(0, 'rgba(255, 240, 150, 0.55)');
    gradient.addColorStop(0.6, 'rgba(255, 220, 100, 0.25)');
    gradient.addColorStop(1, 'rgba(255, 200, 80, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(
        light.x - light.radius,
        light.y - light.radius,
        light.radius * 2,
        light.radius * 2
    );

    ctx.restore();

    // Draw the lamp fixture itself as a small glowing dot
    ctx.beginPath();
    ctx.arc(light.x, light.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff6c8';
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawWalls() {
    for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];

        ctx.fillStyle = '#2a0d3d';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

        ctx.strokeStyle = '#ff2fd6';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff2fd6';
        ctx.shadowBlur = 8;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

        ctx.shadowBlur = 0;
    }
}

function render() {
    // Base night-black background (acts as shadow/darkness by default)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Light glow rendered first so walls/player sit visually on top of it
    drawLight(streetlight, walls);

    // Obstacles occlude the light and block player movement
    drawWalls();

    // Player circle - tint slightly if currently exposed for visual feedback
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = isPlayerLit(streetlight, player, walls) ? '#66ccff' : player.color;
    ctx.fill();
    ctx.closePath();

    // HUD drawn last, always on top
    drawExposureMeter();
}

// ============================================
// MAIN GAME LOOP
// ============================================

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
