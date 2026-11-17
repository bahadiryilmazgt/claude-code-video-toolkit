import * as THREE from 'three';
import { ellipsoid, FurPart, makeFurPart } from './fur';
import { radialSprite } from './textures';
import { clamp, lerp, smooth } from './util';

// "Honey": an original chibi teddy bear. Honey-caramel plush fur, cream muzzle and
// belly, big glossy eyes, pink paw beans, mint satin bow.

export type V3 = [number, number, number];

export interface ArmPose {
  target: V3; // world-space wrist position
  palm: V3; // direction the paw pads face
  finger: V3; // direction the paw "fingers" point
}

export interface BearPose {
  rootPos: V3;
  rootYaw: number;
  bob: number;
  lean: number;
  roll: number;
  twist: number;
  squash: number;
  walkPhase: number;
  walkAmp: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  headSquash: number;
  headFwd: number;
  eyeUpper: number; // front elevation (rad) of the upper lid edge: 0.95 open .. -0.08 shut
  eyeLower: number; // front elevation of the lower lid edge: -0.95 open .. -0.08 shut
  eyeWide: number; // eyeball scale
  gazeYaw: number;
  gazePitch: number;
  happy: number; // ^ ^ closed-eye smile shape
  blink: number;
  squeeze: number; // > < squeezed shut
  sparkle: number;
  browRaise: number;
  browTilt: number; // + inner ends up (curious / worried), - scrunched
  mouthOpen: number;
  mouthWide: number;
  smile: number;
  tongue: number;
  jaw: number;
  cheekPuff: number;
  blush: number;
  noseWiggle: number;
  earL: number;
  earR: number;
  earFlat: number;
  armR: ArmPose;
  armL: ArmPose;
}

const FUR = { color: '#d8955a', tip: '#f4c896', rootDark: 0.74, rim: '#ffe2cf' };
const CREAM = { color: '#f1d6b2', tip: '#fff2df', rootDark: 0.82, rim: '#fff3e8' };

// head-local feature anchors (relative to the head sphere centre)
const HEAD_R: V3 = [0.258, 0.225, 0.225];
const EYE_R = 0.062;
const EYE_C = (s: number): V3 => [s * 0.098, 0.004, 0.176];
const MUZ_C: V3 = [0, -0.08, 0.168];
const MUZ_R: V3 = [0.113, 0.079, 0.082];

function headDeform(v: THREE.Vector3) {
  const yn = v.y / HEAD_R[1];
  v.x *= 1 + 0.06 * smooth((0.2 - yn) / 0.9);
  v.z *= 1 + 0.03 * smooth((0.2 - yn) / 0.9);
  if (v.y > 0) v.y *= 0.95;
}

export function muzzleZ(x: number, y: number): number {
  const dx = x / MUZ_R[0];
  const dy = (y - MUZ_C[1]) / MUZ_R[1];
  const k = 1 - dx * dx - dy * dy;
  return MUZ_C[2] + MUZ_R[2] * Math.sqrt(Math.max(0, k));
}

