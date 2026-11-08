// ============================================================================
// 1. SINGLE-OPEN EXPANDABLE ACCORDION CONTROLLER
// ============================================================================

function setupAccordion() {
    const accordion = document.getElementById('lab-accordion');
    if (!accordion) return;

    const items = Array.from(accordion.querySelectorAll('.accordion-item'));

    items.forEach((item) => {
        const trigger = item.querySelector('.accordion-trigger');
        if (!trigger) return;

        trigger.addEventListener('click', (e) => {
            const isCurrentlyOpen = item.classList.contains('active');

            items.forEach((otherItem) => {
                otherItem.classList.remove('active');
                const otherTrigger = otherItem.querySelector('.accordion-trigger');
                if (otherTrigger) {
                    otherTrigger.setAttribute('aria-expanded', 'false');
                }
            });

            if (!isCurrentlyOpen) {
                item.classList.add('active');
                trigger.setAttribute('aria-expanded', 'true');
            }

            if (e && e.detail > 0) {
                trigger.blur();
            }
        });
    });
}

// ============================================================================
// 2. SIDEWAYS MATRIX RAIN & PROCEDURAL SNOWY MOUNTAIN GENERATOR
// ============================================================================

const canvas = document.getElementById('splash-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const smallScreenQuery = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(max-width: 768px)')
    : { matches: false };
const reducedMotionQuery = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

let width = 0;
let height = 0;
let rafId = null;
let animStartTime = 0;
let lastFrameTime = 0;
let pausedAt = 0;
let totalPausedDuration = 0;
const FRAME_INTERVAL = 1000 / 30;

// Offscreen buffer canvases for code rain layer & radial transparency mask
let photoCrop = { sx: 0, sy: 0, sw: 0, sh: 0 };
const rainCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const rainCtx = rainCanvas ? rainCanvas.getContext('2d') : null;
const maskCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const maskCtx = maskCanvas ? maskCanvas.getContext('2d') : null;
let maskRowRanges = null;

// Grid configuration
let numRows = 100;
let numCols = 300;
let lineHeight = 11;
let fontSize = 10;
let charWidth = 6;
let mountainGrid = null;
let streamRows = [];

// Authentic RV32I / RV64I instruction tokens & low-level systems assembly
const RISCV_INSTRUCTION_CORPUS = [
    'addi a0, zero, 1; ',
    'lui sp, 0x80000; ',
    'jal ra, _start; ',
    'sd ra, 0(sp); ',
    'ld t0, 8(sp); ',
    'xor a0, a1, a2; ',
    'beq a0, zero, .L1; ',
    'slli t0, t0, 3; ',
    'auipc gp, 0x10; ',
    'csrrw x0, mstatus, t1; ',
    'bne t1, t2, .L2; ',
    'add s0, sp, zero; ',
    'sub a1, a1, a2; ',
    'and a0, a0, 0xff; ',
    'or t3, t0, t1; ',
    'srli t0, t0, 1; ',
    'jalr zero, 0(ra); ',
    'ecall; ',
    'fence; ',
    '// zig hypervisor ',
    '#diodesign rv64gc ',
    '0x80000000 -> 0x1000 '
];

const MATRIX_NOISE_PALETTE = [
    'rgba(30, 58, 138, 0.65)',
    'rgba(37, 99, 235, 0.75)',
    'rgba(2, 132, 199, 0.85)',
    'rgba(56, 189, 248, 0.90)',
    'rgba(125, 211, 252, 0.80)'
];

// Diverse character sets for high-contrast alpine massif & atmospheric sky
const SNOW_CHARS      = ['0', '1', 'x', '#', '0', '[', ']', '1', '0', '1', 'x', '#', '0', '1', '[', ']'];
const ALPENGLOW_CHARS = ['#', '*', '8', '#', '0', '*', '#', '8', '0', '#', '*', '#', '8', '0', '#', '*'];
const SLOPE_CHARS     = ['1', '0', '1', '/', '0', '1', 'x', ';', '0', '1', '|', '1', '0', '/', '1', '0'];
const SHADOW_CHARS    = ['.', ':', '.', ' ', '.', ':', '.', ' ', '.', ':', '.', ' ', '.', ':', '.', ' '];
const TREE_CHARS      = ['^', '*', '1', 'x', '0', 'Y', '1', '#', '/', '\\', '1', '0', '^', '*', '0', '1'];
const SKY_CHARS       = ['0', '1', '0', '1', '1', '0', ';', '0', '1', 'x', ':', '1', '0', '/', '1', '0'];

function hashInt(x) {
    x = ((x >>> 16) ^ x) * 0x45d9f3b;
    x = ((x >>> 16) ^ x) * 0x45d9f3b;
    x = (x >>> 16) ^ x;
    return (x >>> 0) / 4294967296;
}

function pickGlyph(tokenIdx, rowIdx, mtnPix) {
    const idx = (hashInt((tokenIdx * 37) ^ (rowIdx * 1013)) * 16) | 0;
    return (mtnPix && mtnPix.glyphSet) ? mtnPix.glyphSet[idx & 15] : SKY_CHARS[idx & 15];
}

// Atmospheric digital sky color model: fills top half with luminous nocturnal matrix blues
function getSkyColor(yn, colIdx, rowIdx) {
    // Subtle glowing star pinned to fixed sky column/row coordinates (never blinks with time or scrolling)
    const h = hashInt((colIdx * 137) ^ (rowIdx * 313));
    if (h < 0.035) {
        return 'rgba(186, 230, 253, 0.95)'; // Brilliant ice-cyan star
    }
    // Smooth atmospheric nocturnal twilight gradient
    if (yn <= 0.08) {
        return 'rgba(23, 37, 84, 0.80)'; // Deep midnight navy
    } else if (yn <= 0.20) {
        return 'rgba(30, 58, 138, 0.85)'; // Royal navy blue
    } else if (yn <= 0.32) {
        return 'rgba(2, 132, 199, 0.88)'; // Electric cerulean
    } else {
        return 'rgba(14, 165, 233, 0.90)'; // Horizon cyan-blue
    }
}

// -------------------------------------------------------------
// PROCEDURAL SILHOUETTE FALLBACK (Used only if image unavailable)
// -------------------------------------------------------------

function buildMountainGrid(nRows, nCols) {
    const grid = new Array(nRows);
    for (let r = 0; r < nRows; r++) {
        const row = new Array(nCols);
        const yn = r / nRows;
        for (let c = 0; c < nCols; c++) {
            const xn = c / nCols;
            // High alpine peak profile at x ~ 0.48
            const peak = Math.exp(-Math.pow((xn - 0.48) * 4.5, 2.0)) * 0.42;
            const crestY = 0.58 - peak;
            if (yn < crestY) {
                row[c] = {
                    fill: 0.0,
                    lum: 0.20,
                    isMtn: false,
                    type: 'sky',
                    glyphSet: SKY_CHARS,
                    color: getSkyColor(yn, c, r)
                };
            } else {
                const isSnow = yn < crestY + 0.12;
                row[c] = {
                    fill: isSnow ? 1.0 : 0.4,
                    lum: isSnow ? 0.9 : 0.3,
                    isMtn: true,
                    type: isSnow ? 'snow' : 'mountain',
                    glyphSet: isSnow ? SNOW_CHARS : SLOPE_CHARS,
                    color: isSnow ? 'rgb(240, 248, 255)' : 'rgb(56, 189, 248)'
                };
            }
        }
        grid[r] = row;
    }
    return grid;
}

// -------------------------------------------------------------
// IMAGE-DRIVEN PHOTOREALISTIC REFERENCE MODEL
// -------------------------------------------------------------

const ALPINE_IMAGE_SRC = '/alpine-reference.webp';
let alpineImage = null;

const ALPINE_MASK_SRC = '/alpine-mask.webp';
let alpineMaskImage = null;

function getAlpineImage() {
    const el = document.getElementById('alpine-reference-img');
    if (el && el.complete && el.naturalWidth > 0) return el;
    if (alpineImage && alpineImage.complete && alpineImage.naturalWidth > 0) return alpineImage;
    return null;
}

function getAlpineMaskImage() {
    const el = document.getElementById('alpine-mask-img');
    if (el && el.complete && el.naturalWidth > 0) return el;
    if (alpineMaskImage && alpineMaskImage.complete && alpineMaskImage.naturalWidth > 0) return alpineMaskImage;
    return null;
}

function onAlpineMaskReady() {
    if (maskCanvas && width > 0 && height > 0) {
        buildMaskCanvas();
    }
}

function loadAlpineMaskImage() {
    const el = document.getElementById('alpine-mask-img');
    if (el) {
        if (el.complete && el.naturalWidth > 0) {
            onAlpineMaskReady();
        } else {
            el.addEventListener('load', onAlpineMaskReady);
        }
        return;
    }
    if (typeof Image === 'undefined') return;
    alpineMaskImage = new Image();
    alpineMaskImage.onload = onAlpineMaskReady;
    alpineMaskImage.src = ALPINE_MASK_SRC;
}
loadAlpineMaskImage();

function onAlpineImageReady(img) {
    if (numRows > 0 && numCols > 0) {
        mountainGrid = buildGridFromImage(img, numRows, numCols);
        if (maskCanvas) buildMaskCanvas();
    }
}

function loadAlpineImage() {
    const el = document.getElementById('alpine-reference-img');
    if (el) {
        if (el.complete && el.naturalWidth > 0) {
            onAlpineImageReady(el);
        } else {
            el.addEventListener('load', () => onAlpineImageReady(el));
        }
        return;
    }
    if (typeof Image === 'undefined') return;
    alpineImage = new Image();
    alpineImage.onload = () => onAlpineImageReady(alpineImage);
    alpineImage.src = ALPINE_IMAGE_SRC;
}
loadAlpineImage();

window.addEventListener('load', () => {
    const imgEl = getAlpineImage();
    if (imgEl && numRows > 0 && numCols > 0) {
        mountainGrid = buildGridFromImage(imgEl, numRows, numCols);
        if (maskCanvas) buildMaskCanvas();
    }
    const maskEl = getAlpineMaskImage();
    if (maskEl && maskCanvas) {
        buildMaskCanvas();
    }
});

