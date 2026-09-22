// ============================================
// NIGHT SHIFT DELIVERY - FULL CORE ENGINE
// Touch movement, walls, dynamic lighting/shadows,
// drone AI (patrol/suspicious/alert), exposure meter,
// win/loss states, delivery zone
// ============================================

// --- CANVAS SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    generateWalls();
    generateLights();
    generateDrones();
    generateDeliveryZone();
}
window.addEventListener('resize', resizeCanvas);

// --- PLAYER OBJECT ---
const player = {
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
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
        },
        {
            x: canvas.width * 0.65,
            y: canvas.height * 0.75,
            w: canvas.width * 0.20,
            h: canvas.height * 0.12
        }
    ];
}

function getWallCorners(wall) {
    return [
        { x: wall.x, y: wall.y },
        { x: wall.x + wall.w, y: wall.y },
        { x: wall.x + wall.w, y: wall.y + wall.h },
        { x: wall.x, y: wall.y + wall.h }
    ];
}

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
// LIGHTING SYSTEM
// ============================================

let lights = [];

function generateLights() {
    lights = [
        {
            x: canvas.width * 0.62,
            y: canvas.height * 0.30,
            radius: Math.max(canvas.width, canvas.height) * 0.28,
            color: 'rgba(255, 230, 120, 0.9)'
        },
        {
            x: canvas.width * 0.25,
            y: canvas.height * 0.55,
            radius: Math.max(canvas.width, canvas.height) * 0.25,
            color: 'rgba(255, 230, 120, 0.9)'
        },
        {
            x: canvas.width * 0.78,
            y: canvas.height * 0.80,
            radius: Math.max(canvas.width, canvas.height) * 0.22,
            color: 'rgba(255, 230, 120, 0.9)'
        }
    ];
}

function raySegmentIntersect(ox, oy, dx, dy, ax, ay, bx, by) {
    const ex = bx - ax;
    const ey = by - ay;
    const denom = dx * ey - dy * ex;

    if (Math.abs(denom) < 1e-10) return null;

    const t = ((ax - ox) * ey - (ay - oy) * ex) / denom;
    const u = ((ax - ox) * dy - (ay - oy) * dx) / denom;

    if (t >= 0 && u >= 0 && u <= 1) {
        return t;
    }
    return null;
}

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

function isTargetLit(light, target, wallList) {
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

    if (closestWallT < dist - 1) return false;

    return true;
}

function isPlayerInAnyLight() {
    for (let i = 0; i < lights.length; i++) {
        if (isTargetLit(lights[i], player, walls)) {
            return true;
        }
    }
    return false;
}

// ============================================
// EXPOSURE METER
// ============================================

let exposure = 0;
const EXPOSURE_FILL_RATE = 0.5;
const EXPOSURE_DRAIN_RATE = 0.35;
const EXPOSURE_ALERT_THRESHOLD = 75;

function updateExposure() {
    const lit = isPlayerInAnyLight();

    if (lit) {
        exposure += EXPOSURE_FILL_RATE;
    } else {
        exposure -= EXPOSURE_DRAIN_RATE;
    }

    exposure = Math.max(0, Math.min(100, exposure));

    if (exposure >= 100) {
        triggerGameOver();
    }
}

function drawExposureMeter() {
    const barWidth = canvas.width * 0.6;
    const barHeight = 18;
    const barX = (canvas.width - barWidth) / 2;
    const barY = 24;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

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

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText('EXPOSURE', barX, barY - 6);
}

// ============================================
// DELIVERY ZONE (WIN CONDITION)
// ============================================

let deliveryZone = {};

function generateDeliveryZone() {
    deliveryZone = {
        x: canvas.width * 0.75,
        y: canvas.height * 0.10,
        w: canvas.width * 0.18,
        h: canvas.height * 0.12
    };
}

function checkDeliveryZone() {
    const closestX = Math.max(deliveryZone.x, Math.min(player.x, deliveryZone.x + deliveryZone.w));
    const closestY = Math.max(deliveryZone.y, Math.min(player.y, deliveryZone.y + deliveryZone.h));

    const dx = player.x - closestX;
    const dy = player.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < player.radius) {
        triggerDeliverySuccess();
    }
}

