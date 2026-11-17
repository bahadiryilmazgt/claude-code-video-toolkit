import * as THREE from 'three';
import { mulberry32 } from './util';

// Procedural canvas textures. Seeded, so every Remotion tab builds identical pixels.

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTex(c: HTMLCanvasElement, srgb = true, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

export function gingham(): THREE.Texture {
  const [c, g] = cv(512, 512);
  g.fillStyle = '#fffaf7';
  g.fillRect(0, 0, 512, 512);
  const n = 8;
  const s = 512 / n;
  g.fillStyle = 'rgba(244,150,178,0.42)';
  for (let i = 0; i < n; i += 2) {
    g.fillRect(i * s, 0, s, 512);
    g.fillRect(0, i * s, 512, s);
  }
  // fabric weave
  const r = mulberry32(3);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.12})`;
    g.fillRect(r() * 512, r() * 512, 1, 3);
    g.fillStyle = `rgba(150,90,110,${r() * 0.05})`;
    g.fillRect(r() * 512, r() * 512, 3, 1);
  }
  return toTex(c, true, [7, 2.2]);
}

/** Full-length tablecloth skirt: gingham with a white scalloped lace hem. */
export function skirt(): THREE.Texture {
  const W = 1024;
  const H = 512;
  const [c, g] = cv(W, H);
  const sx = 56;
  const sy = 48;
  g.fillStyle = '#fffaf7';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(244,150,178,0.42)';
  for (let i = 0; i * sx < W; i += 2) g.fillRect(i * sx, 0, sx, H);
  for (let j = 0; j * sy < H; j += 2) g.fillRect(0, j * sy, W, sy);
  const r = mulberry32(17);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.1})`;
    g.fillRect(r() * W, r() * H, 1, 3);
  }
  // lace hem
  g.fillStyle = '#ffffff';
  g.fillRect(0, H - 46, W, 22);
  for (let x = 0; x < W; x += 32) {
    g.beginPath();
    g.arc(x + 16, H - 24, 16, 0, Math.PI);
    g.fill();
  }
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < W; x += 32) {
    g.beginPath();
    g.arc(x + 16, H - 20, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  const t = toTex(c, true);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

export function woodFloor(): THREE.Texture {
  const [c, g] = cv(1024, 1024);
  const r = mulberry32(11);
  const cols = ['#f3dfc8', '#efd7bd', '#f6e4cf', '#ecd3b8'];
  const pw = 128;
  for (let x = 0; x < 1024; x += pw) {
    let y = -r() * 400;
    while (y < 1024) {
      const len = 300 + r() * 350;
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(x, y, pw, len);
      for (let k = 0; k < 18; k++) {
        g.strokeStyle = `rgba(170,120,80,${0.05 + r() * 0.06})`;
        g.lineWidth = 1 + r() * 1.5;
        g.beginPath();
        const gx = x + r() * pw;
        g.moveTo(gx, y);
        g.bezierCurveTo(gx + r() * 8 - 4, y + len / 3, gx + r() * 8 - 4, y + (2 * len) / 3, gx + r() * 6 - 3, y + len);
        g.stroke();
      }
      g.fillStyle = 'rgba(160,110,80,0.35)';
      g.fillRect(x, y, pw, 2);
      y += len;
    }
    g.fillStyle = 'rgba(160,110,80,0.4)';
    g.fillRect(x, 0, 2, 1024);
  }
  return toTex(c, true, [3, 3]);
}

export function wallpaper(): THREE.Texture {
  const [c, g] = cv(512, 512);
  g.fillStyle = '#fbdcd3';
  g.fillRect(0, 0, 512, 512);
  // soft vertical stripes
  for (let x = 0; x < 512; x += 64) {
    g.fillStyle = 'rgba(255,240,236,0.55)';
    g.fillRect(x, 0, 30, 512);
  }
  const r = mulberry32(5);
  const dots = ['#ffffff', '#fff3c4', '#d8f1e6'];
  for (let y = 16; y < 512; y += 64) {
    for (let x = 16; x < 512; x += 64) {
      const ox = (y / 64) % 2 ? 32 : 0;
      g.fillStyle = dots[Math.floor(r() * 3)];
      g.beginPath();
      g.arc((x + ox) % 512, y, 7, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTex(c, true, [4, 2]);
}

export function wainscot(): THREE.Texture {
  const [c, g] = cv(512, 256);
  g.fillStyle = '#cfeee2';
  g.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = 'rgba(120,170,150,0.25)';
    g.fillRect(x, 0, 3, 256);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(x + 3, 0, 2, 256);
  }
  return toTex(c, true, [6, 1]);
}

export function sky(): THREE.Texture {
  const [c, g] = cv(512, 640);
  const grd = g.createLinearGradient(0, 0, 0, 640);
  grd.addColorStop(0, '#9fd3f4');
  grd.addColorStop(0.65, '#cfe8fb');
  grd.addColorStop(1, '#fde2ee');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 640);
  // rainbow
  const bands = ['#ffb3c6', '#ffd6a5', '#fdffb6', '#caffbf', '#a0c4ff', '#cdb4db'];
  g.globalAlpha = 0.5;
  bands.forEach((b, i) => {
    g.strokeStyle = b;
    g.lineWidth = 16;
    g.beginPath();
    g.arc(300, 640, 360 - i * 16, Math.PI, 2 * Math.PI);
    g.stroke();
  });
  g.globalAlpha = 1;
  const r = mulberry32(8);
  const cloud = (cx: number, cy: number, s: number) => {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(cx + (r() - 0.5) * 120 * s, cy + (r() - 0.5) * 30 * s, (28 + r() * 26) * s, 0, Math.PI * 2);
      g.fill();
    }
  };
  cloud(140, 190, 1.2);
  cloud(390, 120, 0.9);
  cloud(320, 420, 1.0);
  cloud(90, 520, 0.8);
  return toTex(c);
}

export function rug(): THREE.Texture {
  const [c, g] = cv(1024, 1024);
  const cx = 512;
  g.fillStyle = 'rgba(0,0,0,0)';
  g.clearRect(0, 0, 1024, 1024);
  g.fillStyle = '#fff6ec';
  g.beginPath();
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const rr = 500 - 14 * Math.pow(Math.abs(Math.sin(a * 18)), 0.6);
    g.lineTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr);
  }
  g.fill();
  const rings = ['#f9c6d6', '#fff6ec', '#d9cdf3', '#fff6ec', '#f9c6d6'];
  rings.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(cx, cx, 440 - i * 80, 0, Math.PI * 2);
    g.fill();
  });
  const r = mulberry32(21);
  for (let i = 0; i < 20000; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.1})`;
    g.fillRect(r() * 1024, r() * 1024, 2, 2);
  }
  return toTex(c);
}

export function lemonFace(): THREE.Texture {
  const [c, g] = cv(512, 512);
  const cx = 256;
  g.fillStyle = '#f2c72e';
  g.beginPath();
  g.arc(cx, cx, 256, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fbf1c8';
  g.beginPath();
  g.arc(cx, cx, 232, 0, Math.PI * 2);
  g.fill();
  const segs = 10;
  const r = mulberry32(4);
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2 + 0.05;
    const a1 = ((i + 1) / segs) * Math.PI * 2 - 0.05;
    const grd = g.createRadialGradient(cx, cx, 20, cx, cx, 215);
    grd.addColorStop(0, '#fff3a6');
    grd.addColorStop(0.6, '#f9e15a');
    grd.addColorStop(1, '#f6d63e');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(cx + Math.cos((a0 + a1) / 2) * 22, cx + Math.sin((a0 + a1) / 2) * 22);
    g.arc(cx, cx, 212, a0, a1);
    g.closePath();
    g.fill();
    // juice vesicles
    for (let k = 0; k < 70; k++) {
      const a = a0 + (a1 - a0) * (0.15 + 0.7 * r());
      const rr = 40 + r() * 165;
      g.fillStyle = `rgba(255,255,230,${0.25 + r() * 0.35})`;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, 2 + r() * 2, 7 + r() * 8, a, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = '#fdf6d8';
  g.beginPath();
  g.arc(cx, cx, 24, 0, Math.PI * 2);
  g.fill();
  return toTex(c);
}

export function strawberryCap(): THREE.Texture {
  const [c, g] = cv(256, 256);
  const cx = 128;
  const grd = g.createRadialGradient(cx, cx, 4, cx, cx, 128);
  grd.addColorStop(0, '#fff1f0');
  grd.addColorStop(0.35, '#ffd0d4');
  grd.addColorStop(0.75, '#ff7c8c');
  grd.addColorStop(0.93, '#e8213e');
  grd.addColorStop(1, '#c8102e');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const r = mulberry32(9);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    g.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.3})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 30, cx + Math.sin(a) * 30);
    g.lineTo(cx + Math.cos(a) * 110, cx + Math.sin(a) * 110);
    g.stroke();
  }
  return toTex(c);
}

export function cookieDough(): { map: THREE.Texture; bump: THREE.Texture } {
  const [c, g] = cv(512, 512);
  g.fillStyle = '#e2a75c';
  g.fillRect(0, 0, 512, 512);
  const r = mulberry32(13);
  for (let i = 0; i < 2600; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? `rgba(180,110,45,${0.1 + r() * 0.25})` : `rgba(255,225,160,${0.1 + r() * 0.3})`;
    g.beginPath();
    g.arc(r() * 512, r() * 512, 1 + r() * 4, 0, Math.PI * 2);
    g.fill();
  }
  const [c2, g2] = cv(512, 512);
  g2.fillStyle = '#808080';
  g2.fillRect(0, 0, 512, 512);
  const r2 = mulberry32(14);
  for (let i = 0; i < 3500; i++) {
    const v = Math.floor(80 + r2() * 120);
    g2.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g2.beginPath();
    g2.arc(r2() * 512, r2() * 512, 1 + r2() * 3, 0, Math.PI * 2);
    g2.fill();
  }
  const map = toTex(c, true, [1, 1]);
  const bump = toTex(c2, false, [1, 1]);
  return { map, bump };
}

export function radialSprite(inner: string, outer: string, size = 128): THREE.Texture {
  const [c, g] = cv(size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return toTex(c);
}

export function sparkle(): THREE.Texture {
  const [c, g] = cv(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 22);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (const rot of [0, Math.PI / 2]) {
    g.save();
    g.translate(64, 64);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(-62, 0);
    g.quadraticCurveTo(0, -5, 62, 0);
    g.quadraticCurveTo(0, 5, -62, 0);
    g.fill();
    g.restore();
  }
  return toTex(c);
}

export function powder(seed = 1): THREE.Texture {
  const [c, g] = cv(256, 256);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  const r = mulberry32(seed);
  for (let i = 0; i < 4000; i++) {
    const v = Math.floor(100 + r() * 90);
    g.fillStyle = `rgba(${v},${v},${v},0.6)`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  return toTex(c, false, [2, 2]);
}
