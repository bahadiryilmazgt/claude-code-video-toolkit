// Lists frames whose eyes are mid-blink / mid-transition (0 < shut < 1).
import { bodyPose } from '../src/engine/choreo';
const out: number[] = [];
for (let f = 0; f < 900; f++) {
  const p = bodyPose(f / 30);
  const shut = Math.max(p.happy, p.squeeze, p.blink);
  if (shut > 0.001 && shut < 0.999) out.push(f);
}
console.log(out.join(' '));
