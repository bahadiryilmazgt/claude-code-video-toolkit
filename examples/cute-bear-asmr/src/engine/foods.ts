import * as THREE from 'three';
import * as T from './textures';
import { mulberry32 } from './util';

type P2 = [number, number];

function segCircle(out: P2, inn: P2, cx: number, cy: number, r: number): P2 {
  // point where segment out->inn crosses the circle (bisection; robust enough)
  let a = 0;
  let b = 1;
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2;
    const x = out[0] + (inn[0] - out[0]) * m;
    const y = out[1] + (inn[1] - out[1]) * m;
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) b = m;
    else a = m;
  }
  return [out[0] + (inn[0] - out[0]) * a, out[1] + (inn[1] - out[1]) * a];
}

function pointInPoly(p: P2, poly: P2[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Polygon minus a "bite" circle whose edge carries little tooth scallops. */
export function biteOut(poly: P2[], cx: number, cy: number, r: number, teeth = 5): P2[] {
  const n = poly.length;
  const ins = poly.map(([x, y]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
  if (!ins.some(Boolean)) return poly;
  const s = ins.findIndex((v) => !v);
  const P = [...poly.slice(s), ...poly.slice(0, s)];
  const I = [...ins.slice(s), ...ins.slice(0, s)];
  const out: P2[] = [];
  let i = 0;
  while (i < n) {
    if (!I[i]) {
      out.push(P[i]);
      i++;
      continue;
    }
    let j = i;
    while (j < n && I[j]) j++;
    const entry = segCircle(P[i - 1], P[i], cx, cy, r);
    const exit = segCircle(P[j % n], P[j - 1], cx, cy, r);
    const a0 = Math.atan2(entry[1] - cy, entry[0] - cx);
    const a1 = Math.atan2(exit[1] - cy, exit[0] - cx);
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const mid = (dd: number): P2 => [cx + Math.cos(a0 + dd / 2) * r, cy + Math.sin(a0 + dd / 2) * r];
    if (!pointInPoly(mid(d), poly)) d = d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI;
    const m = 40;
    out.push(entry);
    for (let k = 1; k < m; k++) {
      const u = k / m;
      const sc = Math.abs(Math.sin(Math.PI * teeth * u));
      const rr = r * (1 + 0.07 * (sc - 0.6));
      out.push([cx + Math.cos(a0 + d * u) * rr, cy + Math.sin(a0 + d * u) * rr]);
    }
    out.push(exit);
    i = j;
  }
  return out;
}

const shapeOf = (pts: P2[]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));

// ======================================================================
// Star cookie with pink icing and sprinkles
// ======================================================================
export const COOKIE_R = 0.066;
export const COOKIE_T = 0.013;
export const COOKIE_BITES: { c: P2; r: number }[] = [
  { c: [0, COOKIE_R * 0.93], r: 0.03 },
  { c: [COOKIE_R * 0.93 * Math.cos((18 * Math.PI) / 180), COOKIE_R * 0.93 * Math.sin((18 * Math.PI) / 180)], r: 0.03 },
];

function starPoly(R: number, n = 240): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const k = Math.pow(0.5 + 0.5 * Math.cos(5 * (a - Math.PI / 2)), 1.5);
    const rr = R * (0.56 + 0.44 * k);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}

export interface Cookie {
  group: THREE.Group;
  setBites(n: number): void;
}

export function buildCookie(): Cookie {
  const group = new THREE.Group();
  const { map, bump } = T.cookieDough();
  map.repeat.set(7, 7);
  bump.repeat.set(7, 7);
  const dough = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.82 });
  const icing = new THREE.MeshPhysicalMaterial({ color: '#ffc4d8', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const bevel = 0.0035;
  const variants: THREE.Group[] = [];
  const rnd = mulberry32(42);
  const sprinkles: { p: P2; a: number; c: string }[] = [];
  const cols = ['#ffffff', '#8fd3ff', '#fff07a', '#9ff0c0', '#c9a7ff', '#ff8fb8'];
  const icePoly = starPoly(COOKIE_R * 0.74);
  while (sprinkles.length < 34) {
    const p: P2 = [(rnd() - 0.5) * COOKIE_R * 1.5, (rnd() - 0.5) * COOKIE_R * 1.5];
    if (pointInPoly(p, starPoly(COOKIE_R * 0.66, 90))) sprinkles.push({ p, a: rnd() * Math.PI, c: cols[Math.floor(rnd() * cols.length)] });
  }
  for (let b = 0; b <= 2; b++) {
    let body = starPoly(COOKIE_R - bevel);
    let ice = icePoly;
    for (let k = 0; k < b; k++) {
      const { c, r } = COOKIE_BITES[k];
      body = biteOut(body, c[0], c[1], r);
      ice = biteOut(ice, c[0], c[1], r + 0.004);
    }
    const g = new THREE.Group();
    const bodyGeo = new THREE.ExtrudeGeometry(shapeOf(body), {
      depth: COOKIE_T,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 4,
    });
    const bm = new THREE.Mesh(bodyGeo, dough);
    bm.castShadow = true;
    bm.receiveShadow = true;
    g.add(bm);
    const iceGeo = new THREE.ExtrudeGeometry(shapeOf(ice), {
      depth: 0.0015,
      bevelEnabled: true,
      bevelThickness: 0.0022,
      bevelSize: 0.003,
      bevelSegments: 4,
      curveSegments: 4,
    });
    const im = new THREE.Mesh(iceGeo, icing);
    im.position.z = COOKIE_T + bevel - 0.0005;
    im.castShadow = true;
    g.add(im);
    const live = sprinkles.filter((s) =>
      COOKIE_BITES.slice(0, b).every(({ c, r }) => (s.p[0] - c[0]) ** 2 + (s.p[1] - c[1]) ** 2 > (r + 0.007) ** 2),
    );
    const sg = new THREE.CapsuleGeometry(0.0011, 0.0045, 2, 6);
    sg.rotateZ(Math.PI / 2);
    const sm = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ roughness: 0.35 }), live.length);
    const mm = new THREE.Matrix4();
    live.forEach((s, i) => {
      mm.makeRotationZ(s.a).setPosition(s.p[0], s.p[1], COOKIE_T + bevel + 0.0045);
      sm.setMatrixAt(i, mm);
      sm.setColorAt(i, new THREE.Color(s.c));
    });
    g.add(sm);
    g.visible = b === 0;
    variants.push(g);
    group.add(g);
  }
  return {
    group,
    setBites(n) {
      variants.forEach((v, i) => (v.visible = i === Math.min(2, n)));
    },
  };
}

