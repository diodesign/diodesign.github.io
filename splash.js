const canvas = document.getElementById('splash-canvas');
const ctx = canvas.getContext('2d');
let width, height;
let startTime = 0;
let lastUpdate = 0;
let lowCellTime = 0;
let nextSprinkleDelay = 0;
let isMouseDown = false;
let rafId = null;        // requestAnimationFrame handle
let didStep = false;     // true when the CA advanced a generation this frame
let needsRedraw = false; // true after resize() clears the canvas

// Configuration constants
const GRID_COLS = 320;
const GRID_ROWS = 82;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;
const TICK_RATE = 1000 / 60; // ms between CA steps
const START_DELAY = 2000; // milliseconds delay for initial logo
const SPRINKLE_DELAY = 2000; // time under threshold before we add more
const SPRINKLE_DELAY_JITTER = 1000; // random offset for sprinkle delay
const MIN_POPULATION_RATIO = 0.03; // ensure minimum population
const LOW_CELL_THRESHOLD = Math.floor(TOTAL_CELLS * MIN_POPULATION_RATIO);
const CRITICAL_POPULATION_THRESHOLD = Math.floor(LOW_CELL_THRESHOLD / 3);
const FADE_RATE = 0.04; // Visual decay speed for dead cells
const STALE_TIMEOUT = SPRINKLE_DELAY / 2; // ms before a static cell is cleared

// State buffers
let grid = new Uint8Array(TOTAL_CELLS);
let nextGrid = new Uint8Array(TOTAL_CELLS);
let colorGrid = new Float32Array(TOTAL_CELLS); // 0.0 to 1.0 color strength
let lastUpdateGrid = new Float64Array(TOTAL_CELLS); // Timestamp of last state change

const colors = {
    background: '#1a0a2e',
    yellow: { h: 51, s: 100, l: 50 } // Gold base
};

const MESSAGE = [
    "  DIODESIGN LAB   ",
    "  ONLINE SYSTEMS  ",
    "    v1.2 READY   "
];

// Neighbor index caches for performance optimization
const n8Offsets = new Int32Array(TOTAL_CELLS * 8);
const n4Offsets = new Int32Array(TOTAL_CELLS * 4);

function precalculateNeighbors() {
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            const idx = y * GRID_COLS + x;

            // 8 Neighbors (Moore)
            let n8Count = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = (x + dx + GRID_COLS) % GRID_COLS;
                    const ny = (y + dy + GRID_ROWS) % GRID_ROWS;
                    n8Offsets[idx * 8 + n8Count++] = ny * GRID_COLS + nx;
                }
            }

            // 4 Neighbors (Von Neumann)
            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (let i = 0; i < 4; i++) {
                const nx = (x + dirs[i][0] + GRID_COLS) % GRID_COLS;
                const ny = (y + dirs[i][1] + GRID_ROWS) % GRID_ROWS;
                n4Offsets[idx * 4 + i] = ny * GRID_COLS + nx;
            }
        }
    }
}

function init() {
    precalculateNeighbors();
    resize();
    resetGrid();
    startTime = performance.now();
    lastUpdate = startTime;
    // Paint the initial dot-matrix message immediately, before START_DELAY.
    // The animation loop skips draw() unless didStep is true, so without this
    // the canvas would stay blank until the first CA tick.
    draw();
}

function resize() {
    const newWidth = canvas.parentElement.clientWidth;
    const newHeight = canvas.parentElement.clientHeight;

    // Avoid crashing if the canvas is hidden or collapsed (e.g. during search results)
    if (!newWidth || !newHeight || newWidth <= 0 || newHeight <= 0) {
        return;
    }

    width = canvas.width = newWidth;
    height = canvas.height = newHeight;

    // Reallocate the pixel buffer to match the new canvas dimensions.
    imageData = ctx.createImageData(width, height);
    pixels = imageData.data;
    // Setting canvas.width clears the canvas contents — flag a redraw so
    // the dot-matrix message (or current CA frame) is restored immediately.
    needsRedraw = true;
}

function drawMessage(lines) {
    const charW = 5;
    const charH = 7;
    const spacingX = 1;
    const spacingY = 2;
    const scale = 2;

    const totalWidth = lines[0].length * (charW + spacingX) * scale;
    const totalHeight = lines.length * (charH + spacingY) * scale;

    const startX = Math.floor((GRID_COLS - totalWidth) / 2);
    const startY = Math.floor((GRID_ROWS - totalHeight) / 2);

    lines.forEach((line, rowIdx) => {
        for (let i = 0; i < line.length; i++) {
            const char = line[i].toUpperCase();
            const bitmap = FONT[char] || FONT[' '];

            const charOffsetX = startX + i * (charW + spacingX) * scale;
            const charOffsetY = startY + rowIdx * (charH + spacingY) * scale;

            for (let y = 0; y < charH; y++) {
                const row = bitmap[y];
                for (let x = 0; x < charW; x++) {
                    if ((row >> (4 - x)) & 1) {
                        for (let dy = 0; dy < scale; dy++) {
                            for (let dx = 0; dx < scale; dx++) {
                                const gx = (charOffsetX + x * scale + dx + GRID_COLS) % GRID_COLS;
                                const gy = (charOffsetY + y * scale + dy + GRID_ROWS) % GRID_ROWS;
                                const idx = gy * GRID_COLS + gx;
                                grid[idx] = 1;
                                colorGrid[idx] = 0.6;
                                lastUpdateGrid[idx] = performance.now();
                            }
                        }
                    }
                }
            }
        }
    });
}

