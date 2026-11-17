import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as T from './textures';
import {
  COOKIE_PLATE,
  LEMON_PLATE,
  MARSH_BOWL,
  STRAW_BOWL,
  TABLE_Y,
  TABLE_Z0,
  TABLE_Z1,
  WALL_Z,
} from './layout';
import { mulberry32 } from './util';

const ceramic = (color: string) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });

function lathe(points: [number, number][], seg = 64) {
  const g = new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    seg,
  );
  g.computeVertexNormals();
  return g;
}

export function plateGeo(R = 0.085) {
  const s = R / 0.085;
  const pts: [number, number][] = [
    [0, 0.009],
    [0.06, 0.009],
    [0.068, 0.0105],
    [0.078, 0.0135],
    [0.0845, 0.0155],
    [0.0855, 0.0148],
    [0.0845, 0.0128],
    [0.075, 0.0085],
    [0.064, 0.004],
    [0.06, 0.0005],
    [0.056, 0.0],
    [0.0, 0.0],
  ];
  return lathe(pts.map(([x, y]) => [x * s, y]));
}

export function bowlGeo() {
  const pts: [number, number][] = [
    [0, 0.012],
    [0.04, 0.014],
    [0.058, 0.022],
    [0.068, 0.034],
    [0.073, 0.046],
    [0.076, 0.0475],
    [0.0775, 0.046],
    [0.074, 0.034],
    [0.064, 0.018],
    [0.05, 0.007],
    [0.042, 0.004],
    [0.04, 0.0],
    [0.0, 0.0],
  ];
  return lathe(pts);
}

function catenary(x0: number, x1: number, y: number, sag: number, n: number) {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const x = x0 + (x1 - x0) * u;
    out.push(new THREE.Vector3(x, y - sag * 4 * u * (1 - u), 0));
  }
  return out;
}

export interface SetRefs {
  scene: THREE.Scene;
  key: THREE.DirectionalLight;
  blob: THREE.Mesh;
  fairyMats: THREE.MeshBasicMaterial[];
}

