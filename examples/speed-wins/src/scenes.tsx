import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Avatar,
  BoltIcon,
  Bubble,
  Center,
  CheckIcon,
  clamp,
  Coin,
  CrossIcon,
  EnvelopeIcon,
  EyeIcon,
  HairIcon,
  Headline,
  HeartIcon,
  IconBadge,
  Label,
  LightSweep,
  Particles,
  Phone,
  PHONE_H,
  PHONE_W,
  pop,
  ShieldIcon,
  stagger,
  ToothIcon,
} from "./components";
import { AdCard, ChatScreen, CTA_POINT, PATIENT_MESSAGE } from "./screens";
import { C, cue, fontFamily, goldGradient, SAFE_TOP } from "./theme";

const HEAD_TOP = SAFE_TOP + 14; // 244px: first headline baseline sits just under Instagram's top bar
const PHONE_X = 540;
const PHONE_Y = 1040;
const PHONE_S = 0.94;

// ======================================================= 1. HOOK

export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = "01_hook";

  const drop = pop(frame, 0, fps, 11, 0.9);
  const y = interpolate(drop, [0, 1], [-1500, 0]);
  const rot = interpolate(drop, [0, 1], [-9, 0]);
  const card = pop(frame, 9, fps, 15);

  // Coin flies in an arc from bottom-left into the ad.
  const coinT = interpolate(frame, [24, 40], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const coinX = interpolate(coinT, [0, 1], [130, PHONE_X]);
  const coinY = interpolate(coinT, [0, 1], [1700, 900]) - Math.sin(coinT * Math.PI) * 260;
  const coinS = interpolate(coinT, [0, 1], [1.2, 0.45]);
  const impact = interpolate(frame, [40, 46, 70], [0, 1, 0.35], clamp);
  const ring = interpolate(frame, [40, 62], [0, 1], clamp);

  const q = cue(id, "ama");
  return (
    <AbsoluteFill>
      <Headline
        top={HEAD_TOP}
        size={86}
        lines={[[{ t: "Reklama" }, { t: "para" }], [{ t: "harcıyorsun…", gold: true }]]}
        at={[cue(id, "Reklama"), cue(id, "para"), cue(id, "harcıyorsun")]}
      />
      <Headline
        top={HEAD_TOP + 214}
        size={44}
        weight={700}
        underline={false}
        lines={[[{ t: "ama" }, { t: "mesajlara" }, { t: "geç", danger: true }, { t: "mi" }, { t: "dönüyorsun?" }]]}
        at={[q, cue(id, "mesajlara"), cue(id, "geç"), cue(id, "mi"), cue(id, "dönüyorsun")]}
      />
      <Center
        x={PHONE_X}
        y={PHONE_Y}
        style={{ transform: `translate(-50%,-50%) translateY(${y}px) rotate(${rot}deg) scale(${PHONE_S})` }}
      >
        <Phone glow={0.7 + impact * 0.6}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateX(${(1 - card) * 520}px)`,
              opacity: Math.min(1, card * 2),
            }}
          >
            <AdCard glow={impact} />
          </div>
          <LightSweep from={44} dur={20} />
        </Phone>
      </Center>
      {/* impact ring where the coin lands */}
      {ring > 0 && ring < 1 ? (
        <Center x={PHONE_X} y={900}>
          <div
            style={{
              width: 80 + ring * 420,
              height: 80 + ring * 420,
              borderRadius: "50%",
              border: `${4 * (1 - ring) + 1}px solid ${C.goldHi}`,
              opacity: 1 - ring,
              boxShadow: `0 0 30px ${C.gold}`,
            }}
          />
        </Center>
      ) : null}
      {coinT > 0 && coinT < 1 ? (
        <Center x={coinX} y={coinY} style={{ transform: `translate(-50%,-50%) scale(${coinS})`, perspective: 600 }}>
          <Coin size={150} spin={frame * 24} />
        </Center>
      ) : null}
    </AbsoluteFill>
  );
};

// ======================================================= 2. PATIENT WRITES

const TYPE_START = 16;
const TYPE_END = 50;
const SEND_AT = 54;

export const ScenePatient: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = "02_patient";

  // Tap on the ad's CTA, then the ad gives way to the chat.
  const tap = interpolate(frame, [0, 3, 8], [0, 1, 0], clamp);
  const morph = interpolate(frame, [6, 16], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const ripple = interpolate(frame, [1, 18], [0, 1], clamp);
  const typed = interpolate(frame, [TYPE_START, TYPE_END], [0, 1], clamp);
  const sent = pop(frame, SEND_AT, fps, 12);
  const shake = frame >= SEND_AT + 3 && frame < SEND_AT + 15 ? Math.sin(frame * 3.1) * 5 : 0;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: HEAD_TOP + 20, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative" }}>
          <Headline
            top={0}
            size={96}
            lines={[[{ t: "Hasta" }, { t: "yazdı", gold: true }]]}
            at={[cue(id, "Hasta"), cue(id, "reklamını")]}
          />
          <div style={{ width: 760, height: 120 }} />
        </div>
      </div>
      <Center x={540} y={HEAD_TOP + 210}>
        <div
          style={{
            transform: `scale(${pop(frame, cue(id, "görüyor"), fps, 10)}) rotate(${interpolate(frame, [cue(id, "görüyor"), cue(id, "görüyor") + 20], [-14, 0], clamp)}deg)`,
            filter: "drop-shadow(0 0 18px rgba(230,199,122,0.7))",
          }}
        >
          <EnvelopeIcon size={78} stroke={6} />
        </div>
      </Center>
      <Center
        x={PHONE_X + shake}
        y={PHONE_Y}
        style={{ transform: `translate(-50%,-50%) scale(${PHONE_S})` }}
      >
        <Phone glow={0.7 + sent * 0.3}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - morph, transform: `scale(${1 + morph * 0.12})`, filter: `blur(${morph * 10}px)` }}>
            <AdCard tap={tap} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: morph, transform: `scale(${1.08 - morph * 0.08})` }}>
            <ChatScreen name="Estetik Klinik" typed={typed} sent={sent} />
          </div>
          {/* finger tap */}
          {ripple > 0 && ripple < 1 ? (
            <div
              style={{
                position: "absolute",
                left: CTA_POINT.x,
                top: CTA_POINT.y,
                width: 40 + ripple * 220,
                height: 40 + ripple * 220,
                transform: "translate(-50%,-50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(243,234,216,${0.55 * (1 - ripple)}) 0%, transparent 70%)`,
                border: `3px solid rgba(243,234,216,${1 - ripple})`,
              }}
            />
          ) : null}
          <LightSweep from={0} dur={16} opacity={0.35} />
        </Phone>
      </Center>
    </AbsoluteFill>
  );
};

