const canvas = document.getElementById('splash-canvas');
const ctx = canvas.getContext('2d');
let width, height;
let startTime = 0;
let lastUpdate = 0;
let lowCellTime = 0;
let isMouseDown = false;

// Grid dimensions (fixed number of cells)
const GRID_COLS = 320;
const GRID_ROWS = 160;
const TICK_RATE = 75; // ms between CA steps
const START_DELAY = 2000; // 2 seconds static logo
const LOW_CELL_THRESHOLD = (GRID_COLS * GRID_ROWS) / 3; // Adjusted for larger grid
const SPRINKLE_DELAY = 2000; // 2 seconds

let grid = new Uint8Array(GRID_COLS * GRID_ROWS);
let nextGrid = new Uint8Array(GRID_COLS * GRID_ROWS);

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

function init() {
    resize();
    resetGrid();
    startTime = performance.now();
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
                        grid[gy * GRID_COLS + gx] = 1;
                    }
                }
            }
        }
    }
}

function resetGrid() {
    grid.fill(0);

    const logoGridWidth = ASCII_LOGO[0].length * 2;
    const logoGridHeight = ASCII_LOGO.length * 2;

    // GRID_COLS = 320, GRID_ROWS = 160
    const tileW = 160; // 2 tiles horizontally
    const tileH = 40;  // 4 tiles vertically

    const centerX = Math.floor((GRID_COLS - logoGridWidth) / 2);
    const centerY = Math.floor((GRID_ROWS - logoGridHeight) / 2);

    // Fill the grid with a staggered pattern, ensuring no overlaps
    // 4 rows vertically, 2 columns horizontally
    for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 2; i++) {
            const stagger = (j % 2 === 1) ? 80 : 0;
            const x = centerX + i * tileW + stagger;
            const y = centerY + j * tileH;
            drawLogo(x, y);
        }
    }
}

function sprinkle() {
    // Sprinkle 2x2 blocks to ensure they don't die immediately
    const amount = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < amount; i++) {
        const startX = Math.floor(Math.random() * (GRID_COLS - 1));
        const startY = Math.floor(Math.random() * (GRID_ROWS - 1));
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                if (Math.random() > 0.2) { // Tiny bit of randomness
                    grid[(startY + dy) * GRID_COLS + (startX + dx)] = 1;
                }
            }
        }
    }
}

function fillAtMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / width * GRID_COLS;
    const my = (e.clientY - rect.top) / height * GRID_ROWS;

    const startX = Math.floor(mx - 1);
    const startY = Math.floor(my - 1);

    for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
            const gx = startX + dx;
            const gy = startY + dy;
            if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
                // Randomly fill cells in this 2x2 block
                if (Math.random() > 0.3) {
                    grid[gy * GRID_COLS + gx] = 1;
                }
            }
        }
    }
}

function countNeighbors(x, y) {
    let sum = 0;
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            if (i === 0 && j === 0) continue;

            // Toroidal wrapping
            const col = (x + i + GRID_COLS) % GRID_COLS;
            const row = (y + j + GRID_ROWS) % GRID_ROWS;
            sum += grid[row * GRID_COLS + col];
        }
    }
    return sum;
}

function update(time) {
    // Initial delay: keep logo static
    if (time - startTime < START_DELAY) return;

    if (time - lastUpdate < TICK_RATE) return;
    lastUpdate = time;

    let activeCells = 0;

    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            const neighbors = countNeighbors(x, y);
            const state = grid[y * GRID_COLS + x];

            if (state === 1) {
                if (neighbors < 2 || neighbors > 3) {
                    nextGrid[y * GRID_COLS + x] = 0;
                } else {
                    nextGrid[y * GRID_COLS + x] = 1;
                    activeCells++;
                }
            } else {
                // HighLife rules: Birth on 3 or 6 neighbors
                if (neighbors === 3 || neighbors === 6) {
                    nextGrid[y * GRID_COLS + x] = 1;
                    activeCells++;
                } else {
                    nextGrid[y * GRID_COLS + x] = 0;
                }
            }
        }
    }

    // Swap buffers
    const temp = grid;
    grid = nextGrid;
    nextGrid = temp;

    // Check for sprinkling
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
        for (let x = 0; x < GRID_COLS; x++) {
            const state = grid[y * GRID_COLS + x];
            if (state === 1) {
                const neighbors = countNeighbors(x, y);
                const lightness = 40 + (neighbors * 5);
                ctx.fillStyle = `hsl(${colors.yellow.h}, ${colors.yellow.s}%, ${lightness}%)`;

                // Draw cell with a tiny gap
                ctx.fillRect(x * cellW + 0.5, y * cellH + 0.5, cellW - 0.5, cellH - 0.5);
            }
        }
    }
}

function animate(time) {
    update(time);
    draw();
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



