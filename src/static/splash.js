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
const smallScreenQuery = window.matchMedia('(max-width: 768px)');

let width = 0;
let height = 0;
let rafId = null;
let animStartTime = 0;

// Offscreen buffer canvases for code rain layer & radial transparency mask
let photoCrop = { sx: 0, sy: 0, sw: 0, sh: 0 };
const rainCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const rainCtx = rainCanvas ? rainCanvas.getContext('2d') : null;
const maskCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const maskCtx = maskCanvas ? maskCanvas.getContext('2d') : null;

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
    '// silicon hypervisor ',
    '#diodesign rv64gc ',
    '0x80000000 -> 0x1000 '
];

// Color palette constants (diodesign blues, snowy white, deep navy)
const COLOR_SNOW_WHITE = 'rgba(255, 255, 255, 0.98)';
const COLOR_SNOW_CYAN  = 'rgba(125, 211, 252, 0.92)';
const COLOR_ROCK_AZURE = 'rgba(56, 189, 248, 0.85)';
const COLOR_ROCK_NAVY  = 'rgba(30, 58, 138, 0.75)';

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
    const h = hashInt((tokenIdx * 37) ^ (rowIdx * 1013));
    const idx = Math.floor(h * 16) % 16;
    if (!mtnPix || !mtnPix.isMtn || mtnPix.type === 'sky') return SKY_CHARS[idx];
    if (mtnPix.type === 'alpenglow' || mtnPix.type === 'beacon' || mtnPix.type === 'building_window') return ALPENGLOW_CHARS[idx];
    if (mtnPix.type === 'snow' || mtnPix.type === 'building_roof') return SNOW_CHARS[idx];
    if (mtnPix.type === 'shadow') return SHADOW_CHARS[idx];
    if (mtnPix.type === 'tree') return TREE_CHARS[idx];
    if (mtnPix.fill >= 0.38) return SNOW_CHARS[idx];
    return SLOPE_CHARS[idx];
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
// REALISTIC PROCEDURAL ALPINE MOUNTAIN RANGE SYNTHESIZER
// -------------------------------------------------------------

function hash2(ix, iy) {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) | 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296.0;
}

function smoothHermite(t) {
    return t * t * (3.0 - 2.0 * t);
}

function noise2(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smoothHermite(x - x0), fy = smoothHermite(y - y0);
    const v00 = hash2(x0, y0), v10 = hash2(x0 + 1, y0);
    const v01 = hash2(x0, y0 + 1), v11 = hash2(x0 + 1, y0 + 1);
    const v0 = v00 * (1.0 - fx) + v10 * fx;
    const v1 = v01 * (1.0 - fx) + v11 * fx;
    return v0 * (1.0 - fy) + v1 * fy;
}

function ridged2(x, y, octaves = 5) {
    let val = 0.0, amp = 1.0, freq = 1.0, weight = 1.0, tot = 0.0;
    for (let o = 0; o < octaves; o++) {
        const n = (noise2(x * freq, y * freq) - 0.5) * 2.0;
        let sig = 1.0 - Math.abs(n);
        sig = sig * sig * weight;
        weight = Math.min(1.0, Math.max(0.0, sig * 1.85));
        val += sig * amp;
        tot += amp;
        freq *= 2.05;
        amp *= 0.50;
    }
    return val / tot;
}

function fbm2(x, y, octaves = 4) {
    let val = 0.0, amp = 1.0, freq = 1.0, tot = 0.0;
    for (let o = 0; o < octaves; o++) {
        val += noise2(x * freq, y * freq) * amp;
        tot += amp;
        freq *= 2.0;
        amp *= 0.5;
    }
    return val / tot;
}

