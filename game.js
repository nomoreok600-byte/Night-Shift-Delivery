<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Open World 3D - Mobile</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
    }

    html, body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
        touch-action: none;
    }

    canvas {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    #joystick {
        position: fixed;
        bottom: 80px;
        left: 80px;
        width: 150px;
        height: 150px;
        background: rgba(255, 255, 255, 0.1);
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        z-index: 100;
        touch-action: none;
    }

    #joystickStick {
        position: absolute;
        width: 60px;
        height: 60px;
        background: rgba(100, 150, 255, 0.7);
        border: 3px solid rgba(150, 200, 255, 0.9);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }

    #cameraControl {
        position: fixed;
        top: 0;
        right: 0;
        width: 50%;
        height: 100%;
        z-index: 50;
        touch-action: none;
    }

    /* Action Buttons Container */
    #actionButtons {
        position: fixed;
        bottom: 60px;
        right: 60px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-gap: 15px;
        z-index: 100;
    }

    .actionButton {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        border: 3px solid rgba(255, 255, 255, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, system-ui, sans-serif;
        font-size: 12px;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        touch-action: none;
        transition: all 0.1s ease;
    }

    .actionButton:active,
    .actionButton.active {
        background: rgba(100, 150, 255, 0.5);
        border-color: rgba(150, 200, 255, 0.8);
        transform: scale(0.95);
    }

    #btnRun {
        background: rgba(100, 255, 150, 0.15);
        border-color: rgba(100, 255, 150, 0.4);
    }

    #btnRun:active,
    #btnRun.active {
        background: rgba(100, 255, 150, 0.5);
        border-color: rgba(150, 255, 200, 0.8);
    }

    #btnJump {
        background: rgba(255, 200, 100, 0.15);
        border-color: rgba(255, 200, 100, 0.4);
    }

    #btnJump:active {
        background: rgba(255, 200, 100, 0.5);
        border-color: rgba(255, 220, 150, 0.8);
    }

    #btnFire {
        background: rgba(255, 100, 100, 0.15);
        border-color: rgba(255, 100, 100, 0.4);
    }

    #btnFire:active {
        background: rgba(255, 100, 100, 0.5);
        border-color: rgba(255, 150, 150, 0.8);
    }

    #btnReload {
        background: rgba(200, 150, 255, 0.15);
        border-color: rgba(200, 150, 255, 0.4);
    }

    #btnReload:active {
        background: rgba(200, 150, 255, 0.5);
        border-color: rgba(220, 180, 255, 0.8);
    }
</style>
</head>
<body>

    <!-- Movement Joystick (Left Side) -->
    <div id="joystick">
        <div id="joystickStick"></div>
    </div>

    <!-- Camera Control Zone (Right Side) -->
    <div id="cameraControl"></div>

    <!-- Action Buttons (Bottom Right) -->
    <div id="actionButtons">
        <div class="actionButton" id="btnRun">RUN</div>
        <div class="actionButton" id="btnJump">JUMP</div>
        <div class="actionButton" id="btnFire">FIRE</div>
        <div class="actionButton" id="btnReload">RELOAD</div>
    </div>

    <!-- Three.js via CDN -->
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
    
    <script src="game.js"></script>
</body>
</html>
