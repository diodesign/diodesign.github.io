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
let currentDuskT = 0;
let sunCustomPos = false;
let isDraggingSun = false;
let foregroundPath = null;
const mainHeadingEl = document.querySelector('.lab-header h1');

function createCloudSprite(w, h, alpha) {
    // Generous margin around w/h so diffuse gradients & blur never clip against canvas edges
    const sw = Math.ceil(w * 2.0 + 140);
    const sh = Math.ceil(h * 2.6 + 140);
    const sCanvas = document.createElement('canvas');
    sCanvas.width = sw;
    sCanvas.height = sh;
    const sCtx = sCanvas.getContext('2d');

    if ('filter' in sCtx) {
        sCtx.filter = 'blur(10px)';
    }

    const cx = sw * 0.5;
    const cy = sh * 0.5;
    const puffCount = 16;

    for (let k = 0; k < puffCount; k++) {
        const t = (k / (puffCount - 1)) * 2 - 1;
        const env = 1 - t * t * 0.35;
        const ox = t * w * 0.36 + (Math.random() - 0.5) * w * 0.10;
        // Dome-shaped vertical distribution so clouds have a billowy cumulus crown
        const domeOffset = (0.35 - env * 0.7) * h * 0.28;
        const oy = domeOffset + (Math.random() - 0.5) * h * 0.46 * env;
        const rx = (w * (0.19 + Math.random() * 0.12)) * (0.76 + env * 0.28);
        const ry = (h * (0.48 + Math.random() * 0.26)) * (0.76 + env * 0.28);

        sCtx.save();
        sCtx.translate(cx + ox, cy + oy);
        sCtx.scale(rx, ry);

        const puffAlpha = alpha * (0.14 + Math.random() * 0.08) * env;
        const grad = sCtx.createRadialGradient(0, -0.08, 0.05, 0, 0, 1.0);
        grad.addColorStop(0.0, `rgba(255, 255, 255, ${puffAlpha})`);
        grad.addColorStop(0.45, `rgba(248, 252, 255, ${puffAlpha * 0.72})`);
        grad.addColorStop(0.78, `rgba(240, 249, 255, ${puffAlpha * 0.28})`);
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
        const w = 320 + Math.random() * 280;
        const h = 95 + Math.random() * 75;
        const alpha = 0.50 + Math.random() * 0.22;
        const { sprite, sw, sh } = createCloudSprite(w, h, alpha);

        clouds.push({
            x: Math.random() * width,
            y: height * (0.06 + Math.random() * 0.28),
            w,
            h,
            sw,
            sh,
            sprite,
            speed: 0.06 + Math.random() * 0.12,
            boostVx: 0,
            scale: 1.0,
            targetScale: 1.0,
            puffVel: 0
        });
    }

    mistBands = [
        { yRatio: 0.57, amp: 36, slope: -0.055, freq1: 0.0026, freq2: 0.0065, spread: 64, speed: 0.00018, phase: 0.4, alpha: 0.30 },
        { yRatio: 0.615, amp: 30, slope: 0.045, freq1: 0.0032, freq2: 0.0078, spread: 54, speed: -0.00014, phase: 2.1, alpha: 0.34 },
        { yRatio: 0.74, amp: 12, slope: 0.0, freq1: 0.004, freq2: 0.009, spread: 45, speed: 0.00012, phase: 3.7, alpha: 0.28 }
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
    currentDuskT = duskT;

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
    lakeGrad.addColorStop(0.35, lerpColor('#60a5fa', '#1e3a8a', duskT));
    lakeGrad.addColorStop(0.75, lerpColor('#3b82f6', '#172554', duskT));
    lakeGrad.addColorStop(1.0, lerpColor('#2563eb', '#0f172a', duskT));
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
    ctx.save();
    ctx.globalAlpha = 1 - currentDuskT * 0.35;
    for (const c of clouds) {
        c.x += c.speed + c.boostVx;
        c.boostVx *= 0.94;
        c.puffVel = (c.puffVel || 0) * 0.78 + ((c.targetScale || 1) - (c.scale || 1)) * 0.16;
        c.scale = (c.scale || 1) + c.puffVel;

        const dw = c.sw * c.scale;
        const dh = c.sh * (1 + (c.scale - 1) * 1.35);

        if (c.x - dw * 0.5 > width) {
            c.x = -c.sw * 0.5;
            c.scale = 1.0;
            c.targetScale = 1.0;
            c.puffVel = 0;
        }
        ctx.drawImage(c.sprite, c.x - dw * 0.5, c.y - dh * 0.5, dw, dh);
    }
    ctx.restore();

    // 3. Render gently breathing valley mist ribbons at varying heights (and sync heading color texture)
    if (mainHeadingEl) {
        const s1 = time * 0.00018 + 0.4;
        const s2 = time * -0.00014 + 2.1;
        mainHeadingEl.style.setProperty('--mist-x1', `${(32 + Math.sin(s1) * 26).toFixed(1)}%`);
        mainHeadingEl.style.setProperty('--mist-y1', `${(40 + Math.cos(s1 * 0.7) * 22).toFixed(1)}%`);
        mainHeadingEl.style.setProperty('--mist-x2', `${(68 + Math.cos(s2) * 26).toFixed(1)}%`);
        mainHeadingEl.style.setProperty('--mist-y2', `${(60 + Math.sin(s2 * 0.7) * 22).toFixed(1)}%`);
        mainHeadingEl.style.setProperty('--mist-bg-x', `${(50 + Math.sin(s1 * 0.85) * 45).toFixed(1)}%`);
    }

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

    // 4. Shimmering sun glints & Interactive Water Ripples (clipped to lake and beneath the dark water fade)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterLineY, width, height - waterLineY);
    ctx.clip();

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
        const ryRadius = rp.r * 0.26;
        const rpGrad = ctx.createLinearGradient(0, rp.y - ryRadius, 0, rp.y + ryRadius);
        rpGrad.addColorStop(0, `rgba(240, 249, 255, ${rp.alpha})`);
        rpGrad.addColorStop(1, `rgba(147, 197, 253, ${rp.alpha * 0.38})`);
        ctx.strokeStyle = rpGrad;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r, ryRadius, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Dark depth fade over the water so ripples and glints are brighter at the top and darker below
    const waterFadeGrad = ctx.createLinearGradient(0, waterLineY, 0, height);
    waterFadeGrad.addColorStop(0.0, 'rgba(15, 23, 42, 0)');
    waterFadeGrad.addColorStop(0.35, 'rgba(15, 23, 42, 0.18)');
    waterFadeGrad.addColorStop(0.72, 'rgba(15, 23, 42, 0.58)');
    waterFadeGrad.addColorStop(1.0, 'rgba(15, 23, 42, 0.90)');
    ctx.fillStyle = waterFadeGrad;
    ctx.fillRect(0, waterLineY, width, height - waterLineY);
    ctx.restore();

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

    // 4. Clouds hit-test (puff up & breeze nudge!)
    for (const c of clouds) {
        const sc = c.scale || 1;
        if (Math.abs(mx - c.x) <= c.w * 0.42 * sc && Math.abs(my - c.y) <= c.h * 0.62 * sc) {
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
            hit.target.targetScale = Math.min(2.6, (hit.target.targetScale || 1) + 0.26);
            hit.target.puffVel = 0.08;
            hit.target.boostVx = 0.9;
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

    let fmt = 'I-Type';
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
        fmt = 'R-Type';
        const isW = opcode === 0x3b;
        opName = isW ? 'OP-32 (RV64)' : 'OP (Reg)';
        activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-rs1-alu', 'wire-rs2-alu', 'wire-alu-wb'];
        activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-alu', 'node-wb'];

        const validF7 = funct7 === 0x00 || (funct7 === 0x20 && (funct3 === 0 || funct3 === 5));
        const validW = !isW || (xlen === 64 && (funct3 === 0 || funct3 === 1 || funct3 === 5));
        if (!validF7 || !validW) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal Inst';
            rtl = 'Exception: Illegal funct7/funct3 encoding';
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
        fmt = 'I-Type';
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
            wbVal = 'Illegal Inst';
            rtl = 'Exception: Reserved shift/immediate funct bits';
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
        fmt = 'I-Type';
        const lmap = { 0: 'lb', 1: 'lh', 2: 'lw', 3: 'ld', 4: 'lbu', 5: 'lhu', 6: 'lwu' };
        const m = lmap[funct3];
        if (!m || (xlen === 32 && (funct3 === 3 || funct3 === 6))) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal Inst';
            rtl = 'Exception: Reserved load funct3 encoding';
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
        fmt = 'I-Type';
        if (funct3 !== 0) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal Inst';
            rtl = 'Exception: Reserved JALR funct3 encoding';
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
        fmt = 'S-Type';
        immVal = immS;
        const smap = { 0: 'sb', 1: 'sh', 2: 'sw', 3: 'sd' };
        const m = smap[funct3];
        if (!m || (xlen === 32 && funct3 === 3)) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal Inst';
            rtl = 'Exception: Reserved store funct3 encoding';
            ctrl = 'RegWrite=0 · Trap=IllegalInst';
        } else {
            opName = 'STORE';
            asm = `${m} x${rs2}, ${immS}(x${rs1})`;
            aluOp = 'ADDR+';
            const addr = (r1Val + BigInt(immS)) & mask;
            memMode = `Write ${m.toUpperCase()}`;
            memSub = `@0x${addr.toString(16)}`;
            wbText = 'No Reg Write';
            wbVal = `Mem[0x${addr.toString(16)}]`;
            rtl = `Mem[x${rs1} + ${immS}] ← x${rs2}`;
            ctrl = 'RegWrite=0 · ALUSrc=Imm · MemWrite=1';
            activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-dec-imm', 'wire-rs1-alu', 'wire-imm-alu', 'wire-alu-mem', 'wire-rs2-mem'];
            activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-mem'];
        }
    } else if (opcode === 0x63) {
        fmt = 'B-Type';
        immVal = immB;
        const bmap = { 0: 'beq', 1: 'bne', 4: 'blt', 5: 'bge', 6: 'bltu', 7: 'bgeu' };
        const m = bmap[funct3];
        if (!m) {
            opName = 'RESERVED';
            asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
            aluOp = 'ILL';
            wbText = 'Trap';
            wbVal = 'Illegal Inst';
            rtl = 'Exception: Reserved branch funct3 encoding';
            ctrl = 'RegWrite=0 · Trap=IllegalInst';
        } else {
            opName = 'BRANCH';
            asm = `${m} x${rs1}, x${rs2}, ${immB}`;
            aluOp = 'CMP';
            memMode = 'Branch Unit';
            memSub = `PC + ${immB}`;
            wbText = 'PC Next';
            wbVal = `0x${(0x80000000 + immB).toString(16)}`;
            const cmpSym = { beq: '==', bne: '!=', blt: '<s', bge: '>=s', bltu: '<u', bgeu: '>=u' }[m] || '==';
            rtl = `if (x${rs1} ${cmpSym} x${rs2}) PC ← PC + ${immB}`;
            ctrl = 'RegWrite=0 · ALUSrc=rs2 · Branch=1';
            activeWires = ['wire-pc-dec', 'wire-dec-rs1', 'wire-dec-rs2', 'wire-dec-imm', 'wire-rs1-alu', 'wire-rs2-alu', 'wire-alu-mem'];
            activeNodes = ['node-pc', 'node-dec', 'node-regs', 'node-imm', 'node-alu', 'node-mem'];
        }
    } else if (opcode === 0x37 || opcode === 0x17) {
        fmt = 'U-Type';
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
        fmt = 'J-Type';
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
        fmt = 'Custom/Raw';
        opName = `OP 0x${opcode.toString(16)}`;
        asm = `.word 0x${u.toString(16).padStart(8, '0')}`;
        aluOp = 'NOP';
        wbVal = `0x${u.toString(16)}`;
        rtl = 'Unrecognized / Custom Opcode';
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
    if (fmt === 'U-Type' || fmt === 'J-Type') return bit <= 11 ? 'rd' : 'imm';
    if (bit <= 11) return (fmt === 'S-Type' || fmt === 'B-Type') ? 'imm' : 'rd';
    if (bit <= 14) return 'funct3';
    if (bit <= 19) return 'rs1';
    if (fmt === 'I-Type' && u !== undefined) {
        const op = u & 0x7f;
        const f3 = (u >>> 12) & 0x7;
        if ((op === 0x13 || op === 0x1b) && (f3 === 1 || f3 === 5)) {
            const shamtTop = op === 0x1b ? 24 : 25;
            return bit <= shamtTop ? 'imm' : 'funct7';
        }
    }
    if (bit <= 24) return fmt === 'I-Type' ? 'imm' : 'rs2';
    return fmt === 'R-Type' ? 'funct7' : 'imm';
}

function getFormatFieldSpans(d, xlen) {
    const hexOp = `0x${d.opcode.toString(16).padStart(2, '0')}`;
    const hexF3 = `0x${d.funct3.toString(16)}`;
    const hexF7 = `0x${d.funct7.toString(16).padStart(2, '0')}`;
    const signedImm = `${d.immVal >= 0 ? '+' : ''}${d.immVal}`;

    if (d.fmt === 'R-Type') {
        return {
            spans: [
                { span: 7, hi: 31, lo: 25, field: 'funct7', label: 'funct7 [31:25]', val: hexF7 },
                { span: 5, hi: 24, lo: 20, field: 'rs2',    label: 'rs2 [24:20]',    val: `x${d.rs2}` },
                { span: 5, hi: 19, lo: 15, field: 'rs1',    label: 'rs1 [19:15]',    val: `x${d.rs1}` },
                { span: 3, hi: 14, lo: 12, field: 'funct3', label: 'f3 [14:12]',     val: hexF3 },
                { span: 5, hi: 11, lo: 7,  field: 'rd',     label: 'rd [11:7]',      val: `x${d.rd}` },
                { span: 7, hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',   val: hexOp }
            ],
            note: `<strong>R-Type (Register–Register):</strong> <code>funct7</code> and <code>funct3</code> select the ALU operation on <code>rs1 (x${d.rs1})</code> and <code>rs2 (x${d.rs2})</code>, writing to <code>rd (x${d.rd})</code>.`
        };
    }

    if (d.fmt === 'I-Type') {
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
                shiftNote = `<strong>Reserved Shift Encoding:</strong> Upper bits <code>[31:${shamtHi + 1}] = ${fVal}</code> are not valid for <code>funct3 = ${hexF3}</code> (left shifts require <code>0x00</code>; right shifts allow <code>0x00</code> for logical or bit 30 = <code>1</code> for arithmetic).`;
            } else if (d.funct3 === 1) {
                shiftNote = `<strong>I-Type (Left Shift Immediate):</strong> Bits <code>[${shamtHi}:20]</code> set <code>shamt = ${d.immVal}</code>. Left shifts are always logical (upper bits <code>[31:${shamtHi + 1}]</code> must be <code>0x00</code>); flip <strong>bit 14</strong> (<code>funct3 = 0x5</code>) for right shifts where <strong>bit 30</strong> selects logical (<code>srli</code>) vs. arithmetic (<code>srai</code>).`;
            } else {
                shiftNote = `<strong>I-Type (Right Shift Immediate):</strong> Bits <code>[${shamtHi}:20]</code> set <code>shamt = ${d.immVal}</code>, and <strong>bit 30</strong> selects logical (<code>0 = ${isWordShift ? 'srliw' : 'srli'}</code>) vs. arithmetic (<code>1 = ${isWordShift ? 'sraiw' : 'srai'}</code>) right shift.`;
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
            note: `<strong>I-Type (12-Bit Immediate):</strong> Bits <code>[31:20]</code> form a contiguous 12-bit signed immediate (<code>${signedImm}</code>) combined with <code>rs1 (x${d.rs1})</code> and written to <code>rd (x${d.rd})</code>.`
        };
    }

    if (d.fmt === 'S-Type') {
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
            note: `<strong>S-Type Split Immediate:</strong> Stores have no <code>rd</code> register — bits <code>[11:7]</code> (where <code>rd</code> normally sits) join bits <code>[31:25]</code> to form <code>{imm[11:5], imm[4:0]} = ${signedImm}</code> added to base <code>rs1 (x${d.rs1})</code>.`
        };
    }

    if (d.fmt === 'B-Type') {
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
            note: `<strong>B-Type Split Branch Offset:</strong> Branches have no <code>rd</code> — bits <code>[31:25]</code> and bits <code>[11:7]</code> combine (×2) into the 13-bit signed PC offset <code>${signedImm}</code>.`
        };
    }

    if (d.fmt === 'U-Type') {
        const upper20 = `0x${((d.u >>> 12) & 0xfffff).toString(16)}`;
        const shifted = `0x${((d.u & 0xfffff000) >>> 0).toString(16)}`;
        return {
            spans: [
                { span: 20, hi: 31, lo: 12, field: 'imm',    label: 'imm[31:12] [31:12]', val: `${upper20} → ${shifted}` },
                { span: 5,  hi: 11, lo: 7,  field: 'rd',     label: 'rd [11:7]',          val: `x${d.rd}` },
                { span: 7,  hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',       val: hexOp }
            ],
            note: `<strong>U-Type (20-Bit Upper Immediate):</strong> Bits <code>[31:12]</code> (<code>${upper20}</code>) place <code>${shifted}</code> in the upper 20 bits of 32-bit space and write to <code>rd (x${d.rd})</code>.`
        };
    }

    if (d.fmt === 'J-Type') {
        return {
            spans: [
                { span: 20, hi: 31, lo: 12, field: 'imm',    label: 'imm[20|10:1|11|19:12] [31:12]', val: signedImm },
                { span: 5,  hi: 11, lo: 7,  field: 'rd',     label: 'rd [11:7]',                     val: `x${d.rd}` },
                { span: 7,  hi: 6,  lo: 0,  field: 'opcode', label: 'opcode [6:0]',                  val: hexOp }
            ],
            note: `<strong>J-Type (21-Bit Jump Offset):</strong> Bits <code>[31:12]</code> encode the PC-relative jump offset (<code>${signedImm}</code>) while saving return address <code>PC + 4</code> in <code>rd (x${d.rd})</code>.`
        };
    }

    return {
        spans: [
            { span: 25, hi: 31, lo: 7, field: 'imm',    label: 'raw [31:7]',   val: `0x${(d.u >>> 7).toString(16)}` },
            { span: 7,  hi: 6,  lo: 0, field: 'opcode', label: 'opcode [6:0]', val: hexOp }
        ],
        note: `<strong>Custom / Unrecognized Opcode (${hexOp})</strong>`
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
        const hasRd = d.fmt !== 'S-Type' && d.fmt !== 'B-Type';
        setTxt('svg-rd-val', hasRd ? `rd: x${d.rd}` : 'rd: — (none)');
        setTxt('svg-imm-title', `IMM SEXT-${rvXlen}`);
        const immDisplay = d.fmt === 'U-Type'
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