// ======================================================= 3. SHE WRITES TO EVERYONE

const CLINICS = [
  { name: "Sen", Icon: ToothIcon, x: 300, y: 820 },
  { name: "Klinik B", Icon: CrossIcon, x: 780, y: 820 },
  { name: "Klinik C", Icon: EyeIcon, x: 300, y: 1300 },
  { name: "Klinik D", Icon: HairIcon, x: 780, y: 1300 },
];
const HUB = { x: 540, y: 1060 };
const MINI = 0.4;

export const SceneEveryone: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = "03_everyone";

  // Pull back: the phone shrinks into the hub, then splits into four.
  const shrink = interpolate(frame, [0, 22], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const phoneS = interpolate(shrink, [0, 1], [PHONE_S, 0.22]);
  const phoneY = interpolate(shrink, [0, 1], [PHONE_Y, HUB.y]);
  const split = pop(frame, 20, fps, 14, 0.8);
  const hubAvatar = interpolate(frame, [18, 30], [0, 1], clamp);
  const sends = [cue(id, "Aynı"), cue(id, "anda"), cue(id, "birkaç"), cue(id, "kliniğe")];

  return (
    <AbsoluteFill>
      <Headline
        top={HEAD_TOP + 30}
        size={76}
        lines={[[{ t: "Sadece" }, { t: "sana" }, { t: "değil." }]]}
        at={[cue(id, "sadece"), cue(id, "sana"), cue(id, "değil")]}
        exitAt={sends[0] - 8}
      />
      <Headline
        top={HEAD_TOP}
        size={84}
        lines={[[{ t: "Aynı" }, { t: "anda" }], [{ t: "4", gold: true }, { t: "kliniğe", gold: true }, { t: "birden" }]]}
        at={[sends[0], sends[1], sends[2], sends[3], cue(id, "birden")]}
      />
      {/* gold lines hub -> phones */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {CLINICS.map((c, i) => {
          const draw = interpolate(frame, [30 + i * 4, 52 + i * 4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          const len = Math.hypot(c.x - HUB.x, c.y - HUB.y);
          const hot = interpolate(frame, [sends[i], sends[i] + 8, sends[i] + 30], [0, 1, 0.3], clamp);
          return (
            <line
              key={i}
              x1={HUB.x}
              y1={HUB.y}
              x2={c.x}
              y2={c.y}
              stroke={C.goldHi}
              strokeWidth={2.5 + hot * 3}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - draw)}
              opacity={0.55 + hot * 0.45}
              style={{ filter: `drop-shadow(0 0 ${6 + hot * 10}px ${C.gold})` }}
            />
          );
        })}
      </svg>
      {CLINICS.map((c, i) => {
        const x = interpolate(split, [0, 1], [HUB.x, c.x]);
        const y = interpolate(split, [0, 1], [HUB.y, c.y]);
        const s = interpolate(split, [0, 1], [0.22, MINI]);
        const got = pop(frame, sends[i] + 9, fps, 12);
        const glow = interpolate(frame, [sends[i] + 9, sends[i] + 16, sends[i] + 40], [0, 1, 0.4], clamp);
        return (
          <Center key={i} x={x} y={y} style={{ transform: `translate(-50%,-50%) scale(${s})`, opacity: split > 0.02 ? 1 : 0 }}>
            <Phone glow={0.6 + glow * 1.4}>
              <ChatScreen name={c.name === "Sen" ? "Senin Kliniğin" : c.name} status="" typed={0} sent={got} scale={1.15} />
              <div style={{ position: "absolute", top: 70, right: 26, filter: "drop-shadow(0 0 10px rgba(230,199,122,0.7))" }}>
                <c.Icon size={70} stroke={6} />
              </div>
            </Phone>
            {c.name === "Sen" ? (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: -110,
                  transform: `translateX(-50%) scale(${1 / s * 0.4})`,
                  transformOrigin: "bottom center",
                  padding: "10px 34px",
                  borderRadius: 40,
                  background: goldGradient,
                  fontFamily,
                  fontWeight: 800,
                  fontSize: 50,
                  color: C.navy,
                  opacity: interpolate(frame, [36, 46], [0, 1], clamp),
                  whiteSpace: "nowrap",
                }}
              >
                SEN
              </div>
            ) : null}
          </Center>
        );
      })}
      {/* messages flying from the patient to each clinic */}
      {CLINICS.map((c, i) => {
        const t = interpolate(frame, [sends[i], sends[i] + 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
        if (t <= 0 || t >= 1) return null;
        return (
          <Center key={i} x={HUB.x + (c.x - HUB.x) * t} y={HUB.y + (c.y - HUB.y) * t}>
            <div
              style={{
                width: 70,
                height: 54,
                borderRadius: 16,
                background: C.cream,
                boxShadow: `0 0 30px ${C.goldHi}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${0.7 + Math.sin(t * Math.PI) * 0.5})`,
              }}
            >
              <EnvelopeIcon size={40} color={C.navy} stroke={8} />
            </div>
          </Center>
        );
      })}
      {/* the shrinking original phone, then the patient avatar at the hub */}
      {shrink < 1 ? (
        <Center x={PHONE_X} y={phoneY} style={{ transform: `translate(-50%,-50%) scale(${phoneS})`, opacity: 1 - split }}>
          <Phone>
            <ChatScreen name="Estetik Klinik" typed={1} sent={1} />
          </Phone>
        </Center>
      ) : null}
      <Center x={HUB.x} y={HUB.y} style={{ transform: `translate(-50%,-50%) scale(${hubAvatar})` }}>
        <div style={{ borderRadius: "50%", boxShadow: `0 0 50px rgba(230,199,122,0.7)` }}>
          <Avatar size={150} />
        </div>
      </Center>
      <Center x={HUB.x} y={HUB.y + 112} style={{ opacity: hubAvatar }}>
        <Label size={30} color={C.goldHi} style={{ letterSpacing: 4 }}>HASTA</Label>
      </Center>
    </AbsoluteFill>
  );
};

// ======================================================= 4. THE RACE

const PANEL_TOP = 470;
const PANEL_H = 1040;

const Panel: React.FC<{ x: number; children: React.ReactNode; tone: "you" | "rival"; dim: number; glow: number }> = ({
  x,
  children,
  tone,
  dim,
  glow,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: PANEL_TOP,
      width: 486,
      height: PANEL_H,
      borderRadius: 40,
      overflow: "hidden",
      background: "linear-gradient(180deg, rgba(19,48,90,0.75), rgba(6,19,37,0.9))",
      border: `2px solid ${tone === "you" ? `rgba(226,85,58,${0.25 + (1 - glow) * 0.3})` : `rgba(230,199,122,${0.35 + glow * 0.6})`}`,
      boxShadow: tone === "rival" ? `0 0 ${glow * 70}px rgba(201,162,75,${glow * 0.6})` : "none",
    }}
  >
    {children}
    <div style={{ position: "absolute", inset: 0, background: `rgba(2,7,16,${dim})`, pointerEvents: "none" }} />
  </div>
);

