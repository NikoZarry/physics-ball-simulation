"use strict";

// Construct canvas and canvas properties
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Resizes the canvas to the viewport (excludes scrollbars)
function resize() {
    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;
}

window.addEventListener("resize", resize);
resize();

// conditions
let isDragging = false;
let dragEnabled = true;
let dragOffsetx = 0;
let dragOffsety = 0;
let massMode = "density";   // "constant" or "density"
let freezeReadout = false;

// Constants
const g = 1200;                 // pixels per second squared
const e = 0.8;                  // restitution: 1 = perfectly bouncy, 0 = dead stop
const stopVy = 25;              // px/s, kills tiny jitter bounces
const pointerSamples = [];      // array of {x, y, t}
const SAMPLE_WINDOW = 0.10;     // seconds, use last 100 ms of motion
const MAX_SAMPLES = 20;         // cap so it never grows

const r0 = 30;                  // reference radius
const R_MIN = 10;
const R_MAX = 120;
const R_STEP = 5;

const dragK = 0.0018;           // force scale (tune)
const m0 = 1.0;                 // mass when r = r0 (in "constant" mode too)
const mu = 0.10;                // mu friction constant
// Global States
let vx_display = 0;
let vy_display = 0;
let E_display = 0;
let K_display = 0;
let U_display = 0;
let p_display = 0;

// Function that clamps a value into a range
function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}

// Func that returns pointer position in canvas coordinates
function getPointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

// Creates the ball and its properties
const ball = {
    r: 30,
    m: m0,                      // will be updated by updateBallMass
    x: canvas.width / 2,
    y: canvas.height - 30,      // start near bottom, but not inside floor
    vx: 0,
    vy: 0
};

// Updates the ball's mass
function updateBallMass() {
    if (massMode === "constant") {
        ball.m = m0;
    } else {
        // m = m0 * (r/r0)^3 (constant density scaling)
        ball.m = m0 * (ball.r / r0) ** 3;
    }
};
updateBallMass();

function setBallRadius(newR) {
    ball.r = clamp(newR, R_MIN, R_MAX);

    // After changing radius, keep ball inside the canvas
    ball.x = clamp(ball.x, ball.r, canvas.width - ball.r);
    ball.y = clamp(ball.y, ball.r, canvas.height - ball.r);

    updateBallMass();
};

// Pointer down
canvas.addEventListener("pointerdown", function(event) {
    const p = getPointerPos(event);

    const dx = p.x - ball.x;
    const dy = p.y - ball.y;

    if (dx * dx + dy * dy <= ball.r * ball.r) {
        isDragging = true;
        dragOffsetx = dx;
        dragOffsety = dy;

        // Stop physics while user takes control
        ball.vx = 0;
        ball.vy = 0;

        // Start sample history fresh
        pointerSamples.length = 0;
        const t = performance.now() / 1000;
        pointerSamples.push({ x: p.x, y: p.y, t });

        canvas.setPointerCapture(event.pointerId);
    }
});

// Pointer move
canvas.addEventListener("pointermove", function(event) {
    if (!isDragging) return;

    const p = getPointerPos(event);

    ball.x = p.x - dragOffsetx;
    ball.y = p.y - dragOffsety;

    const t = performance.now() / 1000;
    pointerSamples.push({ x: p.x, y: p.y, t });

    if (pointerSamples.length > MAX_SAMPLES) {
        pointerSamples.shift();
    }

    const cutoff = t - SAMPLE_WINDOW;
    while (pointerSamples.length > 2 && pointerSamples[0].t < cutoff) {
        pointerSamples.shift();
    }
});

// Pointer up 
canvas.addEventListener("pointerup", function(event) {
    if (!isDragging) return;
    isDragging = false;

    canvas.releasePointerCapture(event.pointerId);

    if (pointerSamples.length >= 2) {
        const a = pointerSamples[0];
        const b = pointerSamples[pointerSamples.length - 1];

        const dt = b.t - a.t;
        if (dt > 1e-5) {
            const vx = (b.x - a.x) / dt;
            const vy = (b.y - a.y) / dt;

            ball.vx = vx;
            ball.vy = vy;
        }
    }

    pointerSamples.length = 0;
});

canvas.addEventListener("pointerleave", function() {
    isDragging = false;
    pointerSamples.length = 0;
});

// Buttons
const btnSmaller = document.getElementById("btnSmaller");
const btnBigger = document.getElementById("btnBigger");
const btnResetSize = document.getElementById("btnResetSize");
const btnToggleDrag = document.getElementById("btnToggleDrag");

btnBigger.addEventListener("click", () => setBallRadius(ball.r + R_STEP));
btnSmaller.addEventListener("click", () => setBallRadius(ball.r - R_STEP));
btnResetSize.addEventListener("click", () => setBallRadius(r0));

function updateDragButton() {
    btnToggleDrag.textContent = dragEnabled ? "Drag: ON" : "Drag: OFF";
    btnToggleDrag.classList.toggle("drag-on", dragEnabled);
    btnToggleDrag.classList.toggle("drag-off", !dragEnabled);
}
updateDragButton();