function buildGridFromImage(img, nRows, nCols) {
    if (!img || !img.complete || !img.naturalWidth) {
        return buildMountainGrid(nRows, nCols);
    }
    const offCanvas = document.createElement('canvas');
    offCanvas.width = nCols;
    offCanvas.height = nRows;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (!offCtx) {
        return buildMountainGrid(nRows, nCols);
    }

    // Physical dimensions on screen (preserves 1:1 physical aspect ratio, never squishes or stretches)
    const screenW = width || (nCols * charWidth);
    const screenH = height || (nRows * lineHeight);
    const screenAspect = screenW / Math.max(1, screenH);

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const imgAspect = imgW / Math.max(1, imgH);

    // Compute source crop rectangle (sx, sy, sw, sh) to COVER the viewport without geometric distortion
    let sx = 0, sy = 0, sw = imgW, sh = imgH;
    if (screenAspect > imgAspect) {
        // Screen is wider than reference image: fit width, crop height
        sw = imgW;
        sh = Math.round(imgW / screenAspect);
        sy = Math.max(0, Math.min(imgH - sh, Math.round((imgH - sh) * 0.12)));
    } else {
        // Screen is taller/narrower than reference image: fit height, crop width
        sh = imgH;
        sw = Math.round(imgH * screenAspect);
        // Center the crop so the towering summit horn remains centered
        sx = Math.max(0, Math.min(imgW - sw, Math.round((imgW - sw) * 0.50)));
    }

    photoCrop = { sx, sy, sw, sh };

    offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, nCols, nRows);
    let imgData;
    try {
        imgData = offCtx.getImageData(0, 0, nCols, nRows).data;
    } catch (e) {
        return buildMountainGrid(nRows, nCols);
    }

    // 1. Robust mountain crest detection per column with multi-row confirmation
    const rawCrest = new Int32Array(nCols);
    for (let c = 0; c < nCols; c++) {
        let crest = -1;
        for (let r = Math.max(1, Math.round(nRows * 0.05)); r < Math.round(nRows * 0.75); r++) {
            const idx = (r * nCols + c) * 4;
            const red = imgData[idx];
            const green = imgData[idx + 1];
            const blue = imgData[idx + 2];
            const lum = (0.299 * red + 0.587 * green + 0.114 * blue) / 255.0;

            // Mountain signature:
            // Alpenglow (red > 75 && red > blue + 10), snow (lum >= 0.25), or craggy rock (red >= 40 && red > blue - 5)
            const isMtn = (red > 75 && red > blue + 10) || (lum >= 0.25) || (red >= 40 && red > blue - 5);
            if (isMtn && r + 1 < nRows) {
                // Confirm with subsequent row to eliminate any single-pixel compression artifact
                const nextIdx = ((r + 1) * nCols + c) * 4;
                const nr = imgData[nextIdx];
                const ng = imgData[nextIdx + 1];
                const nb = imgData[nextIdx + 2];
                const nlum = (0.299 * nr + 0.587 * ng + 0.114 * nb) / 255.0;
                if (nlum >= 0.16 || nr >= 36) {
                    crest = r;
                    break;
                }
            }
        }
        rawCrest[c] = crest;
    }

    // Propagate crest across missing or shadowed flank columns from neighbors
    for (let c = 0; c < nCols; c++) {
        if (rawCrest[c] === -1) {
            let leftVal = -1, rightVal = -1;
            for (let k = c - 1; k >= 0; k--) {
                if (rawCrest[k] !== -1) { leftVal = rawCrest[k]; break; }
            }
            for (let k = c + 1; k < nCols; k++) {
                if (rawCrest[k] !== -1) { rightVal = rawCrest[k]; break; }
            }
            if (leftVal !== -1 && rightVal !== -1) {
                rawCrest[c] = Math.round((leftVal + rightVal) * 0.5);
            } else if (leftVal !== -1) {
                rawCrest[c] = leftVal;
            } else if (rightVal !== -1) {
                rawCrest[c] = rightVal;
            } else {
                rawCrest[c] = Math.round(nRows * 0.5);
            }
        }
    }

    // 5-tap median filter to reject any single-column crest spikes
    const filteredCrest = new Int32Array(nCols);
    for (let c = 0; c < nCols; c++) {
        const c0 = Math.max(0, c - 2);
        const c1 = Math.min(nCols - 1, c + 2);
        const window = [];
        for (let k = c0; k <= c1; k++) window.push(rawCrest[k]);
        window.sort((a, b) => a - b);
        filteredCrest[c] = window[Math.floor(window.length / 2)];
    }

    // Clamp slope to prevent unrealistic vertical tears (max 2 rows of height change per column)
    const crestRow = new Int32Array(nCols);
    for (let c = 0; c < nCols; c++) crestRow[c] = filteredCrest[c];
    for (let c = 1; c < nCols; c++) {
        if (crestRow[c] > crestRow[c - 1] + 2) crestRow[c] = crestRow[c - 1] + 2;
        else if (crestRow[c] < crestRow[c - 1] - 2) crestRow[c] = crestRow[c - 1] - 2;
    }
    for (let c = nCols - 2; c >= 0; c--) {
        if (crestRow[c] > crestRow[c + 1] + 2) crestRow[c] = crestRow[c + 1] + 2;
        else if (crestRow[c] < crestRow[c + 1] - 2) crestRow[c] = crestRow[c + 1] - 2;
    }

    const grid = new Array(nRows);
    for (let r = 0; r < nRows; r++) {
        const row = new Array(nCols);
        for (let c = 0; c < nCols; c++) {
            // Sky detection: strictly and cleanly above the continuous mountain crest
            if (r < crestRow[c]) {
                row[c] = {
                    fill: 0.0,
                    lum: 0.20,
                    isMtn: false,
                    type: 'sky',
                    glyphSet: SKY_CHARS,
                    color: getSkyColor(r / nRows, c, r)
                };
                continue;
            }

            const idx = (r * nCols + c) * 4;
            const red = imgData[idx];
            const green = imgData[idx + 1];
            const blue = imgData[idx + 2];
            const lum = (0.299 * red + 0.587 * green + 0.114 * blue) / 255.0;

            // 1. Warm Golden Alpenglow on summit horn and sunlit knife-edge ridges
            const isAlpenglow = (red > 150 && green > 100 && red > blue + 35);

            // Quantize to steps of 6 for high-efficiency run-length grouping in Canvas 2D
            let qr = Math.min(255, Math.round(red / 6) * 6);
            let qg = Math.min(255, Math.round(green / 6) * 6);
            let qb = Math.min(255, Math.round(blue / 6) * 6);

            let type = 'mountain';
            let glyphSet = SLOPE_CHARS;
            let fill = lum;

            if (isAlpenglow) {
                type = 'alpenglow';
                glyphSet = ALPENGLOW_CHARS;
                fill = 1.0;
                qr = 254;
                qg = 222;
                qb = Math.min(95, qb);
            } else if (lum >= 0.32) {
                type = 'snow'; // Pristine glacial snowfields and cirques
                glyphSet = SNOW_CHARS;
                fill = Math.min(1.0, lum * 1.35);
                qr = Math.min(255, Math.round(red * 1.25 + 28));
                qg = Math.min(255, Math.round(green * 1.22 + 32));
                qb = Math.min(255, Math.max(Math.round(blue * 1.18 + 32), 195));
                if (lum >= 0.55) {
                    qr = Math.max(qr, 220);
                    qg = Math.max(qg, 238);
                    qb = Math.max(qb, 255);
                }
            } else if (green > red * 1.08 && green > blue * 0.88 && lum < 0.35) {
                type = 'tree'; // Deep spruce pine forest at base
                glyphSet = TREE_CHARS;
                fill = 0.55;
                qr = Math.round(red * 0.75);
                qg = Math.min(255, Math.round(green * 1.25 + 10));
                qb = Math.round(blue * 0.75);
            } else if (lum < 0.14) {
                type = 'shadow'; // Deep rock crevices & couloir shadows
                glyphSet = SHADOW_CHARS;
                fill = 0.10;
                qr = Math.max(16, qr);
                qg = Math.max(26, qg);
                qb = Math.max(48, qb);
            } else {
                type = 'mountain'; // Craggy slate rock faces
                glyphSet = SLOPE_CHARS;
                fill = Math.max(0.20, lum);
                qr = Math.max(28, qr);
                qg = Math.max(44, qg);
                qb = Math.max(78, qb);
            }

            // Quantize to steps of 16 for high-efficiency run-length grouping in Canvas 2D
            qr = Math.min(255, Math.round(qr / 16) * 16);
            qg = Math.min(255, Math.round(qg / 16) * 16);
            qb = Math.min(255, Math.round(qb / 16) * 16);

            row[c] = {
                fill,
                lum,
                isMtn: true,
                type,
                glyphSet,
                color: 'rgb(' + qr + ',' + qg + ',' + qb + ')'
            };
        }
        grid[r] = row;
    }
    return grid;
}

// -------------------------------------------------------------
// HORIZONTAL MATRIX RAIN STREAM LINES
// -------------------------------------------------------------
function initStreamRows() {
    streamRows = [];
    for (let r = 0; r < numRows; r++) {
        // ~70% move right-to-left (-1), ~30% move left-to-right (+1)
        const isReverse = (r % 7 === 2 || r % 7 === 5);
        const direction = isReverse ? 1 : -1;

        // Strictly constant scroll speed at 1/3 speed (40px/s to 64px/s): never accelerates or decelerates
        const speed = (40 + ((r * 17) % 25)) * direction;

        // Staggered start delay: lines start appearing in waves (0.0s to 2.2s)
        const startDelay = ((r * 23) % 29) * 0.075;

        // Line type: ~35% stream authentic RISC-V instructions and systems tokens
        const isInstLine = (r % 3 === 1);

        // Pre-build instruction stream string if it is an instruction line
        let charStream = '';
        if (isInstLine) {
            let corpusIdx = (r * 3) % RISCV_INSTRUCTION_CORPUS.length;
            while (charStream.length < 800) {
                charStream += RISCV_INSTRUCTION_CORPUS[corpusIdx % RISCV_INSTRUCTION_CORPUS.length];
                corpusIdx++;
            }
        }

        // Noise palette seeds for initial random matrix rain phase
        const noiseColors = [];
        for (let i = 0; i < 40; i++) {
            noiseColors.push(MATRIX_NOISE_PALETTE[(r * 5 + i * 3) % MATRIX_NOISE_PALETTE.length]);
        }

        streamRows.push({
            r,
            y: Math.round((r / numRows) * height),
            direction,
            speed,
            startDelay,
            isInstLine,
            charStream,
            noiseColors,
            initialOffset: ((r * 73) % 200) * direction
        });
    }
}