const Clock: React.FC<{ size: number; minuteDeg: number; hourDeg: number; arc?: number; color?: string }> = ({
  size,
  minuteDeg,
  hourDeg,
  arc = 0,
  color = C.goldHi,
}) => {
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 14px rgba(201,162,75,0.6))` }}>
      <circle cx="50" cy="50" r="46" fill="rgba(6,19,37,0.6)" stroke={color} strokeWidth="2.5" />
      {arc > 0 ? (
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - arc)}
          transform="rotate(-90 50 50)"
          strokeLinecap="round"
          opacity={0.9}
        />
      ) : null}
      {new Array(12).fill(0).map((_, i) => (
        <line
          key={i}
          x1="50"
          y1="9"
          x2="50"
          y2={i % 3 === 0 ? 16 : 13}
          stroke={C.cream}
          strokeWidth={i % 3 === 0 ? 2.4 : 1.4}
          transform={`rotate(${i * 30} 50 50)`}
          opacity={0.8}
        />
      ))}
      <line x1="50" y1="50" x2="50" y2="28" stroke={C.cream} strokeWidth="4" strokeLinecap="round" transform={`rotate(${hourDeg} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="17" stroke={color} strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${minuteDeg} 50 50)`} />
      <circle cx="50" cy="50" r="3.5" fill={color} />
    </svg>
  );
};

export const SceneRace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = "04_race";
  const rivalAt = cue(id, "rakibin");
  const replyAt = cue(id, "birkaç") + 2;

  const enter = pop(frame, 0, fps, 16);
  // You: three hours spin by.
  const spin = interpolate(frame, [cue(id, "Sen"), cue(id, "dönüyorsun") + 14], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const youDim = interpolate(frame, [cue(id, "dönüyorsun"), rivalAt], [0, 0.45], clamp);
  const hours = Math.floor(spin * 3);
  // Rival: two minutes, reply, heart.
  const rivalOn = interpolate(frame, [rivalAt - 6, rivalAt + 4], [0, 1], clamp);
  const stopwatch = interpolate(frame, [rivalAt, replyAt], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const reply = pop(frame, replyAt, fps, 12);
  const heart = pop(frame, replyAt + 16, fps, 9);
  const rivalGlow = interpolate(frame, [replyAt, replyAt + 8, replyAt + 40], [0, 1, 0.6], clamp);
  const divider = interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill>
      {/* side labels */}
      <div style={{ position: "absolute", top: HEAD_TOP + 40, left: 40, width: 486, opacity: enter }}>
        <Label size={80} style={{ fontWeight: 800, transform: `translateY(${(1 - enter) * 30}px)` }}>Sen</Label>
      </div>
      <div style={{ position: "absolute", top: HEAD_TOP + 40, left: 554, width: 486, opacity: enter }}>
        <Label size={80} color={C.goldHi} style={{ fontWeight: 800, transform: `translateY(${(1 - enter) * 30}px)`, textShadow: "0 0 24px rgba(230,199,122,0.5)" }}>
          Rakibin
        </Label>
      </div>
      {/* divider */}
      <div
        style={{
          position: "absolute",
          left: 539,
          top: HEAD_TOP + 30,
          width: 2,
          height: (PANEL_TOP + PANEL_H - HEAD_TOP - 30) * divider,
          background: `linear-gradient(180deg, transparent, ${C.goldHi} 15%, ${C.goldHi} 85%, transparent)`,
          boxShadow: `0 0 18px ${C.gold}`,
        }}
      />

      {/* LEFT: you */}
      <div style={{ transform: `translateX(${(1 - enter) * -80}px)`, opacity: enter }}>
        <Panel x={40} tone="you" dim={youDim} glow={0}>
          <Center x={243} y={250}>
            <Clock size={330} minuteDeg={spin * 360 * 3} hourDeg={spin * 90 + 280} />
          </Center>
          <Center x={243} y={458} style={{ opacity: interpolate(spin, [0.1, 0.3], [0, 1], clamp) }}>
            <div
              style={{
                fontFamily,
                fontWeight: 800,
                fontSize: 30,
                color: C.creamDim,
                letterSpacing: 2,
              }}
            >
              +{hours} SAAT
            </div>
          </Center>
          <div style={{ position: "absolute", top: 520, left: 0, right: 0, marginTop: 30 }}>
            <Headline
              top={0}
              size={52}
              underline={false}
              lines={[[{ t: "3 saat", danger: true }, { t: "sonra…" }]]}
              at={[cue(id, "saatler"), cue(id, "sonra")]}
            />
          </div>
          <div style={{ position: "absolute", top: 720, left: 24, right: 24, display: "flex", flexDirection: "column" }}>
            <Bubble side="out" size={24}>
              {PATIENT_MESSAGE}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <svg width={22} height={16} viewBox="0 0 140 100">
                  <path d="M10 55 L32 77 L76 30" stroke="rgba(11,31,58,0.45)" strokeWidth="11" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            </Bubble>
            <div
              style={{
                marginTop: 26,
                alignSelf: "center",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily,
                fontWeight: 600,
                fontSize: 24,
                color: C.danger,
                opacity: interpolate(frame, [cue(id, "dönüyorsun"), cue(id, "dönüyorsun") + 8], [0, 1], clamp),
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.danger, boxShadow: `0 0 12px ${C.danger}` }} />
              Cevap yok
            </div>
          </div>
        </Panel>
      </div>

      {/* RIGHT: rival */}
      <div style={{ transform: `translateX(${(1 - enter) * 80}px)`, opacity: enter }}>
        <Panel x={554} tone="rival" dim={0.5 * (1 - rivalOn)} glow={rivalGlow}>
          <Center x={243} y={250}>
            <Clock size={330} minuteDeg={stopwatch * 12} hourDeg={0} arc={stopwatch * 0.033 * 10} />
          </Center>
          <Center x={243} y={458} style={{ opacity: rivalOn }}>
            <div style={{ fontFamily, fontWeight: 800, fontSize: 30, color: C.goldHi, letterSpacing: 2 }}>
              0:{String(Math.round(stopwatch * 2)).padStart(2, "0")} DK
            </div>
          </Center>
          <div style={{ position: "absolute", top: 550, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
            <Headline
              top={0}
              size={52}
              underline={false}
              lines={[[{ t: "2 dakikada", gold: true }]]}
              at={[cue(id, "dakikada")]}
            />
            <div
              style={{
                position: "absolute",
                right: 14,
                top: 2,
                transform: `scale(${pop(frame, cue(id, "dakikada") + 5, fps, 9)})`,
                filter: `drop-shadow(0 0 12px ${C.ok})`,
              }}
            >
              <CheckIcon size={52} color={C.ok} stroke={11} />
            </div>
          </div>
          <div style={{ position: "absolute", top: 720, left: 24, right: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ alignSelf: "flex-end", position: "relative", maxWidth: "100%" }}>
              <Bubble side="out" size={24} style={{ maxWidth: "100%" }}>
                {PATIENT_MESSAGE}
              </Bubble>
              {heart > 0.01 ? (
                <div
                  style={{
                    position: "absolute",
                    left: -14,
                    bottom: -18,
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    background: C.navy,
                    border: `2px solid ${C.goldHi}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${heart})`,
                    boxShadow: `0 0 ${30 * heart}px rgba(230,199,122,0.95)`,
                  }}
                >
                  <HeartIcon size={26} color={C.goldHi} stroke={11} />
                </div>
              ) : null}
            </div>
            {reply > 0.01 ? (
              <div style={{ alignSelf: "flex-start", transform: `translateY(${(1 - reply) * 60}px) scale(${0.7 + 0.3 * reply})`, transformOrigin: "bottom left", opacity: Math.min(1, reply * 1.5) }}>
                <Bubble side="in" size={24}>Merhaba! Hemen yardımcı olalım.</Bubble>
              </div>
            ) : null}
          </div>
          <LightSweep from={replyAt} dur={20} opacity={0.3} />
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ======================================================= 5. WHY IT MATTERS

const ICONS = [
  { Icon: ShieldIcon, word: "güven" },
  { Icon: HeartIcon, word: null },
  { Icon: BoltIcon, word: "Hızlı" },
];

export const SceneWhy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = "05_why";
  const tIcons = [cue(id, "güven"), cue(id, "arıyor") + 12, cue(id, "Hızlı")];
  const flip = interpolate(frame, [cue(id, "burada") - 8, cue(id, "burada") + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const smile = interpolate(frame, [cue(id, "ilgileniyorlar"), cue(id, "ilgileniyorlar") + 10], [0, 1], clamp);
  const eyebrow = interpolate(frame, [4, 16], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Center x={540} y={HEAD_TOP + 24} style={{ opacity: eyebrow, transform: `translate(-50%,-50%) translateY(${(1 - eyebrow) * 14}px)` }}>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 30, letterSpacing: 8, color: C.goldHi }}>SAĞLIK TURİZMİNDE</div>
      </Center>
      <Headline
        top={HEAD_TOP + 70}
        size={88}
        lines={[[{ t: "Güven" }, { t: "•", gold: true }, { t: "İlgi" }, { t: "•", gold: true }, { t: "Hız", gold: true }]]}
        at={[tIcons[0], tIcons[0] + 8, tIcons[1], tIcons[1] + 8, tIcons[2]]}
        underline={false}
      />
      {ICONS.map(({ Icon }, i) => {
        const x = 230 + i * 310;
        const p = pop(frame, tIcons[i], fps, 10);
        const draw = interpolate(frame, [tIcons[i], tIcons[i] + 16], [0, 1], clamp);
        const ring = interpolate(frame, [4 + i * 5, 26 + i * 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const pulse = interpolate(frame, [tIcons[i], tIcons[i] + 6, tIcons[i] + 30], [0, 1, 0.5], clamp);
        return (
          <React.Fragment key={i}>
            {/* placeholder ring, drawn before the icon lands */}
            <Center x={x} y={760}>
              <svg width={240} height={240} viewBox="0 0 240 240" style={{ opacity: 0.4 * (1 - p) }}>
                <circle cx="120" cy="120" r="108" fill="none" stroke={C.gold} strokeWidth="2" strokeDasharray="6 10" strokeDashoffset={-frame} opacity={ring} />
              </svg>
            </Center>
            <Center x={x} y={760} style={{ transform: `translate(-50%,-50%) scale(${0.4 + 0.6 * p})`, opacity: Math.min(1, p * 2) }}>
              <IconBadge size={220} glow={0.5 + pulse}>
                <Icon size={110} stroke={5.5} progress={draw} />
              </IconBadge>
            </Center>
          </React.Fragment>
        );
      })}
      {/* testimonial card flips in */}
      <Center x={540} y={1200} style={{ perspective: 1600 }}>
        <div
          style={{
            width: 900,
            padding: "40px 44px",
            borderRadius: 40,
            background: `linear-gradient(160deg, #FBF5E9, ${C.cream})`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.45), 0 0 60px rgba(201,162,75,0.35)",
            transform: `rotateY(${(1 - flip) * -90}deg)`,
            opacity: flip > 0.02 ? 1 : 0,
            display: "flex",
            gap: 34,
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <Avatar size={170} smile={smile} />
          </div>
          <div style={{ fontFamily, color: C.navy }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {new Array(5).fill(0).map((_, s) => (
                <svg key={s} width={36} height={36} viewBox="0 0 24 24" style={{ transform: `scale(${pop(frame, cue(id, "benimle") + s * 3, fps, 9)})` }}>
                  <path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z" fill={C.gold} />
                </svg>
              ))}
            </div>
            <div style={{ fontWeight: 800, fontSize: 44, lineHeight: 1.15, letterSpacing: -0.5 }}>
              “Burada benimle ilgileniyorlar.”
            </div>
          </div>
          <LightSweep from={cue(id, "ilgileniyorlar") + 4} dur={22} opacity={0.6} />
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ======================================================= 6. THE PAYOFF

const BARS = [0.2, 0.3, 0.42, 0.58, 0.75, 0.95];
const LINE = [0.92, 0.7, 0.5, 0.33, 0.2, 0.1];
const XLAB = ["24 sa", "6 sa", "1 sa", "30 dk", "10 dk", "2 dk"];

export const ScenePayoff: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = "06_payoff";
  const boomAt = cue(id, "kazanan");
  const punch = interpolate(frame, [boomAt, boomAt + 3, boomAt + 14], [0, 1, 0], clamp);
  const shake = frame >= boomAt && frame < boomAt + 12 ? (random(`sh${frame}`) - 0.5) * 22 * (1 - (frame - boomAt) / 12) : 0;
  const chartIn = pop(frame, 0, fps, 16);

  // Plot area inside the card.
  const PW = 740;
  const PH = 520;
  const pts = LINE.map((v, i) => [40 + (i * (PW - 80)) / (LINE.length - 1), PH - v * PH] as const);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const lineDraw = interpolate(frame, [cue(id, "dakikalarda"), cue(id, "klinik") + 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      <div style={{ transform: `scale(${1 + punch * 0.08})`, transformOrigin: `540px ${HEAD_TOP + 100}px` }}>
        <Headline
          top={HEAD_TOP}
          size={96}
          lines={[[{ t: "Hızlı", gold: true }, { t: "dönen" }], [{ t: "kazanır", gold: true }]]}
          at={[cue(id, "İlk"), cue(id, "dönen"), boomAt]}
        />
      </div>
      <Center x={540} y={1060} style={{ transform: `translate(-50%,-50%) translateY(${(1 - chartIn) * 120}px)`, opacity: chartIn }}>
        <div
          style={{
            position: "relative",
            width: 900,
            height: 820,
            borderRadius: 40,
            background: "linear-gradient(180deg, rgba(19,48,90,0.7), rgba(6,19,37,0.85))",
            border: "2px solid rgba(201,162,75,0.55)",
            boxShadow: `0 0 ${40 + punch * 80}px rgba(201,162,75,${0.25 + punch * 0.5})`,
            overflow: "hidden",
          }}
        >
          {/* legend */}
          <div style={{ position: "absolute", top: 40, left: 60, right: 60, display: "flex", justifyContent: "space-between", fontFamily, fontWeight: 700, fontSize: 30, color: C.cream }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 6, borderRadius: 3, background: C.goldHi, boxShadow: `0 0 10px ${C.gold}` }} />
              Yanıt süresi
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: C.cream }} />
              Randevu
            </div>
          </div>
          <div style={{ position: "absolute", left: 80, top: 140, width: PW, height: PH }}>
            {/* gridlines */}
            {[0.25, 0.5, 0.75, 1].map((g) => (
              <div key={g} style={{ position: "absolute", left: 0, right: 0, top: PH - g * PH, height: 1, background: "rgba(243,234,216,0.1)" }} />
            ))}
            {BARS.map((b, i) => {
              const grow = pop(frame, 8 + i * 6, fps, 14);
              const bw = 64;
              const cx = 40 + (i * (PW - 80)) / (BARS.length - 1);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: cx - bw / 2,
                    bottom: 0,
                    width: bw,
                    height: b * PH * grow,
                    borderRadius: "14px 14px 4px 4px",
                    background: `linear-gradient(180deg, ${C.cream}, rgba(243,234,216,0.55))`,
                    boxShadow: i === BARS.length - 1 ? `0 0 ${20 + punch * 40}px rgba(243,234,216,0.5)` : "none",
                  }}
                />
              );
            })}
            <svg width={PW} height={PH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <path d={path} fill="none" stroke={C.goldHi} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - lineDraw} style={{ filter: `drop-shadow(0 0 10px ${C.gold})` }} />
              {pts.map((p, i) => {
                const on = lineDraw >= i / (pts.length - 1) - 0.001;
                return on ? <circle key={i} cx={p[0]} cy={p[1]} r={11} fill={C.navy} stroke={C.goldHi} strokeWidth={5} /> : null;
              })}
            </svg>
            {/* x labels */}
            {XLAB.map((l, i) => (
              <div
                key={l}
                style={{
                  position: "absolute",
                  top: PH + 22,
                  left: 40 + (i * (PW - 80)) / (XLAB.length - 1) - 60,
                  width: 120,
                  textAlign: "center",
                  fontFamily,
                  fontWeight: 600,
                  fontSize: 24,
                  color: i === XLAB.length - 1 ? C.goldHi : C.creamDim,
                }}
              >
                {l}
              </div>
            ))}
          </div>
          <LightSweep from={boomAt - 6} dur={24} width={260} opacity={0.45} />
        </div>
      </Center>
      {/* boom flash */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 30%, rgba(230,199,122,${punch * 0.35}), transparent 60%)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