function drawDeliveryZone() {
    ctx.fillStyle = 'rgba(50, 255, 120, 0.25)';
    ctx.fillRect(deliveryZone.x, deliveryZone.y, deliveryZone.w, deliveryZone.h);

    ctx.strokeStyle = '#32ff78';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#32ff78';
    ctx.shadowBlur = 12;
    ctx.strokeRect(deliveryZone.x, deliveryZone.y, deliveryZone.w, deliveryZone.h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#32ff78';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DELIVERY', deliveryZone.x + deliveryZone.w / 2, deliveryZone.y + deliveryZone.h / 2 - 4);
    ctx.fillText('ZONE', deliveryZone.x + deliveryZone.w / 2, deliveryZone.y + deliveryZone.h / 2 + 12);
    ctx.textAlign = 'left';
}

// ============================================
// DRONE AI (STATE MACHINE)
// ============================================

let drones = [];

function generateDrones() {
    drones = [
        {
            x: canvas.width * 0.35,
            y: canvas.height * 0.35,
            size: 16,
            speed: 1.5,
            angle: 0,
            visionRange: 180,
            visionAngle: 45,
            state: 'patrol',
            patrolNodes: [
                { x: canvas.width * 0.35, y: canvas.height * 0.35 },
                { x: canvas.width * 0.50, y: canvas.height * 0.28 },
                { x: canvas.width * 0.42, y: canvas.height * 0.45 }
            ],
            currentNode: 0,
            suspicionTimer: 0,
            sweepDirection: 1,
            alertSpeed: 2.8
        },
        {
            x: canvas.width * 0.70,
            y: canvas.height * 0.60,
            size: 16,
            speed: 1.3,
            angle: 180,
            visionRange: 170,
            visionAngle: 45,
            state: 'patrol',
            patrolNodes: [
                { x: canvas.width * 0.70, y: canvas.height * 0.60 },
                { x: canvas.width * 0.50, y: canvas.height * 0.65 },
                { x: canvas.width * 0.75, y: canvas.height * 0.75 }
            ],
            currentNode: 0,
            suspicionTimer: 0,
            sweepDirection: 1,
            alertSpeed: 2.5
        }
    ];
}

function isPlayerInVisionCone(drone) {
    const dx = player.x - drone.x;
    const dy = player.y - drone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > drone.visionRange) return false;

    const angleToPlayer = Math.atan2(dy, dx) * (180 / Math.PI);
    let angleDiff = angleToPlayer - drone.angle;

    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    if (Math.abs(angleDiff) > drone.visionAngle) return false;

    const ndx = dx / dist;
    const ndy = dy / dist;

    let closestWallT = Infinity;
    for (let i = 0; i < walls.length; i++) {
        const edges = getWallEdges(walls[i]);
        for (let j = 0; j < edges.length; j++) {
            const e = edges[j];
            const t = raySegmentIntersect(drone.x, drone.y, ndx, ndy, e.a.x, e.a.y, e.b.x, e.b.y);
            if (t !== null && t < closestWallT) {
                closestWallT = t;
            }
        }
    }

    if (closestWallT < dist - 1) return false;

    return true;
}