// -------------------------------------------------------------
// RADIAL GRADUATED TRANSPARENCY MASK
// -------------------------------------------------------------
function buildMaskCanvas() {
    if (!maskCtx || width === 0 || height === 0) return;
    maskCtx.clearRect(0, 0, width, height);

    const maskImg = getAlpineMaskImage();
    if (maskImg && photoCrop.sw > 0) {
        // High-performance hardware-accelerated mask blit co-registered to photoCrop
        maskCtx.drawImage(
            maskImg,
            photoCrop.sx, photoCrop.sy, photoCrop.sw, photoCrop.sh,
            0, 0, width, height
        );

        // Precompute active row ranges based on alpine-mask.webp non-zero footprint:
        // photoX spans [80, 1170] and photoY spans [35, 640]
        const minX = Math.max(0, Math.floor(((80 - photoCrop.sx) / photoCrop.sw) * width));
        const maxX = Math.min(width, Math.ceil(((1170 - photoCrop.sx) / photoCrop.sw) * width));
        const minY = Math.max(0, Math.floor(((35 - photoCrop.sy) / photoCrop.sh) * height));
        const maxY = Math.min(height, Math.ceil(((640 - photoCrop.sy) / photoCrop.sh) * height));

        maskRowRanges = new Array(numRows);
        for (let r = 0; r < numRows; r++) {
            const rowY = (streamRows && streamRows[r]) ? streamRows[r].y : Math.round(r * lineHeight);
            if (rowY >= minY && rowY <= maxY && minX < maxX) {
                maskRowRanges[r] = { minX, maxX };
            } else {
                maskRowRanges[r] = null;
            }
        }
        return;
    }

    // Fallback: Large graduated radial apertures positioned over scenic alpine features:
    // Pinned dynamically to match underlying photograph coordinates under any aspect ratio
    const minDim = Math.min(width, height);
    const summitX = photoCrop.sw > 0
        ? ((615 - photoCrop.sx) / photoCrop.sw) * width
        : width * 0.48;
    const summitY = photoCrop.sh > 0
        ? ((240 - photoCrop.sy) / photoCrop.sh) * height
        : height * 0.32;

    const leftX = photoCrop.sw > 0
        ? ((250 - photoCrop.sx) / photoCrop.sw) * width
        : width * 0.17;
    const leftY = photoCrop.sh > 0
        ? ((380 - photoCrop.sy) / photoCrop.sh) * height
        : height * 0.52;

    // Mid-right glacier cirque & shoulder (photo x=780, y=360)
    const midX = photoCrop.sw > 0
        ? ((780 - photoCrop.sx) / photoCrop.sw) * width
        : width * 0.62;
    const midY = photoCrop.sh > 0
        ? ((360 - photoCrop.sy) / photoCrop.sh) * height
        : height * 0.48;

    // Right mountain massif & sunlit alpenglow peaks (photo x=1030, y=280)
    const rightX = photoCrop.sw > 0
        ? ((1030 - photoCrop.sx) / photoCrop.sw) * width
        : width * 0.82;
    const rightY = photoCrop.sh > 0
        ? ((280 - photoCrop.sy) / photoCrop.sh) * height
        : height * 0.38;

    const circles = [
        // 1. Centerpiece: Towering alpine summit horn & knife-edge ridges
        { x: summitX, y: summitY, r: minDim * 0.48, maxA: 0.98 },
        // 2. Left flank: High ridges and cascading rock gullies
        { x: leftX, y: leftY, r: minDim * 0.40, maxA: 0.90 },
        // 3. Mid-right glacier cirque connecting center and right
        { x: midX, y: midY, r: minDim * 0.34, maxA: 0.88 },
        // 4. Right mountain: Sunlit alpine massif & cirques
        { x: rightX, y: rightY, r: minDim * 0.40, maxA: 0.92 },
        // 5. Atmospheric Sky Matrix
        { x: width * 0.50, y: height * 0.10, r: minDim * 0.38, maxA: 0.85 }
    ];

    for (const c of circles) {
        const grad = maskCtx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        grad.addColorStop(0.00, `rgba(255, 255, 255, ${c.maxA})`);
        grad.addColorStop(0.35, `rgba(255, 255, 255, ${c.maxA * 0.80})`);
        grad.addColorStop(0.65, `rgba(255, 255, 255, ${c.maxA * 0.35})`);
        grad.addColorStop(0.85, `rgba(255, 255, 255, ${c.maxA * 0.08})`);
        grad.addColorStop(1.00, 'rgba(255, 255, 255, 0.0)');

        maskCtx.fillStyle = grad;
        maskCtx.beginPath();
        maskCtx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        maskCtx.fill();
    }

    // Precompute active horizontal span [minX, maxX] for each row
    maskRowRanges = new Array(numRows);
    for (let r = 0; r < numRows; r++) {
        const rowY = (streamRows && streamRows[r]) ? streamRows[r].y : Math.round(r * lineHeight);
        let rMin = Infinity;
        let rMax = -Infinity;
        for (const c of circles) {
            const dy = Math.abs(rowY - c.y);
            if (dy < c.r) {
                const dx = Math.sqrt(c.r * c.r - dy * dy);
                const cMin = c.x - dx;
                const cMax = c.x + dx;
                if (cMin < rMin) rMin = cMin;
                if (cMax > rMax) rMax = cMax;
            }
        }
        if (rMin <= rMax) {
            maskRowRanges[r] = {
                minX: Math.max(0, Math.floor(rMin)),
                maxX: Math.min(width, Math.ceil(rMax))
            };
        } else {
            maskRowRanges[r] = null;
        }
    }
}

// -------------------------------------------------------------
// FRAME RENDERING
// -------------------------------------------------------------
function renderFrame(time) {
    if (!ctx || width === 0 || height === 0 || !mountainGrid) return;
    if (smallScreenQuery.matches) return;

    if (!animStartTime) animStartTime = time;
    const elapsed = (time - animStartTime - totalPausedDuration) / 1000;

    // 1. Render reference photograph behind the code rain (exact 1:1 scale & crop)
    const imgEl = getAlpineImage();
    if (imgEl && photoCrop.sw > 0) {
        ctx.drawImage(imgEl, photoCrop.sx, photoCrop.sy, photoCrop.sw, photoCrop.sh, 0, 0, width, height);
        // Atmospheric twilight grading over photo so colors harmonize with diodesign palette
        ctx.fillStyle = 'rgba(2, 6, 23, 0.38)';
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
    }

    // If offscreen buffers aren't available, draw directly to main context
    const targetCtx = rainCtx || ctx;
    if (rainCtx) {
        rainCtx.clearRect(0, 0, width, height);
    }

    targetCtx.font = fontSize + 'px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    targetCtx.textBaseline = 'top';

    for (let r = 0; r < numRows; r++) {
        const range = maskRowRanges ? maskRowRanges[r] : null;
        if (!range) continue; // Skip rows outside all aperture circles completely

        const row = streamRows[r];
        if (!row || elapsed < row.startDelay) continue; // Line hasn't started appearing yet

        const activeTime = elapsed - row.startDelay;
        // Smooth transition over ~3.0s from initial random matrix binary to crystallized snowy mountain
        const lineReveal = Math.min(1.0, Math.max(0.0, (activeTime - 1.2) / 2.8));

        // Horizontal scroll position (moves at strictly CONSTANT SPEED, monotonically in intended direction)
        const offset = Math.round(row.initialOffset + row.speed * activeTime);

        // Leading head enters at constant speed across the screen (~3.2s to traverse 1440px)
        const headSpeed = 440 + ((r * 29) % 70);
        const headDist = headSpeed * activeTime;
        let headMinX = -charWidth;
        let headMaxX = width + charWidth;
        if (row.direction < 0) {
            // Right-to-left: leading head advances steadily from right edge to left
            const headX = width - headDist;
            if (headX > 0) headMinX = headX;
        } else {
            // Left-to-right: leading head advances steadily from left edge to right
            const headX = headDist;
            if (headX < width) headMaxX = headX;
        }

        const clampMinX = Math.max(range.minX, headMinX);
        const clampMaxX = Math.min(range.maxX, headMaxX);
        if (clampMinX > clampMaxX) continue;

        const rowY = row.y; // Whole integer scanline

        // Visible character index range bounded strictly to active aperture span
        const minI = Math.floor((clampMinX - charWidth - offset) / charWidth);
        const maxI = Math.ceil((clampMaxX + charWidth - offset) / charWidth);

        let batchStr = '';
        let batchColor = '';
        let batchStartX = 0;

        for (let i = minI; i <= maxI; i++) {
            const screenX = i * charWidth + offset;
            if (screenX < clampMinX - charWidth || screenX > clampMaxX + charWidth) {
                if (batchStr.length > 0) {
                    targetCtx.fillStyle = batchColor;
                    targetCtx.fillText(batchStr, batchStartX, rowY);
                    batchStr = '';
                }
                continue;
            }

            const tokenIdx = i;

            // Sample 2D Mountain Pixel Array at current physical screen column
            // Co-registered with normalized screen width (screenX / width) to ensure
            // 1:1 spatial lockstep with the underlying reference photograph
            const normX = (screenX + charWidth * 0.5) / width;
            const col = Math.floor(normX * numCols);
            const wrappedCol = ((col % numCols) + numCols) % numCols;
            const mtnPix = mountainGrid[r][wrappedCol];
            const targetColor = mtnPix.color;

            let charToDraw;
            let charColor;

            if (row.isInstLine) {
                // RISC-V Instruction Line (strictly reads forward left-to-right)
                const len = row.charStream.length;
                let charIdx = tokenIdx % len;
                if (charIdx < 0) charIdx += len;
                charToDraw = row.charStream[charIdx];
                if (charToDraw === ' ') {
                    if (batchStr.length > 0) {
                        targetCtx.fillStyle = batchColor;
                        targetCtx.fillText(batchStr, batchStartX, rowY);
                        batchStr = '';
                    }
                    continue;
                }

                if (lineReveal < 1.0) {
                    const noiseLen = row.noiseColors.length;
                    let noiseIdx = tokenIdx % noiseLen;
                    if (noiseIdx < 0) noiseIdx += noiseLen;
                    charColor = (lineReveal > 0.5) ? targetColor : row.noiseColors[noiseIdx];
                } else {
                    charColor = targetColor;
                }
            } else {
                // Binary Matrix Lines: diverse character selection
                const finalGlyph = pickGlyph(tokenIdx, r, mtnPix);

                if (lineReveal < 1.0) {
                    const noiseLen = row.noiseColors.length;
                    let noiseIdx = tokenIdx % noiseLen;
                    if (noiseIdx < 0) noiseIdx += noiseLen;
                    charToDraw = (tokenIdx & 1) === 0 ? '1' : '0';
                    charColor = row.noiseColors[noiseIdx];

                    // Deterministic progressive crystallization into mountain/sky
                    const revealThresh = hashInt((tokenIdx * 43) ^ (r * 1013));
                    if (revealThresh < lineReveal) {
                        charToDraw = finalGlyph;
                        charColor = targetColor;
                    }
                } else {
                    charToDraw = finalGlyph;
                    charColor = targetColor;
                }
            }

            if (charToDraw === ' ') {
                if (batchStr.length > 0) {
                    targetCtx.fillStyle = batchColor;
                    targetCtx.fillText(batchStr, batchStartX, rowY);
                    batchStr = '';
                }
                continue;
            }

            // Run-length batching: draw runs of identical color characters in single fillText calls
            if (batchStr.length > 0 && batchColor === charColor) {
                batchStr += charToDraw;
            } else {
                if (batchStr.length > 0) {
                    targetCtx.fillStyle = batchColor;
                    targetCtx.fillText(batchStr, batchStartX, rowY);
                }
                batchStr = charToDraw;
                batchColor = charColor;
                batchStartX = screenX;
            }
        }
        if (batchStr.length > 0) {
            targetCtx.fillStyle = batchColor;
            targetCtx.fillText(batchStr, batchStartX, rowY);
        }
    }

    // 3. Apply radial graduated transparency mask to code rain layer & composite onto photo
    if (rainCtx && maskCanvas && rainCanvas) {
        rainCtx.globalCompositeOperation = 'destination-in';
        rainCtx.drawImage(maskCanvas, 0, 0);
        rainCtx.globalCompositeOperation = 'source-over';

        ctx.drawImage(rainCanvas, 0, 0);
    }
}

