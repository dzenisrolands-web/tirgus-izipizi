import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "tirgus.izipizi.lv — Svaiga pārtika no Latvijas ražotājiem";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #192635 0%, #1e3a4a 60%, #0f1e2b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Green glow top-right */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(83,243,164,0.15), transparent 70%)",
          }}
        />
        {/* Purple glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(173,71,255,0.12), transparent 70%)",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(83,243,164,0.15)",
            border: "1px solid rgba(83,243,164,0.3)",
            borderRadius: 999,
            padding: "8px 20px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#53F3A4",
            }}
          />
          <span style={{ color: "#53F3A4", fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
            Latvijā ražoti produkti
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 68,
              fontWeight: 900,
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            Svaiga pārtika
          </span>
          <span
            style={{
              fontSize: 68,
              fontWeight: 900,
              lineHeight: 1.1,
              background: "linear-gradient(90deg, #53F3A4, #AD47FF)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            bez starpniekiem
          </span>
        </div>

        {/* Subtitle */}
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 24,
            marginTop: 20,
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          Latvijas ražotāji · IziPizi pakomāti · Tieši no fermas
        </p>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, #53F3A4, #AD47FF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 20, fontWeight: 600 }}>
            tirgus.izipizi.lv
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
