import * as THREE from 'three';
import { COOKIE_PLATE, LEMON_PLATE, PLATE_TOP, TABLE_Y, TABLE_Z0, TABLE_Z1 } from './layout';
import { sparkle } from './textures';
import { clamp, ease, mulberry32 } from './util';

// Deterministic particles: every particle position is re-simulated from its
// spawn moment each frame, so any frame can be rendered in isolation.

const G = 3.4; // gentle, slightly slow-mo gravity

function surfaceY(x: number, z: number) {
  for (const p of [COOKIE_PLATE, LEMON_PLATE]) {
    if (Math.hypot(x - p.x, z - p.z) < 0.07) return TABLE_Y + PLATE_TOP;
  }
  if (z > TABLE_Z0 && z < TABLE_Z1 && Math.abs(x) < 0.85) return TABLE_Y;
  return 0;
}

interface Ballistic {
  t0: number;
  p0: THREE.Vector3;
  v0: THREE.Vector3;
  size: number;
  spin: THREE.Vector3;
  color: THREE.Color;
}

function simulate(b: Ballistic, t: number, bounce: boolean) {
  const p = b.p0.clone();
  const vv = b.v0.clone();
  const dt = 1 / 240;
  let landed = -1;
  let tt = b.t0;
  while (tt < t) {
    const h = Math.min(dt, t - tt);
    vv.y -= G * h;
    p.addScaledVector(vv, h);
    const fy = surfaceY(p.x, p.z) + b.size * 0.6;
    if (p.y < fy) {
      p.y = fy;
      if (landed < 0) landed = tt;
      if (!bounce) break;
      vv.y = Math.abs(vv.y) * 0.28;
      vv.x *= 0.55;
      vv.z *= 0.55;
      if (vv.y < 0.05) vv.set(0, 0, 0);
    }
    tt += h;
  }
  return { p, landed, moving: vv.lengthSq() > 1e-4 };
}

function heartShape(s: number) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.9 * s);
  h.bezierCurveTo(-0.15 * s, -0.7 * s, -1.0 * s, -0.25 * s, -1.0 * s, 0.25 * s);
  h.bezierCurveTo(-1.0 * s, 0.75 * s, -0.4 * s, 1.0 * s, 0, 0.55 * s);
  h.bezierCurveTo(0.4 * s, 1.0 * s, 1.0 * s, 0.75 * s, 1.0 * s, 0.25 * s);
  h.bezierCurveTo(1.0 * s, -0.25 * s, 0.15 * s, -0.7 * s, 0, -0.9 * s);
  return h;
}

export interface Spawns {
  crumbs: { t: number; p: THREE.Vector3 }[];
  lemonDrops: { t: number; p: THREE.Vector3 }[];
  strawDrops: { t: number; p: THREE.Vector3 }[];
  hearts: { t: number; p: THREE.Vector3; side: number }[];
  sparkles: { t: number; p: THREE.Vector3; r: number; n: number }[];
}

export class Particles {
  crumbs: Ballistic[] = [];
  drops: (Ballistic & { kind: number })[] = [];
  crumbMesh: THREE.InstancedMesh;
  dropMeshes: THREE.InstancedMesh[];
  hearts: { mesh: THREE.Mesh; t: number; p: THREE.Vector3; side: number }[] = [];
  sparkles: { s: THREE.Sprite; t: number; p: THREE.Vector3; d: number }[] = [];

  constructor(scene: THREE.Scene, sp: Spawns) {
    const r = mulberry32(99);
    const doughCols = ['#d99a4e', '#e7b46b', '#c98a3f', '#ffc4d8', '#f2c27f'];
    for (const c of sp.crumbs) {
      for (let i = 0; i < 16; i++) {
        this.crumbs.push({
          t0: c.t,
          p0: c.p.clone().add(new THREE.Vector3((r() - 0.5) * 0.03, (r() - 0.5) * 0.015, (r() - 0.2) * 0.02)),
          v0: new THREE.Vector3((r() - 0.5) * 0.5, 0.05 + r() * 0.35, 0.05 + r() * 0.35),
          size: 0.0022 + r() * 0.0032,
          spin: new THREE.Vector3(r() * 20, r() * 20, r() * 20),
          color: new THREE.Color(doughCols[Math.floor(r() * doughCols.length)]),
        });
      }
    }
    const crumbGeo = new THREE.DodecahedronGeometry(1, 0);
    this.crumbMesh = new THREE.InstancedMesh(crumbGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), Math.max(1, this.crumbs.length));
    this.crumbs.forEach((c, i) => this.crumbMesh.setColorAt(i, c.color));
    this.crumbMesh.castShadow = true;
    this.crumbMesh.frustumCulled = false;
    scene.add(this.crumbMesh);