function buildMountainGrid(nRows, nCols) {
    // 1. Precalculate 3 realistic terrain crest profiles
    const crest_bg = new Array(nCols);
    const crest_mid = new Array(nCols);
    const crest_hills = new Array(nCols);

    for (let c = 0; c < nCols; c++) {
        const xn = c / nCols;

        // Layer 1: High Alpine Horns (peaks at x ~ 0.18, 0.48, 0.80)
        const p1 = Math.exp(-Math.pow((xn - 0.18) * 4.2, 2.0)) * 0.28;
        const p2 = Math.exp(-Math.pow((xn - 0.80) * 3.8, 2.0)) * 0.32;
        const p3 = Math.exp(-Math.pow((xn - 0.48) * 5.0, 2.0)) * 0.16;
        const r1 = ridged2(xn * 8.5 + 1.2, 3.4, 5) * 0.16;
        crest_bg[c] = 0.40 - (p1 + p2 + p3 + r1);

        // Layer 2: Midground Massif & Cirques (peaks at x ~ 0.08, 0.36, 0.64, 0.94)
        const m1 = Math.exp(-Math.pow((xn - 0.08) * 4.0, 2.0)) * 0.20;
        const m2 = Math.exp(-Math.pow((xn - 0.36) * 4.5, 2.0)) * 0.22;
        const m3 = Math.exp(-Math.pow((xn - 0.64) * 4.2, 2.0)) * 0.24;
        const m4 = Math.exp(-Math.pow((xn - 0.94) * 4.0, 2.0)) * 0.20;
        const r2 = ridged2(xn * 9.2 + 8.7, 7.8, 4) * 0.12;
        crest_mid[c] = 0.56 - (m1 + m2 + m3 + m4 + r2);

        // Layer 3: Rolling Green Foothills & Alpine Meadows
        const h_wave = Math.sin(xn * Math.PI * 3.5 + 0.5) * 0.06 + Math.cos(xn * Math.PI * 5.2) * 0.04;
        const h_fbm = fbm2(xn * 12.0 + 3.4, 8.2, 3) * 0.06;
        crest_hills[c] = 0.65 + h_wave + h_fbm;
    }

    // 2. Alpine Buildings / Outposts with Warm Glowing Soft Yellow Windows
    // Left Chalet on hillside (x ~ 0.09 to 0.16)
    // Right Research Lab on meadow (x ~ 0.81 to 0.89)
    const bldg1_c1 = Math.round(0.09 * nCols);
    const bldg1_c2 = bldg1_c1 + Math.max(12, Math.round(nCols * 0.055));
    const bldg1_r_top = Math.round(0.65 * nRows);
    const bldg1_r_base = Math.round(0.74 * nRows);

    const bldg2_c1 = Math.round(0.81 * nCols);
    const bldg2_c2 = bldg2_c1 + Math.max(14, Math.round(nCols * 0.065));
    const bldg2_r_top = Math.round(0.67 * nRows);
    const bldg2_r_base = Math.round(0.76 * nRows);

    const buildings = [
        {
            c1: bldg1_c1,
            c2: bldg1_c2,
            rTop: bldg1_r_top,
            rBase: bldg1_r_base,
            windows: [
                {
                    c1: bldg1_c1 + Math.round((bldg1_c2 - bldg1_c1) * 0.18),
                    c2: bldg1_c1 + Math.round((bldg1_c2 - bldg1_c1) * 0.42),
                    r1: bldg1_r_top + 2,
                    r2: bldg1_r_base - 2
                },
                {
                    c1: bldg1_c1 + Math.round((bldg1_c2 - bldg1_c1) * 0.58),
                    c2: bldg1_c1 + Math.round((bldg1_c2 - bldg1_c1) * 0.82),
                    r1: bldg1_r_top + 2,
                    r2: bldg1_r_base - 2
                }
            ]
        },
        {
            c1: bldg2_c1,
            c2: bldg2_c2,
            rTop: bldg2_r_top,
            rBase: bldg2_r_base,
            windows: [
                {
                    c1: bldg2_c1 + Math.round((bldg2_c2 - bldg2_c1) * 0.16),
                    c2: bldg2_c1 + Math.round((bldg2_c2 - bldg2_c1) * 0.42),
                    r1: bldg2_r_top + 2,
                    r2: bldg2_r_base - 2
                },
                {
                    c1: bldg2_c1 + Math.round((bldg2_c2 - bldg2_c1) * 0.58),
                    c2: bldg2_c1 + Math.round((bldg2_c2 - bldg2_c1) * 0.84),
                    r1: bldg2_r_top + 2,
                    r2: bldg2_r_base - 2
                }
            ]
        }
    ];

    // 3. Conifer Pine Trees scattered across the rolling hills and valleys
    const treeSpecs = [
        // Left flank grove
        { x: 0.04, y: 0.70, h: 9, w: 5 },
        { x: 0.07, y: 0.73, h: 11, w: 6 },
        { x: 0.10, y: 0.71, h: 8, w: 5 },
        { x: 0.18, y: 0.76, h: 10, w: 6 },
        { x: 0.21, y: 0.73, h: 8, w: 5 },
        { x: 0.24, y: 0.79, h: 12, w: 7 },
        // Lower center-left
        { x: 0.31, y: 0.81, h: 9, w: 5 },
        { x: 0.35, y: 0.84, h: 11, w: 6 },
        { x: 0.39, y: 0.82, h: 8, w: 5 },
        // Lower center-right
        { x: 0.61, y: 0.82, h: 10, w: 6 },
        { x: 0.65, y: 0.80, h: 8, w: 5 },
        { x: 0.69, y: 0.84, h: 12, w: 7 },
        // Right flank grove framing outpost
        { x: 0.77, y: 0.74, h: 9, w: 5 },
        { x: 0.80, y: 0.76, h: 11, w: 6 },
        { x: 0.91, y: 0.75, h: 10, w: 6 },
        { x: 0.94, y: 0.78, h: 12, w: 7 },
        { x: 0.97, y: 0.72, h: 8, w: 5 }
    ];

    const trees = treeSpecs.map(t => {
        const col = Math.round(t.x * nCols);
        const hillBase = Math.round(crest_hills[col % nCols] * nRows) + 2;
        const baseRow = Math.max(hillBase, Math.round(t.y * nRows));
        return {
            col,
            baseRow,
            topRow: baseRow - Math.round(t.h * (nRows / 100)),
            halfW: (t.w * (nCols / 300)) * 0.5
        };
    });

    // Sun vector: low alpine sun from upper-left (NW)
    const lx = -0.65, ly = -0.40, lz = 0.65;
    const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

    // 4. Synthesize 2D Grid
    const grid = new Array(nRows);
    for (let r = 0; r < nRows; r++) {
        const yn = r / nRows;
        const row = new Array(nCols);
        for (let c = 0; c < nCols; c++) {
            const xn = c / nCols;

            // A. Check Building
            let inBldg = false;
            let bldgCell = null;
            for (let i = 0; i < buildings.length; i++) {
                const b = buildings[i];
                if (c >= b.c1 && c <= b.c2 && r >= b.rTop && r <= b.rBase) {
                    inBldg = true;
                    // Pitched snow roof (top 2 rows)
                    if (r <= b.rTop + 1) {
                        bldgCell = {
                            fill: 1.0, lum: 0.95, isMtn: true, type: 'building_roof',
                            color: 'rgb(246,250,255)'
                        };
                    } else {
                        // Check Windows
                        let isWin = false;
                        for (let j = 0; j < b.windows.length; j++) {
                            const w = b.windows[j];
                            if (c >= w.c1 && c <= w.c2 && r >= w.r1 && r <= w.r2) {
                                isWin = true; break;
                            }
                        }
                        if (isWin) {
                            // Warm glowing soft yellow window
                            bldgCell = {
                                fill: 1.0, lum: 1.0, isMtn: true, type: 'building_window',
                                color: 'rgb(254,240,138)'
                            };
                        } else {
                            // Dark timber chalet wall
                            bldgCell = {
                                fill: 0.45, lum: 0.35, isMtn: true, type: 'building_wall',
                                color: 'rgb(30,41,59)'
                            };
                        }
                    }
                    break;
                }
            }
            if (inBldg) {
                row[c] = bldgCell;
                continue;
            }

            // B. Check Pine Trees
            let inTree = false;
            let treeCell = null;
            for (let i = 0; i < trees.length; i++) {
                const tr = trees[i];
                if (r >= tr.topRow && r <= tr.baseRow) {
                    const prog = (r - tr.topRow) / Math.max(1, tr.baseRow - tr.topRow);
                    const curW = prog * tr.halfW;
                    if (Math.abs(c - tr.col) <= curW) {
                        inTree = true;
                        // Trunk at bottom center
                        if (r >= tr.baseRow - 1 && Math.abs(c - tr.col) <= 0.7) {
                            treeCell = {
                                fill: 0.40, lum: 0.35, isMtn: true, type: 'tree',
                                color: 'rgb(66,45,30)' // Timber bark
                            };
                        } else {
                            // Conifer pine needles: sunlit emerald on left, deep spruce on right
                            const isLit = (c <= tr.col);
                            const shade = hash2(c, r);
                            let tr_r, tr_g, tr_b;
                            if (isLit) {
                                tr_r = Math.round(28 + shade * 16);
                                tr_g = Math.round(135 + shade * 45);
                                tr_b = Math.round(62 + shade * 24);
                            } else {
                                tr_r = Math.round(16 + shade * 12);
                                tr_g = Math.round(80 + shade * 30);
                                tr_b = Math.round(42 + shade * 18);
                            }
                            tr_r = Math.round(tr_r / 6) * 6;
                            tr_g = Math.round(tr_g / 6) * 6;
                            tr_b = Math.round(tr_b / 6) * 6;
                            treeCell = {
                                fill: 0.65, lum: 0.60, isMtn: true, type: 'tree',
                                color: 'rgb(' + tr_r + ',' + tr_g + ',' + tr_b + ')'
                            };
                        }
                        break;
                    }
                }
            }
            if (inTree) {
                row[c] = treeCell;
                continue;
            }

            // C. Terrain Layers:
            // Layer 3: Rolling Green Hills & Alpine Meadows (yn >= crest_hills)
            // Layer 2: Midground Massif (yn >= crest_mid)
            // Layer 1: High Alps Horns (yn >= crest_bg)
            // Layer 0: Sky
            let layer = 0;
            let crest_y = 1.0;
            if (yn >= crest_hills[c]) {
                layer = 3; crest_y = crest_hills[c];
            } else if (yn >= crest_mid[c]) {
                layer = 2; crest_y = crest_mid[c];
            } else if (yn >= crest_bg[c]) {
                layer = 1; crest_y = crest_bg[c];
            }

            if (layer === 0) {
                // Sky pixel: continuous atmospheric nocturnal matrix
                row[c] = {
                    fill: 0.0,
                    lum: 0.20,
                    isMtn: false,
                    type: 'sky',
                    color: null // Evaluated dynamically via getSkyColor(yn, tokenIdx, r)
                };
                continue;
            }

            const depth = yn - crest_y;

            if (layer === 3) {
                // ROLLING GREEN HILLS & MEADOWS
                const c_next = (c + 1) % nCols;
                const c_prev = (c - 1 + nCols) % nCols;
                const h_slope = (crest_hills[c_next] - crest_hills[c_prev]) * nCols * 0.5;
                let nx = -h_slope * 0.25 + (noise2(xn * 40.0, yn * 25.0) - 0.5) * 0.35;
                let ny = 0.70 + (noise2(xn * 20.0, yn * 40.0) - 0.5) * 0.25;
                let nz = 0.70;
                const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
                nx /= nLen; ny /= nLen; nz /= nLen;

                const diff = Math.max(0.0, nx * nlx + ny * nly + nz * nlz);
                const light = 0.25 + 0.75 * diff;

                // Alpine grass: sunlit slopes are fresh moss / warm golden grass, hollows are deep pine green
                let g_r = light * (22 + 40 * light);
                let g_g = light * (100 + 75 * light);
                let g_b = light * (42 + 25 * light);

                // Lantern glow spill from cabin windows onto surrounding meadow
                let maxGlow = 0;
                for (let i = 0; i < buildings.length; i++) {
                    const b = buildings[i];
                    for (let j = 0; j < b.windows.length; j++) {
                        const w = b.windows[j];
                        const dw = Math.hypot((c - (w.c1 + w.c2) * 0.5) / 5.5, (r - (w.r1 + w.r2) * 0.5) / 3.0);
                        if (dw < 6.5) {
                            const glow = Math.max(0.0, 1.0 - dw / 6.5) * 0.75;
                            if (glow > maxGlow) maxGlow = glow;
                        }
                    }
                }
                if (maxGlow > 0) {
                    g_r = g_r * (1.0 - maxGlow) + 254 * maxGlow;
                    g_g = g_g * (1.0 - maxGlow) + 230 * maxGlow;
                    g_b = g_b * (1.0 - maxGlow) + 90 * maxGlow;
                } else {
                    // Occasional soft golden alpine wildflower
                    const flowerH = hash2(c * 17, r * 31);
                    if (flowerH < 0.05 && light > 0.45) {
                        g_r = 250; g_g = 204; g_b = 21;
                    }
                }

                const qr = Math.min(255, Math.max(0, Math.round(g_r / 6) * 6));
                const qg = Math.min(255, Math.max(0, Math.round(g_g / 6) * 6));
                const qb = Math.min(255, Math.max(0, Math.round(g_b / 6) * 6));

                row[c] = {
                    fill: Math.max(0.0, Math.min(1.0, 0.40 + light * 0.35)),
                    lum: light,
                    isMtn: true,
                    type: 'meadow',
                    color: 'rgb(' + qr + ',' + qg + ',' + qb + ')'
                };
            } else {
                // ALPINE MOUNTAINS (Alps Horns & Massif)
                const slant = layer === 1 ? 1.3 : 1.6;
                const rib = ridged2(xn * 18.0 + depth * slant, yn * 10.0 + layer * 7.0, 4);
                const couloir = noise2(xn * 35.0, yn * 20.0);
                const strata = fbm2(xn * 15.0, yn * 18.0, 3);

                const c_next = (c + 1) % nCols;
                const c_prev = (c - 1 + nCols) % nCols;
                const cur_crest = (layer === 2) ? crest_mid : crest_bg;
                const crest_slope = (cur_crest[c_next] - cur_crest[c_prev]) * nCols * 0.5;

                let nx = -crest_slope * 0.16 + (rib - 0.5) * 0.70 + (couloir - 0.5) * 0.25;
                let ny = 0.55 + (strata - 0.5) * 0.35;
                let nz = 0.85 + (1.0 - Math.min(1.0, depth * 2.5)) * 0.35;

                const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
                nx /= nLen; ny /= nLen; nz /= nLen;

                const diff = Math.max(0.0, nx * nlx + ny * nly + nz * nlz);
                const light = 0.18 + 0.82 * diff;

                const alt_factor = Math.max(0.0, 1.0 - yn * 1.6);
                const crest_factor = Math.max(0.0, 1.0 - depth * (layer === 1 ? 3.5 : 4.8));
                const shelf_factor = Math.max(0.0, (ny - 0.35) / 0.5);
                const gully_snow = Math.max(0.0, (couloir - 0.50) * 1.5);

                let snow_amt = crest_factor * 0.65 + alt_factor * 0.20 + shelf_factor * 0.15 + gully_snow * 0.15;
                if (Math.abs(nx) > 0.80) {
                    snow_amt *= 0.30;
                }
                snow_amt = Math.max(0.0, Math.min(1.0, snow_amt));

                const haze = layer === 1 ? 0.28 : 0.12;

                const snow_r = 160 + 95 * light;
                const snow_g = 210 + 45 * light;
                const snow_b = 255;

                const rock_r = 12 + 44 * light;
                const rock_g = 28 + 155 * light;
                const rock_b = 75 + 170 * light;

                let r_col = rock_r * (1.0 - snow_amt) + snow_r * snow_amt;
                let g_col = rock_g * (1.0 - snow_amt) + snow_g * snow_amt;
                let b_col = rock_b * (1.0 - snow_amt) + snow_b * snow_amt;

                r_col = r_col * (1.0 - haze) + 16 * haze;
                g_col = g_col * (1.0 - haze) + 48 * haze;
                b_col = b_col * (1.0 - haze) + 125 * haze;

                const qr = Math.min(255, Math.max(0, Math.round(r_col / 6) * 6));
                const qg = Math.min(255, Math.max(0, Math.round(g_col / 6) * 6));
                const qb = Math.min(255, Math.max(0, Math.round(b_col / 6) * 6));

                row[c] = {
                    fill: Math.max(0.0, Math.min(1.0, snow_amt * 0.72 + light * 0.28)),
                    lum: light,
                    isMtn: true,
                    type: 'mountain',
                    color: 'rgb(' + qr + ',' + qg + ',' + qb + ')'
                };
            }
        }
        grid[r] = row;
    }
    return grid;
}