// ======================================================================
// Lemon slice
// ======================================================================
export const LEMON_R = 0.044;
export const LEMON_T = 0.009;
export const LEMON_BITE = { c: [0, LEMON_R * 1.02] as P2, r: 0.024 };

export interface Lemon {
  group: THREE.Group;
  setBitten(b: boolean): void;
}

export function buildLemon(): Lemon {
  const group = new THREE.Group();
  const face = T.lemonFace();
  const bevel = 0.0018;
  const R = LEMON_R - bevel;
  face.repeat.set(1 / (2 * LEMON_R), 1 / (2 * LEMON_R));
  face.offset.set(0.5, 0.5);
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: face,
    roughness: 0.25,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    emissive: '#f7d84a',
    emissiveIntensity: 0.12,
  });
  const sideMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.5 });
  const variants: THREE.Mesh[] = [];
  for (const bitten of [false, true]) {
    let poly: P2[] = [];
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      poly.push([Math.cos(a) * R, Math.sin(a) * R]);
    }
    if (bitten) poly = biteOut(poly, LEMON_BITE.c[0], LEMON_BITE.c[1], LEMON_BITE.r, 4);
    const geo = new THREE.ExtrudeGeometry(shapeOf(poly), {
      depth: LEMON_T,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 4,
    });
    const pos = geo.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    const rind = new THREE.Color('#f0c22a');
    const flesh = new THREE.Color('#fbe77a');
    for (let i = 0; i < pos.count; i++) {
      const rr = Math.hypot(pos.getX(i), pos.getY(i));
      const c = rr > LEMON_R * 0.93 ? rind : flesh;
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, [faceMat, sideMat]);
    m.castShadow = true;
    m.receiveShadow = true;
    m.visible = !bitten;
    variants.push(m);
    group.add(m);
  }
  // center the slice on its thickness
  group.children.forEach((c) => (c.position.z = -LEMON_T / 2));
  return {
    group,
    setBitten(b) {
      variants[0].visible = !b;
      variants[1].visible = b;
    },
  };
}