btnToggleDrag.addEventListener("click", () => {
    dragEnabled = !dragEnabled;
    updateDragButton();
});

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    const key = e.key.toLowerCase();

    if (key === "d") {
        dragEnabled = !dragEnabled;
        updateDragButton();
    } else if (key === "r") {
        btnResetSize.click();
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        btnBigger.click();
    } else if (e.key === "ArrowDown") {
        e.preventDefault();
        btnSmaller.click();
}});

// Fixed timestep settings
const FIXED_DT = 1 / 120;
let accumulator = 0;
let last = performance.now();

// Physics step
function step(dt) {
    if (isDragging) return;

    // Gravity
    ball.vy += g * dt;

    // Quadratic drag (force-based)
    if (dragEnabled) {
        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed > 1e-6) {
            const areaScale = (ball.r / r0) ** 2;
            const k = dragK * areaScale;

            const Fx = -k * ball.vx * speed;
            const Fy = -k * ball.vy * speed;

            ball.vx += (Fx / ball.m) * dt;
            ball.vy += (Fy / ball.m) * dt;
        }
    }

    // Integrate position
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    const leftX = ball.r;
    const rightX = canvas.width - ball.r;
    const topY = ball.r;
    const floorY = canvas.height - ball.r;

    // Floor
    if (ball.y > floorY) {
        ball.y = floorY;

        if (ball.vy > 0) {
            ball.vy = -ball.vy * e;
            if (Math.abs(ball.vy) < stopVy) ball.vy = 0;
        }

        // Floor friction acts on horizontal speed on contact
        ball.vx *= (1 - mu);
        if (Math.abs(ball.vx) < 5) ball.vx = 0;     // Makes sure the ball doesn't slide forever
    }

    // Ceiling
    if (ball.y < topY) {
        ball.y = topY;
        
        if (ball.vy < 0) ball.vy = -ball.vy * e;
    }

    // Walls
    if (ball.x <= leftX) {
        ball.x = leftX;
        if (ball.vx < 0) ball.vx = -ball.vx * e;
    } else if (ball.x >= rightX) {
        ball.x = rightX;
        if (ball.vx > 0) ball.vx = -ball.vx * e;
    }

    const SLEEP_V = 0.05;
    if (Math.abs(ball.vx) < SLEEP_V) ball.vx = 0;
    if (Math.abs(ball.vy) < SLEEP_V) ball.vy = 0;   
}

// Diagnostics: momentum and energy
function computeDiagnostics() {
    const v2 = ball.vx * ball.vx + ball.vy * ball.vy;   // v^2

    const K = 0.5 * ball.m * v2;            // Kinetic Energy

    const floorY = canvas.height - ball.r;  
    const h = floorY - ball.y;              // height above floor in pixels
    const U = ball.m * g * h;               // Potential Energy

    const E = K + U;                        // Total Energy, E=K+U

    const px = ball.m * ball.vx;            // x-momentum
    const py = ball.m * ball.vy;            // y-momentum
    const p = Math.hypot(px, py);           // mag momentum

    return { K, U, E, px, py, p };
}
    
function toSI(x, digits=2) {
    if (x === 0) return "0";
    if (Math.abs(x) < 1e-6) return "0";  // display deadband
    const prefixes = {
        "-12": "p",
        "-9": "n",
        "-6": "µ",
        "-3": "m",
        "0": "",
        "3": "k",
        "6": "M",
        "9": "G",
        "12": "T"
       };

       const sign = Math.sign(x);
       x = Math.abs(x);

       const exponent = Math.floor(Math.log10(x) / 3) * 3;
       const scaled = x / 10 ** exponent;

       const prefix = prefixes[exponent] ?? `e${exponent}`;

       return `${(sign * scaled).toFixed(digits)} ${prefix}`;
}

// Draw
function draw(frameDt) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    const d = computeDiagnostics();

    const alpha = 0.1; 

    // Smoothing out values so they're more readable
    vx_display += alpha * (ball.vx - vx_display)
    vy_display += alpha * (ball.vy - vy_display)
    E_display += alpha * (d.E - E_display);
    K_display += alpha * (d.K - K_display);
    U_display += alpha * (d.U - U_display);
    p_display += alpha * (d.p - p_display);

    ctx.fillStyle = "lime";
    ctx.font = "16px monospace";
    ctx.fillText(
        `dt(ms): ${(frameDt * 1000).toFixed(1)} drag:${dragEnabled} m:${ball.m.toFixed(2)} r:${ball.r} ` +
        `vx:${toSI(vx_display)} vy:${toSI(vy_display)} ` +
        `E:${toSI(E_display)} K:${toSI(K_display)} U:${toSI(U_display)} |p|:${toSI(p_display)}`,
        12,
        24
    );
}

// Main loop
function animate(now) {    
    let frameDt = (now - last) / 1000;
    last = now;

    if (frameDt > 0.1) frameDt = 0.1;

    if (canvas.width <= 0 || canvas.height <= 0) {
        requestAnimationFrame(animate);
        return;
    }

    accumulator += frameDt;

    while (accumulator >= FIXED_DT) {
        step(FIXED_DT);
        accumulator -= FIXED_DT;
    }

    draw(frameDt);
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
