const canvas = document.getElementById('splash-canvas');
const ctx = canvas.getContext('2d');
let width, height;
let startTime = 0;
let lastUpdate = 0;
let lowCellTime = 0;
let isMouseDown = false;

// Configuration constants
const GRID_COLS = 320;
const GRID_ROWS = 160;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;
const TICK_RATE = 1000 / 60; // ms between CA steps
const START_DELAY = 2000; // 2 seconds static logo
const SPRINKLE_DELAY = 2000; // time under threshold before we add more
const MIN_POPULATION_RATIO = 0.1; // ensure minimum population
const LOW_CELL_THRESHOLD = Math.floor(TOTAL_CELLS * MIN_POPULATION_RATIO);
const FADE_RATE = 0.04; // Visual decay speed for dead cells

// State buffers
let grid = new Uint8Array(TOTAL_CELLS);
let nextGrid = new Uint8Array(TOTAL_CELLS);
let colorGrid = new Float32Array(TOTAL_CELLS); // 0.0 to 1.0 color strength

const colors = {
    background: '#1a0a2e',
    yellow: { h: 51, s: 100, l: 50 } // Gold base
};

const ASCII_LOGO = [
    " #####  #  ####  #####  ######  ####  #  ####  #    # ",
    " #    # # #    # #    # #      #      # #    # ##   # ",
    " #    # # #    # #    # #####   ####  # #      # #  # ",
    " #    # # #    # #    # #           # # #  ### #  # # ",
    " #    # # #    # #    # #      #    # # #    # #   ## ",
    " #####  #  ####  #####  ######  ####  #  ####  #    # "
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
}

function resize() {
    width = canvas.width = canvas.parentElement.clientWidth;
    height = canvas.height = canvas.parentElement.clientHeight;
}

function drawLogo(startX, startY) {
    const logoCharsWidth = ASCII_LOGO[0].length;
    const logoCharsHeight = ASCII_LOGO.length;

    for (let y = 0; y < logoCharsHeight; y++) {
        for (let x = 0; x < logoCharsWidth; x++) {
            if (ASCII_LOGO[y][x] === '#') {
                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        const gx = (startX + x * 2 + dx + GRID_COLS) % GRID_COLS;
                        const gy = (startY + y * 2 + dy + GRID_ROWS) % GRID_ROWS;
                        const idx = gy * GRID_COLS + gx;
                        grid[idx] = 1;
                        colorGrid[idx] = 0.6; // Initial brand color strength
                    }
                }
            }
        }
    }
}

function resetGrid() {
    grid.fill(0);
    colorGrid.fill(0);

    const logoGridWidth = ASCII_LOGO[0].length * 2;
    const logoGridHeight = ASCII_LOGO.length * 2;

    const tileW = 160;
    const tileH = 40;

    const centerX = Math.floor((GRID_COLS - logoGridWidth) / 2);
    const centerY = Math.floor((GRID_ROWS - logoGridHeight) / 2);

    for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 2; i++) {
            const stagger = (j % 2 === 1) ? 80 : 0;
            const x = centerX + i * tileW + stagger;
            const y = centerY + j * tileH;
            drawLogo(x, y);
        }
    }
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
            }
        }
    }
}

function sprinkle() {
    const amount = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < amount; i++) {
        const gx = Math.floor(Math.random() * GRID_COLS);
        const gy = Math.floor(Math.random() * GRID_ROWS);
        fillCluster(gx, gy, 4);
    }
}

function fillAtMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / width * GRID_COLS;
    const my = (e.clientY - rect.top) / height * GRID_ROWS;
    fillCluster(mx, my, 4);
}

function update(time) {
    if (time - startTime < START_DELAY) return;
    if (time - lastUpdate < TICK_RATE) return;
    lastUpdate = time;

    let activeCells = 0;

    // Phase 1: Calculate next generation (HighLife B36/S23)
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

        if (grid[i] === 1) {
            nextGrid[i] = (n8 === 2 || n8 === 3) ? 1 : 0;
        } else {
            nextGrid[i] = (n8 === 3 || n8 === 6) ? 1 : 0;
        }
    }

    // Phase 2: Apply next generation and update visual intensity in one pass
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
        } else if (time - lowCellTime > SPRINKLE_DELAY) {
            sprinkle();
            lowCellTime = 0;
        }
    } else {
        lowCellTime = 0;
    }
}

function draw() {
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    const cellW = width / GRID_COLS;
    const cellH = height / GRID_ROWS;

    for (let y = 0; y < GRID_ROWS; y++) {
        const yOffset = y * GRID_COLS;
        const dy = y * cellH + 0.5;

        for (let x = 0; x < GRID_COLS; x++) {
            const intensity = colorGrid[yOffset + x];
            if (intensity > 0.01) {
                // Scale lightness from brand gold (50%) up to a bright gold (85%), avoiding pure white
                const lightness = 50 + (intensity * 35);
                // Keep saturation high (minimum 80%) to maintain the gold hue
                const saturation = 100 - (intensity * 20);

                ctx.fillStyle = `hsl(${colors.yellow.h}, ${saturation}%, ${lightness}%)`;
                ctx.fillRect(x * cellW + 0.5, dy, cellW - 0.5, cellH - 0.5);
            }
        }
    }
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
        draw();
    }
    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    resize();
});

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    fillAtMouse(e);
});

window.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
        fillAtMouse(e);
    }
});

init();
requestAnimationFrame(animate);



