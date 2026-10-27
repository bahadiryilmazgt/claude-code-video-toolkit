// Phone screen contents shared by several scenes: the clinic ad and the chat.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Bubble, ChatHeader, clamp, CrossIcon, DoubleCheck, HeartIcon, ToothIcon } from "./components";
import { C, fontFamily, goldGradient } from "./theme";

export const PATIENT_MESSAGE = "Merhaba, fiyat bilgisi alabilir miyim?";

/** Generic sponsored post for a clinic. `tap` (0..1) presses the CTA button. */
export const AdCard: React.FC<{ glow?: number; tap?: number }> = ({ glow = 0, tap = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: 22,
      right: 22,
      top: 92,
      borderRadius: 30,
      background: "rgba(243,234,216,0.06)",
      border: `2px solid rgba(201,162,75,${0.35 + glow * 0.6})`,
      boxShadow: `0 0 ${glow * 60}px rgba(230,199,122,${glow * 0.6})`,
      padding: 20,
      fontFamily,
      color: C.cream,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: goldGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CrossIcon size={30} color={C.navy} stroke={10} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 26 }}>Estetik Klinik</div>
        <div style={{ fontWeight: 500, fontSize: 19, color: C.creamDim }}>Sponsorlu</div>
      </div>
    </div>
    <div
      style={{
        position: "relative",
        marginTop: 18,
        height: 420,
        borderRadius: 22,
        overflow: "hidden",
        background: `radial-gradient(circle at 50% 38%, #1F4677 0%, ${C.navy} 55%, ${C.navyDeep} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div style={{ filter: "drop-shadow(0 0 24px rgba(230,199,122,0.6))" }}>
        <ToothIcon size={170} stroke={4.5} />
      </div>
      <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: -0.5 }}>Gülüş Tasarımı</div>
      <div style={{ fontWeight: 600, fontSize: 22, color: C.goldHi, letterSpacing: 2 }}>İSTANBUL</div>
    </div>
    <div
      style={{
        marginTop: 18,
        height: 74,
        borderRadius: 18,
        background: goldGradient,
        color: C.navy,
        fontWeight: 800,
        fontSize: 27,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${1 - tap * 0.06})`,
        boxShadow: `0 0 ${20 + tap * 40}px rgba(230,199,122,${0.35 + tap * 0.5})`,
      }}
    >
      Mesaj Gönder
    </div>
    <div style={{ display: "flex", gap: 22, marginTop: 18, alignItems: "center", opacity: 0.7 }}>
      <HeartIcon size={30} color={C.cream} stroke={8} />
      <div style={{ fontSize: 19, fontWeight: 600 }}>2.481 beğeni</div>
    </div>
  </div>
);

/** Where the ad's CTA button sits on the 472x972 phone screen (tap target). */
export const CTA_POINT = { x: 236, y: 663 };

export const ChatWallpaper: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity: 0.07,
      backgroundImage: `radial-gradient(${C.gold} 1.5px, transparent 1.5px)`,
      backgroundSize: "28px 28px",
    }}
  />
);

/**
 * The patient's chat with a clinic. `typed` is the fraction of the message typed
 * into the input bar; `sent` (spring 0..1) moves it into the thread.
 */
export const ChatScreen: React.FC<{
  name: string;
  status?: string;
  typed: number;
  sent: number;
  read?: boolean;
  reply?: number;
  replyText?: string;
  heart?: number;
  scale?: number;
}> = ({ name, status = "çevrimiçi", typed, sent, read = false, reply = 0, replyText, heart = 0, scale = 1 }) => {
  const frame = useCurrentFrame();
  const n = Math.round(PATIENT_MESSAGE.length * typed);
  const caret = sent < 0.5 && typed > 0 && Math.floor(frame / 8) % 2 === 0;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <ChatWallpaper />
      <ChatHeader name={name} status={status} size={scale} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 18 * scale,
          padding: `${20 * scale}px ${22 * scale}px`,
        }}
      >
        {sent > 0.01 ? (
          <div
            style={{
              alignSelf: "flex-end",
              position: "relative",
              transform: `translateY(${(1 - sent) * 120 * scale}px) scale(${0.7 + 0.3 * sent})`,
              transformOrigin: "bottom right",
              opacity: Math.min(1, sent * 1.5),
              maxWidth: "88%",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <Bubble side="out" size={30 * scale} style={{ maxWidth: "100%" }}>
              {PATIENT_MESSAGE}
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 4, fontSize: 18 * scale, color: "rgba(11,31,58,0.55)" }}>
                09:41
                <DoubleCheck size={16 * scale} color={read ? "#2F80C8" : "rgba(11,31,58,0.45)"} />
              </div>
            </Bubble>
            {heart > 0.01 ? (
              <div
                style={{
                  position: "absolute",
                  left: -18 * scale,
                  bottom: -16 * scale,
                  width: 52 * scale,
                  height: 52 * scale,
                  borderRadius: "50%",
                  background: C.navy,
                  border: `2px solid ${C.goldHi}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${heart})`,
                  boxShadow: `0 0 ${24 * heart}px rgba(230,199,122,0.9)`,
                }}
              >
                <HeartIcon size={28 * scale} color={C.goldHi} stroke={10} />
              </div>
            ) : null}
          </div>
        ) : null}
        {reply > 0.01 && replyText ? (
          <div
            style={{
              alignSelf: "flex-start",
              transform: `translateY(${(1 - reply) * 80 * scale}px) scale(${0.7 + 0.3 * reply})`,
              transformOrigin: "bottom left",
              opacity: Math.min(1, reply * 1.5),
              maxWidth: "88%",
            }}
          >
            <Bubble side="in" size={30 * scale} style={{ maxWidth: "100%" }}>
              {replyText}
            </Bubble>
          </div>
        ) : null}
      </div>
      {/* input bar */}
      <div
        style={{
          margin: `0 ${18 * scale}px ${26 * scale}px`,
          minHeight: 74 * scale,
          borderRadius: 40 * scale,
          border: "1.5px solid rgba(201,162,75,0.5)",
          background: "rgba(243,234,216,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 14 * scale,
          padding: `${12 * scale}px ${14 * scale}px ${12 * scale}px ${26 * scale}px`,
          fontFamily,
          fontSize: 25 * scale,
          fontWeight: 500,
          color: C.cream,
        }}
      >
        <div style={{ flex: 1, opacity: sent > 0.3 ? 0 : 1, lineHeight: 1.25 }}>
          {n === 0 ? <span style={{ color: C.creamDim }}>Mesaj yaz…</span> : PATIENT_MESSAGE.slice(0, n)}
          {caret ? <span style={{ color: C.goldHi }}>|</span> : null}
        </div>
        <div
          style={{
            width: 52 * scale,
            height: 52 * scale,
            borderRadius: "50%",
            background: goldGradient,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${1 + interpolate(sent, [0, 0.3, 0.6], [0, 0.2, 0], clamp)})`,
          }}
        >
          <svg width={26 * scale} height={26 * scale} viewBox="0 0 24 24">
            <path d="M3 11.5 L21 3 L13.5 21 L11 13 Z" fill={C.navy} />
          </svg>
        </div>
      </div>
    </div>
  );
};
