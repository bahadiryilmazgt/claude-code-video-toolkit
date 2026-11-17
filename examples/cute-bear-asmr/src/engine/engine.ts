import * as THREE from 'three';
import TL from '../timeline.json';
import { Bear } from './bear';
import { bodyPose, cameraAt, handsAndFoods, Scene3 } from './choreo';
import {
  buildCookie,
  buildLemon,
  buildMarsh,
  buildStrawberry,
  COOKIE_BITES,
  COOKIE_T,
  Cookie,
  Lemon,
  LEMON_R,
  Marsh,
  marshGeo,
  marshMaterial,
  Straw,
} from './foods';
import { BOWL_TOP, MARSH_BOWL, STRAW_BOWL } from './layout';
import { Particles, Spawns } from './particles';
import { Post } from './post';
import { buildSet } from './set';
import { mulberry32 } from './util';

const M = TL.marks as Record<string, number>;

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  bear: Bear;
  cookie: Cookie;
  lemon: Lemon;
  marsh: Marsh;
  straw: Straw;
  particles: Particles;
  post: Post;
  fps: number;
  key!: THREE.DirectionalLight;
  blob!: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement, w: number, h: number, fps: number) {
    this.fps = fps;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.84;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.localClippingEnabled = true;
    this.renderer = r;

    const set = buildSet(r);
    this.scene = set.scene;
    this.key = set.key;
    this.blob = set.blob;
    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.04, 20);
    this.bear = new Bear(this.scene);

    this.cookie = buildCookie();
    this.lemon = buildLemon();
    this.marsh = buildMarsh();
    this.straw = buildStrawberry(1, true);
    this.scene.add(this.cookie.group, this.lemon.group, this.marsh.group, this.straw.group);
    this.scene.add(this.marsh.piece, this.marsh.strand);
    this.decor();

    // pre-compute particle spawn points by evaluating the scene at spawn times
    const sp: Spawns = { crumbs: [], lemonDrops: [], strawDrops: [], hearts: [], sparkles: [] };
    for (const [k, tb] of [M.cookieBite1, M.cookieBite2].entries()) {
      this.pose(tb);
      const c = COOKIE_BITES[k].c;
      sp.crumbs.push({ t: tb, p: this.cookie.group.localToWorld(new THREE.Vector3(c[0], c[1] * 0.85, COOKIE_T)) });
    }
    this.pose(M.lemonBite);
    sp.lemonDrops.push({ t: M.lemonBite, p: this.lemon.group.localToWorld(new THREE.Vector3(0, LEMON_R * 0.8, 0.01)) });
    for (const tb of [M.strawBite1, M.strawBite2]) {
      this.pose(tb);
      sp.strawDrops.push({ t: tb, p: this.bear.mouthWorld().add(new THREE.Vector3(0, -0.01, 0.02)) });
    }
    (TL.hearts as number[]).forEach((th, i) => {
      this.pose(th);
      const side = i % 2 === 0 ? 1 : -1;
      sp.hearts.push({ t: th, p: this.bear.faceToWorld([side * 0.27, 0.1 + 0.03 * (i % 3), 0.06]), side });
    });
    for (const [ts, what, n] of [
      [4.47, 'head', 7],
      [6.3, 'cookie', 6],
      [17.95, 'marsh', 6],
      [28.1, 'head', 7],
    ] as [number, string, number][]) {
      this.pose(ts);
      const p =
        what === 'cookie'
          ? this.cookie.group.getWorldPosition(new THREE.Vector3())
          : what === 'marsh'
            ? this.marsh.group.getWorldPosition(new THREE.Vector3())
            : this.bear.faceToWorld([0, 0.02, 0.12]);
      sp.sparkles.push({ t: ts, p, r: what === 'head' ? 0.3 : 0.09, n });
    }
    this.particles = new Particles(this.scene, sp);
    // Fur shells skip the (costly) environment lookups; everything glossy keeps them.
    if ((globalThis as unknown as { FUR_OPTS?: { noenv?: boolean } }).FUR_OPTS?.noenv) {
      const env = this.scene.environment;
      const k = this.scene.environmentIntensity;
      this.scene.traverse((o) => {
        const mats = (o as THREE.Mesh).material;
        if (!mats) return;
        for (const m of Array.isArray(mats) ? mats : [mats]) {
          const sm = m as THREE.MeshStandardMaterial;
          if (sm.isMeshStandardMaterial && !sm.userData.isFur && !sm.envMap) {
            sm.envMap = env;
            sm.envMapIntensity = k;
          }
        }
      });
      this.scene.environment = null;
    }
    this.post = new Post(r, w, h);
  }

  decor() {
    // more treats so the dishes look generous
    const r = mulberry32(55);
    const cols = ['#ffffff', '#ffd1e0', '#d9f5e6', '#e7dcff', '#fff0b8'];
    const g = marshGeo(0.019, 0.022, 32);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(g, marshMaterial(cols[i % cols.length]));
      const a = (i / 7) * Math.PI * 2 + r();
      const rr = i === 0 ? 0 : 0.038;
      m.position.copy(MARSH_BOWL).add(new THREE.Vector3(Math.cos(a) * rr, BOWL_TOP + 0.012 + (i === 0 ? 0 : 0.008), Math.sin(a) * rr));
      m.rotation.set((r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 0.8);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
    for (let i = 0; i < 4; i++) {
      const s = buildStrawberry(i + 2, false);
      const a = (i / 4) * Math.PI * 2 + 0.6;
      s.group.rotation.set(0.3 * r(), a + 1.2, Math.PI / 2 + 0.35 + 0.2 * r());
      s.group.scale.setScalar(0.88 + 0.12 * r());
      const ctr = new THREE.Vector3(0, 0.027, 0).applyEuler(s.group.rotation).multiplyScalar(s.group.scale.x);
      s.group.position.copy(STRAW_BOWL).add(new THREE.Vector3(Math.cos(a) * 0.03, BOWL_TOP + 0.022, Math.sin(a) * 0.03)).sub(ctr);
      this.scene.add(s.group);
    }
  }

  pose(t: number): Scene3 {
    const p = bodyPose(t);
    this.bear.applyBody(p);
    this.bear.applyLegs(p);
    this.bear.root.updateMatrixWorld(true);
    const s = handsAndFoods(t, this.bear);
    p.armR = s.armR;
    p.armL = s.armL;
    this.bear.applyArms(p);
    // foods
    this.cookie.group.position.copy(s.cookie.pos);
    this.cookie.group.quaternion.copy(s.cookie.quat);
    this.cookie.setBites(s.cookie.bites);
    this.lemon.group.position.copy(s.lemon.pos);
    this.lemon.group.quaternion.copy(s.lemon.quat);
    this.lemon.setBitten(s.lemon.bitten);
    this.marsh.group.position.copy(s.marsh.pos);
    this.marsh.group.quaternion.copy(s.marsh.quat);
    const sq = s.marsh.squish;
    this.marsh.body.scale.set(1 - 0.32 * sq, 1 + 0.2 * sq, 1 + 0.2 * sq);
    this.marsh.setDent(s.marsh.dent);
    this.marsh.piece.visible = !!s.marsh.piece;
    if (s.marsh.piece) this.marsh.piece.position.copy(s.marsh.piece);
    this.marsh.strand.visible = !!s.marsh.strand;
    if (s.marsh.strand) {
      const [a, b] = s.marsh.strand;
      const d = b.clone().sub(a);
      const len = Math.max(0.001, d.length());
      this.marsh.strand.position.copy(a).add(b).multiplyScalar(0.5);
      this.marsh.strand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      const thin = Math.max(0.25, 1 - len * 8);
      this.marsh.strand.scale.set(thin, len, thin);
    }
    this.straw.group.position.copy(s.straw.pos);
    this.straw.group.quaternion.copy(s.straw.quat);
    this.straw.group.updateMatrixWorld(true);
    this.straw.setCut(s.straw.cut, this.straw.group.matrixWorld);
    // key-light shadow box and contact blob follow the bear
    const rp = this.bear.root.position;
    const kt = new THREE.Vector3(rp.x * 0.7, 0.4, Math.min(-0.15, rp.z + 0.15));
    this.key.target.position.copy(kt);
    this.key.position.copy(kt).add(new THREE.Vector3(-1.3, 2.0, 2.15));
    this.blob.position.set(rp.x, 0.004, rp.z + 0.02);
    this.scene.updateMatrixWorld(true);
    return s;
  }

  render(frame: number) {
    const prof = (globalThis as unknown as { BEAR_PROFILE?: number }).BEAR_PROFILE;
    if (prof === 2) this.renderer.shadowMap.enabled = false;
    if (prof === 4) this.bear.furParts.forEach((f) => (f.fur.visible = false));
    if (prof === 5) this.bear.furParts.forEach((f) => (f.fur.count = 4));
    if (prof) {
      this.renderer.info.autoReset = false;
      this.renderer.info.reset();
    }
    const gl = this.renderer.getContext();
    const t0 = performance.now();
    const t = frame / this.fps;
    this.pose(t);
    this.particles.update(t);
    const t1 = performance.now();
    const c = cameraAt(t);
    const cam = this.camera;
    cam.position.copy(c.pos);
    cam.fov = c.fov;
    cam.updateProjectionMatrix();
    cam.lookAt(c.look);
    cam.updateMatrixWorld(true);
    const target =
      c.focus === 'marsh'
        ? this.marsh.group.getWorldPosition(new THREE.Vector3())
        : c.focus === 'mouth'
          ? this.bear.mouthWorld().add(new THREE.Vector3(0, -0.03, 0.03))
          : this.bear.faceToWorld([0, 0, 0.15]);
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const focus = target.sub(cam.position).dot(fwd);
    this.post.compMat.uniforms.uDebug.value = (globalThis as unknown as { BEAR_DEBUG?: number }).BEAR_DEBUG ?? 0;
    if (prof === 7) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, cam);
      return;
    }
    this.post.render(prof === 6 ? new THREE.Scene() : this.scene, cam, {
      near: cam.near,
      far: cam.far,
      focus,
      aperture: c.ap * 0.9,
      maxBlur: 22 * (this.post.h / 1920),
      seed: frame * 0.618,
    }, prof ? () => gl.finish() : undefined);
    if (prof) {
      gl.finish();
      const t2 = performance.now();
      const ri = this.renderer.info.render;
      console.log(`PROFILE frame ${frame} pose ${(t1 - t0).toFixed(0)}ms total ${(t2 - t0).toFixed(0)}ms ${this.post.timing} calls ${ri.calls} tris ${ri.triangles} shadow ${this.renderer.shadowMap.enabled}`);
    }
  }
}