// ======================================================= 7. CTA

const RING_Y = 860;

export const SceneCTA: React.FC<{ hitAt: number }> = ({ hitAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = "07_cta";

  const ring = pop(frame, 0, fps, 14, 0.9);
  const flash = interpolate(frame, [0, 4, 20], [0.9, 0.6, 0], clamp);
  const logo = pop(frame, 14, fps, 14);
  const hit = interpolate(frame, [hitAt, hitAt + 4, hitAt + 40], [0, 1, 0], clamp);
  const ripple = interpolate(frame, [hitAt, hitAt + 36], [0, 1], clamp);
  const handle = interpolate(frame, [cue(id, "kaybetme"), cue(id, "kaybetme") + 12], [0, 1], clamp);
  const R = 200;

  return (
    <AbsoluteFill>
      <Particles count={30} seed="cta" boost={2 + hit * 3} />
      <Headline
        top={HEAD_TOP}
        size={80}
        lines={[[{ t: "Reklam" }, { t: "bütçen", gold: true }], [{ t: "boşa" }, { t: "gitmesin." }]]}
        at={[cue(id, "Reklam"), cue(id, "bütçen"), cue(id, "boşa"), cue(id, "gitmesin")]}
      />
      {/* the ring */}
      <Center x={540} y={RING_Y}>
        <div
          style={{
            width: R * 2 * ring,
            height: R * 2 * ring,
            borderRadius: "50%",
            border: `${6 + hit * 4}px solid ${C.goldHi}`,
            boxShadow: `0 0 ${50 + hit * 80}px rgba(230,199,122,${0.7 + hit * 0.3}), inset 0 0 ${40 + hit * 40}px rgba(201,162,75,0.45)`,
            background: "radial-gradient(circle, rgba(19,48,90,0.85) 0%, rgba(6,19,37,0.95) 70%)",
          }}
        />
      </Center>
      {/* slow orbit spark around the ring */}
      <Center
        x={540 + Math.cos(frame / 14) * R * ring}
        y={RING_Y + Math.sin(frame / 14) * R * ring}
        style={{ opacity: ring }}
      >
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#FFF3D1", boxShadow: `0 0 24px 8px ${C.goldHi}` }} />
      </Center>
      {ripple > 0 && ripple < 1 ? (
        <Center x={540} y={RING_Y}>
          <div style={{ width: R * 2 + ripple * 700, height: R * 2 + ripple * 700, borderRadius: "50%", border: `3px solid rgba(230,199,122,${1 - ripple})` }} />
        </Center>
      ) : null}
      {/* logo placeholder inside the ring */}
      <Center x={540} y={RING_Y} style={{ transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * logo})`, opacity: logo }}>
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: "2px dashed rgba(230,199,122,0.55)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily,
            color: C.cream,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 64, letterSpacing: 10 }}>LOGO</div>
          <div style={{ fontWeight: 600, fontSize: 22, letterSpacing: 4, color: C.goldHi, marginTop: 6 }}>BURAYA</div>
        </div>
      </Center>
      <Headline
        top={RING_Y + R + 80}
        size={74}
        lines={[[{ t: "Mesajlara" }, { t: "hızlı", gold: true }, { t: "dön.", gold: true }]]}
        at={[cue(id, "Mesajlara"), cue(id, "hızlı"), cue(id, "dön")]}
      />
      <Center x={540} y={RING_Y + R + 250} style={{ opacity: handle, transform: `translate(-50%,-50%) translateY(${(1 - handle) * 16}px)` }}>
        <div
          style={{
            padding: "14px 40px",
            borderRadius: 50,
            border: `2px solid ${C.gold}`,
            background: "rgba(6,19,37,0.6)",
            fontFamily,
            fontWeight: 700,
            fontSize: 36,
            color: C.cream,
            letterSpacing: 1,
          }}
        >
          @kullanıcıadı
        </div>
      </Center>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${RING_Y / 19.2}%, rgba(255,240,205,${flash * 0.8 + hit * 0.25}), transparent ${30 + flash * 30}%)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export { PHONE_H, PHONE_W };