// -------------------------------------------------------------
// VISIBILITY, LIFECYCLE & PERFORMANCE MANAGEMENT
// -------------------------------------------------------------

function isAnimationActive() {
    if (smallScreenQuery.matches) return false;
    if (typeof document !== 'undefined') {
        if (document.hidden || document.visibilityState !== 'visible') return false;
    }
    if (reducedMotionQuery.matches) return false;
    return true;
}

function startAnimation() {
    if (pausedAt > 0) {
        totalPausedDuration += performance.now() - pausedAt;
        pausedAt = 0;
    }
    if (!rafId && isAnimationActive()) {
        rafId = requestAnimationFrame(animate);
    }
}

function stopAnimation() {
    if (!pausedAt) {
        pausedAt = performance.now();
    }
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}

function setupLandscapeInteractions() {
    // 1. Pause RAF loop completely whenever tab/window is hidden or minimized
    document.addEventListener('visibilitychange', () => {
        if (document.hidden || document.visibilityState !== 'visible') {
            stopAnimation();
        } else {
            startAnimation();
        }
    });

    // 2. Respect user's OS prefers-reduced-motion setting
    if (reducedMotionQuery.addEventListener) {
        reducedMotionQuery.addEventListener('change', () => {
            if (reducedMotionQuery.matches) {
                stopAnimation();
                renderFrame(performance.now());
            } else {
                startAnimation();
            }
        });
    }
}

function animate(time) {
    // Hard stop: immediately halt and do not request subsequent frames when not visible
    if (!isAnimationActive()) {
        rafId = null;
        return;
    }

    rafId = requestAnimationFrame(animate);

    // Frame rate pacing (rock-steady 30 FPS, ~33.3ms)
    if (time - lastFrameTime < FRAME_INTERVAL) {
        return;
    }
    if (lastFrameTime === 0 || time - lastFrameTime > 200) {
        lastFrameTime = time;
    } else {
        lastFrameTime += FRAME_INTERVAL;
    }

    renderFrame(time);
}

function resizeAndRebuild() {
    if (!canvas) return;

    if (smallScreenQuery.matches) {
        stopAnimation();
        return;
    }

    const newW = window.innerWidth;
    const newH = window.innerHeight;
    if (!newW || !newH) return;

    width = canvas.width = newW;
    height = canvas.height = newH;

    if (rainCanvas) {
        rainCanvas.width = width;
        rainCanvas.height = height;
    }
    if (maskCanvas) {
        maskCanvas.width = width;
        maskCanvas.height = height;
    }

    // Aim for ~100 horizontal lines filling the screen
    numRows = Math.max(65, Math.min(105, Math.round(height / 14)));
    lineHeight = Math.max(10, Math.round(height / numRows));
    fontSize = Math.max(9, Math.min(13, Math.round(lineHeight * 0.88)));

    // Exact monospace character cell width
    if (ctx && ctx.measureText) {
        ctx.font = fontSize + 'px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        charWidth = Math.max(6, ctx.measureText('0').width);
    } else {
        charWidth = Math.max(6, Math.round(fontSize * 0.65));
    }

    numCols = Math.round(width / charWidth);

    // Synthesize 2D alpine pixel array (image-driven with procedural fallback)
    const imgEl = getAlpineImage();
    if (imgEl) {
        mountainGrid = buildGridFromImage(imgEl, numRows, numCols);
    } else {
        mountainGrid = buildMountainGrid(numRows, numCols);
    }

    // Initialize horizontal stream rows
    initStreamRows();

    // Rebuild radial transparency mask once photoCrop coordinates and stream rows are locked
    if (maskCanvas) {
        buildMaskCanvas();
    }

    if (reducedMotionQuery.matches) {
        stopAnimation();
        renderFrame(performance.now());
    } else {
        startAnimation();
    }
}
// ============================================================================
// 3. TACTILE 32/64-BIT RISC-V SILICON & INSTRUCTION EXPLORER
// ============================================================================

const ABI_NAMES = [
    'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
    's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
    'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
    's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'
];

let rvXlen = 64;
let currentInst = 0x02a08293; // addi x5, x1, 42
let bitButtons = [];

function parseReg(token) {
    if (!token) return 0;
    const clean = token.trim().toLowerCase();
    if (clean.startsWith('x')) {
        const n = parseInt(clean.slice(1), 10);
        if (!isNaN(n) && n >= 0 && n < 32) return n;
    }
    const abiIdx = ABI_NAMES.indexOf(clean);
    return abiIdx >= 0 ? abiIdx : 0;
}

function signExtend(val, bits) {
    const shift = 32 - bits;
    return (val << shift) >> shift;
}

function signExtendBigInt(val, bits) {
    const shift = BigInt(64 - bits);
    return (BigInt.asUintN(64, val) << shift) >> shift;
}