export function buildSet(renderer: THREE.WebGLRenderer): SetRefs {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f8d9d3');

  // Soft studio reflections for glossy eyes, nose, ceramics, juicy fruit.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.45;

  // ---------------- lights ----------------
  const hemi = new THREE.HemisphereLight('#fff4ee', '#e7c3d2', 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight('#fff0df', 2.5);
  key.position.set(-1.3, 2.4, 2.0);
  key.target.position.set(0, 0.4, -0.15);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = -0.85;
  sc.right = 0.85;
  sc.top = 0.85;
  sc.bottom = -0.85;
  sc.near = 0.5;
  sc.far = 6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight('#e3dcff', 0.75);
  fill.position.set(1.6, 0.9, 1.7);
  scene.add(fill);

  const rim = new THREE.DirectionalLight('#ffd3e6', 2.2);
  rim.position.set(0.9, 1.7, -2.0);
  rim.target.position.set(0, 0.5, -0.3);
  scene.add(rim, rim.target);

  const rim2 = new THREE.DirectionalLight('#d8f0ff', 1.1);
  rim2.position.set(-1.2, 1.2, -1.8);
  rim2.target.position.set(0, 0.5, -0.3);
  scene.add(rim2, rim2.target);

  // ---------------- room ----------------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ map: T.woodFloor(), roughness: 0.6 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 96),
    new THREE.MeshStandardMaterial({ map: T.rug(), roughness: 1, transparent: true, alphaTest: 0.5 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.002, -0.55);
  rug.receiveShadow = true;
  scene.add(rug);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 4),
    new THREE.MeshStandardMaterial({ map: T.wallpaper(), roughness: 0.95 }),
  );
  wall.position.set(0, 2, WALL_Z);
  wall.receiveShadow = true;
  scene.add(wall);

  const wains = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 0.5),
    new THREE.MeshStandardMaterial({ map: T.wainscot(), roughness: 0.8 }),
  );
  wains.position.set(0, 0.25, WALL_Z + 0.005);
  scene.add(wains);
  const cream = new THREE.MeshStandardMaterial({ color: '#fff6ea', roughness: 0.6 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(8, 0.03, 0.03), cream);
  rail.position.set(0, 0.5, WALL_Z + 0.015);
  scene.add(rail);
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(8, 0.06, 0.02), cream);
  skirting.position.set(0, 0.03, WALL_Z + 0.01);
  scene.add(skirting);

  // arched window with a pastel sky + rainbow
  const win = new THREE.Group();
  const W = 0.4;
  const H = 0.3;
  const archShape = (w: number, h: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h);
    s.absarc(0, h, w / 2, 0, Math.PI, false);
    s.lineTo(-w / 2, 0);
    return s;
  };
  const skyTex = T.sky();
  skyTex.repeat.set(1 / W, 1 / (H + W / 2));
  skyTex.offset.set(0.5, 0);
  const skyMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(archShape(W, H), 24),
    new THREE.MeshBasicMaterial({ map: skyTex, color: new THREE.Color(1.15, 1.15, 1.15) }),
  );
  win.add(skyMesh);
  const outer = archShape(W + 0.07, H);
  outer.holes.push(archShape(W, H) as unknown as THREE.Path);
  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outer, { depth: 0.03, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, curveSegments: 24 }),
    cream,
  );
  frame.position.set(0, -0.035, 0);
  win.add(frame);
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.014, H + W / 2, 0.02), cream);
  bar1.position.set(0, (H + W / 2) / 2, 0.01);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(W, 0.014, 0.02), cream);
  bar2.position.set(0, H * 0.62, 0.01);
  win.add(bar1, bar2);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, 0.025, 0.08), cream);
  sill.position.set(0, -0.045, 0.03);
  win.add(sill);
  // tiny potted plant on the sill
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.05, 24), ceramic('#f6b9c9'));
  pot.position.set(0.12, -0.007, 0.04);
  win.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#7fcf8f', roughness: 0.6 });
  const rl = mulberry32(31);
  for (let i = 0; i < 7; i++) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), leafMat);
    lf.scale.set(0.6, 1.3, 0.35);
    lf.position.set(0.12 + (rl() - 0.5) * 0.04, 0.035 + rl() * 0.03, 0.04 + (rl() - 0.5) * 0.02);
    lf.rotation.z = (rl() - 0.5) * 1.6;
    win.add(lf);
  }
  win.position.set(-0.33, 0.78, WALL_Z + 0.01);
  scene.add(win);

  // shelf with candy jars
  const shelf = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.022, 0.13), cream);
  shelf.add(board);
  const jarCols = ['#ffc8dd', '#bde0fe', '#fff1a8'];
  jarCols.forEach((c, i) => {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.1 + i * 0.015, 24),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.1, transmission: 0, opacity: 0.55, transparent: true, clearcoat: 1 }),
    );
    jar.position.set(-0.14 + i * 0.1, 0.06 + i * 0.0075, 0);
    const candy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.033, 0.07 + i * 0.015, 20),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }),
    );
    candy.position.copy(jar.position).add(new THREE.Vector3(0, -0.01, 0));
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.016, 24), ceramic(['#f49ac1', '#8ecae6', '#ffd166'][i]));
    lid.position.set(jar.position.x, jar.position.y + (0.1 + i * 0.015) / 2 + 0.008, 0);
    shelf.add(candy, jar, lid);
  });
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.09), new THREE.MeshStandardMaterial({ color: '#c3b1e1' }));
  book.position.set(0.17, 0.06, 0);
  book.rotation.z = -0.12;
  shelf.add(book);
  shelf.position.set(0.42, 0.62, WALL_Z + 0.07);
  scene.add(shelf);

  // bunting
  const bunt = catenary(-1.0, 1.0, 1.42, 0.16, 15);
  const flagCols = ['#ffb3c6', '#bde0fe', '#fff1a8', '#caffbf', '#d7c4f2', '#ffd6a5'];
  const stringMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const flagGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.045, 0, 0),
    new THREE.Vector3(0.045, 0, 0),
    new THREE.Vector3(0, -0.085, 0),
  ]);
  flagGeo.computeVertexNormals();
  bunt.forEach((p, i) => {
    if (i === 0 || i === bunt.length - 1) return;
    const f = new THREE.Mesh(
      flagGeo,
      new THREE.MeshStandardMaterial({ color: flagCols[i % flagCols.length], side: THREE.DoubleSide, roughness: 0.9 }),
    );
    f.position.set(p.x, p.y, WALL_Z + 0.06);
    f.rotation.z = (bunt[i + 1].y - bunt[i - 1].y) * 3;
    scene.add(f);
  });
  const buntCurve = new THREE.CatmullRomCurve3(bunt.map((p) => new THREE.Vector3(p.x, p.y, WALL_Z + 0.06)));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(buntCurve, 80, 0.002, 6), stringMat));

  // fairy lights (bright HDR bulbs -> bokeh + bloom)
  const fairy = catenary(-1.0, 1.0, 1.2, 0.2, 30);
  const fairyMats: THREE.MeshBasicMaterial[] = [];
  const bulbCols = ['#ffd59e', '#ffd59e', '#ffc2d8', '#ffd59e', '#c9f2dd'];
  const bulbGeo = new THREE.SphereGeometry(0.011, 10, 8);
  fairy.forEach((p, i) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(bulbCols[i % bulbCols.length]).multiplyScalar(5) });
    fairyMats.push(m);
    const b = new THREE.Mesh(bulbGeo, m);
    b.position.set(p.x, p.y - 0.012, WALL_Z + 0.12);
    scene.add(b);
  });
  const fairyCurve = new THREE.CatmullRomCurve3(fairy.map((p) => new THREE.Vector3(p.x, p.y, WALL_Z + 0.12)));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(fairyCurve, 80, 0.0018, 6), new THREE.MeshBasicMaterial({ color: '#9bbf9b' })));

  // ---------------- table ----------------
  const table = new THREE.Group();
  const w = 1.7;
  const d = TABLE_Z1 - TABLE_Z0;
  const zc = (TABLE_Z0 + TABLE_Z1) / 2;
  const wood = new THREE.MeshStandardMaterial({ color: '#fbefe1', roughness: 0.55 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), wood);
  top.position.set(0, TABLE_Y - 0.004 - 0.015, zc);
  top.castShadow = true;
  top.receiveShadow = true;
  table.add(top);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.02, d + 0.02),
    new THREE.MeshStandardMaterial({ map: T.gingham(), roughness: 0.95 }),
  );
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.set(0, TABLE_Y, zc);
  cloth.receiveShadow = true;
  table.add(cloth);
  const skirtTex = T.skirt();
  const skirtMat = new THREE.MeshStandardMaterial({ map: skirtTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 });
  const skirtSkew = (width: number, folds: number) => {
    const g = new THREE.PlaneGeometry(width, TABLE_Y + 0.004, Math.round(width * 160), 12);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const drop = 0.5 - y / (TABLE_Y + 0.004); // 0 top .. 1 hem
      const fold = Math.sin(x * folds) * 0.5 + Math.sin(x * folds * 2.3 + 1.3) * 0.25;
      p.setZ(i, fold * 0.009 * Math.pow(drop, 1.2) + 0.004 * drop);
    }
    g.computeVertexNormals();
    g.translate(0, (TABLE_Y + 0.004) / 2 - 0.002, 0);
    return g;
  };
  const fskirt = new THREE.Mesh(skirtSkew(w + 0.02, 38), skirtMat);
  fskirt.position.set(0, 0, TABLE_Z1 + 0.011);
  fskirt.receiveShadow = true;
  fskirt.castShadow = true;
  table.add(fskirt);
  const bskirt = fskirt.clone();
  bskirt.rotation.y = Math.PI;
  bskirt.position.z = TABLE_Z0 - 0.011;
  table.add(bskirt);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(skirtSkew(d + 0.04, 38), skirtMat);
    side.rotation.y = sx * Math.PI / 2;
    side.position.set(sx * (w / 2 + 0.011), 0, zc);
    side.receiveShadow = true;
    side.castShadow = true;
    table.add(side);
  }
  scene.add(table);

  // dishes
  const addDish = (geo: THREE.BufferGeometry, mat: THREE.Material, p: THREE.Vector3) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(p);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  };
  addDish(plateGeo(0.085), ceramic('#c4e4f7'), COOKIE_PLATE);
  addDish(plateGeo(0.07), ceramic('#fff0b3'), LEMON_PLATE);
  addDish(bowlGeo(), ceramic('#ddd0f7'), MARSH_BOWL);
  addDish(bowlGeo(), ceramic('#c9f0dc'), STRAW_BOWL);

  // a little vase of flowers at the table edge (foreground bokeh)
  const vase = new THREE.Group();
  const vb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 16), ceramic('#ffd6e3'));
  vb.scale.set(1, 1.15, 1);
  vb.position.y = 0.045;
  vase.add(vb);
  const flowerCols = ['#ff9ebb', '#fff3b0', '#ffffff', '#c7b8f5'];
  const rf = mulberry32(77);
  for (let i = 0; i < 5; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.12, 6), leafMat);
    const ang = (i / 5) * Math.PI * 2;
    stem.position.set(Math.cos(ang) * 0.012, 0.12, Math.sin(ang) * 0.012);
    stem.rotation.set(Math.sin(ang) * 0.3, 0, -Math.cos(ang) * 0.3);
    vase.add(stem);
    const head = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const pet = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 10, 8),
        new THREE.MeshStandardMaterial({ color: flowerCols[i % 4], roughness: 0.7 }),
      );
      pet.scale.set(1, 0.4, 0.6);
      pet.position.set(Math.cos((k / 6) * 6.283) * 0.012, 0, Math.sin((k / 6) * 6.283) * 0.012);
      head.add(pet);
    }
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd166' }));
    head.add(ctr);
    head.position.set(Math.cos(ang) * 0.04, 0.18 + rf() * 0.03, Math.sin(ang) * 0.04);
    head.rotation.set(0.6 + rf() * 0.4, ang, 0);
    vase.add(head);
  }
  vase.position.set(0.5, TABLE_Y, 0.12);
  vase.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  scene.add(vase);

  // soft contact shadow that follows the bear on the floor
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.5),
    new THREE.MeshBasicMaterial({ map: T.radialSprite('rgba(90,50,60,0.55)', 'rgba(90,50,60,0)'), transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.004;
  blob.renderOrder = 2;
  scene.add(blob);

  return { scene, key, fairyMats, blob };
}