// -------------------------------------------------------------
// IMAGE-DRIVEN PHOTOREALISTIC REFERENCE MODEL WITH PROCEDURAL FALLBACK
// -------------------------------------------------------------

const COASTAL_IMAGE_SRC = '/coastal-reference.webp';
const ALPINE_IMAGE_SRC = '/alpine-reference.webp';
let alpineImage = null;
let alpineImageLoaded = false;

function getAlpineImage() {
    const el = document.getElementById('alpine-reference-img');
    if (el && el.complete && el.naturalWidth > 0) return el;
    if (alpineImage && alpineImage.complete && alpineImage.naturalWidth > 0) return alpineImage;
    return null;
}

function loadAlpineImage() {
    if (typeof Image === 'undefined') return;
    alpineImage = new Image();
    alpineImage.onload = () => {
        alpineImageLoaded = true;
        if (numRows > 0 && numCols > 0) {
            mountainGrid = buildGridFromImage(alpineImage, numRows, numCols);
        }
    };
    alpineImage.onerror = () => {
        alpineImageLoaded = false;
    };
    alpineImage.src = ALPINE_IMAGE_SRC;
}
loadAlpineImage();

window.addEventListener('load', () => {
    const imgEl = getAlpineImage();
    if (imgEl && numRows > 0 && numCols > 0) {
        mountainGrid = buildGridFromImage(imgEl, numRows, numCols);
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
                    color: null // Evaluated dynamically via getSkyColor(yn, c, r)
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
            let fill = lum;

            if (isAlpenglow) {
                type = 'alpenglow';
                fill = 1.0;
                // Brilliant golden alpenglow amber
                qr = 254;
                qg = 222;
                qb = Math.min(95, qb);
            } else if (lum >= 0.32) {
                type = 'snow'; // Pristine glacial snowfields and cirques
                fill = Math.min(1.0, lum * 1.35);
                // Boost snow brightness & glacial ice-blue tint
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
                fill = 0.55;
                qr = Math.round(red * 0.75);
                qg = Math.min(255, Math.round(green * 1.25 + 10));
                qb = Math.round(blue * 0.75);
            } else if (lum < 0.14) {
                type = 'shadow'; // Deep rock crevices & couloir shadows (negative space)
                fill = 0.10;
                qr = Math.max(16, qr);
                qg = Math.max(26, qg);
                qb = Math.max(48, qb);
            } else {
                type = 'mountain'; // Craggy slate rock faces
                fill = Math.max(0.20, lum);
                qr = Math.max(28, qr);
                qg = Math.max(44, qg);
                qb = Math.max(78, qb);
            }

            row[c] = {
                fill,
                lum,
                isMtn: true,
                type,
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

    // Large graduated radial apertures positioned over scenic alpine features:
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

    const rightX = photoCrop.sw > 0
        ? ((1050 - photoCrop.sx) / photoCrop.sw) * width
        : width * 0.84;
    const rightY = photoCrop.sh > 0
        ? ((420 - photoCrop.sy) / photoCrop.sh) * height
        : height * 0.56;

    const circles = [
        // Summit Horn & Ridge (Centerpiece)
        { x: summitX, y: summitY, r: minDim * 0.48, maxA: 0.98 },
        // Left Ridge & Flank
        { x: leftX, y: leftY, r: minDim * 0.40, maxA: 0.90 },
        // Right Flank & Glacier Cirque
        { x: rightX, y: rightY, r: minDim * 0.42, maxA: 0.92 },
        // Atmospheric Sky Matrix
        { x: width * 0.50, y: height * 0.10, r: minDim * 0.38, maxA: 0.85 }
    ];

    for (const c of circles) {
        const grad = maskCtx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        grad.addColorStop(0.00, `rgba(255, 255, 255, ${c.maxA})`);
        grad.addColorStop(0.35, `rgba(255, 255, 255, ${c.maxA * 0.85})`);
        grad.addColorStop(0.68, `rgba(255, 255, 255, ${c.maxA * 0.40})`);
        grad.addColorStop(0.88, `rgba(255, 255, 255, ${c.maxA * 0.12})`);
        grad.addColorStop(1.00, 'rgba(255, 255, 255, 0.0)');

        maskCtx.fillStyle = grad;
        maskCtx.beginPath();
        maskCtx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        maskCtx.fill();
    }
}

// -------------------------------------------------------------
// FRAME RENDERING
// -------------------------------------------------------------
function renderFrame(time) {
    if (!ctx || width === 0 || height === 0 || !mountainGrid) return;
    if (smallScreenQuery.matches) return;

    if (!animStartTime) animStartTime = time;
    const elapsed = (time - animStartTime) / 1000;

    // 1. Render reference photograph behind the code rain (exact 1:1 scale & crop)
    const imgEl = getAlpineImage();
    if (imgEl && photoCrop.sw > 0) {
        ctx.drawImage(imgEl, photoCrop.sx, photoCrop.sy, photoCrop.sw, photoCrop.sh, 0, 0, width, height);
        // Atmospheric twilight grading over photo so colors harmonize with diodesign palette
        ctx.fillStyle = 'rgba(2, 6, 23, 0.32)';
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
    }

    // If offscreen buffers aren't available, draw directly to main context
    const targetCtx = rainCtx || ctx;
    if (rainCtx) {
        rainCtx.clearRect(0, 0, width, height);
        // Dark nocturnal matrix backing inside the code rain layer
        rainCtx.fillStyle = 'rgba(0, 0, 0, 0.86)';
        rainCtx.fillRect(0, 0, width, height);
    }

    targetCtx.font = fontSize + 'px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    targetCtx.textBaseline = 'top';

    for (let r = 0; r < numRows; r++) {
        const row = streamRows[r];
        if (elapsed < row.startDelay) continue; // Line hasn't started appearing yet

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

        const rowY = row.y; // Whole integer scanline

        // Visible character index range
        const minI = Math.floor((-charWidth - offset) / charWidth);
        const maxI = Math.ceil((width + charWidth - offset) / charWidth);

        for (let i = minI; i <= maxI; i++) {
            const screenX = i * charWidth + offset;
            if (screenX < headMinX || screenX > headMaxX) continue;

            const tokenIdx = i;

            // Sample 2D Mountain Pixel Array at current physical screen column
            // Co-registered with normalized screen width (screenX / width) to ensure
            // 1:1 spatial lockstep with the underlying reference photograph
            const normX = (screenX + charWidth * 0.5) / width;
            const col = Math.floor(normX * numCols);
            const wrappedCol = ((col % numCols) + numCols) % numCols;
            const mtnPix = mountainGrid[r][wrappedCol];

            // Target color: mountain color if in mountain, otherwise atmospheric nocturnal sky color
            const targetColor = mtnPix.isMtn
                ? mtnPix.color
                : getSkyColor(r / numRows, wrappedCol, r);

            let charToDraw = ' ';
            let charColor = targetColor;

            if (row.isInstLine) {
                // RISC-V Instruction Line (strictly reads forward left-to-right)
                const charIdx = ((tokenIdx % row.charStream.length) + row.charStream.length) % row.charStream.length;
                const instChar = row.charStream[charIdx];
                if (instChar === ' ') continue;

                if (lineReveal < 1.0) {
                    // Initial random matrix phase
                    const noiseIdx = ((tokenIdx % row.noiseColors.length) + row.noiseColors.length) % row.noiseColors.length;
                    charColor = (lineReveal > 0.5) ? targetColor : row.noiseColors[noiseIdx];
                    charToDraw = instChar;
                } else {
                    // Fully formed: instructions flow through sky and mountain, illuminated by contours
                    charColor = targetColor;
                    charToDraw = instChar;
                }
            } else {
                // Binary Matrix Lines: diverse character selection
                const finalGlyph = pickGlyph(tokenIdx, r, mtnPix);

                if (lineReveal < 1.0) {
                    // Initial random binary phase
                    const noiseIdx = ((tokenIdx % row.noiseColors.length) + row.noiseColors.length) % row.noiseColors.length;
                    const bitMod = ((tokenIdx % 2) + 2) % 2;
                    charToDraw = bitMod === 0 ? '1' : '0';
                    charColor = row.noiseColors[noiseIdx];

                    // Deterministic progressive crystallization into mountain/sky
                    const revealThresh = hashInt((tokenIdx * 43) ^ (r * 1013));
                    if (revealThresh < lineReveal) {
                        charToDraw = finalGlyph;
                        charColor = targetColor;
                    }
                } else {
                    // Fully formed atmospheric snowy mountain & digital sky
                    charToDraw = finalGlyph;
                    charColor = targetColor;
                }
            }

            if (charToDraw === ' ') continue;

            // Render each character cell at its exact integer physical pixel coordinate
            // Completely eliminates string seam jitter, character collisions, and brightness oscillation
            targetCtx.fillStyle = charColor;
            targetCtx.fillText(charToDraw, screenX, rowY);
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
// RESIZE, LIFECYCLE & NO-OP INTERACTION HANDLER
// -------------------------------------------------------------
function setupLandscapeInteractions() {
    // Autonomous background animation with central floating panel:
    // No background drag or mouse steering, background is non-interactive.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        } else {
            if (!rafId && !smallScreenQuery.matches) {
                rafId = requestAnimationFrame(animate);
            }
        }
    });
}

function animate(time) {
    if (smallScreenQuery.matches) {
        rafId = null;
        return;
    }

    if (document.visibilityState === 'visible') {
        renderFrame(time);
    }

    rafId = requestAnimationFrame(animate);
}

function resizeAndRebuild() {
    if (!canvas) return;

    if (smallScreenQuery.matches) {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
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
    numRows = Math.max(70, Math.min(130, Math.round(height / 11)));
    lineHeight = Math.max(10, Math.round(height / numRows));
    fontSize = Math.max(9, Math.min(13, Math.round(lineHeight * 0.90)));

    // Exact integer monospace character cell width
    if (ctx) {
        ctx.font = fontSize + 'px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        charWidth = Math.max(6, Math.ceil(ctx.measureText('0').width));
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

    // Rebuild radial transparency mask once photoCrop coordinates are locked
    if (maskCanvas) {
        buildMaskCanvas();
    }

    // Initialize horizontal stream rows
    initStreamRows();

    if (!rafId) {
        rafId = requestAnimationFrame(animate);
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