function updateDrone(drone) {
    if (exposure >= EXPOSURE_ALERT_THRESHOLD && drone.state !== 'alert') {
        drone.state = 'alert';
    }

    if (isPlayerInVisionCone(drone) && drone.state !== 'alert') {
        drone.state = 'alert';
    }

    if (drone.state === 'patrol') {
        const target = drone.patrolNodes[drone.currentNode];
        const dx = target.x - drone.x;
        const dy = target.y - drone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
            drone.currentNode = (drone.currentNode + 1) % drone.patrolNodes.length;
        } else {
            drone.x += (dx / dist) * drone.speed;
            drone.y += (dy / dist) * drone.speed;
            drone.angle = Math.atan2(dy, dx) * (180 / Math.PI);
        }

    } else if (drone.state === 'suspicious') {
        drone.suspicionTimer++;

        drone.angle += drone.sweepDirection * 2;

        if (drone.suspicionTimer > 90) {
            drone.sweepDirection *= -1;
            drone.suspicionTimer = 0;
        }

        if (isPlayerInVisionCone(drone)) {
            drone.state = 'alert';
        }

        if (Math.random() < 0.01) {
            drone.state = 'patrol';
            drone.suspicionTimer = 0;
        }

    } else if (drone.state === 'alert') {
        const dx = player.x - drone.x;
        const dy = player.y - drone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            drone.x += (dx / dist) * drone.alertSpeed;
            drone.y += (dy / dist) * drone.alertSpeed;
            drone.angle = Math.atan2(dy, dx) * (180 / Math.PI);
        }

        if (dist < player.radius + drone.size) {
            triggerGameOver();
        }
    }
}

function drawDrone(drone) {
    ctx.save();
    ctx.translate(drone.x, drone.y);
    ctx.rotate((drone.angle * Math.PI) / 180);

    const angleRad = (drone.visionAngle * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, drone.visionRange, -angleRad, angleRad);
    ctx.closePath();

    if (drone.state === 'alert') {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.25)';
    } else if (drone.state === 'suspicious') {
        ctx.fillStyle = 'rgba(255, 200, 50, 0.2)';
    } else {
        ctx.fillStyle = 'rgba(255, 230, 80, 0.15)';
    }
    ctx.fill();

    ctx.strokeStyle = drone.state === 'alert' ? '#ff3232' : '#ffe050';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(drone.size, 0);
    ctx.lineTo(-drone.size / 2, -drone.size);
    ctx.lineTo(-drone.size / 2, drone.size);
    ctx.closePath();

    if (drone.state === 'alert') {
        ctx.fillStyle = '#ff3232';
        ctx.shadowColor = '#ff3232';
        ctx.shadowBlur = 15;
    } else if (drone.state === 'suspicious') {
        ctx.fillStyle = '#ffaa33';
    } else {
        ctx.fillStyle = '#dd4444';
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
}

// ============================================
// WIN / LOSS HANDLERS
// ============================================

function triggerDeliverySuccess() {
    alert('Delivery Successful! Payment received.');
    resetLevel();
}

function triggerGameOver() {
    alert('Busted! Game Over.');
    resetLevel();
}

function resetLevel() {
    player.x = player.startX;
    player.y = player.startY;
    player.targetX = player.x;
    player.targetY = player.y;
    exposure = 0;

    for (let i = 0; i < drones.length; i++) {
        drones[i].x = drones[i].patrolNodes[0].x;
        drones[i].y = drones[i].patrolNodes[0].y;
        drones[i].currentNode = 0;
        drones[i].state = 'patrol';
        drones[i].suspicionTimer = 0;
        drones[i].angle = 0;
    }
}

// --- INITIAL SETUP ---
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
generateWalls();
generateLights();
generateDrones();
generateDeliveryZone();

player.startX = canvas.width * 0.15;
player.startY = canvas.height * 0.10;
player.x = player.startX;
player.y = player.startY;
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
    checkDeliveryZone();

    for (let i = 0; i < drones.length; i++) {
        updateDrone(drones[i]);
    }
}

// ============================================
// RENDER LOGIC
// ============================================

function drawLight(light, wallList) {
    const polygon = computeLightPolygon(light, wallList);
    if (polygon.length === 0) return;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
        ctx.lineTo(polygon[i].x, polygon[i].y);
    }
    ctx.closePath();
    ctx.clip();

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
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < lights.length; i++) {
        drawLight(lights[i], walls);
    }

    drawDeliveryZone();
    drawWalls();

    for (let i = 0; i < drones.length; i++) {
        drawDrone(drones[i]);
    }

    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = isPlayerInAnyLight() ? '#66ccff' : player.color;
    ctx.fill();
    ctx.closePath();

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
