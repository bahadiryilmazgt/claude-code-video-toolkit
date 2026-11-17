import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shell-texture fur. A furry part is a solid base mesh (casts shadows) plus an
// InstancedMesh whose instances are concentric shells pushed out along the
// normal. Each shell keeps only the pixels that belong to a strand, so the
// stack of shells reads as individual tapered hairs. Strand placement uses the
// rest-pose `furPos`/`furNrm` attributes, so the fur never swims when the part
// moves, scales or (for the arms) deforms.

export interface FurOptions {
  color: string;
  tip?: string;
  rootDark?: number;
  length: number;
  density: number;
  shells?: number;
  droop?: number;
  rim?: string;
  rimAmt?: number;
  /** Up to 4 spheres (furPos space, xyz + radius) where fur gets short. */
  masks?: THREE.Vector4[];
  maskMin?: number;
}

export interface FurPart {
  base: THREE.Mesh;
  fur: THREE.InstancedMesh;
  group: THREE.Group;
  uniforms: Record<string, THREE.IUniform>;
}

const NO_MASK = new THREE.Vector4(1e4, 1e4, 1e4, 0.0001);

export function makeFurMaterial(o: FurOptions) {
  const shells = o.shells ?? 20;
  const masks = (o.masks ?? []).slice(0, 4);
  while (masks.length < 4) masks.push(NO_MASK.clone());
  const uniforms: Record<string, THREE.IUniform> = {
    uShells: { value: shells },
    uFurLen: { value: o.length },
    uDensity: { value: o.density },
    uDroop: { value: o.droop ?? 0.35 },
    uGravity: { value: new THREE.Vector3(0, -1, 0.15).normalize() },
    uRootDark: { value: o.rootDark ?? 0.55 },
    uTip: { value: new THREE.Color(o.tip ?? o.color) },
    uRim: { value: new THREE.Color(o.rim ?? '#ffe6d6') },
    uRimAmt: { value: o.rimAmt ?? 0.5 },
    uMask: { value: masks },
    uMaskMin: { value: o.maskMin ?? 0.25 },
    uWind: { value: new THREE.Vector3(0, 0, 0) },
  };
  const m = new THREE.MeshStandardMaterial({
    color: o.color,
    roughness: 0.92,
    metalness: 0,
    alphaToCoverage: true,
  });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 furPos; attribute vec3 furNrm;
        uniform float uShells, uFurLen, uDroop, uMaskMin; uniform vec3 uGravity, uWind; uniform vec4 uMask[4];
        varying vec3 vFurPos; varying vec3 vFurNrm; varying float vShell; varying float vLenF;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float shell = float(gl_InstanceID + 1) / uShells;
        vShell = shell; vFurPos = furPos; vFurNrm = furNrm;
        float lenF = 1.0;
        for (int i = 0; i < 4; i++) {
          float dm = distance(furPos, uMask[i].xyz);
          lenF = min(lenF, mix(uMaskMin, 1.0, smoothstep(uMask[i].w, uMask[i].w * 1.7, dm)));
        }
        vLenF = lenF;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        vec3 nV = normalize( normalMatrix * objectNormal );
        vec3 gV = (viewMatrix * vec4(uGravity + uWind, 0.0)).xyz;
        vec3 dir = normalize(nV + gV * uDroop * shell);
        mvPosition.xyz += dir * uFurLen * lenF * shell;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uDensity, uRootDark, uRimAmt; uniform vec3 uTip, uRim;
        varying vec3 vFurPos; varying vec3 vFurNrm; varying float vShell; varying float vLenF;
        vec3 hash33(vec3 p){ p = fract(p * vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy + p.yxx)*p.zyx); }`,
      )
      .replace(
        '#include <alphatest_fragment>',
        `{
          vec3 p = vFurPos * uDensity; vec3 cell = floor(p); vec3 f = fract(p);
          vec3 h = hash33(cell);
          vec3 c = 0.3 + 0.4 * h;
          vec3 dv = f - c; vec3 nn = normalize(vFurNrm);
          dv -= dot(dv, nn) * nn;
          float d = length(dv);
          float len = (0.5 + 0.5 * h.z) * vLenF;
          float sh = vShell;
          float r = 0.43 * (1.0 - 0.85 * sh / max(len, 1e-3));
          float aa = fwidth(d) * 0.7 + 1e-4;
          float a = smoothstep(r + aa, r - aa, d) * step(sh, len);
          // far away a strand is smaller than a pixel: fade to average coverage
          float px = length(fwidth(p));
          float farF = smoothstep(0.45, 1.1, px);
          a = mix(a, step(sh, len) * clamp(1.3 * (1.0 - sh / max(len, 1e-3)), 0.0, 1.0) * 0.8, farF);
          if (a < 0.04) discard;
          diffuseColor.a = a;
          float g = pow(sh, 0.75);
          diffuseColor.rgb *= mix(uRootDark, 1.0, g) * (0.94 + 0.12 * h.x);
          diffuseColor.rgb = mix(diffuseColor.rgb, uTip, g * g * 0.55);
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight += uRim * uRimAmt * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5) * vShell;
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'fur-v1';
  return { material: m, uniforms, shells };
}

/** Copy position/normal into the rest-pose attributes the fur shader reads. */
export function addFurAttributes(geo: THREE.BufferGeometry) {
  geo.setAttribute('furPos', geo.getAttribute('position').clone());
  geo.setAttribute('furNrm', geo.getAttribute('normal').clone());
  return geo;
}

/** Smooth, seam-free ellipsoid with an optional vertex deformation. */
export function ellipsoid(
  rx: number,
  ry: number,
  rz: number,
  detail = 4,
  deform?: (v: THREE.Vector3) => void,
) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.set(v.x * rx, v.y * ry, v.z * rz);
    if (deform) deform(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function makeFurPart(
  geo: THREE.BufferGeometry,
  o: FurOptions,
  baseMat?: THREE.Material,
): FurPart {
  if (!geo.getAttribute('furPos')) addFurAttributes(geo);
  const { material, uniforms, shells } = makeFurMaterial(o);
  const base = new THREE.Mesh(
    geo,
    baseMat ??
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(o.color).multiplyScalar(o.rootDark ?? 0.55),
        roughness: 1,
      }),
  );
  base.castShadow = true;
  base.receiveShadow = true;
  const fur = new THREE.InstancedMesh(geo, material, shells);
  const id = new THREE.Matrix4();
  for (let i = 0; i < shells; i++) fur.setMatrixAt(i, id);
  fur.receiveShadow = !(globalThis as unknown as { FUR_NOSHADOW?: number }).FUR_NOSHADOW;
  fur.castShadow = false;
  fur.frustumCulled = false;
  const group = new THREE.Group();
  group.add(base, fur);
  return { base, fur, group, uniforms };
}
