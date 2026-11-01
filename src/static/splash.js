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

        trigger.addEventListener('click', () => {
            const isCurrentlyOpen = item.classList.contains('active');

            // Close all sections so at most one is ever expanded at a time
            items.forEach((otherItem) => {
                otherItem.classList.remove('active');
                const otherTrigger = otherItem.querySelector('.accordion-trigger');
                if (otherTrigger) {
                    otherTrigger.setAttribute('aria-expanded', 'false');
                }
            });

            // Toggle the clicked section open if it wasn't already open
            if (!isCurrentlyOpen) {
                item.classList.add('active');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

// ============================================================================
// 2. SCENIC PROCEDURAL LANDSCAPE ENGINE (DESKTOP / TABLET ONLY)
// ============================================================================

const canvas = document.getElementById('splash-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const smallScreenQuery = window.matchMedia('(max-width: 768px)');

let width = 0;
let height = 0;
let rafId = null;
let lastFrameTime = 0;
const FRAME_INTERVAL = 1000 / 24; // Gentle 24 FPS for low CPU/GPU usage

// Offscreen static buffer for the complex multi-faceted mountain ranges & sky
const terrainCanvas = document.createElement('canvas');
const tCtx = terrainCanvas.getContext('2d');

// Deterministic PRNG & 1D/2D Value Noise for organic procedural generation
let seed = 4219;
function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
}

const PERM = new Uint8Array(512);
function initNoise(initialSeed = 1337) {
    seed = initialSeed;
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = p[i];
        p[i] = p[j];
        p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
    return a + t * (b - a);
}

function noise1D(x) {
    const xi = Math.floor(x) & 255;
    const xf = x - Math.floor(x);
    const u = fade(xf);
    const a = PERM[xi] / 255;
    const b = PERM[xi + 1] / 255;
    return lerp(a, b, u) * 2 - 1;
}

// Ridged multifractal 1D noise for crisp alpine peaks
function ridgedFBM(x, octaves = 5, lacunarity = 2.05, gain = 0.52) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1.0;
    let prev = 1.0;
    for (let i = 0; i < octaves; i++) {
        let n = Math.abs(noise1D(x * freq + i * 37.3));
        n = 1.0 - n;
        n = n * n;
        sum += n * amp * prev;
        prev = n;
        freq *= lacunarity;
        amp *= gain;
    }
    return sum;
}

// Smooth FBM for rolling foothills, mist, and clouds
function smoothFBM(x, octaves = 4) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1.0;
    for (let i = 0; i < octaves; i++) {
        sum += (noise1D(x * freq + i * 91.7) * 0.5 + 0.5) * amp;
        freq *= 2.02;
        amp *= 0.5;
    }
    return sum;
}

// Dynamic animated elements (clouds, mist banks, water ripples, soaring birds)
let clouds = [];
let mistBands = [];
let birds = [];
let waterLineY = 0;
let sunX = 0;
let sunY = 0;

function createCloudSprite(w, h, alpha) {
    const pad = 44;
    const sw = Math.ceil(w + pad * 2);
    const sh = Math.ceil(h + pad * 2);
    const sCanvas = document.createElement('canvas');
    sCanvas.width = sw;
    sCanvas.height = sh;
    const sCtx = sCanvas.getContext('2d');

    const cx = sw * 0.5;
    const cy = sh * 0.5;
    const puffCount = 12;

    for (let k = 0; k < puffCount; k++) {
        const t = (k / (puffCount - 1)) * 2 - 1; // -1 to 1 across cloud width
        const env = 1 - t * t * 0.65;
        const ox = t * w * 0.36 + (Math.random() - 0.5) * w * 0.12;
        const oy = (Math.random() - 0.5) * h * 0.38 * env;
        const rx = (w * (0.18 + Math.random() * 0.16)) * (0.65 + env * 0.45);
        const ry = (h * (0.38 + Math.random() * 0.32)) * (0.65 + env * 0.45);

        sCtx.save();
        sCtx.translate(cx + ox, cy + oy);
        sCtx.scale(rx, ry);

        const puffAlpha = alpha * (0.22 + Math.random() * 0.18) * env;
        const grad = sCtx.createRadialGradient(0, -0.1, 0.05, 0, 0, 1.0);
        grad.addColorStop(0.0, `rgba(255, 255, 255, ${puffAlpha})`);
        grad.addColorStop(0.45, `rgba(248, 252, 255, ${puffAlpha * 0.65})`);
        grad.addColorStop(0.78, `rgba(240, 249, 255, ${puffAlpha * 0.22})`);
        grad.addColorStop(1.0, 'rgba(240, 249, 255, 0)');

        sCtx.fillStyle = grad;
        sCtx.beginPath();
        sCtx.arc(0, 0, 1.0, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.restore();
    }

    return { sprite: sCanvas, sw, sh };
}

function initAnimatedElements() {
    clouds = [];
    const cloudCount = 10;
    for (let i = 0; i < cloudCount; i++) {
        const w = 240 + Math.random() * 340;
        const h = 38 + Math.random() * 52;
        const alpha = 0.42 + Math.random() * 0.32;
        const { sprite, sw, sh } = createCloudSprite(w, h, alpha);

        clouds.push({
            x: Math.random() * width,
            y: height * (0.05 + Math.random() * 0.30),
            w,
            h,
            sw,
            sh,
            sprite,
            speed: 0.06 + Math.random() * 0.12
        });
    }

    mistBands = [
        { yRatio: 0.52, amp: 14, speed: 0.00035, phase: 0.4, alpha: 0.32 },
        { yRatio: 0.63, amp: 18, speed: -0.00028, phase: 1.9, alpha: 0.38 },
        { yRatio: 0.74, amp: 12, speed: 0.00022, phase: 3.7, alpha: 0.28 }
    ];

    birds = Array.from({ length: 6 }, (_, i) => ({
        x: width * (0.12 + i * 0.03 + Math.random() * 0.15),
        y: height * (0.18 + Math.random() * 0.14),
        vx: 0.22 + Math.random() * 0.12,
        vy: (Math.random() - 0.5) * 0.04,
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: 0.09 + Math.random() * 0.04,
        scale: 3.2 + Math.random() * 2.2
    }));
}

function drawFacetedMountainLayer(cfg) {
    const {
        baseY,
        amplitude,
        freq,
        seedOffset,
        ridged,
        sunlitColor,
        shadowColor,
        ridgeHighlight,
        fogColor,
        fogAlpha,
        trees
    } = cfg;

    const step = 14;
    const cols = Math.ceil(width / step) + 2;
    const ridgeY = new Float32Array(cols);

    for (let i = 0; i < cols; i++) {
        const x = i * step;
        const nx = x * freq + seedOffset;
        const hVal = ridged ? ridgedFBM(nx, 5) : smoothFBM(nx, 4);
        ridgeY[i] = baseY - hVal * amplitude;
    }

    // 1. Fill base silhouette with shadow color
    tCtx.beginPath();
    tCtx.moveTo(0, waterLineY + 4);
    for (let i = 0; i < cols; i++) {
        tCtx.lineTo(i * step, ridgeY[i]);
    }
    tCtx.lineTo(width, waterLineY + 4);
    tCtx.closePath();
    tCtx.fillStyle = shadowColor;
    tCtx.fill();

    // 2. Draw 3D sunlit vs shadowed terrain facets descending from local peaks
    for (let i = 1; i < cols - 1; i++) {
        const x0 = (i - 1) * step;
        const x1 = i * step;
        const x2 = (i + 1) * step;
        const y0 = ridgeY[i - 1];
        const y1 = ridgeY[i];
        const y2 = ridgeY[i + 1];

        // Local peak or sunlit left-facing slope (sun is in upper-left/center-left sky)
        const slopeLeft = y1 - y0;
        const slopeRight = y2 - y1;

        if (slopeLeft < 0) {
            // Slope faces the sun (rising from left to right) -> paint sunlit facet ribbon
            const drop = Math.min(waterLineY - y1, amplitude * (0.42 + (noise1D(i * 0.37) * 0.5 + 0.5) * 0.35));
            const ridgeShift = step * (0.6 + (noise1D(i * 0.71) * 0.5 + 0.5) * 1.1);

            tCtx.beginPath();
            tCtx.moveTo(x0, y0);
            tCtx.lineTo(x1, y1);
            tCtx.lineTo(x1 + ridgeShift, y1 + drop);
            tCtx.lineTo(x0 + ridgeShift * 0.6, y0 + drop * 0.85);
            tCtx.closePath();
            tCtx.fillStyle = sunlitColor;
            tCtx.fill();
        } else if (slopeLeft >= 0 && slopeRight > 0 && i % 3 === 0) {
            // Subtle secondary sunlit spur
            const drop = Math.min(waterLineY - y1, amplitude * 0.25);
            tCtx.beginPath();
            tCtx.moveTo(x0, y0);
            tCtx.lineTo(x1, y1);
            tCtx.lineTo(x0 + step * 0.4, y1 + drop);
            tCtx.closePath();
            tCtx.fillStyle = sunlitColor;
            tCtx.fill();
        }
    }

    // 3. Crisp sunlit snowline / ridge crest highlight
    if (ridgeHighlight) {
        tCtx.beginPath();
        for (let i = 0; i < cols; i++) {
            const x = i * step;
            if (i === 0) tCtx.moveTo(x, ridgeY[i]);
            else tCtx.lineTo(x, ridgeY[i]);
        }
        tCtx.strokeStyle = ridgeHighlight;
        tCtx.lineWidth = 1.25;
        tCtx.stroke();
    }

    // 4. Optional procedural conifer / pine spire silhouettes along foreground ridges
    if (trees) {
        tCtx.fillStyle = shadowColor;
        for (let x = 0; x < width; x += 6) {
            const idx = Math.min(cols - 1, Math.floor(x / step));
            const frac = (x % step) / step;
            const nextIdx = Math.min(cols - 1, idx + 1);
            const ry = lerp(ridgeY[idx], ridgeY[nextIdx], frac);
            const treeH = 5 + (Math.abs(noise1D(x * 0.19)) * 9);
            tCtx.beginPath();
            tCtx.moveTo(x - 2.8, ry + 2);
            tCtx.lineTo(x, ry - treeH);
            tCtx.lineTo(x + 2.8, ry + 2);
            tCtx.closePath();
            tCtx.fill();
        }
    }

    // 5. Atmospheric valley mist gradient at the base of the mountain range
    if (fogAlpha > 0) {
        const topFogY = baseY - amplitude * 0.55;
        const grad = tCtx.createLinearGradient(0, topFogY, 0, waterLineY);
        grad.addColorStop(0, 'rgba(238, 242, 246, 0)');
        grad.addColorStop(1, fogColor);
        tCtx.fillStyle = grad;
        tCtx.fillRect(0, topFogY, width, waterLineY - topFogY);
    }
}

function buildStaticLandscape() {
    if (!width || !height) return;
    terrainCanvas.width = width;
    terrainCanvas.height = height;

    initNoise(2026);
    waterLineY = Math.floor(height * 0.80);
    sunX = width * 0.24;
    sunY = height * 0.19;

    // 1. Atmospheric Zenith-to-Horizon Sky Gradient (Pure Blue-on-Light palette)
    const skyGrad = tCtx.createLinearGradient(0, 0, 0, waterLineY);
    skyGrad.addColorStop(0.0, '#bae6fd');  // Crisp high-altitude sky cyan
    skyGrad.addColorStop(0.38, '#dbeafe'); // Soft daylight azure
    skyGrad.addColorStop(0.75, '#eff6ff'); // Pale ice mist
    skyGrad.addColorStop(1.0, '#f8fafc');  // Luminous horizon glow
    tCtx.fillStyle = skyGrad;
    tCtx.fillRect(0, 0, width, waterLineY);

    // 2. Soft Morning Sun & Atmospheric Halo
    const sunHalo = tCtx.createRadialGradient(sunX, sunY, 6, sunX, sunY, Math.max(width, height) * 0.32);
    sunHalo.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    sunHalo.addColorStop(0.12, 'rgba(240, 249, 255, 0.78)');
    sunHalo.addColorStop(0.45, 'rgba(186, 230, 253, 0.28)');
    sunHalo.addColorStop(1.0, 'rgba(186, 230, 253, 0)');
    tCtx.fillStyle = sunHalo;
    tCtx.fillRect(0, 0, width, waterLineY);

    tCtx.beginPath();
    tCtx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    tCtx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    tCtx.fill();

    // 3. Layer 1: Distant High-Altitude Glacial Peaks
    drawFacetedMountainLayer({
        baseY: height * 0.56,
        amplitude: height * 0.30,
        freq: 0.0016,
        seedOffset: 12.4,
        ridged: true,
        sunlitColor: '#dbeafe',
        shadowColor: '#93c5fd',
        ridgeHighlight: 'rgba(255, 255, 255, 0.75)',
        fogColor: 'rgba(239, 246, 255, 0.65)',
        fogAlpha: 0.65,
        trees: false
    });

    // 4. Layer 2: Upper Alpine Range (Cerulean & Sky Cobalt)
    drawFacetedMountainLayer({
        baseY: height * 0.63,
        amplitude: height * 0.26,
        freq: 0.0021,
        seedOffset: 48.9,
        ridged: true,
        sunlitColor: '#93c5fd',
        shadowColor: '#60a5fa',
        ridgeHighlight: 'rgba(224, 242, 254, 0.6)',
        fogColor: 'rgba(224, 242, 254, 0.52)',
        fogAlpha: 0.52,
        trees: false
    });

    // 5. Layer 3: Mid-Valley Ridges (Rich Cobalt & Azure)
    drawFacetedMountainLayer({
        baseY: height * 0.70,
        amplitude: height * 0.22,
        freq: 0.0026,
        seedOffset: 103.2,
        ridged: true,
        sunlitColor: '#60a5fa',
        shadowColor: '#2563eb',
        ridgeHighlight: 'rgba(147, 197, 253, 0.45)',
        fogColor: 'rgba(219, 234, 254, 0.45)',
        fogAlpha: 0.45,
        trees: false
    });

    // 6. Layer 4: Rolling Forested Foothills (Deep Royal Cobalt)
    drawFacetedMountainLayer({
        baseY: height * 0.77,
        amplitude: height * 0.16,
        freq: 0.0032,
        seedOffset: 215.7,
        ridged: false,
        sunlitColor: '#2563eb',
        shadowColor: '#1d4ed8',
        ridgeHighlight: null,
        fogColor: 'rgba(219, 234, 254, 0.30)',
        fogAlpha: 0.30,
        trees: true
    });

    // 7. Tranquil Alpine Fjord / Lake Reflection at the Base (y = waterLineY .. height)
    const waterH = height - waterLineY;
    const lakeGrad = tCtx.createLinearGradient(0, waterLineY, 0, height);
    lakeGrad.addColorStop(0.0, '#93c5fd');
    lakeGrad.addColorStop(0.25, '#60a5fa');
    lakeGrad.addColorStop(0.65, '#2563eb');
    lakeGrad.addColorStop(1.0, '#1e3a8a');
    tCtx.fillStyle = lakeGrad;
    tCtx.fillRect(0, waterLineY, width, waterH);

    // Subtle mirrored mountain reflection wash in the lake
    tCtx.save();
    tCtx.globalAlpha = 0.22;
    tCtx.translate(0, waterLineY * 2);
    tCtx.scale(1, -0.38);
    tCtx.drawImage(terrainCanvas, 0, 0);
    tCtx.restore();

    // Crisp shoreline mist line
    const shoreGrad = tCtx.createLinearGradient(0, waterLineY - 4, 0, waterLineY + 10);
    shoreGrad.addColorStop(0, 'rgba(224, 242, 254, 0)');
    shoreGrad.addColorStop(0.5, 'rgba(240, 249, 255, 0.75)');
    shoreGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    tCtx.fillStyle = shoreGrad;
    tCtx.fillRect(0, waterLineY - 4, width, 14);

    // 8. Precompute Foreground Framing Promontories (Left & Right Slopes in Deep Navy-Slate)
    buildForegroundPromontories();
}

let foregroundPath = null;

function buildForegroundPromontories() {
    const path = new Path2D();

    // Left rocky headland
    path.moveTo(0, height);
    path.lineTo(0, height * 0.73);
    for (let x = 0; x <= width * 0.28; x += 10) {
        const t = x / (width * 0.28);
        const drop = Math.pow(t, 1.5) * (height * 0.28);
        const jag = noise1D(x * 0.04) * 8;
        path.lineTo(x, height * 0.73 + drop + jag);
    }
    path.lineTo(width * 0.30, height);
    path.closePath();

    // Right rocky headland
    path.moveTo(width, height);
    path.lineTo(width, height * 0.71);
    for (let x = width; x >= width * 0.70; x -= 10) {
        const t = (width - x) / (width * 0.30);
        const drop = Math.pow(t, 1.45) * (height * 0.30);
        const jag = noise1D(x * 0.04 + 77) * 8;
        path.lineTo(x, height * 0.71 + drop + jag);
    }
    path.lineTo(width * 0.68, height);
    path.closePath();

    foregroundPath = path;
}

function renderFrame(time) {
    if (!ctx || !width || !height) return;

    // 1. Blit pre-rendered static mountain vista
    ctx.drawImage(terrainCanvas, 0, 0);

    // 2. Render diffuse drifting high-altitude clouds
    for (const c of clouds) {
        c.x += c.speed;
        if (c.x - c.sw * 0.5 > width) {
            c.x = -c.sw * 0.5;
        }
        ctx.drawImage(c.sprite, c.x - c.sw * 0.5, c.y - c.sh * 0.5);
    }

    // 3. Render gently breathing valley mist ribbons
    for (const m of mistBands) {
        const baseY = height * m.yRatio;
        const shift = time * m.speed + m.phase;

        ctx.beginPath();
        ctx.moveTo(0, baseY + 45);
        for (let x = 0; x <= width; x += 32) {
            const wave = Math.sin(x * 0.004 + shift) * m.amp + Math.cos(x * 0.009 - shift * 0.7) * (m.amp * 0.5);
            ctx.lineTo(x, baseY + wave);
        }
        ctx.lineTo(width, baseY + 45);
        ctx.closePath();

        const mistGrad = ctx.createLinearGradient(0, baseY - m.amp, 0, baseY + 45);
        mistGrad.addColorStop(0, 'rgba(240, 249, 255, 0)');
        mistGrad.addColorStop(0.5, `rgba(240, 249, 255, ${m.alpha})`);
        mistGrad.addColorStop(1, 'rgba(240, 249, 255, 0)');
        ctx.fillStyle = mistGrad;
        ctx.fill();
    }

    // 4. Shimmering sun glints on the alpine lake
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.42)';
    ctx.lineWidth = 1.2;
    const tSec = time * 0.0012;
    for (let i = 0; i < 22; i++) {
        const ry = waterLineY + 6 + (i / 22) * (height - waterLineY - 12);
        const spread = 40 + i * 12;
        const offset = Math.sin(tSec + i * 1.7) * 28;
        const len = 14 + (Math.cos(tSec * 1.3 + i * 2.3) * 0.5 + 0.5) * 32;
        const rx = sunX + offset + ((i % 5) - 2) * (spread * 0.25);

        ctx.beginPath();
        ctx.moveTo(rx - len * 0.5, ry);
        ctx.lineTo(rx + len * 0.5, ry);
        ctx.stroke();
    }

    // 5. Distant soaring birds
    ctx.strokeStyle = 'rgba(30, 58, 138, 0.55)';
    ctx.lineWidth = 1.35;
    for (const b of birds) {
        b.x += b.vx;
        b.y += b.vy + Math.sin(time * 0.001 + b.wingPhase) * 0.03;
        b.wingPhase += b.wingSpeed;

        if (b.x > width + 30) {
            b.x = -30;
            b.y = height * (0.15 + Math.random() * 0.16);
        }

        const flap = Math.sin(b.wingPhase) * b.scale * 0.55;
        const s = b.scale;

        ctx.beginPath();
        ctx.moveTo(b.x - s, b.y - flap);
        ctx.quadraticCurveTo(b.x - s * 0.4, b.y - Math.abs(flap) * 0.5, b.x, b.y);
        ctx.quadraticCurveTo(b.x + s * 0.4, b.y - Math.abs(flap) * 0.5, b.x + s, b.y - flap);
        ctx.stroke();
    }

    // 6. Foreground framing dark rocks (drawn last so they occlude the water reflection & mist)
    if (foregroundPath) {
        ctx.fillStyle = '#0f172a';
        ctx.fill(foregroundPath);
    }
}

function animate(time) {
    if (smallScreenQuery.matches) {
        rafId = null;
        return;
    }

    if (document.visibilityState === 'visible') {
        if (time - lastFrameTime >= FRAME_INTERVAL) {
            lastFrameTime = time;
            renderFrame(time);
        }
    }

    rafId = requestAnimationFrame(animate);
}

function resizeAndRebuild() {
    if (!canvas) return;

    // On small-screen devices (<= 768px), stop animation and skip rendering the background
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

    buildStaticLandscape();
    initAnimatedElements();
    renderFrame(performance.now());

    if (!rafId) {
        rafId = requestAnimationFrame(animate);
    }
}

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeAndRebuild, 120);
});

if (smallScreenQuery.addEventListener) {
    smallScreenQuery.addEventListener('change', resizeAndRebuild);
}

// Initialize accordion and landscape
setupAccordion();
resizeAndRebuild();