// ======================================================================
// Pink marshmallow (squishable, tearable)
// ======================================================================
export const MARSH_R = 0.042;
export const MARSH_H = 0.052;

function marshProfile(R: number, H: number, cr: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const arc = (cx: number, cy: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr));
    }
  };
  for (let i = 1; i <= 6; i++) pts.push(new THREE.Vector2(((R - cr) * i) / 6, 0));
  arc(R - cr, cr, -Math.PI / 2, 0, 8);
  for (let i = 1; i <= 6; i++) pts.push(new THREE.Vector2(R, cr + ((H - 2 * cr) * i) / 7));
  arc(R - cr, H - cr, 0, Math.PI / 2, 8);
  for (let i = 5; i >= 0; i--) pts.push(new THREE.Vector2(((R - cr) * i) / 6, H));
  return pts.map((p) => new THREE.Vector2(Math.max(p.x, 1e-4), p.y));
}

export interface Marsh {
  group: THREE.Group;
  body: THREE.Mesh;
  piece: THREE.Mesh;
  strand: THREE.Mesh;
  /** local tear point (where the small piece comes from) */
  tearPoint: THREE.Vector3;
  setDent(a: number): void;
}

export function marshMaterial(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.82,
    sheen: 1,
    sheenColor: new THREE.Color('#ffffff'),
    sheenRoughness: 0.55,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.06,
    bumpMap: T.powder(5),
    bumpScale: 0.25,
  });
}

export function marshGeo(R = MARSH_R, H = MARSH_H, seg = 72) {
  const g = new THREE.LatheGeometry(marshProfile(R, H, Math.min(R, H) * 0.34), seg);
  g.translate(0, -H / 2, 0);
  return g;
}