function assembleRiscv(asmText) {
    const clean = asmText.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
    if (!clean) return null;
    const hexMatch = clean.match(/^(?:\.word\s+)?0x([0-9a-fA-F]{1,8})$/i);
    if (hexMatch) {
        return parseInt(hexMatch[1], 16) >>> 0;
    }
    const parts = clean.split(' ');
    const mnem = parts[0].toLowerCase();

    const encodeR = (funct7, rs2, rs1, funct3, rd, opcode) =>
        (((funct7 & 0x7f) << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) |
         ((funct3 & 0x7) << 12) | ((rd & 0x1f) << 7) | (opcode & 0x7f)) >>> 0;

    const encodeI = (imm, rs1, funct3, rd, opcode) =>
        (((imm & 0xfff) << 20) | ((rs1 & 0x1f) << 15) |
         ((funct3 & 0x7) << 12) | ((rd & 0x1f) << 7) | (opcode & 0x7f)) >>> 0;

    const encodeS = (imm, rs2, rs1, funct3, opcode) => {
        const imm11_5 = (imm >> 5) & 0x7f;
        const imm4_0 = imm & 0x1f;
        return ((imm11_5 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) |
                ((funct3 & 0x7) << 12) | (imm4_0 << 7) | (opcode & 0x7f)) >>> 0;
    };

    const encodeB = (imm, rs2, rs1, funct3, opcode) => {
        const b12 = (imm >> 12) & 1;
        const b11 = (imm >> 11) & 1;
        const b10_5 = (imm >> 5) & 0x3f;
        const b4_1 = (imm >> 1) & 0xf;
        return ((b12 << 31) | (b10_5 << 25) | ((rs2 & 0x1f) << 20) | ((rs1 & 0x1f) << 15) |
                ((funct3 & 0x7) << 12) | (b4_1 << 8) | (b11 << 7) | (opcode & 0x7f)) >>> 0;
    };

    const encodeJ = (imm, rd, opcode) => {
        const b20 = (imm >> 20) & 1;
        const b10_1 = (imm >> 1) & 0x3ff;
        const b11 = (imm >> 11) & 1;
        const b19_12 = (imm >> 12) & 0xff;
        return ((b20 << 31) | (b10_1 << 21) | (b11 << 20) | (b19_12 << 12) |
                ((rd & 0x1f) << 7) | (opcode & 0x7f)) >>> 0;
    };

    const rOps = {
        add:  [0x00, 0x0, 0x33], sub:  [0x20, 0x0, 0x33],
        sll:  [0x00, 0x1, 0x33], slt:  [0x00, 0x2, 0x33],
        sltu: [0x00, 0x3, 0x33], xor:  [0x00, 0x4, 0x33],
        srl:  [0x00, 0x5, 0x33], sra:  [0x20, 0x5, 0x33],
        or:   [0x00, 0x6, 0x33], and:  [0x00, 0x7, 0x33],
        addw: [0x00, 0x0, 0x3b], subw: [0x20, 0x0, 0x3b],
        sllw: [0x00, 0x1, 0x3b], srlw: [0x00, 0x5, 0x3b],
        sraw: [0x20, 0x5, 0x3b]
    };
    if (rOps[mnem] && parts.length >= 4) {
        const [f7, f3, op] = rOps[mnem];
        return encodeR(f7, parseReg(parts[3]), parseReg(parts[2]), f3, parseReg(parts[1]), op);
    }

    const iOps = {
        addi:  [0x0, 0x13], slti:  [0x2, 0x13], sltiu: [0x3, 0x13],
        xori:  [0x4, 0x13], ori:   [0x6, 0x13], andi:  [0x7, 0x13],
        slli:  [0x1, 0x13], srli:  [0x5, 0x13], srai:  [0x5, 0x13],
        addiw: [0x0, 0x1b], slliw: [0x1, 0x1b], srliw: [0x5, 0x1b],
        sraiw: [0x5, 0x1b]
    };
    if (iOps[mnem] && parts.length >= 4) {
        const [f3, op] = iOps[mnem];
        let imm = parseInt(parts[3], 0) || 0;
        if (mnem === 'srai') imm = (imm & 0x3f) | 0x400;
        else if (mnem === 'sraiw') imm = (imm & 0x1f) | 0x400;
        else if (mnem === 'slli' || mnem === 'srli') imm = imm & 0x3f;
        else if (mnem === 'slliw' || mnem === 'srliw') imm = imm & 0x1f;
        return encodeI(imm, parseReg(parts[2]), f3, parseReg(parts[1]), op);
    }

    const loads = { lb: 0x0, lh: 0x1, lw: 0x2, ld: 0x3, lbu: 0x4, lhu: 0x5, lwu: 0x6 };
    if (loads[mnem] !== undefined && parts.length >= 3) {
        const rd = parseReg(parts[1]);
        const m = parts[2].match(/^(-?(?:0x[\da-fA-F]+|\d+))\(([^)]+)\)$/);
        if (m) {
            return encodeI(parseInt(m[1], 0), parseReg(m[2]), loads[mnem], rd, 0x03);
        }
    }

    if (mnem === 'jalr' && parts.length >= 3) {
        const rd = parseReg(parts[1]);
        const m = parts[2].match(/^(-?(?:0x[\da-fA-F]+|\d+))\(([^)]+)\)$/);
        if (m) {
            return encodeI(parseInt(m[1], 0), parseReg(m[2]), 0x0, rd, 0x67);
        }
        if (parts.length >= 4) {
            return encodeI(parseInt(parts[3], 0) || 0, parseReg(parts[2]), 0x0, rd, 0x67);
        }
    }

    const stores = { sb: 0x0, sh: 0x1, sw: 0x2, sd: 0x3 };
    if (stores[mnem] !== undefined && parts.length >= 3) {
        const rs2 = parseReg(parts[1]);
        const m = parts[2].match(/^(-?(?:0x[\da-fA-F]+|\d+))\(([^)]+)\)$/);
        if (m) {
            return encodeS(parseInt(m[1], 0), rs2, parseReg(m[2]), stores[mnem], 0x23);
        }
    }

    const branches = { beq: 0x0, bne: 0x1, blt: 0x4, bge: 0x5, bltu: 0x6, bgeu: 0x7 };
    if (branches[mnem] !== undefined && parts.length >= 4) {
        return encodeB(parseInt(parts[3], 0) || 0, parseReg(parts[2]), parseReg(parts[1]), branches[mnem], 0x63);
    }

    if ((mnem === 'lui' || mnem === 'auipc') && parts.length >= 3) {
        const rd = parseReg(parts[1]);
        const imm20 = parseInt(parts[2], 0) || 0;
        const op = mnem === 'lui' ? 0x37 : 0x17;
        return (((imm20 & 0xfffff) << 12) | ((rd & 0x1f) << 7) | op) >>> 0;
    }

    if (mnem === 'jal' && parts.length >= 3) {
        const rd = parseReg(parts[1]);
        const imm21 = parseInt(parts[2], 0) || 0;
        return encodeJ(imm21, rd, 0x6f);
    }

    return null;
}

