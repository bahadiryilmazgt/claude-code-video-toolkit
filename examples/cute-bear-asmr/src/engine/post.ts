import * as THREE from 'three';

// Render pipeline: MSAA HDR scene pass -> half-res bokeh depth of field ->
// quarter-res bloom -> composite (DoF mix, bloom, vignette, grade, grain) with
// tone mapping and sRGB output.

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DEPTH_FN = `
uniform float uNear, uFar, uFocus, uAperture, uMaxBlur;
float linZ(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float cocPx(float z){ return clamp(uAperture * abs(z - uFocus) / z, 0.0, 1.0) * uMaxBlur; }
`;

const DOF_FS = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uTexel;
varying vec2 vUv;
${DEPTH_FN}
#define NS 56
void main(){
  float zc = linZ(texture2D(tDepth, vUv).r);
  float cc = cocPx(zc);
  vec3 col = texture2D(tColor, vUv).rgb;
  float tot = 1.0;
  for (int i = 0; i < NS; i++) {
    float fi = float(i);
    float ang = fi * 2.39996323;
    float rr = sqrt((fi + 0.5) / float(NS)) * uMaxBlur;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * rr * uTexel;
    vec3 sc = texture2D(tColor, tc).rgb;
    float zs = linZ(texture2D(tDepth, tc).r);
    float cs = cocPx(zs);
    if (zs > zc) cs = min(cs, cc * 2.0);
    float m = smoothstep(rr - 1.5, rr + 1.5, cs);
    col += mix(col / tot, sc, m);
    tot += 1.0;
  }
  gl_FragColor = vec4(col / tot, cc);
}`;

const BRIGHT_FS = `
uniform sampler2D tColor; varying vec2 vUv; uniform vec2 uTexel;
void main(){
  vec3 c = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) c += texture2D(tColor, vUv + vec2(float(x), float(y)) * uTexel * 1.5).rgb;
  c /= 9.0;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(c * smoothstep(1.6, 4.0, l), 1.0);
}`;

const BLUR_FS = `
uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
void main(){
  float w[5]; w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216;
  vec3 c = texture2D(tColor, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture2D(tColor, vUv + uDir * float(i) * 1.6).rgb * w[i];
    c += texture2D(tColor, vUv - uDir * float(i) * 1.6).rgb * w[i];
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const COMP_FS = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tDof; uniform sampler2D tBloom;
uniform float uBloom, uVignette, uGrain, uSeed, uExposure, uDebug;
varying vec2 vUv;
${DEPTH_FN}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
void main(){
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec4 dof = texture2D(tDof, vUv);
  float cc = cocPx(linZ(texture2D(tDepth, vUv).r));
  float k = smoothstep(0.6, 2.2, max(cc, dof.a * 0.0 + cc));
  vec3 c = mix(sharp, dof.rgb, k);
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  // gentle pastel grade: lift shadows toward lilac, warm highlights
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, c * vec3(1.03, 1.0, 0.97), smoothstep(0.3, 1.0, l));
  c += vec3(0.012, 0.006, 0.02) * (1.0 - smoothstep(0.0, 0.35, l));
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(0.8, 1.0)));
  gl_FragColor = vec4(max(c, 0.0), 1.0);
  if (uDebug > 0.5) { gl_FragColor = vec4(cc / 22.0, linZ(texture2D(tDepth, vUv).r) / 6.0, dof.a / 22.0, 1.0); return; }
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  {
    vec3 g = gl_FragColor.rgb;
    float lum = dot(g, vec3(0.299, 0.587, 0.114));
    g = mix(vec3(lum), g, 1.14);
    g = (g - 0.5) * 1.07 + 0.5;
    gl_FragColor.rgb = clamp(g, 0.0, 1.0);
  }
  gl_FragColor.rgb += (hash(vUv * 1000.0) - 0.5) * uGrain;
}`;

export interface PostParams {
  near: number;
  far: number;
  focus: number;
  aperture: number;
  maxBlur: number;
  seed: number;
}

export class Post {
  r: THREE.WebGLRenderer;
  w: number;
  h: number;
  rtMain: THREE.WebGLRenderTarget;
  rtDof: THREE.WebGLRenderTarget;
  rtB1: THREE.WebGLRenderTarget;
  rtB2: THREE.WebGLRenderTarget;
  quad: THREE.Mesh;
  qs = new THREE.Scene();
  qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  dofMat: THREE.ShaderMaterial;
  brightMat: THREE.ShaderMaterial;
  blurMat: THREE.ShaderMaterial;
  compMat: THREE.ShaderMaterial;

  constructor(r: THREE.WebGLRenderer, w: number, h: number) {
    this.r = r;
    this.w = w;
    this.h = h;
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    this.rtMain = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: (globalThis as unknown as { BEAR_PROFILE?: number }).BEAR_PROFILE === 3 ? 0 : 4,
      depthTexture: depth,
    });
    const half = { type: THREE.HalfFloatType, depthBuffer: false } as const;
    this.rtDof = new THREE.WebGLRenderTarget(w / 2, h / 2, half);
    this.rtB1 = new THREE.WebGLRenderTarget(w / 4, h / 4, half);
    this.rtB2 = new THREE.WebGLRenderTarget(w / 4, h / 4, half);
    const lensU = () => ({
      uNear: { value: 0.05 },
      uFar: { value: 20 },
      uFocus: { value: 1 },
      uAperture: { value: 0 },
      uMaxBlur: { value: 20 },
    });
    this.dofMat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: DOF_FS,
      uniforms: {
        tColor: { value: this.rtMain.texture },
        tDepth: { value: depth },
        uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
        ...lensU(),
      },
      depthTest: false,
      depthWrite: false,
    });
    this.brightMat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: BRIGHT_FS,
      uniforms: { tColor: { value: this.rtDof.texture }, uTexel: { value: new THREE.Vector2(2 / w, 2 / h) } },
      depthTest: false,
      depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: BLUR_FS,
      uniforms: { tColor: { value: null }, uDir: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: COMP_FS,
      uniforms: {
        tColor: { value: this.rtMain.texture },
        tDepth: { value: depth },
        tDof: { value: this.rtDof.texture },
        tBloom: { value: this.rtB1.texture },
        uBloom: { value: 0.5 },
        uVignette: { value: 0.22 },
        uGrain: { value: 0.012 },
        uSeed: { value: 0 },
        uExposure: { value: 1.0 },
        uDebug: { value: 0 },
        ...lensU(),
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compMat);
    this.quad.frustumCulled = false;
    this.qs.add(this.quad);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qs, this.qc);
  }

  timing = '';
  render(scene: THREE.Scene, cam: THREE.PerspectiveCamera, p: PostParams, sync?: () => void) {
    const r = this.r;
    const T = [performance.now()];
    const mark = () => {
      if (sync) {
        sync();
        T.push(performance.now());
      }
    };
    for (const m of [this.dofMat, this.compMat]) {
      m.uniforms.uNear.value = p.near;
      m.uniforms.uFar.value = p.far;
      m.uniforms.uFocus.value = p.focus;
      m.uniforms.uAperture.value = p.aperture;
      m.uniforms.uMaxBlur.value = p.maxBlur;
    }
    this.compMat.uniforms.uSeed.value = p.seed;
    const tm = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.rtMain);
    r.clear();
    r.render(scene, cam);
    mark();
    this.pass(this.dofMat, this.rtDof);
    mark();
    this.pass(this.brightMat, this.rtB1);
    for (let i = 0; i < 2; i++) {
      this.blurMat.uniforms.tColor.value = this.rtB1.texture;
      this.blurMat.uniforms.uDir.value.set(4 / this.w, 0);
      this.pass(this.blurMat, this.rtB2);
      this.blurMat.uniforms.tColor.value = this.rtB2.texture;
      this.blurMat.uniforms.uDir.value.set(0, 4 / this.h);
      this.pass(this.blurMat, this.rtB1);
    }
    mark();
    r.toneMapping = tm;
    this.pass(this.compMat, null);
    mark();
    if (sync) this.timing = `scene ${(T[1] - T[0]).toFixed(0)} dof ${(T[2] - T[1]).toFixed(0)} bloom ${(T[3] - T[2]).toFixed(0)} comp ${(T[4] - T[3]).toFixed(0)}`;
  }
}
