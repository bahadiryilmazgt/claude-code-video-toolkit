// Minimal page for the final render: same Engine as the Remotion composition,
// but frames are read straight off the WebGL canvas (much faster than page
// screenshots under software GL).
import { Engine } from '../src/engine/engine';

declare global {
  interface Window {
    bear: { init(w: number, h: number): void; frame(f: number, q: number): string; timing(f: number): string; exp(f: number, mode: string): string };
  }
}

let engine: Engine | null = null;
let canvas: HTMLCanvasElement;

window.bear = {
  init(w, h) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    document.body.appendChild(canvas);
    engine = new Engine(canvas, w, h, 30);
  },
  timing(f) {
    const gl = engine!.renderer.getContext();
    const px1 = new Uint8Array(4);
    const a = performance.now();
    engine!.render(f);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
    const b = performance.now();
    const buf = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const c = performance.now();
    canvas.toDataURL('image/jpeg', 0.97);
    const d = performance.now();
    engine!.render(f + 1);
    gl.readPixels(0, canvas.height - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
    const e = performance.now();
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const g = performance.now();
    return `render+1px ${(b - a).toFixed(0)} | fullReadPixels ${(c - b).toFixed(0)} | toDataURL ${(d - c).toFixed(0)} | render2+1px(top) ${(e - d).toFixed(0)} | full2 ${(g - e).toFixed(0)}`;
  },
  exp(f, mode) {
    const e = engine!;
    const gl = e.renderer.getContext();
    const px = new Uint8Array(4);
    const restore: (() => void)[] = [];
    const hide = (o: { visible: boolean }) => {
      const v = o.visible;
      o.visible = false;
      restore.push(() => (o.visible = v));
    };
    if (mode === 'nofur') e.bear.furParts.forEach((p) => hide(p.fur));
    if (mode === 'noshadow') {
      e.renderer.shadowMap.enabled = false;
      restore.push(() => (e.renderer.shadowMap.enabled = true));
    }
    if (mode === 'nobear') {
      hide(e.bear.root);
      e.bear.arms.forEach((a) => hide(a.part.group));
      e.bear.paws.forEach((p) => hide(p));
    }
    if (mode === 'onlybear') {
      e.scene.children.forEach((c) => {
        if (c !== e.bear.root && !e.bear.paws.includes(c as never) && !e.bear.arms.some((a) => a.part.group === c) && !(c as { isLight?: boolean }).isLight) hide(c);
      });
    }
    const times: number[] = [];
    for (let k = 0; k < 2; k++) {
      const a = performance.now();
      e.render(f + k);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      times.push(performance.now() - a);
    }
    restore.forEach((r) => r());
    return `${mode}: ${times.map((x) => x.toFixed(0)).join(' / ')} ms`;
  },
  frame(f, q) {
    engine!.render(f);
    return canvas.toDataURL('image/jpeg', q);
  },
};