function resetGrid() {
    grid.fill(0);
    colorGrid.fill(0);
    lastUpdateGrid.fill(performance.now());
    drawMessage(MESSAGE);
}

function fillCluster(gx, gy, size = 4) {
    const startX = Math.floor(gx - size / 2);
    const startY = Math.floor(gy - size / 2);

    for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
            const tx = (startX + dx + GRID_COLS) % GRID_COLS;
            const ty = (startY + dy + GRID_ROWS) % GRID_ROWS;
            const idx = ty * GRID_COLS + tx;
            if (Math.random() > 0.5) {
                grid[idx] = 1;
                colorGrid[idx] = 1.0; // User/sprinkle interaction starts at full strength
                lastUpdateGrid[idx] = performance.now();
            }
        }
    }
}

function sprinkle(isCritical = false) {
    const amount = (6 + Math.floor(Math.random() * 6)) * (isCritical ? 3 : 1);
    for (let i = 0; i < amount; i++) {
        const gx = Math.floor(Math.random() * GRID_COLS);
        const gy = Math.floor(Math.random() * GRID_ROWS);
        fillCluster(gx, gy, 4);
    }
}

function fillAtMouse(e) {
    if (!width || !height || performance.now() - startTime < START_DELAY) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / width * GRID_COLS;
    const my = (e.clientY - rect.top) / height * GRID_ROWS;
    fillCluster(mx, my, 4);
}

function update(time) {
    didStep = false;
    if (time - startTime < START_DELAY) return;

    // Transition cursor after delay
    if (!canvas.classList.contains('active-animation')) {
        canvas.classList.add('active-animation');
    }

    if (time - lastUpdate < TICK_RATE) return;
    lastUpdate = time;
    didStep = true;

    let activeCells = 0;

    // Calculate next generation (HighLife B36/S23)
    // Optimized with pre-calculated neighbor indices
    for (let i = 0; i < TOTAL_CELLS; i++) {
        let n8 = 0;
        const base = i * 8;
        n8 += grid[n8Offsets[base]];
        n8 += grid[n8Offsets[base + 1]];
        n8 += grid[n8Offsets[base + 2]];
        n8 += grid[n8Offsets[base + 3]];
        n8 += grid[n8Offsets[base + 4]];
        n8 += grid[n8Offsets[base + 5]];
        n8 += grid[n8Offsets[base + 6]];
        n8 += grid[n8Offsets[base + 7]];

        let newState;
        if (grid[i] === 1) {
            newState = (n8 === 2 || n8 === 3) ? 1 : 0;
        } else {
            newState = (n8 === 3 || n8 === 6) ? 1 : 0;
        }

        // Kill cells that haven't changed in a while (static cells)
        if (newState !== grid[i]) {
            lastUpdateGrid[i] = time;
        } else if (newState === 1 && (time - lastUpdateGrid[i] > STALE_TIMEOUT)) {
            newState = 0;
            lastUpdateGrid[i] = time;
        }

        nextGrid[i] = newState;
    }

    // Apply next generation and update visual intensity in one pass
    grid.set(nextGrid);

    for (let i = 0; i < TOTAL_CELLS; i++) {
        if (grid[i] === 1) {
            activeCells++;
            // Calculate 4-neighbor intensity
            const base = i * 4;
            let n4 = 0;
            n4 += grid[n4Offsets[base]];
            n4 += grid[n4Offsets[base + 1]];
            n4 += grid[n4Offsets[base + 2]];
            n4 += grid[n4Offsets[base + 3]];

            colorGrid[i] = 0.4 + (n4 * 0.15);
        } else if (colorGrid[i] > 0) {
            colorGrid[i] = Math.max(0, colorGrid[i] - FADE_RATE);
        }
    }

    // Population management
    if (activeCells < LOW_CELL_THRESHOLD) {
        if (lowCellTime === 0) {
            lowCellTime = time;
            nextSprinkleDelay = SPRINKLE_DELAY + ((Math.random() * 2 - 1) * SPRINKLE_DELAY_JITTER);
        } else if (time - lowCellTime > nextSprinkleDelay) {
            sprinkle(activeCells < CRITICAL_POPULATION_THRESHOLD);
            lowCellTime = 0;
        }
    } else {
        lowCellTime = 0;
    }
}

// Pre-allocated pixel buffer — reused every frame to avoid GC pressure.
// Recreated in resize() when canvas dimensions change.
let imageData = null;
let pixels = null; // Uint8ClampedArray view into imageData.data