function decodeRiscv(inst, xlen) {
    const u = inst >>> 0;
    const opcode = u & 0x7f;
    const rd = (u >>> 7) & 0x1f;
    const funct3 = (u >>> 12) & 0x7;
    const rs1 = (u >>> 15) & 0x1f;
    const rs2 = (u >>> 20) & 0x1f;
    const funct7 = (u >>> 25) & 0x7f;

    const immI = signExtend(u >>> 20, 12);
    const immS = signExtend(((u >>> 25) << 5) | ((u >>> 7) & 0x1f), 12);
    const immB = signExtend(
        (((u >>> 31) & 1) << 12) | (((u >>> 7) & 1) << 11) |
        (((u >>> 25) & 0x3f) << 5) | (((u >>> 8) & 0xf) << 1),
        13
    );
    const immU = (u & 0xfffff000) >> 0;
    const immJ = signExtend(
        (((u >>> 31) & 1) << 20) | (((u >>> 12) & 0xff) << 12) |
        (((u >>> 20) & 1) << 11) | (((u >>> 21) & 0x3ff) << 1),
        21
    );

    // Sample architectural register values (64-bit BigInt / 32-bit masked)
    const mask = xlen === 64 ? 0xffffffffffffffffn : 0xffffffffn;
    const r1Val = (rs1 === 0 ? 0n : BigInt(0x100 + rs1 * 16)) & mask;
    const r2Val = (rs2 === 0 ? 0n : BigInt(0x020 + rs2 * 8)) & mask;

    let fmt = 'I-type';
    let opName = 'OP-IMM';
    let asm = `addi x${rd}, x${rs1}, ${immI}`;
    let aluOp = 'ADD';
    let memMode = 'Bypass';
    let memSub = 'No R/W';
    let wbText = `x${rd}`;
    let wbVal = '0x0';
    let immVal = immI;
    let rtl = `x${rd} ← x${rs1} + ${immI}`;
    let ctrl = 'RegWrite=1 · ALUSrc=Imm · Mem=Off';
    let activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-imm', 'wire-rs1-alu', 'wire-imm-alu', 'wire-alu-wb'];
    let activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-wb'];

    if (opcode === 0x33 || opcode === 0x3b) {
        fmt = 'R-type';
        const isW = opcode === 0x3b;
        opName = isW ? 'OP-32 (RV64)' : 'OP (reg)';
        activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-rs1-alu', 'wire-rs2-alu', 'wire-alu-wb'];
        activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-alu', 'node-wb'];

        const validF7 = funct7 === 0x00 || (funct7 === 0x20 && (funct3 === 0 || funct3 === 5));
        const validW = !isW || (xlen === 64 && (funct3 === 0 || funct3 === 1 || funct3 === 5));
        if (!validF7 || !validW) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal inst';
            rtl = 'Exception: illegal funct7/funct3 encoding';
            ctrl = 'RegWrite=0 · Trap=IllegalInst';
        } else {
            const isSub = (funct7 & 0x20) !== 0;
            const map = {
                0: isSub ? 'sub' : 'add',
                1: 'sll',
                2: 'slt',
                3: 'sltu',
                4: 'xor',
                5: isSub ? 'sra' : 'srl',
                6: 'or',
                7: 'and'
            };
            let m = map[funct3] || 'add';
            if (isW && (m === 'add' || m === 'sub' || m === 'sll' || m === 'srl' || m === 'sra')) {
                m += 'w';
            }
            asm = `${m} x${rd}, x${rs1}, x${rs2}`;
            aluOp = m.toUpperCase();

            const opSym = { add: '+', sub: '-', sll: '<<', slt: '<s', sltu: '<u', xor: '^', srl: '>>u', sra: '>>s', or: '|', and: '&' }[m.replace(/w$/, '')] || '+';
            rtl = isW ? `x${rd} ← sext32((x${rs1} ${opSym} x${rs2})[31:0])` : `x${rd} ← x${rs1} ${opSym} x${rs2}`;
            ctrl = 'RegWrite=1 · ALUSrc=rs2 · Mem=Off';

            const shamt = r2Val & (isW ? 0x1fn : (xlen === 64 ? 0x3fn : 0x1fn));
            let res = 0n;
            if (m.startsWith('add')) res = r1Val + r2Val;
            else if (m.startsWith('sub')) res = r1Val - r2Val;
            else if (m.startsWith('sll')) res = (isW ? (r1Val & 0xffffffffn) : r1Val) << shamt;
            else if (m === 'slt') res = BigInt.asIntN(xlen, r1Val) < BigInt.asIntN(xlen, r2Val) ? 1n : 0n;
            else if (m === 'sltu') res = BigInt.asUintN(xlen, r1Val) < BigInt.asUintN(xlen, r2Val) ? 1n : 0n;
            else if (m === 'xor') res = r1Val ^ r2Val;
            else if (m.startsWith('srl')) res = (isW ? (r1Val & 0xffffffffn) : r1Val) >> shamt;
            else if (m.startsWith('sra')) {
                const signedSrc = isW ? BigInt.asIntN(32, r1Val) : BigInt.asIntN(xlen, r1Val);
                res = signedSrc >> shamt;
            }
            else if (m === 'or') res = r1Val | r2Val;
            else if (m === 'and') res = r1Val & r2Val;

            if (isW) {
                res = signExtendBigInt(res & 0xffffffffn, 32);
            }
            res = (rd === 0 ? 0n : res) & mask;
            wbVal = `0x${res.toString(16)}`;
        }
    } else if (opcode === 0x13 || opcode === 0x1b) {
        fmt = 'I-type';
        const isW = opcode === 0x1b;
        opName = isW ? 'OP-IMM-32' : 'OP-IMM';
        const isShift = funct3 === 1 || funct3 === 5;
        const isWordShift = isW || xlen === 32;
        const upperShift = isWordShift ? funct7 : (u >>> 26);
        const validShiftUpper = funct3 === 1
            ? upperShift === 0
            : (upperShift === 0 || upperShift === (isWordShift ? 0x20 : 0x10));
        const validW = !isW || (xlen === 64 && (funct3 === 0 || funct3 === 1 || funct3 === 5));

        if ((isShift && !validShiftUpper) || !validW) {
            opName = 'RESERVED';
            const shamtMask = isWordShift ? 0x1f : 0x3f;
            immVal = isShift ? (immI & shamtMask) : immI;
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal inst';
            rtl = 'Exception: reserved shift or immediate funct bits';
            ctrl = 'RegWrite=0 · Trap=IllegalInst';
        } else {
            const map = {
                0: 'addi',
                1: 'slli',
                2: 'slti',
                3: 'sltiu',
                4: 'xori',
                5: (funct7 & 0x20) ? 'srai' : 'srli',
                6: 'ori',
                7: 'andi'
            };
            let m = map[funct3] || 'addi';
            if (isW && (m === 'addi' || m === 'slli' || m === 'srli' || m === 'srai')) {
                m += 'w';
            }
            const shamtMask = isWordShift ? 0x1f : 0x3f;
            const dispImm = isShift ? (immI & shamtMask) : immI;
            immVal = dispImm;
            asm = `${m} x${rd}, x${rs1}, ${dispImm}`;
            aluOp = m.replace(/iw$/, 'w').replace(/i$/, '').toUpperCase();

            const opSym = { addi: '+', slli: '<<', slti: '<s', sltiu: '<u', xori: '^', srli: '>>u', srai: '>>s', ori: '|', andi: '&' }[m.replace(/w$/, '')] || '+';
            rtl = isW ? `x${rd} ← sext32((x${rs1} ${opSym} ${dispImm})[31:0])` : `x${rd} ← x${rs1} ${opSym} ${dispImm}`;
            ctrl = 'RegWrite=1 · ALUSrc=Imm · Mem=Off';

            const bigImm = BigInt(dispImm);
            let res = 0n;
            if (m.startsWith('addi')) res = r1Val + bigImm;
            else if (m === 'slti') res = BigInt.asIntN(xlen, r1Val) < bigImm ? 1n : 0n;
            else if (m === 'sltiu') res = BigInt.asUintN(xlen, r1Val) < BigInt.asUintN(xlen, bigImm) ? 1n : 0n;
            else if (m === 'xori') res = r1Val ^ (bigImm & mask);
            else if (m === 'ori') res = r1Val | (bigImm & mask);
            else if (m === 'andi') res = r1Val & (bigImm & mask);
            else if (m.startsWith('slli')) res = (isW ? (r1Val & 0xffffffffn) : r1Val) << bigImm;
            else if (m.startsWith('srli')) res = (isW ? (r1Val & 0xffffffffn) : r1Val) >> bigImm;
            else if (m.startsWith('srai')) {
                const signedSrc = isW ? BigInt.asIntN(32, r1Val) : BigInt.asIntN(xlen, r1Val);
                res = signedSrc >> bigImm;
            }

            if (isW) {
                res = signExtendBigInt(res & 0xffffffffn, 32);
            }
            res = (rd === 0 ? 0n : res) & mask;
            wbVal = `0x${res.toString(16)}`;
        }
    } else if (opcode === 0x03) {
        fmt = 'I-type';
        const lmap = { 0: 'lb', 1: 'lh', 2: 'lw', 3: 'ld', 4: 'lbu', 5: 'lhu', 6: 'lwu' };
        const m = lmap[funct3];
        if (!m || (xlen === 32 && (funct3 === 3 || funct3 === 6))) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal inst';
            rtl = 'Exception: reserved load funct3 encoding';
            ctrl = 'RegWrite=0 · Trap=IllegalInst';
        } else {
            opName = 'LOAD';
            asm = `${m} x${rd}, ${immI}(x${rs1})`;
            aluOp = 'ADDR+';
            const addr = (r1Val + BigInt(immI)) & mask;
            memMode = `Read ${m.toUpperCase()}`;
            memSub = `@0x${addr.toString(16)}`;
            wbVal = `Mem[0x${addr.toString(16)}]`;
            rtl = `x${rd} ← Mem[x${rs1} + ${immI}]`;
            ctrl = 'RegWrite=1 · ALUSrc=Imm · MemRead=1';
            activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-imm', 'wire-rs1-alu', 'wire-imm-alu', 'wire-alu-mem', 'wire-mem-wb'];
            activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-mem', 'node-wb'];
        }
    } else if (opcode === 0x67) {
        fmt = 'I-type';
        if (funct3 !== 0) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal inst';
            rtl = 'Exception: reserved JALR funct3 encoding';
            ctrl = 'RegWrite=0 · Trap=IllegalInst';
        } else {
            opName = 'JALR';
            asm = `jalr x${rd}, ${immI}(x${rs1})`;
            aluOp = 'JUMP+';
            wbText = `x${rd}`;
            wbVal = '0x80000004';
            rtl = `x${rd} ← PC + 4; PC ← (x${rs1} + ${immI}) & ~1`;
            ctrl = 'RegWrite=1 · ALUSrc=Imm · Jump=1';
            activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-imm', 'wire-rs1-alu', 'wire-imm-alu', 'wire-alu-wb'];
            activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-wb'];
        }
    } else if (opcode === 0x23) {
        fmt = 'S-type';
        immVal = immS;
        const smap = { 0: 'sb', 1: 'sh', 2: 'sw', 3: 'sd' };
        const m = smap[funct3];
        if (!m || (xlen === 32 && funct3 === 3)) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal inst';
            rtl = 'Exception: reserved store funct3 encoding';
            ctrl = 'RegWrite=0 · Trap=IllegalInst';
        } else {
            opName = 'STORE';
            asm = `${m} x${rs2}, ${immS}(x${rs1})`;
            aluOp = 'ADDR+';
            const addr = (r1Val + BigInt(immS)) & mask;
            memMode = `Write ${m.toUpperCase()}`;
            memSub = `@0x${addr.toString(16)}`;
            wbText = 'No reg write';
            wbVal = `Mem[0x${addr.toString(16)}]`;
            rtl = `Mem[x${rs1} + ${immS}] ← x${rs2}`;
            ctrl = 'RegWrite=0 · ALUSrc=Imm · MemWrite=1';
            activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-dec-imm', 'wire-rs1-alu', 'wire-imm-alu', 'wire-alu-mem', 'wire-rs2-mem'];
            activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-mem'];
        }
    } else if (opcode === 0x63) {
        fmt = 'B-type';
        immVal = immB;
        const bmap = { 0: 'beq', 1: 'bne', 4: 'blt', 5: 'bge', 6: 'bltu', 7: 'bgeu' };
        const m = bmap[funct3];
        if (!m) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal inst';
            rtl = 'Exception: reserved branch funct3 encoding';
            ctrl = 'RegWrite=0 · Trap=IllegalInst';
        } else {
            opName = 'BRANCH';
            asm = `${m} x${rs1}, x${rs2}, ${immB}`;
            aluOp = 'CMP';
            memMode = 'Branch unit';
            memSub = `PC + ${immB}`;
            wbText = 'Next PC';
            wbVal = `0x${(0x80000000 + immB).toString(16)}`;
            const cmpSym = { beq: '==', bne: '!=', blt: '<s', bge: '>=s', bltu: '<u', bgeu: '>=u' }[m] || '==';
            rtl = `if (x${rs1} ${cmpSym} x${rs2}) PC ← PC + ${immB}`;
            ctrl = 'RegWrite=0 · ALUSrc=rs2 · Branch=1';
            activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-dec-imm', 'wire-rs1-alu', 'wire-rs2-alu', 'wire-alu-mem'];
            activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-mem'];
        }
    } else if (opcode === 0x37 || opcode === 0x17) {
        fmt = 'U-type';
        const isLui = opcode === 0x37;
        opName = isLui ? 'LUI' : 'AUIPC';
        const upper20 = (u >>> 12) & 0xfffff;
        const shiftedHex = `0x${((u & 0xfffff000) >>> 0).toString(16)}`;
        immVal = immU;
        asm = `${isLui ? 'lui' : 'auipc'} x${rd}, 0x${upper20.toString(16)}`;
        aluOp = isLui ? 'PASS IMM' : 'PC+IMM';
        wbVal = isLui ? shiftedHex : `0x${BigInt.asUintN(xlen, 0x80000000n + BigInt(immU)).toString(16)}`;
        rtl = isLui ? `x${rd} ← sext32(0x${upper20.toString(16)} << 12)` : `x${rd} ← PC + sext32(0x${upper20.toString(16)} << 12)`;
        ctrl = 'RegWrite=1 · ALUSrc=ImmU · Mem=Off';
        activeWires = ['wire-pc-dec', 'wire-dec-imm', 'wire-imm-alu', 'wire-alu-wb'];
        activeNodes = ['node-pc', 'node-dec', 'node-imm', 'node-alu', 'node-wb'];
    } else if (opcode === 0x6f) {
        fmt = 'J-type';
        opName = 'JAL';
        immVal = immJ;
        asm = `jal x${rd}, ${immJ}`;
        aluOp = 'PC+IMM';
        wbText = `x${rd}`;
        wbVal = '0x80000004';
        rtl = `x${rd} ← PC + 4; PC ← PC + ${immJ}`;
        ctrl = 'RegWrite=1 · ALUSrc=ImmJ · Jump=1';
        activeWires = ['wire-pc-dec', 'wire-dec-imm', 'wire-imm-alu', 'wire-alu-wb'];
        activeNodes = ['node-pc', 'node-dec', 'node-imm', 'node-alu', 'node-wb'];
    } else {
        fmt = 'Custom/raw';
        opName = `OP 0x${opcode.toString(16)}`;
        asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
        aluOp = 'NOP';
        wbVal = `0x${u.toString(16)}`;
        rtl = 'Unrecognized or custom opcode';
        ctrl = 'RegWrite=0 · Mem=Off';
    }

    return {
        u, opcode, rd, funct3, rs1, rs2, funct7,
        fmt, opName, asm, aluOp, memMode, memSub, wbText, wbVal,
        r1Val, r2Val, immVal, rtl, ctrl, activeWires, activeNodes
    };
}

