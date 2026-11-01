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
        });
    });
}

// ============================================================================
// 2. INTERACTIVE SCENIC PROCEDURAL LANDSCAPE (EASTER EGG)
// ============================================================================

const canvas = document.getElementById('splash-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const smallScreenQuery = window.matchMedia('(max-width: 768px)');

let width = 0;
let height = 0;
let rafId = null;
let lastFrameTime = 0;
const FRAME_INTERVAL = 1000 / 28;

// Offscreen static buffer for the multi-faceted mountain ranges & sky
const terrainCanvas = document.createElement('canvas');
const tCtx = terrainCanvas.getContext('2d');

// Deterministic PRNG & 1D Value Noise for organic procedural generation
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

function parseRGB(c) {
    if (c.startsWith('#')) {
        const n = parseInt(c.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = c.match(/\d+/g);
    return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
}

function lerpColor(colorA, colorB, t) {
    const [r1, g1, b1] = parseRGB(colorA);
    const [r2, g2, b2] = parseRGB(colorB);
    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const bl = Math.round(lerp(b1, b2, t));
    return `rgb(${r}, ${g}, ${bl})`;
}

function noise1D(x) {
    const xi = Math.floor(x) & 255;
    const xf = x - Math.floor(x);
    const u = fade(xf);
    const a = PERM[xi] / 255;
    const b = PERM[xi + 1] / 255;
    return lerp(a, b, u) * 2 - 1;
}

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

// Dynamic animated & interactive state
let clouds = [];
let mistBands = [];
let birds = [];
let waterRipples = [];
let stars = [];
let waterLineY = 0;
let sunX = 0;
let sunY = 0;
let mountainHorizonAtSunY = 0;
let sunCustomPos = false;
let isDraggingSun = false;
let foregroundPath = null;

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
        const t = (k / (puffCount - 1)) * 2 - 1;
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
            speed: 0.06 + Math.random() * 0.12,
            boostVx: 0
        });
    }

    mistBands = [
        { yRatio: 0.57, amp: 36, slope: -0.055, freq1: 0.0026, freq2: 0.0065, spread: 64, speed: 0.00032, phase: 0.4, alpha: 0.30 },
        { yRatio: 0.615, amp: 30, slope: 0.045, freq1: 0.0032, freq2: 0.0078, spread: 54, speed: -0.00025, phase: 2.1, alpha: 0.34 },
        { yRatio: 0.74, amp: 12, slope: 0.0, freq1: 0.004, freq2: 0.009, spread: 45, speed: 0.00022, phase: 3.7, alpha: 0.28 }
    ];

    birds = Array.from({ length: 7 }, (_, i) => ({
        x: width * (0.10 + i * 0.04 + Math.random() * 0.15),
        y: height * (0.16 + Math.random() * 0.16),
        vx: 0.28 + Math.random() * 0.15,
        vy: (Math.random() - 0.5) * 0.05,
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: 0.10 + Math.random() * 0.05,
        scale: 3.4 + Math.random() * 2.2
    }));

    stars = Array.from({ length: 75 }, () => ({
        x: Math.random() * width,
        y: Math.random() * (height * 0.52),
        r: 0.7 + Math.random() * 1.3,
        phase: Math.random() * Math.PI * 2
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
        ridgeHighlight,
        fogColor,
        fogAlpha
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

    // Track highest mountain ridge directly at sunX so water reflection fades when Sun goes behind mountains
    const sunCol = Math.max(0, Math.min(cols - 1, Math.floor(sunX / step)));
    const sunNextCol = Math.min(cols - 1, sunCol + 1);
    const sunFrac = Math.max(0, Math.min(1, (sunX - sunCol * step) / step));
    const layerYAtSun = lerp(ridgeY[sunCol], ridgeY[sunNextCol], sunFrac);
    if (layerYAtSun < mountainHorizonAtSunY) {
        mountainHorizonAtSunY = layerYAtSun;
    }

    // 1. Build mountain silhouette path and fill with the layer's color
    tCtx.beginPath();
    tCtx.moveTo(0, waterLineY + 4);
    for (let i = 0; i < cols; i++) {
        tCtx.lineTo(i * step, ridgeY[i]);
    }
    tCtx.lineTo(width, waterLineY + 4);
    tCtx.closePath();
    tCtx.fillStyle = sunlitColor;
    tCtx.fill();

    // 2. Crisp sunlit snowline / ridge crest highlight
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

    // 3. Atmospheric valley mist gradient at the base of the mountain range
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
    mountainHorizonAtSunY = waterLineY;
    if (!sunCustomPos) {
        sunX = width * 0.24;
        sunY = height * 0.19;
    }

    // Dusk/Night factor based on how low the user drags the sun (0 = high daylight, 1 = deep twilight/night)
    const duskT = Math.max(0, Math.min(1, (sunY - height * 0.20) / (height * 0.42)));

    // 1. Atmospheric Zenith-to-Horizon Sky Gradient
    const skyGrad = tCtx.createLinearGradient(0, 0, 0, waterLineY);
    skyGrad.addColorStop(0.0, lerpColor('#bae6fd', '#0f172a', duskT));
    skyGrad.addColorStop(0.38, lerpColor('#dbeafe', '#1e3a8a', duskT));
    skyGrad.addColorStop(0.75, lerpColor('#eff6ff', '#1d4ed8', duskT));
    skyGrad.addColorStop(1.0, lerpColor('#f8fafc', '#38bdf8', duskT));
    tCtx.fillStyle = skyGrad;
    tCtx.fillRect(0, 0, width, waterLineY);

    // 2. Stars when sun is dragged low into twilight/night
    if (duskT > 0.25) {
        const starAlpha = (duskT - 0.25) / 0.75;
        tCtx.fillStyle = `rgba(224, 242, 254, ${starAlpha * 0.85})`;
        for (const st of stars) {
            tCtx.beginPath();
            tCtx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
            tCtx.fill();
        }
    }

    // 3. Morning/Twilight Sun & Atmospheric Halo
    const sunHalo = tCtx.createRadialGradient(sunX, sunY, 6, sunX, sunY, Math.max(width, height) * 0.34);
    sunHalo.addColorStop(0.0, 'rgba(255, 255, 255, 0.96)');
    sunHalo.addColorStop(0.12, 'rgba(224, 242, 254, 0.82)');
    sunHalo.addColorStop(0.45, 'rgba(125, 211, 252, 0.28)');
    sunHalo.addColorStop(1.0, 'rgba(125, 211, 252, 0)');
    tCtx.fillStyle = sunHalo;
    tCtx.fillRect(0, 0, width, waterLineY);

    tCtx.beginPath();
    tCtx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    tCtx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    tCtx.fill();

    // 4. Layer 1: Distant High-Altitude Glacial Peaks
    drawFacetedMountainLayer({
        baseY: height * 0.56,
        amplitude: height * 0.30,
        freq: 0.0016,
        seedOffset: 12.4,
        ridged: true,
        sunlitColor: lerpColor('#93c5fd', '#60a5fa', duskT),
        shadowColor: lerpColor('#60a5fa', '#1e40af', duskT),
        ridgeHighlight: 'rgba(255, 255, 255, 0.78)',
        fogColor: `rgba(219, 234, 254, ${0.62 * (1 - duskT * 0.5)})`,
        fogAlpha: 0.62,
        trees: false
    });

    // 5. Layer 2: Upper Alpine Range (Cerulean & Sky Cobalt)
    drawFacetedMountainLayer({
        baseY: height * 0.63,
        amplitude: height * 0.26,
        freq: 0.0021,
        seedOffset: 48.9,
        ridged: true,
        sunlitColor: lerpColor('#60a5fa', '#3b82f6', duskT),
        shadowColor: lerpColor('#3b82f6', '#1e3a8a', duskT),
        ridgeHighlight: 'rgba(224, 242, 254, 0.62)',
        fogColor: `rgba(219, 234, 254, ${0.48 * (1 - duskT * 0.5)})`,
        fogAlpha: 0.48,
        trees: false
    });

    // 6. Layer 3: Mid-Valley Ridges (Rich Cobalt & Azure)
    drawFacetedMountainLayer({
        baseY: height * 0.70,
        amplitude: height * 0.22,
        freq: 0.0026,
        seedOffset: 103.2,
        ridged: true,
        sunlitColor: lerpColor('#3b82f6', '#2563eb', duskT),
        shadowColor: lerpColor('#1d4ed8', '#172554', duskT),
        ridgeHighlight: 'rgba(186, 230, 253, 0.48)',
        fogColor: `rgba(219, 234, 254, ${0.40 * (1 - duskT * 0.5)})`,
        fogAlpha: 0.40,
        trees: false
    });

    // 7. Layer 4: Rolling Forested Foothills (Deep Royal Cobalt)
    drawFacetedMountainLayer({
        baseY: height * 0.77,
        amplitude: height * 0.16,
        freq: 0.0032,
        seedOffset: 215.7,
        ridged: false,
        sunlitColor: lerpColor('#2563eb', '#1d4ed8', duskT),
        shadowColor: lerpColor('#1d4ed8', '#1e40af', duskT),
        ridgeHighlight: null,
        fogColor: `rgba(219, 234, 254, ${0.26 * (1 - duskT * 0.5)})`,
        fogAlpha: 0.26,
        trees: true
    });

    // 8. Tranquil Alpine Fjord / Lake Reflection at the Base
    const waterH = height - waterLineY;
    const lakeGrad = tCtx.createLinearGradient(0, waterLineY, 0, height);
    lakeGrad.addColorStop(0.0, lerpColor('#93c5fd', '#1d4ed8', duskT));
    lakeGrad.addColorStop(0.25, lerpColor('#60a5fa', '#1e3a8a', duskT));
    lakeGrad.addColorStop(0.65, lerpColor('#2563eb', '#172554', duskT));
    lakeGrad.addColorStop(1.0, '#0f172a');
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
    shoreGrad.addColorStop(0.5, 'rgba(240, 249, 255, 0.72)');
    shoreGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    tCtx.fillStyle = shoreGrad;
    tCtx.fillRect(0, waterLineY - 4, width, 14);

    // 9. Precompute Foreground Framing Promontories
    buildForegroundPromontories();
}

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
        c.x += c.speed + c.boostVx;
        c.boostVx *= 0.94;
        if (c.x - c.sw * 0.5 > width) {
            c.x = -c.sw * 0.5;
        }
        ctx.drawImage(c.sprite, c.x - c.sw * 0.5, c.y - c.sh * 0.5);
    }

    // 3. Render gently breathing valley mist ribbons at varying heights
    for (const m of mistBands) {
        const baseY = height * m.yRatio;
        const shift = time * m.speed + m.phase;
        const spread = m.spread || 45;
        let minY = Infinity;
        let maxY = -Infinity;

        ctx.beginPath();
        for (let x = 0; x <= width; x += 32) {
            const tilt = ((x / width) - 0.5) * height * (m.slope || 0);
            const wave = Math.sin(x * (m.freq1 || 0.004) + shift) * m.amp
                + Math.cos(x * (m.freq2 || 0.009) - shift * 0.7) * (m.amp * 0.5);
            const y = baseY + tilt + wave;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(width, maxY + spread);
        ctx.lineTo(0, maxY + spread);
        ctx.closePath();

        const mistGrad = ctx.createLinearGradient(0, minY - 8, 0, maxY + spread);
        mistGrad.addColorStop(0, 'rgba(240, 249, 255, 0)');
        mistGrad.addColorStop(0.38, `rgba(240, 249, 255, ${m.alpha})`);
        mistGrad.addColorStop(1, 'rgba(240, 249, 255, 0)');
        ctx.fillStyle = mistGrad;
        ctx.fill();
    }

    // 4. Shimmering sun glints on the alpine lake (tracking sunX and fading out as Sun drops behind mountains)
    const sunReflectAlpha = Math.max(0, Math.min(1, (mountainHorizonAtSunY + 24 - sunY) / 58));
    if (sunReflectAlpha > 0.01) {
        ctx.strokeStyle = `rgba(224, 242, 254, ${0.45 * sunReflectAlpha})`;
        ctx.lineWidth = 1.25;
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
    }

    // 5. Interactive Expanding Water Ripples
    for (let i = waterRipples.length - 1; i >= 0; i--) {
        const rp = waterRipples[i];
        rp.r += 1.35;
        rp.alpha *= 0.965;
        if (rp.alpha < 0.02) {
            waterRipples.splice(i, 1);
            continue;
        }
        ctx.strokeStyle = `rgba(224, 242, 254, ${rp.alpha})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.26, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 6. Distant soaring birds (Boids-lite)
    ctx.strokeStyle = 'rgba(30, 58, 138, 0.6)';
    ctx.lineWidth = 1.35;
    for (const b of birds) {
        b.x += b.vx;
        b.y += b.vy + Math.sin(time * 0.001 + b.wingPhase) * 0.03;
        b.vx = lerp(b.vx, 0.32, 0.01);
        b.vy = lerp(b.vy, 0, 0.02);
        b.wingPhase += b.wingSpeed;

        if (b.x > width + 30) {
            b.x = -30;
            b.y = height * (0.14 + Math.random() * 0.18);
        }

        const flap = Math.sin(b.wingPhase) * b.scale * 0.55;
        const s = b.scale;

        ctx.beginPath();
        ctx.moveTo(b.x - s, b.y - flap);
        ctx.quadraticCurveTo(b.x - s * 0.4, b.y - Math.abs(flap) * 0.5, b.x, b.y);
        ctx.quadraticCurveTo(b.x + s * 0.4, b.y - Math.abs(flap) * 0.5, b.x + s, b.y - flap);
        ctx.stroke();
    }

    // 7. Foreground framing dark rocks (drawn last so they occlude the water reflection & mist)
    if (foregroundPath) {
        ctx.fillStyle = '#0f172a';
        ctx.fill(foregroundPath);
    }
}

// Hit-testing & Interactive Easter Egg Handlers for Landscape Canvas
function hitTestLandscape(mx, my) {
    if (!ctx || !width || !height) return null;

    // Ignore if over the dark foreground rocks
    if (foregroundPath && ctx.isPointInPath(foregroundPath, mx, my)) {
        return null;
    }

    // 1. Sun hit-test (draggable light source!)
    if (Math.hypot(mx - sunX, my - sunY) <= 44) {
        return { type: 'sun' };
    }

    // 2. Alpine lake water hit-test (clickable ripples!)
    if (my >= waterLineY) {
        return { type: 'water' };
    }

    // 3. Birds hit-test (scatter & spawn flock!)
    for (const b of birds) {
        if (Math.hypot(mx - b.x, my - b.y) <= 28) {
            return { type: 'bird', target: b };
        }
    }

    // 4. Clouds hit-test (breeze nudge!)
    for (const c of clouds) {
        if (Math.abs(mx - c.x) <= c.w * 0.38 && Math.abs(my - c.y) <= c.h * 0.55) {
            return { type: 'cloud', target: c };
        }
    }

    return null;
}

function setupLandscapeInteractions() {
    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
        if (smallScreenQuery.matches) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (isDraggingSun) {
            sunCustomPos = true;
            sunX = Math.max(40, Math.min(width - 40, mx));
            sunY = Math.max(36, Math.min(waterLineY - 20, my));
            buildStaticLandscape();
            renderFrame(performance.now());
            canvas.style.cursor = 'grabbing';
            return;
        }

        const hit = hitTestLandscape(mx, my);
        canvas.style.cursor = hit ? 'pointer' : 'default';
    });

    canvas.addEventListener('mousedown', (e) => {
        if (smallScreenQuery.matches) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const hit = hitTestLandscape(mx, my);
        if (!hit) return;

        if (hit.type === 'sun') {
            isDraggingSun = true;
            canvas.style.cursor = 'grabbing';
        } else if (hit.type === 'water') {
            waterRipples.push({ x: mx, y: my, r: 4, alpha: 0.85 });
            if (waterRipples.length > 25) waterRipples.shift();
        } else if (hit.type === 'cloud') {
            hit.target.boostVx = 2.4;
        } else if (hit.type === 'bird') {
            // Excite flock and spawn a pair of companion birds
            hit.target.vx = 1.4;
            hit.target.vy = -0.35;
            if (birds.length < 18) {
                for (let k = 0; k < 2; k++) {
                    birds.push({
                        x: mx + (Math.random() - 0.5) * 24,
                        y: my + (Math.random() - 0.5) * 18,
                        vx: 0.7 + Math.random() * 0.5,
                        vy: (Math.random() - 0.5) * 0.3,
                        wingPhase: Math.random() * Math.PI * 2,
                        wingSpeed: 0.14,
                        scale: 3.2 + Math.random() * 2.0
                    });
                }
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingSun) {
            isDraggingSun = false;
            if (canvas) canvas.style.cursor = 'pointer';
        }
    });
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

function assembleRiscv(asmText) {
    const clean = asmText.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
    if (!clean) return null;
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

    const rOps = {
        add:  [0x00, 0x0, 0x33], sub:  [0x20, 0x0, 0x33],
        sll:  [0x00, 0x1, 0x33], slt:  [0x00, 0x2, 0x33],
        xor:  [0x00, 0x4, 0x33], srl:  [0x00, 0x5, 0x33],
        sra:  [0x20, 0x5, 0x33], or:   [0x00, 0x6, 0x33],
        and:  [0x00, 0x7, 0x33], addw: [0x00, 0x0, 0x3b],
        subw: [0x20, 0x0, 0x3b]
    };
    if (rOps[mnem] && parts.length >= 4) {
        const [f7, f3, op] = rOps[mnem];
        return encodeR(f7, parseReg(parts[3]), parseReg(parts[2]), f3, parseReg(parts[1]), op);
    }

    const iOps = {
        addi: [0x0, 0x13], slti: [0x2, 0x13], xori: [0x4, 0x13],
        ori:  [0x6, 0x13], andi: [0x7, 0x13], addiw:[0x0, 0x1b],
        slli: [0x1, 0x13], srli: [0x5, 0x13], srai: [0x5, 0x13]
    };
    if (iOps[mnem] && parts.length >= 4) {
        const [f3, op] = iOps[mnem];
        let imm = parseInt(parts[3], 0) || 0;
        if (mnem === 'srai') imm = (imm & 0x3f) | 0x400;
        return encodeI(imm, parseReg(parts[2]), f3, parseReg(parts[1]), op);
    }

    const loads = { lw: 0x2, ld: 0x3, lb: 0x0, lh: 0x1 };
    if (loads[mnem] !== undefined && parts.length >= 3) {
        const rd = parseReg(parts[1]);
        const m = parts[2].match(/^(-?(?:0x[\da-fA-F]+|\d+))\(([^)]+)\)$/);
        if (m) {
            return encodeI(parseInt(m[1], 0), parseReg(m[2]), loads[mnem], rd, 0x03);
        }
    }

    const stores = { sw: 0x2, sd: 0x3, sb: 0x0, sh: 0x1 };
    if (stores[mnem] !== undefined && parts.length >= 3) {
        const rs2 = parseReg(parts[1]);
        const m = parts[2].match(/^(-?(?:0x[\da-fA-F]+|\d+))\(([^)]+)\)$/);
        if (m) {
            return encodeS(parseInt(m[1], 0), rs2, parseReg(m[2]), stores[mnem], 0x23);
        }
    }

    const branches = { beq: 0x0, bne: 0x1, blt: 0x4, bge: 0x5 };
    if (branches[mnem] !== undefined && parts.length >= 4) {
        return encodeB(parseInt(parts[3], 0) || 0, parseReg(parts[2]), parseReg(parts[1]), branches[mnem], 0x63);
    }

    if ((mnem === 'lui' || mnem === 'auipc') && parts.length >= 3) {
        const rd = parseReg(parts[1]);
        const imm20 = parseInt(parts[2], 0) || 0;
        const op = mnem === 'lui' ? 0x37 : 0x17;
        return (((imm20 & 0xfffff) << 12) | ((rd & 0x1f) << 7) | op) >>> 0;
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

    // Sample architectural register values (64-bit BigInt / 32-bit masked)
    const mask = xlen === 64 ? 0xffffffffffffffffn : 0xffffffffn;
    const r1Val = (rs1 === 0 ? 0n : BigInt(0x100 + rs1 * 16)) & mask;
    const r2Val = (rs2 === 0 ? 0n : BigInt(0x020 + rs2 * 8)) & mask;

    let fmt = 'I-Type';
    let opName = 'OP-IMM';
    let asm = `addi x${rd}, x${rs1}, ${immI}`;
    let aluOp = 'ADD';
    let memMode = 'Bypass';
    let memSub = 'No R/W';
    let wbText = `x${rd} (${ABI_NAMES[rd]})`;
    let wbVal = '0x0';
    let immVal = immI;
    let activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-imm', 'wire-rs1-alu', 'wire-imm-alu', 'wire-alu-wb'];
    let activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-wb'];

    if (opcode === 0x33 || opcode === 0x3b) {
        fmt = 'R-Type';
        opName = opcode === 0x3b ? 'OP-32 (RV64)' : 'OP (Reg)';
        activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-rs1-alu', 'wire-rs2-alu', 'wire-alu-wb'];
        activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-alu', 'node-wb'];

        const isSub = (funct7 & 0x20) !== 0;
        const map = { 0: isSub ? 'sub' : 'add', 1: 'sll', 2: 'slt', 4: 'xor', 5: isSub ? 'sra' : 'srl', 6: 'or', 7: 'and' };
        let m = map[funct3] || 'add';
        if (opcode === 0x3b && (m === 'add' || m === 'sub')) m += 'w';
        asm = `${m} x${rd}, x${rs1}, x${rs2}`;
        aluOp = m.toUpperCase();

        let res = r1Val + r2Val;
        if (m.startsWith('sub')) res = r1Val - r2Val;
        else if (m === 'xor') res = r1Val ^ r2Val;
        else if (m === 'or') res = r1Val | r2Val;
        else if (m === 'and') res = r1Val & r2Val;
        else if (m === 'sll') res = r1Val << (r2Val & 0x3fn);
        res &= mask;
        wbVal = `0x${res.toString(16)}`;
    } else if (opcode === 0x13 || opcode === 0x1b) {
        fmt = 'I-Type';
        opName = opcode === 0x1b ? 'OP-IMM-32' : 'OP-IMM';
        const map = { 0: 'addi', 1: 'slli', 2: 'slti', 4: 'xori', 5: (funct7 & 0x20) ? 'srai' : 'srli', 6: 'ori', 7: 'andi' };
        let m = map[funct3] || 'addi';
        if (opcode === 0x1b && m === 'addi') m = 'addiw';
        const dispImm = (funct3 === 1 || funct3 === 5) ? (immI & 0x3f) : immI;
        asm = `${m} x${rd}, x${rs1}, ${dispImm}`;
        aluOp = m.replace(/i w?$/, '').toUpperCase();

        const bigImm = BigInt(dispImm);
        let res = r1Val + bigImm;
        if (m === 'xori') res = r1Val ^ (bigImm & mask);
        else if (m === 'ori') res = r1Val | (bigImm & mask);
        else if (m === 'andi') res = r1Val & (bigImm & mask);
        else if (m === 'slli') res = r1Val << BigInt(dispImm & 0x3f);
        res &= mask;
        wbVal = `0x${res.toString(16)}`;
    } else if (opcode === 0x03) {
        fmt = 'I-Type';
        opName = 'LOAD';
        const lmap = { 0: 'lb', 1: 'lh', 2: 'lw', 3: 'ld' };
        const m = lmap[funct3] || (xlen === 64 ? 'ld' : 'lw');
        asm = `${m} x${rd}, ${immI}(x${rs1})`;
        aluOp = 'ADDR+';
        const addr = (r1Val + BigInt(immI)) & mask;
        memMode = `Read ${m.toUpperCase()}`;
        memSub = `@0x${addr.toString(16)}`;
        wbVal = xlen === 64 ? '0xfeedcafe00000042' : '0x00000042';
        activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-imm', 'wire-rs1-alu', 'wire-imm-alu', 'wire-alu-mem', 'wire-mem-wb'];
        activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-mem', 'node-wb'];
    } else if (opcode === 0x23) {
        fmt = 'S-Type';
        opName = 'STORE';
        immVal = immS;
        const smap = { 0: 'sb', 1: 'sh', 2: 'sw', 3: 'sd' };
        const m = smap[funct3] || (xlen === 64 ? 'sd' : 'sw');
        asm = `${m} x${rs2}, ${immS}(x${rs1})`;
        aluOp = 'ADDR+';
        const addr = (r1Val + BigInt(immS)) & mask;
        memMode = `Write ${m.toUpperCase()}`;
        memSub = `@0x${addr.toString(16)}`;
        wbText = 'No Reg Write';
        wbVal = `Mem[0x${addr.toString(16)}]`;
        activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-dec-imm', 'wire-rs1-alu', 'wire-imm-alu', 'wire-alu-mem', 'wire-rs2-mem'];
        activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-mem'];
    } else if (opcode === 0x63) {
        fmt = 'B-Type';
        opName = 'BRANCH';
        immVal = immB;
        const bmap = { 0: 'beq', 1: 'bne', 4: 'blt', 5: 'bge' };
        const m = bmap[funct3] || 'beq';
        asm = `${m} x${rs1}, x${rs2}, ${immB}`;
        aluOp = 'CMP';
        memMode = 'Branch Unit';
        memSub = `PC + ${immB}`;
        wbText = 'PC Next';
        wbVal = `0x${(0x80000000 + immB).toString(16)}`;
        activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-dec-imm', 'wire-rs1-alu', 'wire-rs2-alu', 'wire-alu-mem'];
        activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-mem'];
    } else if (opcode === 0x37 || opcode === 0x17) {
        fmt = 'U-Type';
        opName = opcode === 0x37 ? 'LUI' : 'AUIPC';
        const upper20 = (u >>> 12) & 0xfffff;
        immVal = immU;
        asm = `${opcode === 0x37 ? 'lui' : 'auipc'} x${rd}, 0x${upper20.toString(16)}`;
        aluOp = 'SHIFT<<12';
        wbVal = `0x${(u & 0xfffff000).toString(16)}`;
        activeWires = ['wire-pc-dec', 'wire-dec-imm', 'wire-imm-alu', 'wire-alu-wb'];
        activeNodes = ['node-pc', 'node-dec', 'node-imm', 'node-alu', 'node-wb'];
    } else {
        fmt = 'Custom/Raw';
        opName = `OP 0x${opcode.toString(16)}`;
        asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
        aluOp = 'NOP';
        wbVal = `0x${u.toString(16)}`;
    }

    return {
        u, opcode, rd, funct3, rs1, rs2, funct7,
        fmt, opName, asm, aluOp, memMode, memSub, wbText, wbVal,
        r1Val, r2Val, immVal, activeWires, activeNodes
    };
}

function getBitFieldType(bit, fmt) {
    if (bit <= 6) return 'opcode';
    if (fmt === 'U-Type') return bit <= 11 ? 'rd' : 'imm';
    if (bit <= 11) return (fmt === 'S-Type' || fmt === 'B-Type') ? 'imm' : 'rd';
    if (bit <= 14) return 'funct3';
    if (bit <= 19) return 'rs1';
    if (bit <= 24) return fmt === 'I-Type' ? 'imm' : 'rs2';
    return fmt === 'R-Type' ? 'funct7' : 'imm';
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

        // Update 32 bit buttons
        for (let b = 31; b >= 0; b--) {
            const bitVal = (d.u >>> b) & 1;
            const btn = bitButtons[b];
            btn.textContent = bitVal;
            btn.classList.toggle('bit-one', bitVal === 1);
            btn.setAttribute('data-field', getBitFieldType(b, d.fmt));
        }

        // Update Field Legend
        if (legendEl) {
            legendEl.innerHTML = `
                <span class="rv-field-chip"><span class="rv-field-dot" style="background:#60a5fa"></span>[31:25] funct7/imm: <strong>0x${d.funct7.toString(16)}</strong></span>
                <span class="rv-field-chip"><span class="rv-field-dot" style="background:#38bdf8"></span>[24:20] rs2: <strong>x${d.rs2} (${ABI_NAMES[d.rs2]})</strong></span>
                <span class="rv-field-chip"><span class="rv-field-dot" style="background:#0ea5e9"></span>[19:15] rs1: <strong>x${d.rs1} (${ABI_NAMES[d.rs1]})</strong></span>
                <span class="rv-field-chip"><span class="rv-field-dot" style="background:#0284c7"></span>[14:12] funct3: <strong>0x${d.funct3.toString(16)}</strong></span>
                <span class="rv-field-chip"><span class="rv-field-dot" style="background:#2563eb"></span>[11:7] rd: <strong>x${d.rd} (${ABI_NAMES[d.rd]})</strong></span>
                <span class="rv-field-chip"><span class="rv-field-dot" style="background:#1e3a8a"></span>[6:0] opcode: <strong>0x${d.opcode.toString(16).padStart(2, '0')}</strong></span>
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
        setTxt('svg-rd-val', `rd: x${d.rd} (${ABI_NAMES[d.rd]})`);
        setTxt('svg-imm-title', `IMM SEXT-${rvXlen}`);
        setTxt('svg-imm-val', `${d.immVal >= 0 ? '+' : ''}${d.immVal}`);
        setTxt('svg-alu-op', d.aluOp);
        setTxt('svg-mem-val', d.memMode);
        setTxt('svg-mem-sub', d.memSub);
        setTxt('svg-wb-reg', d.wbText);
        setTxt('svg-wb-val', d.wbVal);

        document.querySelectorAll('#rv-datapath-svg .rv-wire').forEach((w) => {
            w.classList.toggle('active', d.activeWires.includes(w.id));
        });
        document.querySelectorAll('#rv-datapath-svg .rv-node').forEach((n) => {
            n.classList.toggle('active', d.activeNodes.includes(n.id));
        });

        if (execBar) {
            execBar.innerHTML = `
                <span>Architecture: <strong>RV${rvXlen}I (${rvXlen}-bit registers)</strong></span>
                <span>Decoded: <strong>${d.asm}</strong></span>
                <span>Result (${d.wbText}): <strong>${d.wbVal}</strong></span>
            `;
        }
    }

    // Toggle between Program View and RISC-V Explorer View
    const toggleExplorer = (forceOpen) => {
        const isOpen = !explorerView.hidden;
        const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
        programView.hidden = nextOpen;
        explorerView.hidden = !nextOpen;
        chipBtn.classList.toggle('active', nextOpen);
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