    const dropSets: [Spawns['lemonDrops'], number, number][] = [
      [sp.lemonDrops, 0, 16],
      [sp.strawDrops, 1, 9],
    ];
    for (const [list, kind, n] of dropSets) {
      for (const d of list) {
        for (let i = 0; i < n; i++) {
          const a = r() * Math.PI * 2;
          const sp2 = 0.25 + r() * 0.5;
          this.drops.push({
            kind,
            t0: d.t + r() * 0.04,
            p0: d.p.clone(),
            v0: new THREE.Vector3(Math.cos(a) * sp2 * 0.8, 0.15 + r() * 0.45, 0.15 + Math.abs(Math.sin(a)) * sp2 * 0.6),
            size: 0.0016 + r() * 0.0024,
            spin: new THREE.Vector3(),
            color: new THREE.Color(),
          });
        }
      }
    }
    const dropGeo = new THREE.SphereGeometry(1, 14, 10);
    const mats = [
      new THREE.MeshPhysicalMaterial({ color: '#fff5b8', roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.8, emissive: '#f7e27a', emissiveIntensity: 0.25 }),
      new THREE.MeshPhysicalMaterial({ color: '#ff8a9c', roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.85, emissive: '#ff4060', emissiveIntensity: 0.15 }),
    ];
    this.dropMeshes = mats.map((m, k) => {
      const count = Math.max(1, this.drops.filter((d) => d.kind === k).length);
      const im = new THREE.InstancedMesh(dropGeo, m, count);
      im.frustumCulled = false;
      scene.add(im);
      return im;
    });

    const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.02), {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 5,
      curveSegments: 16,
    });
    heartGeo.center();
    const heartMat = new THREE.MeshPhysicalMaterial({ color: '#ff7eb0', roughness: 0.25, clearcoat: 1, emissive: '#ff5c9a', emissiveIntensity: 0.25 });
    for (const h of sp.hearts) {
      const m = new THREE.Mesh(heartGeo, heartMat);
      m.visible = false;
      scene.add(m);
      this.hearts.push({ mesh: m, ...h });
    }

    const stex = sparkle();
    for (const s of sp.sparkles) {
      for (let i = 0; i < s.n; i++) {
        const mat = new THREE.SpriteMaterial({
          map: stex,
          color: new THREE.Color(2.6, 2.5, 2.2),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.visible = false;
        scene.add(sprite);
        const a = r() * Math.PI * 2;
        const rr = s.r * (0.6 + 0.5 * r());
        this.sparkles.push({
          s: sprite,
          t: s.t + i * 0.07 + r() * 0.05,
          p: s.p.clone().add(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr * 1.1, 0.03 + r() * 0.03)),
          d: 0.45 + r() * 0.2,
        });
      }
    }
  }

  update(t: number) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    this.crumbs.forEach((c, i) => {
      if (t < c.t0) {
        m.makeScale(0, 0, 0);
      } else {
        const { p, landed } = simulate(c, t, true);
        const tt = landed > 0 ? landed - c.t0 : t - c.t0;
        e.set(c.spin.x * tt, c.spin.y * tt, c.spin.z * tt);
        q.setFromEuler(e);
        sc.set(c.size, c.size * 0.75, c.size * 0.9);
        m.compose(p, q, sc);
      }
      this.crumbMesh.setMatrixAt(i, m);
    });
    this.crumbMesh.instanceMatrix.needsUpdate = true;
    const counters = [0, 0];
    for (const d of this.drops) {
      const im = this.dropMeshes[d.kind];
      const idx = counters[d.kind]++;
      if (t < d.t0) {
        m.makeScale(0, 0, 0);
      } else {
        const { p, landed } = simulate(d, t, false);
        let s = d.size * clamp((t - d.t0) / 0.03);
        if (landed > 0) s *= 1 - clamp((t - landed) / 0.12);
        const vel = d.v0.clone().add(new THREE.Vector3(0, -G * (t - d.t0), 0));
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.lengthSq() > 1e-6 ? vel.normalize() : new THREE.Vector3(0, 1, 0));
        sc.set(s, s * (landed > 0 ? 0.5 : 1.35), s);
        m.compose(p, q, sc);
      }
      im.setMatrixAt(idx, m);
    }
    this.dropMeshes.forEach((im) => (im.instanceMatrix.needsUpdate = true));

    for (const h of this.hearts) {
      const age = t - h.t;
      const life = 1.5;
      if (age < 0 || age > life) {
        h.mesh.visible = false;
        continue;
      }
      h.mesh.visible = true;
      const sIn = ease('outBack', age / 0.32);
      const sOut = 1 - ease('in', (age - (life - 0.35)) / 0.35);
      const s = Math.max(0, sIn * (age > life - 0.35 ? sOut : 1));
      h.mesh.scale.setScalar(s);
      h.mesh.position.copy(h.p).add(new THREE.Vector3(h.side * 0.04 * age + 0.012 * Math.sin(age * 7), 0.2 * age, 0.02 * age));
      h.mesh.rotation.set(0, 0.5 * Math.sin(age * 3.5), h.side * 0.2 + 0.15 * Math.sin(age * 5));
    }
    for (const sp of this.sparkles) {
      const age = t - sp.t;
      if (age < 0 || age > sp.d) {
        sp.s.visible = false;
        continue;
      }
      sp.s.visible = true;
      const k = Math.sin((age / sp.d) * Math.PI);
      sp.s.scale.setScalar(0.035 * k);
      sp.s.material.rotation = age * 2.5;
      sp.s.position.copy(sp.p);
    }
  }
}