export function buildMarsh(): Marsh {
  const group = new THREE.Group();
  const geo = marshGeo();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const rest = (pos.array as Float32Array).slice();
  const col = new Float32Array(pos.count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = marshMaterial('#ffb3cc');
  mat.vertexColors = true;
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  // tear point: top rim, toward the bear's right paw side (-X) and front
  const tearPoint = new THREE.Vector3(-MARSH_R * 0.62, MARSH_H / 2 - 0.004, MARSH_R * 0.55);
  const piece = new THREE.Mesh(new THREE.IcosahedronGeometry(0.016, 2), marshMaterial('#ffbcd2'));
  piece.scale.set(1.1, 0.85, 0.95);
  piece.castShadow = true;
  piece.visible = false;
  const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.005, 1, 10, 1, true), marshMaterial('#ffd0de'));
  strand.visible = false;
  group.add(piece, strand);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const white = new THREE.Color('#fff4f7');
  return {
    group,
    body,
    piece,
    strand,
    tearPoint,
    setDent(a: number) {
      for (let i = 0; i < pos.count; i++) {
        v.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
        n.fromBufferAttribute(nrm, i);
        const d = v.distanceTo(tearPoint);
        const w = a * Math.exp(-((d / 0.016) ** 2));
        v.addScaledVector(n, -0.012 * w);
        pos.setXYZ(i, v.x, v.y, v.z);
        const k = Math.min(1, w * 1.6);
        col[i * 3] = 1 + (white.r * 1.3 - 1) * k;
        col[i * 3 + 1] = 1 + (white.g * 1.3 - 1) * k;
        col[i * 3 + 2] = 1 + (white.b * 1.3 - 1) * k;
      }
      pos.needsUpdate = true;
      (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}

// ======================================================================
// Strawberry (clipping-plane bite + cross-section cap)
// ======================================================================
export const STRAW_L = 0.054;
const strawProfile: P2[] = [
  [0.0001, 0],
  [0.004, 0.0015],
  [0.008, 0.006],
  [0.012, 0.0125],
  [0.016, 0.0205],
  [0.0195, 0.029],
  [0.0215, 0.0375],
  [0.0215, 0.044],
  [0.019, 0.049],
  [0.0135, 0.0525],
  [0.006, 0.054],
  [0.0001, 0.0542],
];
export function strawRadiusAt(y: number) {
  for (let i = 1; i < strawProfile.length; i++) {
    const [r1, y1] = strawProfile[i];
    const [r0, y0] = strawProfile[i - 1];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return 0;
}

export interface Straw {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  calyx: THREE.Group;
  setCut(yCut: number, worldMatrix: THREE.Matrix4): void;
}

export function buildStrawberry(seed = 1, withClip = false): Straw {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const curve = new THREE.SplineCurve(strawProfile.map(([x, y]) => new THREE.Vector2(x, y)));
  const pts = curve.getPoints(40);
  const geo = new THREE.LatheGeometry(pts, 48);
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const tipC = new THREE.Color('#d9142f');
  const topC = new THREE.Color('#f04a4f');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(tipC).lerp(topC, Math.min(1, pos.getY(i) / STRAW_L) ** 2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 10);
  const planes = withClip ? [clipPlane] : [];
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.3,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    emissive: '#ff2040',
    emissiveIntensity: 0.06,
    clippingPlanes: planes,
    clipShadows: true,
  });
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  body.receiveShadow = true;
  bodyGroup.add(body);
  // seeds
  const rnd = mulberry32(seed * 101);
  const seedGeo = new THREE.SphereGeometry(0.0013, 6, 4);
  seedGeo.scale(0.8, 1.5, 0.8);
  const nSeeds = 70;
  const seeds = new THREE.InstancedMesh(
    seedGeo,
    new THREE.MeshStandardMaterial({ color: '#ffe08a', roughness: 0.4, clippingPlanes: planes }),
    nSeeds,
  );
  const mm = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < nSeeds; i++) {
    const y = 0.004 + (i / nSeeds) * 0.043;
    const a = i * 2.39996 + rnd() * 0.3;
    const r = strawRadiusAt(y) + 0.0002;
    const dr = strawRadiusAt(y + 0.001) - strawRadiusAt(y - 0.001);
    const tilt = Math.atan2(dr, 0.002);
    q.setFromEuler(new THREE.Euler(0, -a, tilt * 0.0));
    mm.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1));
    seeds.setMatrixAt(i, mm);
  }
  bodyGroup.add(seeds);
  // cross-section cap (shown only once bitten)
  const capMat = new THREE.MeshPhysicalMaterial({ map: T.strawberryCap(), roughness: 0.35, clearcoat: 0.8, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.CircleGeometry(1, 40), capMat);
  cap.rotation.x = Math.PI / 2;
  cap.visible = false;
  bodyGroup.add(cap);
  group.add(bodyGroup);
  // calyx: sepals + stem
  const calyx = new THREE.Group();
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4fb35e', roughness: 0.55, side: THREE.DoubleSide });
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -0.0035);
  leafShape.quadraticCurveTo(0.012, -0.004, 0.02, 0);
  leafShape.quadraticCurveTo(0.012, 0.004, 0, 0.0035);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
  for (let i = 0; i < 7; i++) {
    const lf = new THREE.Mesh(leafGeo, leafMat);
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.2;
    const holder = new THREE.Group();
    holder.rotation.y = a;
    lf.rotation.x = Math.PI / 2;
    lf.rotation.y = -(0.35 + rnd() * 0.25); // droop over the shoulder
    holder.add(lf);
    holder.position.y = STRAW_L - 0.0005;
    calyx.add(holder);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0018, 0.013, 8), leafMat);
  stem.position.y = STRAW_L + 0.006;
  stem.rotation.z = 0.15;
  calyx.add(stem);
  calyx.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  group.add(calyx);

  const planeN = new THREE.Vector3();
  const planeP = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  return {
    group,
    bodyGroup,
    calyx,
    setCut(yCut, wm) {
      if (yCut <= 0) {
        clipPlane.set(new THREE.Vector3(0, 1, 0), 100);
        cap.visible = false;
        bodyGroup.visible = true;
        return;
      }
      if (yCut >= STRAW_L - 0.002) {
        bodyGroup.visible = false;
        return;
      }
      bodyGroup.visible = true;
      nm.getNormalMatrix(wm);
      planeN.set(0, 1, 0).applyMatrix3(nm).normalize();
      planeP.set(0, yCut, 0).applyMatrix4(wm);
      clipPlane.setFromNormalAndCoplanarPoint(planeN, planeP);
      const r = strawRadiusAt(yCut);
      cap.visible = true;
      cap.position.set(0, yCut, 0);
      cap.scale.set(r * 0.995, r * 0.995, 1);
    },
  };
}
