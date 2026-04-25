const canvas = document.getElementById('splash-canvas');
const ctx = canvas.getContext('2d');
let width, height;
let mouse = { x: -1000, y: -1000 };

const colors = {
    background: '#1a0a2e',
    point: { r: 255, g: 215, b: 0 }, // Gold
    line: { r: 255, g: 215, b: 0 },
    glow: 'rgba(255, 215, 0, 0.3)',
    nebula: [
        { r: 26, g: 10, b: 46, a: 0.2 },  // Deep Purple
        { r: 0, g: 128, b: 128, a: 0.15 }, // Teal/Cyan
        { r: 75, g: 0, b: 130, a: 0.1 }   // Indigo
    ]
};

const rawPoints = [
    { x: 0.0420, y: 0.7732 }, { x: 0.0266, y: 0.7594 }, { x: 0.0147, y: 0.7193 }, { x: 0.0071, y: 0.6653 }, { x: 0.0027, y: 0.6063 }, { x: 0.0005, y: 0.5454 }, { x: 0.0000, y: 0.4839 }, { x: 0.0008, y: 0.4226 }, { x: 0.0034, y: 0.3619 }, { x: 0.0084, y: 0.3036 }, { x: 0.0169, y: 0.2517 }, { x: 0.0298, y: 0.2167 }, { x: 0.0455, y: 0.2106 }, { x: 0.0601, y: 0.2336 }, { x: 0.0702, y: 0.2806 }, { x: 0.0720, y: 0.2425 }, { x: 0.0714, y: 0.1810 }, { x: 0.0714, y: 0.1195 }, { x: 0.0714, y: 0.0580 }, { x: 0.0764, y: 0.0159 }, { x: 0.0924, y: 0.0159 }, { x: 0.1083, y: 0.0159 }, { x: 0.1128, y: 0.0602 }, { x: 0.1128, y: 0.1217 }, { x: 0.1128, y: 0.1832 }, { x: 0.1128, y: 0.2447 }, { x: 0.1128, y: 0.3062 }, { x: 0.1128, y: 0.3678 }, { x: 0.1128, y: 0.4292 }, { x: 0.1128, y: 0.4907 }, { x: 0.1128, y: 0.5523 }, { x: 0.1128, y: 0.6138 }, { x: 0.1128, y: 0.6752 }, { x: 0.1128, y: 0.7368 }, { x: 0.1038, y: 0.7636 }, { x: 0.0878, y: 0.7636 }, { x: 0.0766, y: 0.7361 }, { x: 0.0674, y: 0.7294 }, { x: 0.0547, y: 0.7656 }, { x: 0.0556, y: 0.6406 }, { x: 0.0678, y: 0.6075 }, { x: 0.0710, y: 0.5475 }, { x: 0.0714, y: 0.4860 }, { x: 0.0708, y: 0.4245 }, { x: 0.0662, y: 0.3663 }, { x: 0.0521, y: 0.3495 }, { x: 0.0439, y: 0.4001 }, { x: 0.0419, y: 0.4611 }, { x: 0.0419, y: 0.5226 }, { x: 0.0439, y: 0.5835 }, { x: 0.0514, y: 0.6361 },
    { x: 0.1385, y: 0.2191 }, { x: 0.1544, y: 0.2191 }, { x: 0.1704, y: 0.2191 }, { x: 0.1798, y: 0.2441 }, { x: 0.1798, y: 0.3056 }, { x: 0.1798, y: 0.3672 }, { x: 0.1798, y: 0.4287 }, { x: 0.1798, y: 0.4902 }, { x: 0.1798, y: 0.5516 }, { x: 0.1798, y: 0.6132 }, { x: 0.1798, y: 0.6747 }, { x: 0.1798, y: 0.7362 }, { x: 0.1710, y: 0.7636 }, { x: 0.1550, y: 0.7636 }, { x: 0.1391, y: 0.7636 }, { x: 0.1385, y: 0.7045 }, { x: 0.1385, y: 0.6429 }, { x: 0.1385, y: 0.5814 }, { x: 0.1385, y: 0.5199 }, { x: 0.1385, y: 0.4584 }, { x: 0.1385, y: 0.3969 }, { x: 0.1385, y: 0.3354 }, { x: 0.1385, y: 0.2739 }, { x: 0.1592, y: 0.0000 }, { x: 0.1743, y: 0.0157 }, { x: 0.1809, y: 0.0697 }, { x: 0.1786, y: 0.1298 }, { x: 0.1660, y: 0.1639 }, { x: 0.1502, y: 0.1618 }, { x: 0.1388, y: 0.1221 }, { x: 0.1376, y: 0.0614 }, { x: 0.1457, y: 0.0110 },
    { x: 0.3164, y: 0.4902 }, { x: 0.3154, y: 0.5515 }, { x: 0.3122, y: 0.6117 }, { x: 0.3062, y: 0.6685 }, { x: 0.2968, y: 0.7178 }, { x: 0.2838, y: 0.7535 }, { x: 0.2686, y: 0.7707 }, { x: 0.2527, y: 0.7722 }, { x: 0.2372, y: 0.7577 }, { x: 0.2239, y: 0.7245 }, { x: 0.2137, y: 0.6773 }, { x: 0.2069, y: 0.6219 }, { x: 0.2030, y: 0.5624 }, { x: 0.2014, y: 0.5012 }, { x: 0.2020, y: 0.4398 }, { x: 0.2048, y: 0.3792 }, { x: 0.2102, y: 0.3214 }, { x: 0.2191, y: 0.2708 }, { x: 0.2316, y: 0.2329 }, { x: 0.2466, y: 0.2135 }, { x: 0.2625, y: 0.2098 }, { x: 0.2782, y: 0.2212 }, { x: 0.2921, y: 0.2504 }, { x: 0.3030, y: 0.2949 }, { x: 0.3105, y: 0.3492 }, { x: 0.3147, y: 0.4084 }, { x: 0.3163, y: 0.4695 }, { x: 0.2431, y: 0.4921 }, { x: 0.2440, y: 0.5535 }, { x: 0.2481, y: 0.6126 }, { x: 0.2611, y: 0.6400 }, { x: 0.2715, y: 0.5982 }, { x: 0.2741, y: 0.5376 }, { x: 0.2745, y: 0.4762 }, { x: 0.2734, y: 0.4149 }, { x: 0.2680, y: 0.3576 }, { x: 0.2535, y: 0.3472 }, { x: 0.2454, y: 0.3981 }, { x: 0.2433, y: 0.4590 },
    { x: 0.3751, y: 0.7732 }, { x: 0.3597, y: 0.7594 }, { x: 0.3478, y: 0.7193 }, { x: 0.3403, y: 0.6653 }, { x: 0.3358, y: 0.6063 }, { x: 0.3337, y: 0.5454 }, { x: 0.3331, y: 0.4839 }, { x: 0.3339, y: 0.4226 }, { x: 0.3365, y: 0.3619 }, { x: 0.3415, y: 0.3036 }, { x: 0.3500, y: 0.2517 }, { x: 0.3629, y: 0.2167 }, { x: 0.3786, y: 0.2106 }, { x: 0.3932, y: 0.2336 }, { x: 0.4033, y: 0.2806 }, { x: 0.4051, y: 0.2425 }, { x: 0.4045, y: 0.1810 }, { x: 0.4045, y: 0.1195 }, { x: 0.4045, y: 0.0580 }, { x: 0.4095, y: 0.0159 }, { x: 0.4255, y: 0.0159 }, { x: 0.4415, y: 0.0159 }, { x: 0.4459, y: 0.0602 }, { x: 0.4459, y: 0.1217 }, { x: 0.4459, y: 0.1832 }, { x: 0.4459, y: 0.2447 }, { x: 0.4459, y: 0.3062 }, { x: 0.4459, y: 0.3678 }, { x: 0.4459, y: 0.4292 }, { x: 0.4459, y: 0.4907 }, { x: 0.4459, y: 0.5523 }, { x: 0.4459, y: 0.6138 }, { x: 0.4459, y: 0.6752 }, { x: 0.4459, y: 0.7368 }, { x: 0.4369, y: 0.7636 }, { x: 0.4210, y: 0.7636 }, { x: 0.4097, y: 0.7361 }, { x: 0.4005, y: 0.7294 }, { x: 0.3878, y: 0.7656 }, { x: 0.3887, y: 0.6406 }, { x: 0.4009, y: 0.6075 }, { x: 0.4041, y: 0.5475 }, { x: 0.4045, y: 0.4860 }, { x: 0.4039, y: 0.4245 }, { x: 0.3993, y: 0.3663 }, { x: 0.3852, y: 0.3495 }, { x: 0.3770, y: 0.4001 }, { x: 0.3750, y: 0.4611 }, { x: 0.3751, y: 0.5226 }, { x: 0.3770, y: 0.5835 }, { x: 0.3846, y: 0.6361 },
    { x: 0.5214, y: 0.2105 }, { x: 0.5372, y: 0.2179 }, { x: 0.5517, y: 0.2430 }, { x: 0.5630, y: 0.2859 }, { x: 0.5702, y: 0.3406 }, { x: 0.5738, y: 0.4004 }, { x: 0.5748, y: 0.4617 }, { x: 0.5748, y: 0.5232 }, { x: 0.5637, y: 0.5420 }, { x: 0.5477, y: 0.5420 }, { x: 0.5318, y: 0.5420 }, { x: 0.5159, y: 0.5420 }, { x: 0.5078, y: 0.5708 }, { x: 0.5143, y: 0.6256 }, { x: 0.5290, y: 0.6461 }, { x: 0.5449, y: 0.6412 }, { x: 0.5599, y: 0.6206 }, { x: 0.5675, y: 0.6316 }, { x: 0.5675, y: 0.6931 }, { x: 0.5629, y: 0.7439 }, { x: 0.5479, y: 0.7641 }, { x: 0.5321, y: 0.7724 }, { x: 0.5162, y: 0.7714 }, { x: 0.5006, y: 0.7579 }, { x: 0.4870, y: 0.7269 }, { x: 0.4769, y: 0.6795 }, { x: 0.4709, y: 0.6227 }, { x: 0.4678, y: 0.5623 }, { x: 0.4669, y: 0.5010 }, { x: 0.4675, y: 0.4396 }, { x: 0.4699, y: 0.3789 }, { x: 0.4751, y: 0.3207 }, { x: 0.4837, y: 0.2694 }, { x: 0.4963, y: 0.2318 }, { x: 0.5114, y: 0.2133 }, { x: 0.5224, y: 0.3335 }, { x: 0.5100, y: 0.3662 }, { x: 0.5074, y: 0.4264 }, { x: 0.5224, y: 0.4301 }, { x: 0.5365, y: 0.4232 }, { x: 0.5337, y: 0.3631 },
    { x: 0.6766, y: 0.5964 }, { x: 0.6747, y: 0.6572 }, { x: 0.6678, y: 0.7122 }, { x: 0.6556, y: 0.7511 }, { x: 0.6405, y: 0.7696 }, { x: 0.6246, y: 0.7730 }, { x: 0.6087, y: 0.7669 }, { x: 0.5933, y: 0.7509 }, { x: 0.5882, y: 0.7026 }, { x: 0.5882, y: 0.6410 }, { x: 0.5912, y: 0.5989 }, { x: 0.6057, y: 0.6241 }, { x: 0.6213, y: 0.6364 }, { x: 0.6351, y: 0.6162 }, { x: 0.6283, y: 0.5661 }, { x: 0.6143, y: 0.5364 }, { x: 0.6013, y: 0.5011 }, { x: 0.5922, y: 0.4510 }, { x: 0.5882, y: 0.3918 }, { x: 0.5889, y: 0.3305 }, { x: 0.5949, y: 0.2740 }, { x: 0.6066, y: 0.2331 }, { x: 0.6217, y: 0.2133 }, { x: 0.6376, y: 0.2098 }, { x: 0.6533, y: 0.2197 }, { x: 0.6681, y: 0.2423 }, { x: 0.6718, y: 0.2875 }, { x: 0.6669, y: 0.3460 }, { x: 0.6579, y: 0.3616 }, { x: 0.6431, y: 0.3389 }, { x: 0.6285, y: 0.3500 }, { x: 0.6355, y: 0.3983 }, { x: 0.6491, y: 0.4303 }, { x: 0.6620, y: 0.4664 }, { x: 0.6718, y: 0.5146 }, { x: 0.6763, y: 0.5732 },
    { x: 0.6957, y: 0.2191 }, { x: 0.7116, y: 0.2191 }, { x: 0.7276, y: 0.2191 }, { x: 0.7370, y: 0.2441 }, { x: 0.7370, y: 0.3056 }, { x: 0.7370, y: 0.3672 }, { x: 0.7370, y: 0.4287 }, { x: 0.7370, y: 0.4902 }, { x: 0.7370, y: 0.5516 }, { x: 0.7370, y: 0.6132 }, { x: 0.7370, y: 0.6747 }, { x: 0.7370, y: 0.7362 }, { x: 0.7282, y: 0.7636 }, { x: 0.7122, y: 0.7636 }, { x: 0.6963, y: 0.7636 }, { x: 0.6957, y: 0.7045 }, { x: 0.6957, y: 0.6429 }, { x: 0.6957, y: 0.5814 }, { x: 0.6957, y: 0.5199 }, { x: 0.6957, y: 0.4584 }, { x: 0.6957, y: 0.3969 }, { x: 0.6957, y: 0.3354 }, { x: 0.6957, y: 0.2739 }, { x: 0.7164, y: 0.0000 }, { x: 0.7315, y: 0.0157 }, { x: 0.7381, y: 0.0697 }, { x: 0.7358, y: 0.1298 }, { x: 0.7232, y: 0.1639 }, { x: 0.7074, y: 0.1618 }, { x: 0.6960, y: 0.1221 }, { x: 0.6948, y: 0.0614 }, { x: 0.7030, y: 0.0110 },
    { x: 0.8039, y: 1.0000 }, { x: 0.7881, y: 0.9953 }, { x: 0.7728, y: 0.9778 }, { x: 0.7601, y: 0.9417 }, { x: 0.7528, y: 0.8875 }, { x: 0.7521, y: 0.8265 }, { x: 0.7588, y: 0.7715 }, { x: 0.7713, y: 0.7341 }, { x: 0.7713, y: 0.7075 }, { x: 0.7638, y: 0.6548 }, { x: 0.7670, y: 0.5957 }, { x: 0.7769, y: 0.5512 }, { x: 0.7667, y: 0.5046 }, { x: 0.7612, y: 0.4471 }, { x: 0.7599, y: 0.3860 }, { x: 0.7625, y: 0.3254 }, { x: 0.7701, y: 0.2718 }, { x: 0.7826, y: 0.2344 }, { x: 0.7977, y: 0.2159 }, { x: 0.8137, y: 0.2120 }, { x: 0.8293, y: 0.2219 }, { x: 0.8452, y: 0.2239 }, { x: 0.8612, y: 0.2239 }, { x: 0.8751, y: 0.2316 }, { x: 0.8751, y: 0.2931 }, { x: 0.8658, y: 0.3273 }, { x: 0.8621, y: 0.3692 }, { x: 0.8623, y: 0.4304 }, { x: 0.8583, y: 0.4898 }, { x: 0.8492, y: 0.5397 }, { x: 0.8357, y: 0.5718 }, { x: 0.8202, y: 0.5856 }, { x: 0.8043, y: 0.5854 }, { x: 0.7978, y: 0.6257 }, { x: 0.8125, y: 0.6415 }, { x: 0.8285, y: 0.6415 }, { x: 0.8444, y: 0.6436 }, { x: 0.8592, y: 0.6650 }, { x: 0.8691, y: 0.7121 }, { x: 0.8726, y: 0.7719 }, { x: 0.8719, y: 0.8333 }, { x: 0.8671, y: 0.8916 }, { x: 0.8574, y: 0.9399 }, { x: 0.8440, y: 0.9728 }, { x: 0.8288, y: 0.9912 }, { x: 0.8130, y: 0.9990 }, { x: 0.8068, y: 0.8837 }, { x: 0.8226, y: 0.8759 }, { x: 0.8337, y: 0.8356 }, { x: 0.8285, y: 0.7857 }, { x: 0.8126, y: 0.7828 }, { x: 0.7967, y: 0.7838 }, { x: 0.7898, y: 0.8342 }, { x: 0.7987, y: 0.8794 }, { x: 0.8114, y: 0.4791 }, { x: 0.8207, y: 0.4360 }, { x: 0.8212, y: 0.3747 }, { x: 0.8148, y: 0.3212 }, { x: 0.8027, y: 0.3477 }, { x: 0.8013, y: 0.4088 }, { x: 0.8049, y: 0.4676 },
    { x: 0.9612, y: 0.2095 }, { x: 0.9768, y: 0.2213 }, { x: 0.9892, y: 0.2590 }, { x: 0.9965, y: 0.3132 }, { x: 0.9996, y: 0.3734 }, { x: 1.0000, y: 0.4349 }, { x: 1.0000, y: 0.4964 }, { x: 1.0000, y: 0.5579 }, { x: 1.0000, y: 0.6194 }, { x: 1.0000, y: 0.6809 }, { x: 1.0000, y: 0.7424 }, { x: 0.9895, y: 0.7636 }, { x: 0.9736, y: 0.7636 }, { x: 0.9586, y: 0.7597 }, { x: 0.9586, y: 0.6982 }, { x: 0.9586, y: 0.6367 }, { x: 0.9586, y: 0.5752 }, { x: 0.9586, y: 0.5137 }, { x: 0.9586, y: 0.4522 }, { x: 0.9572, y: 0.3910 }, { x: 0.9470, y: 0.3513 }, { x: 0.9349, y: 0.3838 }, { x: 0.9322, y: 0.4443 }, { x: 0.9316, y: 0.5058 }, { x: 0.9316, y: 0.5673 }, { x: 0.9316, y: 0.6287 }, { x: 0.9316, y: 0.6902 }, { x: 0.9316, y: 0.7517 }, { x: 0.9187, y: 0.7636 }, { x: 0.9027, y: 0.7636 }, { x: 0.8902, y: 0.7504 }, { x: 0.8902, y: 0.6889 }, { x: 0.8902, y: 0.6273 }, { x: 0.8902, y: 0.5659 }, { x: 0.8902, y: 0.5043 }, { x: 0.8902, y: 0.4428 }, { x: 0.8902, y: 0.3814 }, { x: 0.8902, y: 0.3198 }, { x: 0.8902, y: 0.2583 }, { x: 0.8960, y: 0.2191 }, { x: 0.9120, y: 0.2191 }, { x: 0.9240, y: 0.2389 }, { x: 0.9300, y: 0.2835 }, { x: 0.9397, y: 0.2353 }, { x: 0.9542, y: 0.2116 },
];