// Parse background hex colour once into RGB components.
const _bg = colors.background.slice(1);
const BG_R = parseInt(_bg.slice(0, 2), 16);
const BG_G = parseInt(_bg.slice(2, 4), 16);
const BG_B = parseInt(_bg.slice(4, 6), 16);

/**
 * Converts HSL to RGB. All inputs/outputs in [0..1] range.
 * Avoids the browser style pipeline (no fillStyle string construction).
 */
function hslToRgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h * 12) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function draw() {
    if (!imageData) return;

    const cellW = width / GRID_COLS;
    const cellH = height / GRID_ROWS;
    const H = colors.yellow.h / 360; // normalised hue

    // Fill entire buffer with background colour.
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = BG_R;
        pixels[i + 1] = BG_G;
        pixels[i + 2] = BG_B;
        pixels[i + 3] = 255;
    }

    // Paint active/fading cells directly into the pixel buffer.
    for (let cy = 0; cy < GRID_ROWS; cy++) {
        const yOffset = cy * GRID_COLS;
        const py0 = Math.round(cy * cellH);
        const py1 = Math.round((cy + 1) * cellH);

        for (let cx = 0; cx < GRID_COLS; cx++) {
            const intensity = colorGrid[yOffset + cx];
            if (intensity <= 0.01) continue;

            const px0 = Math.round(cx * cellW);
            const px1 = Math.round((cx + 1) * cellW);

            // 1. Draw large black drop shadow to give the cluster overall depth
            if (intensity > 0.1) {
                const sOffset = 4;
                const spy0 = py0 + 1;
                const spy1 = Math.min(py1 + sOffset, height);
                const spx0 = px0 + 1;
                const spx1 = Math.min(px1 + sOffset, width);
                for (let py = spy0; py < spy1; py++) {
                    const rowBase = py * width * 4;
                    for (let px = spx0; px < spx1; px++) {
                        const i = rowBase + px * 4;
                        pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0;
                    }
                }
            }

            // 2. Draw beveled 3D cell (Gem/Tile effect)
            const L = (50 + intensity * 35) / 100;
            const S = (100 - intensity * 20) / 100;
            const [r, g, b] = hslToRgb(H, S, L); // Base face color
            const [lr, lg, lb] = hslToRgb(H, S, Math.min(1, L + 0.15)); // Top-left highlight
            const [dr, dg, db] = hslToRgb(H, S, Math.max(0, L - 0.2));  // Bottom-right shadow

            for (let py = py0; py < py1; py++) {
                const rowBase = py * width * 4;
                for (let px = px0; px < px1; px++) {
                    const i = rowBase + px * 4;
                    if (py === py0 || px === px0) {
                        // Top/Left highlight
                        pixels[i] = lr; pixels[i + 1] = lg; pixels[i + 2] = lb;
                    } else if (py === py1 - 1 || px === px1 - 1) {
                        // Bottom/Right internal shadow
                        pixels[i] = dr; pixels[i + 1] = dg; pixels[i + 2] = db;
                    } else {
                        // Main cell face
                        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b;
                    }
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

let isVisible = true;
let isTabActive = true;

const observer = new IntersectionObserver((entries) => {
    isVisible = entries[0].isIntersecting;
}, { threshold: 0.1 });
observer.observe(canvas);

document.addEventListener('visibilitychange', () => {
    isTabActive = document.visibilityState === 'visible';
});

function animate(time) {
    if (isVisible && isTabActive) {
        update(time);
        // Repaint when the CA stepped OR when a resize just cleared the canvas.
        if (didStep || needsRedraw) {
            draw();
            needsRedraw = false;
        }
    }
    rafId = requestAnimationFrame(animate);
}

// Debounced resize — avoids hammering the canvas on every pixel of a window drag.
let _resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(resize, 100);
});

// ---- Mouse interaction ----
canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    fillAtMouse(e);
});

window.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown) fillAtMouse(e);
});

// ---- Touch interaction ----
function fillAtTouch(e) {
    if (!width || !height || performance.now() - startTime < START_DELAY) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (const touch of e.changedTouches) {
        const gx = (touch.clientX - rect.left) / width * GRID_COLS;
        const gy = (touch.clientY - rect.top) / height * GRID_ROWS;
        fillCluster(gx, gy, 4);
    }
}

canvas.addEventListener('touchstart', fillAtTouch, { passive: false });
canvas.addEventListener('touchmove', fillAtTouch, { passive: false });

// ---- Pause loop when canvas is collapsed after a search ----
const splashWrapper = document.getElementById('splash-canvas-wrapper');
if (splashWrapper) {
    const collapseObserver = new MutationObserver(() => {
        if (splashWrapper.classList.contains('collapsed')) {
            cancelAnimationFrame(rafId);
            rafId = null;
        } else if (!rafId) {
            rafId = requestAnimationFrame(animate);
        }
    });
    collapseObserver.observe(splashWrapper, { attributes: true, attributeFilter: ['class'] });
}

init();
rafId = requestAnimationFrame(animate);