class Arm {
  geo: THREE.BufferGeometry;
  part: FurPart;
  NU = 20;
  NV = 16;
  curve = new THREE.QuadraticBezierCurve3();
  constructor() {
    const { NU, NV } = this;
    const g = new THREE.BufferGeometry();
    const n = (NU + 1) * (NV + 1);
    const pos = new Float32Array(n * 3);
    const nrm = new Float32Array(n * 3);
    const fp = new Float32Array(n * 3);
    const fn = new Float32Array(n * 3);
    const idx: number[] = [];
    for (let i = 0; i <= NU; i++) {
      for (let j = 0; j <= NV; j++) {
        const k = i * (NV + 1) + j;
        const a = (j / NV) * Math.PI * 2;
        fp.set([(i / NU) * 0.26, Math.cos(a) * 0.05, Math.sin(a) * 0.05], k * 3);
        fn.set([0, Math.cos(a), Math.sin(a)], k * 3);
        if (i < NU && j < NV) {
          const b = k + NV + 1;
          idx.push(k, k + 1, b, b, k + 1, b + 1);
        }
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('furPos', new THREE.BufferAttribute(fp, 3));
    g.setAttribute('furNrm', new THREE.BufferAttribute(fn, 3));
    g.setIndex(idx);
    this.geo = g;
    this.part = makeFurPart(g, { ...FUR, length: 0.011, density: 380, shells: 16 });
    this.part.base.frustumCulled = false;
  }
  update(shoulder: THREE.Vector3, wrist: THREE.Vector3, bendDir: THREE.Vector3) {
    const L0 = 0.25;
    const d = shoulder.distanceTo(wrist);
    const bend = Math.sqrt(Math.max(0, L0 * L0 - d * d)) * 0.42 + 0.012;
    const mid = shoulder.clone().add(wrist).multiplyScalar(0.5).addScaledVector(bendDir, bend);
    this.curve.v0.copy(shoulder);
    this.curve.v1.copy(mid);
    this.curve.v2.copy(wrist);
    const { NU, NV } = this;
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const nrm = this.geo.getAttribute('normal') as THREE.BufferAttribute;
    const T0 = this.curve.getTangent(0);
    let N = new THREE.Vector3(0, 1, 0);
    if (Math.abs(N.dot(T0)) > 0.9) N.set(1, 0, 0);
    N = N.sub(T0.clone().multiplyScalar(N.dot(T0))).normalize();
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const B = new THREE.Vector3();
    const o = new THREE.Vector3();
    let prevT = T0.clone();
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      this.curve.getPoint(u, p);
      this.curve.getTangent(u, t);
      // parallel transport the frame
      const axis = new THREE.Vector3().crossVectors(prevT, t);
      const s = axis.length();
      if (s > 1e-6) {
        axis.normalize();
        N.applyAxisAngle(axis, Math.asin(clamp(s, -1, 1)));
      }
      prevT.copy(t);
      B.crossVectors(t, N).normalize();
      const r = lerp(0.054, 0.046, u) * (1 + 0.1 * Math.sin(u * Math.PI));
      for (let j = 0; j <= NV; j++) {
        const a = (j / NV) * Math.PI * 2;
        o.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        const k = i * (NV + 1) + j;
        pos.setXYZ(k, p.x + o.x * r, p.y + o.y * r, p.z + o.z * r);
        nrm.setXYZ(k, o.x, o.y, o.z);
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

class Eye {
  group = new THREE.Group(); // positioned at the eye centre, faces +Z
  ball: THREE.Mesh;
  upper: THREE.Mesh;
  lower: THREE.Mesh;
  lash: THREE.Mesh;
  lashMat: THREE.MeshStandardMaterial;
  glints: THREE.Mesh[] = [];
  side: number;
  constructor(side: number, lidMat: THREE.Material) {
    this.side = side;
    const ballMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });
    ballMat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            vec3 dlo = normalize(vLocal);
            float ang = acos(clamp(dlo.z, -1.0, 1.0));
            float az = atan(dlo.y, dlo.x);
            vec3 pupil = vec3(0.012, 0.007, 0.006);
            vec3 irisIn = vec3(0.16, 0.075, 0.03);
            vec3 irisOut = vec3(0.36, 0.17, 0.06);
            float streak = 0.85 + 0.15 * sin(az * 23.0) * sin(az * 7.0 + 1.3);
            float lowerGlow = 0.75 + 0.5 * smoothstep(0.2, -0.9, dlo.y);
            vec3 iris = mix(irisIn, irisOut, smoothstep(0.32, 0.62, ang)) * streak * lowerGlow;
            vec3 col = mix(pupil, iris, smoothstep(0.30, 0.34, ang));
            col = mix(col, vec3(0.02, 0.012, 0.01), smoothstep(0.64, 0.7, ang));
            diffuseColor.rgb = col;
          }`,
        );
    };
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 48, 32), ballMat);
    this.group.add(this.ball);
    // lids: hemispheres slightly larger than the eye, rotated about X
    const lg = new THREE.SphereGeometry(EYE_R * 1.045, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    this.upper = new THREE.Mesh(lg, lidMat);
    const lg2 = new THREE.SphereGeometry(EYE_R * 1.04, 40, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    this.lower = new THREE.Mesh(lg2, lidMat);
    this.group.add(this.upper, this.lower);
    this.lashMat = new THREE.MeshStandardMaterial({ color: '#3a2014', roughness: 0.6 });
    this.lash = new THREE.Mesh(new THREE.BufferGeometry(), this.lashMat);
    this.group.add(this.lash);
    const glintMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.9, 1.9), toneMapped: true });
    for (const [phi, el, sz] of [
      [-0.36, 0.42, 0.017],
      [0.3, -0.3, 0.0075],
    ] as [number, number, number][]) {
      const gl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), glintMat);
      const rr = EYE_R * 1.004;
      const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(el), Math.sin(el), Math.cos(phi) * Math.cos(el));
      gl.position.copy(dir).multiplyScalar(rr);
      gl.lookAt(dir.clone().multiplyScalar(2));
      gl.scale.set(sz, sz * 0.85, sz * 0.15);
      gl.userData.base = sz;
      this.glints.push(gl);
      this.group.add(gl);
    }
  }
  /** distance from the eye centre along local dir `d` to the head surface */
  surfDist(d: THREE.Vector3) {
    const C = EYE_C(this.side);
    const df = d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.side * 0.2);
    const R = [0.27, 0.214, 0.232];
    let a = 0;
    let b = 0;
    let c = -1;
    for (let i = 0; i < 3; i++) {
      const di = df.getComponent(i);
      a += (di * di) / (R[i] * R[i]);
      b += (2 * C[i] * di) / (R[i] * R[i]);
      c += (C[i] * C[i]) / (R[i] * R[i]);
    }
    return (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
  }
  setPose(p: BearPose) {
    const wide = p.eyeWide;
    const blinkW = p.blink * clamp(1 - p.happy - p.squeeze);
    const shut = Math.max(p.happy, p.squeeze, p.blink);
    // closed eyes are drawn on the fur: the eyeball squashes and tucks into the head
    const tuck = smooth(clamp(shut * 1.3));
    this.ball.scale.set(wide * (1 - 0.12 * tuck), wide * (1 - 0.85 * smooth(shut)), wide * (1 - 0.12 * tuck));
    this.ball.position.z = -0.04 * tuck;
    this.ball.rotation.set(-p.gazePitch, p.gazeYaw, 0);
    const eu = lerp(p.eyeUpper, -0.06, shut);
    const el = lerp(p.eyeLower, -0.06, shut);
    this.upper.rotation.x = -eu;
    this.lower.rotation.x = -el;
    this.upper.position.z = this.lower.position.z = -0.04 * tuck;
    this.upper.scale.setScalar(wide);
    this.lower.scale.setScalar(wide);
    this.upper.visible = this.lower.visible = false;
    this.glints.forEach((g, i) => {
      const s = g.userData.base * (1 + p.sparkle * (i === 0 ? 0.35 : 0.6));
      g.scale.set(s, s * 0.85, s * 0.15);
      g.visible = shut < 0.5;
    });
    // lash line: follows the upper lid, morphs to ^ (happy) or > / < (squeeze)
    const N = 28;
    const pts: THREE.Vector3[] = [];
    const wOpen = clamp(1 - p.happy - p.squeeze - blinkW);
    const dir = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const phiO = lerp(-1.25, 1.25, s);
      const eO = Math.atan(Math.tan(eu) * Math.cos(phiO));
      const phiH = lerp(-0.95, 0.95, s);
      const eH = -0.18 + 0.4 * Math.pow(Math.cos((phiH / 0.95) * (Math.PI / 2)), 1.1);
      const tri = 1 - Math.abs(2 * s - 1);
      const phiS = -this.side * lerp(-0.85, 0.5, tri);
      const eS = 0.38 * (1 - 2 * s);
      const phiB = lerp(-1.05, 1.05, s);
      const eB = -0.02 - 0.13 * Math.cos((phiB / 1.05) * (Math.PI / 2));
      const phi = wOpen * phiO + p.happy * phiH + p.squeeze * phiS + blinkW * phiB;
      const e = wOpen * eO + p.happy * eH + p.squeeze * eS + blinkW * eB;
      dir.set(Math.sin(phi) * Math.cos(e), Math.sin(e), Math.cos(phi) * Math.cos(e));
      const rOpen = EYE_R * 1.085 * wide;
      const rShut = this.surfDist(dir) + 0.0045;
      const rr = lerp(rOpen, rShut, tuck);
      pts.push(dir.clone().multiplyScalar(rr));
    }
    const thick = lerp(0.0032, 0.0055, shut);
    this.lash.geometry.dispose();
    this.lash.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, thick, 6, false);
  }
}

export class Bear {
  root = new THREE.Group();
  hips = new THREE.Group();
  neck = new THREE.Group();
  head = new THREE.Group();
  face = new THREE.Group(); // origin = head sphere centre
  muzzle = new THREE.Group();
  eyes: Eye[];
  brows: THREE.Group[] = [];
  ears: THREE.Group[] = [];
  cheeks: FurPart[] = [];
  blush: THREE.Mesh[] = [];
  nose: THREE.Mesh;
  mouthHole: THREE.Mesh;
  tongue: THREE.Mesh;
  mouthLine: THREE.Mesh;
  arms: Arm[];
  paws: THREE.Group[] = [];
  thighs: THREE.Group[] = [];
  feet: THREE.Group[] = [];
  furParts: FurPart[] = [];
  shoulderLocal = [new THREE.Vector3(-0.15, 0.27, 0.02), new THREE.Vector3(0.15, 0.27, 0.02)];

  constructor(scene: THREE.Scene) {
    const add = (p: FurPart) => {
      this.furParts.push(p);
      return p;
    };
    scene.add(this.root);
    this.root.add(this.hips);
    this.hips.position.set(0, 0.12, 0);

    // torso + belly
    const torso = add(makeFurPart(ellipsoid(0.185, 0.2, 0.165, 4), { ...FUR, length: 0.013, density: 360, shells: 20 }));
    torso.group.position.set(0, 0.15, 0);
    this.hips.add(torso.group);
    const belly = add(
      makeFurPart(ellipsoid(0.125, 0.135, 0.05, 3), { ...CREAM, length: 0.009, density: 400, shells: 16 }),
    );
    belly.group.position.set(0, 0.125, 0.128);
    this.hips.add(belly.group);
    // satin bow
    const satin = new THREE.MeshPhysicalMaterial({
      color: '#8fe0c0',
      roughness: 0.32,
      sheen: 1,
      sheenColor: new THREE.Color('#e9fff6'),
      clearcoat: 0.4,
    });
    const bow = new THREE.Group();
    for (const s of [-1, 1]) {
      const lobe = new THREE.Mesh(ellipsoid(0.042, 0.027, 0.016, 3, (v) => (v.y *= 1 + 0.5 * Math.abs(v.x) / 0.042)), satin);
      lobe.position.set(s * 0.038, 0, 0);
      lobe.rotation.z = s * 0.12;
      lobe.castShadow = true;
      bow.add(lobe);
    }
    const knot = new THREE.Mesh(ellipsoid(0.015, 0.016, 0.014, 3), satin);
    knot.position.z = 0.006;
    bow.add(knot);
    bow.position.set(0, 0.305, 0.128);
    bow.rotation.x = -0.25;
    this.hips.add(bow);

    // head
    this.hips.add(this.neck);
    this.neck.position.set(0, 0.32, 0.0);
    this.neck.add(this.head);
    this.head.add(this.face);
    this.face.position.set(0, 0.2, 0.01);
    const eyeMasks = [-1, 1].map((s) => new THREE.Vector4(s * 0.098, 0.004, 0.2, 0.066));
    const headPart = add(
      makeFurPart(ellipsoid(HEAD_R[0], HEAD_R[1], HEAD_R[2], 5, headDeform), {
        ...FUR,
        length: 0.012,
        density: 400,
        shells: 22,
        masks: eyeMasks,
        maskMin: 0.4,
      }),
    );
    this.face.add(headPart.group);

    // ears
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.165, 0.16, -0.035);
      const ear = add(
        makeFurPart(ellipsoid(0.08, 0.076, 0.042, 3, (v) => {
          if (v.z > 0) v.z *= 0.55;
        }), { ...FUR, length: 0.009, density: 400, shells: 14 }),
      );
      ear.group.position.set(s * 0.03, 0.045, 0);
      ear.group.rotation.z = -s * 0.38;
      pivot.add(ear.group);
      const inner = new THREE.Mesh(
        ellipsoid(0.048, 0.045, 0.018, 3),
        new THREE.MeshPhysicalMaterial({ color: '#f3a2b6', roughness: 0.75, sheen: 1, sheenColor: new THREE.Color('#ffd8e3') }),
      );
      inner.position.set(s * 0.03, 0.04, 0.02);
      inner.rotation.z = -s * 0.38;
      pivot.add(inner);
      this.face.add(pivot);
      this.ears.push(pivot);
    }

    // cheeks (puff when chewing)
    for (const s of [-1, 1]) {
      const ch = add(
        makeFurPart(ellipsoid(0.072, 0.064, 0.064, 3), { ...FUR, length: 0.011, density: 400, shells: 16 }),
      );
      ch.group.position.set(s * 0.13, -0.078, 0.122);
      this.face.add(ch.group);
      this.cheeks.push(ch);
    }

    // muzzle
    this.face.add(this.muzzle);
    const muzPart = add(
      makeFurPart(ellipsoid(MUZ_R[0], MUZ_R[1], MUZ_R[2], 4), {
        ...CREAM,
        length: 0.005,
        density: 480,
        shells: 12,
        masks: [new THREE.Vector4(0, 0.04, 0.072, 0.03), new THREE.Vector4(0, -0.02, 0.078, 0.022)],
        maskMin: 0.1,
      }),
    );
    muzPart.group.position.set(...MUZ_C);
    this.muzzle.add(muzPart.group);
    const noseMat = new THREE.MeshPhysicalMaterial({ color: '#3b2318', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    this.nose = new THREE.Mesh(
      ellipsoid(0.037, 0.025, 0.022, 4, (v) => {
        v.x *= 1 + 0.25 * (v.y / 0.025);
      }),
      noseMat,
    );
    this.nose.position.set(0, -0.043, muzzleZ(0, -0.043) - 0.004);
    this.nose.rotation.x = -0.25;
    this.nose.castShadow = true;
    this.muzzle.add(this.nose);
    // mouth: dark opening + tongue + "w" lip line
    this.mouthHole = new THREE.Mesh(
      ellipsoid(1, 1, 1, 3),
      new THREE.MeshStandardMaterial({ color: '#4a1820', roughness: 0.7 }),
    );
    this.muzzle.add(this.mouthHole);
    this.tongue = new THREE.Mesh(ellipsoid(1, 1, 1, 3), new THREE.MeshPhysicalMaterial({ color: '#ee7d93', roughness: 0.4, clearcoat: 0.6 }));
    this.muzzle.add(this.tongue);
    this.mouthLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#3a2014', roughness: 0.6 }));
    this.muzzle.add(this.mouthLine);

    // eyes
    const lidMat = new THREE.MeshStandardMaterial({ color: '#d69a60', roughness: 0.95 });
    this.eyes = [-1, 1].map((s) => {
      const e = new Eye(s, lidMat);
      e.group.position.set(...EYE_C(s));
      e.group.rotation.y = s * 0.2;
      this.face.add(e.group);
      return e;
    });

    // brows
    const browMat = new THREE.MeshStandardMaterial({ color: '#a86d3c', roughness: 1 });
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.0062, 0.028, 4, 10), browMat);
      b.rotation.z = Math.PI / 2;
      b.scale.set(1, 1, 0.5);
      const holder = new THREE.Group();
      holder.add(b);
      this.face.add(holder);
      this.brows.push(holder);
    }

    // blush
    const blushTex = radialSprite('rgba(255,120,150,0.9)', 'rgba(255,120,150,0)');
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.085, 0.06),
        new THREE.MeshBasicMaterial({ map: blushTex, transparent: true, depthWrite: false, opacity: 0.5 }),
      );
      const bx = s * 0.158;
      const by = -0.05;
      const bz = HEAD_R[2] * 1.02 * Math.sqrt(Math.max(0, 1 - (bx / 0.275) ** 2 - (by / HEAD_R[1]) ** 2));
      const n = new THREE.Vector3(bx / 0.275 ** 2, by / HEAD_R[1] ** 2, bz / HEAD_R[2] ** 2).normalize();
      m.position.set(bx, by, bz).addScaledVector(n, 0.017);
      m.lookAt(m.position.clone().add(n));
      m.renderOrder = 5;
      this.face.add(m);
      this.blush.push(m);
    }

    // arms + paws (world space)
    this.arms = [new Arm(), new Arm()];
    for (const a of this.arms) {
      this.furParts.push(a.part);
      scene.add(a.part.group);
    }
    const padMat = new THREE.MeshPhysicalMaterial({ color: '#f39bb0', roughness: 0.45, clearcoat: 0.4, sheen: 0.6 });
    for (let i = 0; i < 2; i++) {
      const paw = new THREE.Group();
      const pp = add(
        makeFurPart(ellipsoid(0.05, 0.054, 0.045, 4), {
          ...FUR,
          length: 0.009,
          density: 400,
          shells: 14,
          masks: [new THREE.Vector4(0, 0.005, 0.045, 0.032)],
          maskMin: 0.05,
        }),
      );
      paw.add(pp.group);
      const pad = new THREE.Mesh(ellipsoid(0.023, 0.019, 0.008, 3), padMat);
      pad.position.set(0, -0.008, 0.041);
      paw.add(pad);
      for (const [x, y] of [
        [-0.019, 0.018],
        [0, 0.025],
        [0.019, 0.018],
      ]) {
        const bean = new THREE.Mesh(ellipsoid(0.0085, 0.0085, 0.0045, 2), padMat);
        bean.position.set(x, y, 0.0375);
        paw.add(bean);
      }
      scene.add(paw);
      this.paws.push(paw);
    }

    // legs
    for (const s of [-1, 1]) {
      const th = new THREE.Group();
      const thigh = add(makeFurPart(ellipsoid(0.07, 0.065, 0.07, 3), { ...FUR, length: 0.011, density: 360, shells: 14 }));
      th.add(thigh.group);
      this.root.add(th);
      this.thighs.push(th);
      const ft = new THREE.Group();
      const foot = add(makeFurPart(ellipsoid(0.062, 0.042, 0.082, 3), { ...FUR, length: 0.01, density: 360, shells: 12 }));
      ft.add(foot.group);
      const sole = new THREE.Mesh(ellipsoid(0.04, 0.008, 0.055, 2), padMat);
      sole.position.set(0, -0.036, 0.01);
      ft.add(sole);
      this.root.add(ft);
      this.feet.push(ft);
    }
  }

  /** head-local (face) point -> world */
  faceToWorld(p: THREE.Vector3 | V3, out = new THREE.Vector3()) {
    if (Array.isArray(p)) out.set(p[0], p[1], p[2]);
    else out.copy(p);
    return this.face.localToWorld(out);
  }
  hipsToWorld(p: V3, out = new THREE.Vector3()) {
    return this.hips.localToWorld(out.set(p[0], p[1], p[2]));
  }
  mouthWorld(out = new THREE.Vector3()) {
    return this.muzzle.localToWorld(out.set(0, -0.098, muzzleZ(0, -0.098)));
  }

  applyBody(p: BearPose) {
    this.root.position.set(...p.rootPos);
    this.root.rotation.y = p.rootYaw;
    this.hips.position.set(0, 0.12 + p.bob, 0);
    this.hips.rotation.set(p.lean, p.twist, p.roll, 'YXZ');
    this.hips.scale.set(1 / Math.sqrt(p.squash), p.squash, 1 / Math.sqrt(p.squash));
    this.neck.position.set(0, 0.32, p.headFwd);
    this.head.rotation.set(p.headPitch, p.headYaw, p.headRoll, 'YXZ');
    this.head.scale.set(1 / Math.sqrt(p.headSquash), p.headSquash, 1 / Math.sqrt(p.headSquash));

    // face
    this.eyes.forEach((e) => e.setPose(p));
    this.brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      const x = s * 0.1;
      const y = 0.098 + p.browRaise * 0.022;
      const zs = HEAD_R[2] * Math.sqrt(Math.max(0, 1 - (x / 0.268) ** 2 - (y / 0.214) ** 2));
      b.position.set(x, y, zs + 0.009);
      b.rotation.set(-0.35, s * 0.42, -s * p.browTilt * 0.5 + s * 0.05);
    });
    const puff = p.cheekPuff;
    this.cheeks.forEach((c, i) => {
      const s = i === 0 ? -1 : 1;
      const k = lerp(0.72, 1.14, puff);
      c.group.scale.set(k, k * 0.96, k);
      c.group.position.set(s * lerp(0.128, 0.142, puff), -0.078 - 0.006 * puff + p.jaw * 0.004, lerp(0.118, 0.13, puff));
    });
    this.blush.forEach((b) => {
      (b.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.62 * p.blush;
      b.scale.setScalar(0.9 + 0.3 * p.blush + 0.15 * puff);
    });
    this.ears.forEach((e, i) => {
      const s = i === 0 ? -1 : 1;
      e.rotation.set(-0.15 - p.earFlat * 0.6, s * p.earFlat * 0.3, -s * (i === 0 ? p.earR : p.earL));
    });
    // muzzle / jaw
    this.muzzle.position.set(0, -p.jaw * 0.006, p.jaw * 0.002);
    this.muzzle.scale.set(1 + p.jaw * 0.03, 1 + p.jaw * 0.05, 1);
    this.nose.position.y = -0.043 + 0.0035 * p.noseWiggle;
    this.nose.scale.set(1 + 0.12 * Math.abs(p.noseWiggle), 1 - 0.06 * Math.abs(p.noseWiggle), 1);
    this.updateMouth(p);
  }

  updateMouth(p: BearPose) {
    const open = clamp(p.mouthOpen);
    const wide = p.mouthWide;
    const cy = -0.094;
    // opening
    const hw = 0.026 * wide * (0.65 + 0.35 * open);
    const hh = 0.003 + 0.032 * open;
    const my = cy - hh * 0.75;
    this.mouthHole.visible = open > 0.03;
    this.mouthHole.scale.set(hw, hh, 0.014);
    this.mouthHole.position.set(0, my, muzzleZ(0, my) - 0.0085);
    this.tongue.visible = open > 0.2 && p.tongue > 0.01;
    this.tongue.scale.set(hw * 0.7, hh * 0.45 * p.tongue, 0.012);
    this.tongue.position.set(0, my - hh * 0.45, muzzleZ(0, my - hh * 0.45) - 0.006);
    // "w" lip line: philtrum + two curls, opening up as the mouth opens
    const pts: THREE.Vector3[] = [];
    const curl = 0.006 + 0.004 * p.smile;
    const span = 0.03 * wide * (1 + 0.25 * open);
    for (let i = 0; i <= 30; i++) {
      const s = (i / 30) * 2 - 1; // -1..1
      const x = s * span;
      const a = Math.abs(s);
      const w = -Math.sin(a * Math.PI) * curl; // two dips
      const corner = p.smile * 0.01 * a * a; // corners lift
      const drop = -open * hh * 0.25 * (1 - a * a);
      const y = cy + w + corner + drop;
      pts.push(new THREE.Vector3(x, y, muzzleZ(x, y) + 0.0035));
    }
    const ph: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const y = lerp(-0.064, cy, i / 6);
      ph.push(new THREE.Vector3(0, y, muzzleZ(0, y) + 0.0035));
    }
    this.mouthLine.geometry.dispose();
    const g1 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0028, 6);
    const g2 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ph), 8, 0.0026, 6);
    this.mouthLine.geometry = mergeTwo(g1, g2);
  }

  applyLegs(p: BearPose) {
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const ph = p.walkPhase + (i === 0 ? 0 : Math.PI);
      const lift = Math.max(0, Math.sin(ph)) * 0.035 * p.walkAmp;
      const fwd = Math.cos(ph) * 0.06 * p.walkAmp;
      this.feet[i].position.set(s * 0.085, 0.042 + lift, 0.03 + fwd);
      this.feet[i].rotation.x = -Math.sin(ph) * 0.3 * p.walkAmp;
      const hip = new THREE.Vector3(s * 0.085, 0.02, 0);
      this.hips.updateMatrix();
      hip.applyMatrix4(this.hips.matrix);
      const foot = this.feet[i].position;
      const mid = hip.clone().add(foot).multiplyScalar(0.5);
      this.thighs[i].position.copy(mid);
      const dir = hip.clone().sub(foot).normalize();
      this.thighs[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
  }

  applyArms(p: BearPose) {
    this.root.updateMatrixWorld(true);
    const arms = [p.armR, p.armL];
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const a = arms[i];
      const shoulder = this.hips.localToWorld(this.shoulderLocal[i].clone());
      const target = new THREE.Vector3(...a.target);
      const maxL = 0.3;
      const d = target.clone().sub(shoulder);
      if (d.length() > maxL) target.copy(shoulder).addScaledVector(d.normalize(), maxL);
      const bodyC = this.hips.localToWorld(new THREE.Vector3(0, 0.15, 0));
      const out = shoulder.clone().sub(bodyC).setY(0).normalize();
      const bend = out.multiplyScalar(0.8).add(new THREE.Vector3(0, -0.6, 0)).normalize();
      // wrist sits a little back from the paw centre, along the forearm
      const paw = this.paws[i];
      const palm = new THREE.Vector3(...a.palm).normalize();
      const fing = new THREE.Vector3(...a.finger);
      fing.sub(palm.clone().multiplyScalar(fing.dot(palm))).normalize();
      const xAx = new THREE.Vector3().crossVectors(fing, palm).normalize();
      const m = new THREE.Matrix4().makeBasis(xAx, fing, palm);
      paw.quaternion.setFromRotationMatrix(m);
      paw.position.copy(target);
      const wrist = target.clone().addScaledVector(fing, -0.022);
      this.arms[i].update(shoulder, wrist, bend);
      void s;
    }
  }
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const A = a.getAttribute(name).array as Float32Array;
    const B = b.getAttribute(name).array as Float32Array;
    const C = new Float32Array(A.length + B.length);
    C.set(A);
    C.set(B, A.length);
    g.setAttribute(name, new THREE.BufferAttribute(C, 3));
  }
  const ia = a.getIndex()!.array;
  const ib = b.getIndex()!.array;
  const off = a.getAttribute('position').count;
  const idx = new Uint32Array(ia.length + ib.length);
  idx.set(ia);
  for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + off;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  a.dispose();
  b.dispose();
  return g;
}
