const SIZE = 32;
const MONSTER = '#5a1888';
const MONSTER_DARK = '#3d1060';
const MONSTER_LIGHT = '#7a2ab0';
const EYE_WHITE = '#f8f4ee';
const PUPIL = '#111111';

// Safari ignores runtime favicon changes; leave the static <link> alone.
const supportsAnimatedFavicon = !(
  /Safari/i.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|OPR/i.test(navigator.userAgent)
);

const canvas = document.createElement('canvas');
canvas.width = SIZE;
canvas.height = SIZE;
const ctx = canvas.getContext('2d');

let link = null;
if (supportsAnimatedFavicon) {
  link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }
}

function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function deform(ox, oy, leanX, leanY, time, heightNorm) {
  const anchor = heightNorm ** 2.1;

  const lump =
    Math.sin(ox * 7 + oy * 5 + time * 0.4) *
      Math.cos(oy * 6 + time * 0.3) *
      0.55 *
      anchor +
    Math.sin(oy * 9) * 0.2 * anchor;
  const wobble = Math.sin(time * 1.4 + ox * 3) * 0.22 * anchor;

  return {
    x: ox + leanX * anchor * 5.5 + lump,
    y: oy + leanY * anchor * 1.4 + wobble + lump * 0.2,
    anchor,
  };
}

function drawBody(cx, cy, rx, ry, leanX, leanY, time) {
  const steps = 40;
  ctx.beginPath();

  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    // Bottom = 0, top = 1 — base stays planted like the 3D blob
    const heightNorm = (1 - sin) * 0.5;
    const ox = cos * rx;
    const oy = sin * ry;
    const d = deform(ox, oy, leanX, leanY, time, heightNorm);

    let x = d.x;
    let y = d.y;

    // Fuzzy hair spikes toward the top
    const topMask = Math.max(0, -sin) ** 0.65;
    const seed = hash(i * 3.7 + 1.2);
    const seed2 = 0.5 + 0.5 * Math.sin(i * 2.3 + time * 1.8);
    const fuzz = seed * seed2 * topMask;
    const spike = fuzz * 2.6;
    x += cos * spike + Math.sin(time * 1.4 + i * 0.7) * 0.4 * fuzz;
    y += sin * spike - fuzz * 0.4;

    if (i === 0) ctx.moveTo(cx + x, cy + y);
    else ctx.lineTo(cx + x, cy + y);
  }

  ctx.closePath();

  const grad = ctx.createRadialGradient(
    cx - rx * 0.28,
    cy - ry * 0.4,
    1.5,
    cx,
    cy + 1,
    rx * 1.2
  );
  grad.addColorStop(0, MONSTER_LIGHT);
  grad.addColorStop(0.5, MONSTER);
  grad.addColorStop(1, MONSTER_DARK);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawEye(x, y, r, lookX, lookY) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = EYE_WHITE;
  ctx.fill();

  const maxOffset = r * 0.34;
  const len = Math.hypot(lookX, lookY) || 1;
  const dist = Math.min(maxOffset, len * maxOffset);
  const px = x + (lookX / len) * dist;
  const py = y + (lookY / len) * dist;

  ctx.beginPath();
  ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = PUPIL;
  ctx.fill();
}

/**
 * Draw one favicon frame from the live monster animation state.
 * @param {{ time: number, smoothTarget: { x: number, y: number }, mouseX: number, mouseY: number }} state
 */
export function updateFavicon(state) {
  if (!supportsAnimatedFavicon) return;

  const { time, smoothTarget, mouseX, mouseY } = state;

  ctx.clearRect(0, 0, SIZE, SIZE);

  const rx = 11.4;
  const ry = 10.5;
  // Plant the base on the bottom edge; only the top leans (like the main blob)
  const cx = SIZE * 0.5;
  const cy = SIZE - 1 - ry + Math.sin(time * 1.1) * 0.12;

  drawBody(cx, cy, rx, ry, smoothTarget.x, smoothTarget.y, time);

  const eyeSpacing = 4.35;
  const eyeR = 3.15;
  const eyeLocalY = -ry * 0.4;
  const eyeHeightNorm = (1 - eyeLocalY / ry) * 0.5;

  const lookX = (mouseX / window.innerWidth - 0.5) * 2;
  const lookY = (mouseY / window.innerHeight - 0.5) * 2;

  for (const side of [-1, 1]) {
    const d = deform(
      side * eyeSpacing,
      eyeLocalY,
      smoothTarget.x,
      smoothTarget.y,
      time,
      eyeHeightNorm
    );
    drawEye(cx + d.x, cy + d.y, eyeR, lookX, lookY);
  }

  link.href = canvas.toDataURL('image/png');
}