function getBitFieldType(bit, fmt, u) {
    if (bit <= 6) return 'opcode';
    if (fmt === 'U-type' || fmt === 'J-type') return bit <= 11 ? 'rd' : 'imm';
    if (bit <= 11) return (fmt === 'S-type' || fmt === 'B-type') ? 'imm' : 'rd';
    if (bit <= 14) return 'funct3';
    if (bit <= 19) return 'rs1';
    if (fmt === 'I-type' && u !== undefined) {
        const op = u & 0x7f;
        const f3 = (u >>> 12) & 0x7;
        if ((op === 0x13 || op === 0x1b) && (f3 === 1 || f3 === 5)) {
            const shamtTop = op === 0x1b ? 24 : 25;
            return bit <= shamtTop ? 'imm' : 'funct7';
        }
    }
    if (bit <= 24) return fmt === 'I-type' ? 'imm' : 'rs2';
    return fmt === 'R-type' ? 'funct7' : 'imm';
}

function getFormatFieldSpans(d, xlen) {
    const hexOp = `0x${d.opcode.toString(16).padStart(2, '0')}`;
    const hexF3 = `0x${d.funct3.toString(16)}`;
    const hexF7 = `0x${d.funct7.toString(16).padStart(2, '0')}`;
    const signedImm = `${d.immVal >= 0 ? '+' : ''}${d.immVal}`;

    if (d.fmt === 'R-type') {
        return {
            spans: [
                { span: 7, hi: 31, lo: 25, field: 'funct7', label: 'funct7 [31:25]', val: hexF7 },
                { span: 5, hi: 24, lo: 20, field: 'rs2',    label: 'rs2 [24:20]',    val: `x${d.rs2}` },
                { span: 5, hi: 19, lo: 15, field: 'rs1',    label: 'rs1 [19:15]',    val: `x${d.rs1}` },
                { span: 3, hi: 14, lo: 12, field: 'funct3', label: 'f3 [14:12]',     val: hexF3 },
                { span: 5, hi: 11, lo: 7,  field: 'rd',     label: 'rd [11:7]',      val: `x${d.rd}` },
                { span: 7, hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',   val: hexOp }
            ],
            note: `<strong>R-type (register–register):</strong> <code>funct7</code> and <code>funct3</code> select the ALU operation on <code>rs1 (x${d.rs1})</code> and <code>rs2 (x${d.rs2})</code>, writing to <code>rd (x${d.rd})</code>.`
        };
    }

    if (d.fmt === 'I-type') {
        const isShift = (d.opcode === 0x13 || d.opcode === 0x1b) && (d.funct3 === 1 || d.funct3 === 5);
        if (isShift) {
            const isWordShift = d.opcode === 0x1b || xlen === 32;
            const shamtBits = isWordShift ? 5 : 6;
            const fBits = 12 - shamtBits;
            const shamtHi = 19 + shamtBits;
            const fNum = d.u >>> (20 + shamtBits);
            const fVal = `0x${fNum.toString(16).padStart(2, '0')}`;
            let shiftNote;
            if (d.opName === 'RESERVED') {
                shiftNote = `<strong>Reserved shift encoding:</strong> Upper bits <code>[31:${shamtHi + 1}] = ${fVal}</code> are not valid for <code>funct3 = ${hexF3}</code> (left shifts require <code>0x00</code>; right shifts allow <code>0x00</code> for logical or bit 30 = <code>1</code> for arithmetic).`;
            } else if (d.funct3 === 1) {
                shiftNote = `<strong>I-type (left shift immediate):</strong> Bits <code>[${shamtHi}:20]</code> set <code>shamt = ${d.immVal}</code>. Left shifts are always logical (upper bits <code>[31:${shamtHi + 1}]</code> must be <code>0x00</code>); flip <strong>bit 14</strong> (<code>funct3 = 0x5</code>) for right shifts where <strong>bit 30</strong> selects logical (<code>srli</code>) vs. arithmetic (<code>srai</code>).`;
            } else {
                shiftNote = `<strong>I-type (right shift immediate):</strong> Bits <code>[${shamtHi}:20]</code> set <code>shamt = ${d.immVal}</code>, and <strong>bit 30</strong> selects logical (<code>0 = ${isWordShift ? 'srliw' : 'srli'}</code>) vs. arithmetic (<code>1 = ${isWordShift ? 'sraiw' : 'srai'}</code>) right shift.`;
            }
            return {
                spans: [
                    { span: fBits,     hi: 31,      lo: shamtHi + 1, field: 'funct7', label: `funct [31:${shamtHi + 1}]`, val: fVal },
                    { span: shamtBits, hi: shamtHi, lo: 20,          field: 'imm',    label: `shamt [${shamtHi}:20]`,     val: `${d.immVal}` },
                    { span: 5,         hi: 19,      lo: 15,          field: 'rs1',    label: 'rs1 [19:15]',               val: `x${d.rs1}` },
                    { span: 3,         hi: 14,      lo: 12,          field: 'funct3', label: 'f3 [14:12]',                val: hexF3 },
                    { span: 5,         hi: 11,      lo: 7,           field: 'rd',     label: 'rd [11:7]',                 val: `x${d.rd}` },
                    { span: 7,         hi: 6,       lo: 0,           field: 'opcode', label: 'opcode [6:0]',              val: hexOp }
                ],
                note: shiftNote
            };
        }
        return {
            spans: [
                { span: 12, hi: 31, lo: 20, field: 'imm',    label: 'imm[11:0] [31:20]', val: signedImm },
                { span: 5,  hi: 19, lo: 15, field: 'rs1',    label: 'rs1 [19:15]',       val: `x${d.rs1}` },
                { span: 3,  hi: 14, lo: 12, field: 'funct3', label: 'f3 [14:12]',        val: hexF3 },
                { span: 5,  hi: 11, lo: 7,  field: 'rd',     label: 'rd [11:7]',         val: `x${d.rd}` },
                { span: 7,  hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',      val: hexOp }
            ],
            note: `<strong>I-type (12-bit immediate):</strong> Bits <code>[31:20]</code> form a contiguous 12-bit signed immediate (<code>${signedImm}</code>) combined with <code>rs1 (x${d.rs1})</code> and written to <code>rd (x${d.rd})</code>.`
        };
    }

    if (d.fmt === 'S-type') {
        const hi7 = d.funct7.toString(2).padStart(7, '0');
        const lo5 = d.rd.toString(2).padStart(5, '0');
        return {
            spans: [
                { span: 7, hi: 31, lo: 25, field: 'imm',    label: 'imm[11:5] [31:25]', val: `0b${hi7}` },
                { span: 5, hi: 24, lo: 20, field: 'rs2',    label: 'rs2 (src) [24:20]', val: `x${d.rs2}` },
                { span: 5, hi: 19, lo: 15, field: 'rs1',    label: 'rs1 (base) [19:15]',val: `x${d.rs1}` },
                { span: 3, hi: 14, lo: 12, field: 'funct3', label: 'f3 [14:12]',        val: hexF3 },
                { span: 5, hi: 11, lo: 7,  field: 'imm',    label: 'imm[4:0] [11:7]',   val: `0b${lo5}` },
                { span: 7, hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',      val: hexOp }
            ],
            note: `<strong>S-type split immediate:</strong> Stores have no <code>rd</code> register — bits <code>[11:7]</code> (where <code>rd</code> normally sits) join bits <code>[31:25]</code> to form <code>{imm[11:5], imm[4:0]} = ${signedImm}</code> added to base <code>rs1 (x${d.rs1})</code>.`
        };
    }

    if (d.fmt === 'B-type') {
        const hi7 = d.funct7.toString(2).padStart(7, '0');
        const lo5 = d.rd.toString(2).padStart(5, '0');
        return {
            spans: [
                { span: 7, hi: 31, lo: 25, field: 'imm',    label: 'imm[12|10:5] [31:25]', val: `0b${hi7}` },
                { span: 5, hi: 24, lo: 20, field: 'rs2',    label: 'rs2 [24:20]',          val: `x${d.rs2}` },
                { span: 5, hi: 19, lo: 15, field: 'rs1',    label: 'rs1 [19:15]',          val: `x${d.rs1}` },
                { span: 3, hi: 14, lo: 12, field: 'funct3', label: 'f3 [14:12]',           val: hexF3 },
                { span: 5, hi: 11, lo: 7,  field: 'imm',    label: 'imm[4:1|11] [11:7]',   val: `0b${lo5}` },
                { span: 7, hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',         val: hexOp }
            ],
            note: `<strong>B-type split branch offset:</strong> Branches have no <code>rd</code> — bits <code>[31:25]</code> and bits <code>[11:7]</code> combine (×2) into the 13-bit signed PC offset <code>${signedImm}</code>.`
        };
    }

    if (d.fmt === 'U-type') {
        const upper20 = `0x${((d.u >>> 12) & 0xfffff).toString(16)}`;
        const shifted = `0x${((d.u & 0xfffff000) >>> 0).toString(16)}`;
        return {
            spans: [
                { span: 20, hi: 31, lo: 12, field: 'imm',    label: 'imm[31:12] [31:12]', val: `${upper20} → ${shifted}` },
                { span: 5,  hi: 11, lo: 7,  field: 'rd',     label: 'rd [11:7]',          val: `x${d.rd}` },
                { span: 7,  hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',       val: hexOp }
            ],
            note: `<strong>U-type (20-bit upper immediate):</strong> Bits <code>[31:12]</code> (<code>${upper20}</code>) place <code>${shifted}</code> in the upper 20 bits of 32-bit space and write to <code>rd (x${d.rd})</code>.`
        };
    }

    if (d.fmt === 'J-type') {
        return {
            spans: [
                { span: 20, hi: 31, lo: 12, field: 'imm',    label: 'imm[20|10:1|11|19:12] [31:12]', val: signedImm },
                { span: 5,  hi: 11, lo: 7,  field: 'rd',     label: 'rd [11:7]',                     val: `x${d.rd}` },
                { span: 7,  hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',                  val: hexOp }
            ],
            note: `<strong>J-type (21-bit jump offset):</strong> Bits <code>[31:12]</code> encode the PC-relative jump offset (<code>${signedImm}</code>) while saving return address <code>PC + 4</code> in <code>rd (x${d.rd})</code>.`
        };
    }

    return {
        spans: [
            { span: 25, hi: 31, lo: 7, field: 'imm',    label: 'raw [31:7]',   val: `0x${(d.u >>> 7).toString(16)}` },
            { span: 7,  hi: 6,  lo: 0, field: 'opcode', label: 'opcode [6:0]', val: hexOp }
        ],
        note: `<strong>Custom or unrecognized opcode (${hexOp})</strong>`
    };
}

function setupRiscvExplorer() {
    const chipBtn = document.getElementById('riscv-chip-btn');
    const backBtn = document.getElementById('rv-back-btn');
    const programView = document.getElementById('program-view');
    const explorerView = document.getElementById('riscv-explorer-view');
    const bitstripEl = document.getElementById('rv-bitstrip');
    const legendEl = document.getElementById('rv-field-legend');
    const asmInput = document.getElementById('rv-asm-input');
    const hexBadge = document.getElementById('rv-hex-badge');
    const execBar = document.getElementById('rv-execution-bar');

    if (!chipBtn || !programView || !explorerView || !bitstripEl) return;

    // Build the 32 tactile bit buttons (bit 31 down to bit 0)
    bitstripEl.innerHTML = '';
    bitButtons = [];
    for (let b = 31; b >= 0; b--) {
        const cell = document.createElement('div');
        cell.className = 'rv-bit-cell';

        const idxSpan = document.createElement('span');
        idxSpan.className = 'rv-bit-idx';
        idxSpan.textContent = b;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rv-bit-btn';
        btn.setAttribute('aria-label', `Flip bit ${b}`);
        btn.addEventListener('click', () => {
            currentInst = (currentInst ^ (1 << b)) >>> 0;
            refreshExplorerUI(true);
        });

        cell.appendChild(idxSpan);
        cell.appendChild(btn);
        bitstripEl.appendChild(cell);
        bitButtons[b] = btn;
    }

    function refreshExplorerUI(updateAsmField = false) {
        const d = decodeRiscv(currentInst, rvXlen);

        if (updateAsmField && asmInput) {
            asmInput.value = d.asm;
        }
        if (hexBadge) {
            hexBadge.textContent = `0x${d.u.toString(16).padStart(8, '0')}`;
        }

        const layout = getFormatFieldSpans(d, rvXlen);
        const startBits = new Set(layout.spans.map((s) => s.hi));

        // Update 32 bit buttons
        for (let b = 31; b >= 0; b--) {
            const bitVal = (d.u >>> b) & 1;
            const btn = bitButtons[b];
            const fType = getBitFieldType(b, d.fmt, d.u);
            btn.textContent = bitVal;
            btn.classList.toggle('bit-one', bitVal === 1);
            btn.setAttribute('data-field', fType);
            if (btn.parentElement) {
                btn.parentElement.classList.toggle('field-start', b !== 31 && startBits.has(b));
            }
        }

        // Update Format-Aligned Bit-Field Span Bar & Note
        if (legendEl) {
            const spansHtml = layout.spans.map((s) => `
                <div class="rv-span-box" data-field="${s.field}" style="grid-column: span ${s.span};">
                    <span class="rv-span-name">${s.label}</span>
                    <strong class="rv-span-val">${s.val}</strong>
                </div>
            `).join('');
            legendEl.innerHTML = `
                <div class="rv-span-grid">${spansHtml}</div>
                <div class="rv-format-note">${layout.note}</div>
            `;
        }

        // Update SVG Datapath Nodes & Wires
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };

        setTxt('svg-xlen-tag', `RV${rvXlen}I`);
        setTxt('svg-fmt-val', d.fmt);
        setTxt('svg-op-val', `${d.opName}`);
        setTxt('svg-reg-title', `${rvXlen}-BIT REGS`);
        setTxt('svg-rs1-val', `rs1 (x${d.rs1}): 0x${d.r1Val.toString(16)}`);
        setTxt('svg-rs2-val', `rs2 (x${d.rs2}): 0x${d.r2Val.toString(16)}`);
        const hasRd = d.fmt !== 'S-type' && d.fmt !== 'B-type';
        setTxt('svg-rd-val', hasRd ? `rd: x${d.rd}` : 'rd: — (none)');
        setTxt('svg-imm-title', `IMM SEXT-${rvXlen}`);
        const immDisplay = d.fmt === 'U-type'
            ? `0x${((d.u & 0xfffff000) >>> 0).toString(16)}`
            : `${d.immVal >= 0 ? '+' : ''}${d.immVal}`;
        setTxt('svg-imm-val', immDisplay);
        setTxt('svg-alu-op', d.aluOp);
        setTxt('svg-mem-val', d.memMode);
        setTxt('svg-mem-sub', d.memSub);
        setTxt('svg-wb-reg', d.wbText);
        const wbValEl = document.getElementById('svg-wb-val');
        if (wbValEl) {
            if (d.wbVal.length > 10) {
                const mid = Math.ceil(d.wbVal.length / 2);
                wbValEl.innerHTML = `<tspan x="767" dy="-4">${d.wbVal.slice(0, mid)}</tspan><tspan x="767" dy="11">${d.wbVal.slice(mid)}</tspan>`;
            } else {
                wbValEl.textContent = d.wbVal;
            }
        }

        document.querySelectorAll('#rv-datapath-svg .rv-wire').forEach((w) => {
            const isActive = d.activeWires.includes(w.id);
            w.classList.toggle('active', isActive);
            if (isActive && w.parentNode) {
                w.parentNode.appendChild(w);
            }
        });
        document.querySelectorAll('#rv-datapath-svg .rv-node').forEach((n) => {
            n.classList.toggle('active', d.activeNodes.includes(n.id));
        });

        if (execBar) {
            const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            execBar.innerHTML = `
                <span>Operation: <strong>${esc(d.rtl)}</strong></span>
                <span>Control: <strong>${esc(d.ctrl)}</strong></span>
                <span>Result (${esc(d.wbText)}): <strong>${esc(d.wbVal)}</strong></span>
            `;
        }
    }

    // Toggle between Program View and RISC-V Explorer View
    const floatingPanel = document.getElementById('floating-panel');
    const toggleExplorer = (forceOpen) => {
        const isOpen = !explorerView.hidden;
        const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
        programView.hidden = nextOpen;
        explorerView.hidden = !nextOpen;
        chipBtn.classList.toggle('active', nextOpen);
        if (floatingPanel) {
            floatingPanel.classList.toggle('explorer-open', nextOpen);
        }
        if (nextOpen) {
            refreshExplorerUI(true);
        }
    };

    chipBtn.addEventListener('click', () => toggleExplorer());
    if (backBtn) {
        backBtn.addEventListener('click', () => toggleExplorer(false));
    }

    // RV32I / RV64I Toggle
    document.querySelectorAll('.rv-xlen-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            rvXlen = parseInt(btn.getAttribute('data-xlen'), 10) || 64;
            document.querySelectorAll('.rv-xlen-btn').forEach((b) => b.classList.toggle('active', b === btn));

            // Update memory preset labels between 32-bit (lw/sw) and 64-bit (ld/sd)
            const memPreset = document.getElementById('rv-preset-mem');
            const storePreset = document.getElementById('rv-preset-store');
            const wPreset = document.getElementById('rv-preset-w');
            if (memPreset) {
                memPreset.textContent = rvXlen === 64 ? 'ld' : 'lw';
                memPreset.setAttribute('data-asm', rvXlen === 64 ? 'ld x5, 16(x2)' : 'lw x5, 16(x2)');
            }
            if (storePreset) {
                storePreset.textContent = rvXlen === 64 ? 'sd' : 'sw';
                storePreset.setAttribute('data-asm', rvXlen === 64 ? 'sd x1, 8(x2)' : 'sw x1, 8(x2)');
            }
            if (wPreset) {
                wPreset.style.display = rvXlen === 64 ? 'inline-block' : 'none';
            }

            refreshExplorerUI(true);
        });
    });

    // Preset Pills
    document.querySelectorAll('.rv-preset-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
            const asm = pill.getAttribute('data-asm');
            if (!asm) return;
            const encoded = assembleRiscv(asm);
            if (encoded !== null) {
                currentInst = encoded;
                if (asmInput) asmInput.value = asm;
                refreshExplorerUI(false);
            }
        });
    });

    // Live Assembly Input
    if (asmInput) {
        asmInput.addEventListener('input', () => {
            const encoded = assembleRiscv(asmInput.value);
            if (encoded !== null) {
                currentInst = encoded;
                refreshExplorerUI(false);
            }
        });
    }

    refreshExplorerUI(true);
}

// ============================================================================
// INITIALIZE ALL SYSTEMS
// ============================================================================

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeAndRebuild, 120);
});

if (smallScreenQuery.addEventListener) {
    smallScreenQuery.addEventListener('change', resizeAndRebuild);
}

setupAccordion();
setupLandscapeInteractions();
setupRiscvExplorer();
resizeAndRebuild();