let points = [];
let triangles = [];
let bgPoints = [];
let nebulaClouds = [];

function init() {
    resize();
    points = [];
    triangles = [];
    bgPoints = [];
    nebulaClouds = [];

    const aspectRatio = 3;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rawPoints.forEach(p => {
        const px = p.x * aspectRatio;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const rawWidth = maxX - minX;
    const rawHeight = maxY - minY;

    const scale = Math.min(width * 0.8 / rawWidth, height * 0.8 / rawHeight);
    const offsetX = (width - rawWidth * scale) / 2 - minX * scale;
    const offsetY = (height - rawHeight * scale) / 2 - minY * scale;

    const letterRanges = [
        [0, 50], [51, 73], [74, 82], [83, 120], [121, 171],
        [172, 210], [211, 246], [247, 269], [270, 278], [279, 326], [327, 369]
    ];

    const step = 3;
    letterRanges.forEach(range => {
        const start = range[0];
        const end = range[1];
        const newSegmentStart = points.length;

        const charOffsetX = (Math.random() - 0.5) * 30;
        const charOffsetY = (Math.random() - 0.5) * 100;

        for (let i = start; i <= end; i += step) {
            const p = rawPoints[i];
            const px = p.x * aspectRatio;
            points.push({
                baseX: px * scale + offsetX + charOffsetX,
                baseY: p.y * scale + offsetY + charOffsetY,
                baseZ: 0,
                x: 0, y: 0, z: 0,
                relativeX: p.x,
                offset: Math.random() * 1000,
                twinkle: Math.random() * Math.PI,
                starSize: 0.6 + Math.random() * 0.8
            });
        }
        const newSegmentEnd = points.length - 1;
        for (let j = newSegmentStart; j < newSegmentEnd - 1; j++) {
            triangles.push([j, j + 1, j + 2]);
        }
    });

    for (let i = 0; i < 60; i++) {
        const rx = Math.random();
        const ry = Math.random();
        bgPoints.push({
            baseX: rx * width,
            baseY: ry * height,
            baseZ: (Math.random() - 0.5) * 800,
            x: 0, y: 0, z: 0,
            relativeX: rx,
            offset: Math.random() * 1000,
            twinkle: Math.random() * Math.PI,
            starSize: 0.3 + Math.random() * 0.5,
            twinkleSpeed: 1 + Math.random() * 3
        });
    }

    // Create nebula gas clouds
    for (let i = 0; i < 15; i++) {
        const color = colors.nebula[Math.floor(Math.random() * colors.nebula.length)];
        nebulaClouds.push({
            baseX: Math.random() * width,
            baseY: Math.random() * height,
            baseZ: (Math.random() - 0.5) * 1200, // Deep volume
            x: 0, y: 0, z: 0,
            size: 200 + Math.random() * 400,
            color: color,
            offset: Math.random() * 1000
        });
    }
}

function resize() {
    width = canvas.width = canvas.parentElement.clientWidth;
    height = canvas.height = canvas.parentElement.clientHeight;
}

function animate(time) {
    ctx.clearRect(0, 0, width, height);
    const focalLength = 1000;
    const t = time * 0.001;

    const shimmerPos = (Math.sin(t * 0.4) + 1) / 2;
    const shimmerWidth = 0.25;

    // Process all elements (Wordmark, Nebula Stars, Gas Clouds)
    [points, bgPoints, nebulaClouds].forEach((set, setIdx) => {
        set.forEach(p => {
            const pt = t + p.offset;
            let targetX = p.baseX + Math.sin(pt * 0.3) * (setIdx === 2 ? 15 : 6); // Clouds drift more
            let targetY = p.baseY + Math.cos(pt * 0.4) * (setIdx === 2 ? 15 : 6);
            let targetZ = p.baseZ + Math.sin(pt * 0.2) * 60;

            const dx = mouse.x - targetX;
            const dy = mouse.y - targetY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 300) {
                const force = (1 - dist / 300) * (setIdx === 2 ? 10 : 20); // Clouds react less
                targetX += (dx / dist) * force;
                targetY += (dy / dist) * force;
                targetZ -= force * 2;
            }

            p.x = targetX;
            p.y = targetY;
            p.z = targetZ;

            const pScale = focalLength / (focalLength + p.z);
            p.projX = (p.x - width / 2) * pScale + width / 2;
            p.projY = (p.y - height / 2) * pScale + height / 2;
            p.currentScale = pScale;

            if (setIdx < 2) { // Shimmer only for stars
                const shimmerDist = Math.abs(p.relativeX - shimmerPos);
                const shimmerIntensity = Math.max(0, 1 - shimmerDist / shimmerWidth);
                const speed = p.twinkleSpeed || 2;
                p.twinkleVal = (0.7 + Math.sin(t * speed + p.twinkle) * 0.3) + (shimmerIntensity * 0.5);
                p.shimmerIntensity = shimmerIntensity;
            }
        });
    });

    // Draw nebula gas clouds first (the deepest layer)
    nebulaClouds.forEach(cloud => {
        const radius = cloud.size * cloud.currentScale;
        if (radius < 1) return;

        const grad = ctx.createRadialGradient(
            cloud.projX, cloud.projY, 0,
            cloud.projX, cloud.projY, radius
        );

        const c = cloud.color;
        const opacity = c.a * cloud.currentScale;
        grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`);
        grad.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity * 0.4})`);
        grad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cloud.projX, cloud.projY, radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw nebula star connections
    ctx.shadowBlur = 0;
    bgPoints.forEach((p, i) => {
        for (let j = i + 1; j < bgPoints.length; j++) {
            const p2 = bgPoints[j];
            const dx = p.projX - p2.projX;
            const dy = p.projY - p2.projY;
            const distSq = dx * dx + dy * dy;

            if (distSq < 22500) {
                const dist = Math.sqrt(distSq);
                const avgShimmer = (p.shimmerIntensity + p2.shimmerIntensity) / 2;
                const opacity = (1 - dist / 150) * 0.12 * p.currentScale * (1 + avgShimmer);
                ctx.strokeStyle = `rgba(255, 215, 0, ${opacity})`;
                ctx.lineWidth = 0.3 * p.currentScale;
                ctx.beginPath();
                ctx.moveTo(p.projX, p.projY);
                ctx.lineTo(p2.projX, p2.projY);
                ctx.stroke();
            }
        }
    });

    // Draw main wordmark triangles
    triangles.forEach(tri => {
        const p1 = points[tri[0]];
        const p2 = points[tri[1]];
        const p3 = points[tri[2]];

        const avgScale = (p1.currentScale + p2.currentScale + p3.currentScale) / 3;
        const avgTwinkle = (p1.twinkleVal + p2.twinkleVal + p3.twinkleVal) / 3;
        const avgShimmer = (p1.shimmerIntensity + p2.shimmerIntensity + p3.shimmerIntensity) / 3;

        const depthOpacity = Math.max(0.05, (avgScale - 0.3) * avgTwinkle);

        ctx.beginPath();
        ctx.moveTo(p1.projX, p1.projY);
        ctx.lineTo(p2.projX, p2.projY);
        ctx.lineTo(p3.projX, p3.projY);
        ctx.closePath();

        ctx.shadowBlur = (10 + avgShimmer * 20) * avgScale;
        ctx.shadowColor = `rgba(255, 215, 0, ${depthOpacity * 0.6})`;

        if (isPointInTriangle(mouse, p1, p2, p3)) {
            ctx.fillStyle = `rgba(255, 215, 0, ${depthOpacity * 0.7})`;
            ctx.fill();
        }

        ctx.strokeStyle = `rgba(255, 215, 0, ${depthOpacity * (0.35 + avgShimmer * 0.3)})`;
        ctx.lineWidth = 0.5 + (avgScale ** 2.5) * (2.5 + avgShimmer * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;
    });

    // Draw all points (stars)
    [points, bgPoints].forEach((set, idx) => {
        set.forEach(p => {
            const depthOpacity = Math.max(0.05, (p.currentScale - 0.2) * p.twinkleVal);
            const baseAlpha = idx === 0 ? 1 : 0.4;
            ctx.fillStyle = `rgba(255, 215, 0, ${depthOpacity * baseAlpha})`;
            ctx.beginPath();
            const size = (p.starSize || 0.8) * p.currentScale + (p.currentScale ** 2) * (2.5 + p.shimmerIntensity * 2);
            ctx.arc(p.projX, p.projY, size, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    requestAnimationFrame(animate);
}

function isPointInTriangle(mouse, p1, p2, p3) {
    const p = mouse;
    const a = { x: p1.projX, y: p1.projY };
    const b = { x: p2.projX, y: p2.projY };
    const c = { x: p3.projX, y: p3.projY };
    const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
    const s = 1 / (2 * area) * (a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y);
    const t = 1 / (2 * area) * (a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y);
    return s > 0 && t > 0 && (1 - s - t) > 0;
}

window.addEventListener('resize', () => {
    init();
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});

init();
requestAnimationFrame(animate);
