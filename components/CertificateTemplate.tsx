"use client";

import React from "react";

// All colors use explicit hex / rgba -- no Tailwind (html2canvas cannot parse oklch)
const C = {
  bg:         "#0b07d5",
  bgDark:     "#0700a0",
  orange:     "#ff9500",
  orangeDeep: "#d97600",
  white:      "#ffffff",
  w70:        "rgba(255,255,255,0.70)",
  w45:        "rgba(255,255,255,0.45)",
};

export type TextPosition = { x: number; y: number };

export interface TextPositions {
  institutionName?: TextPosition;
  header?:         TextPosition;
  certifyText?:    TextPosition;
  studentName?:    TextPosition;
  completionText?: TextPosition;
  courseName?:     TextPosition;
  issueDate?:      TextPosition;
  signatory?:      TextPosition;
  certificateId?:  TextPosition;
}

export interface CertificateSettings {
  institutionName:    string;
  primaryColor:       string;
  accentColor:        string;
  backgroundImageUrl?: string | null;
  logoUrl?:           string | null;
  signatureUrl?:      string | null;
  signatoryName:      string;
  signatoryTitle:     string;
  certifyText:        string;
  completionText:     string;
  fontFamily:         "serif" | "sans-serif" | "lato" | "source-sans-pro" | "script";
  headingSize:        "sm" | "md" | "lg";
  paddingTop?:        number;
  paddingLeft?:       number;
  lineSpacing?:       "tight" | "normal" | "relaxed";
  textPositions?:     TextPositions;
}

export const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  institutionName:  process.env.NEXT_PUBLIC_ORG_NAME ?? "AI Skills Africa",
  primaryColor:     "#0b07d5",
  accentColor:      "#ff9500",
  backgroundImageUrl: null,
  logoUrl:          null,
  signatureUrl:     null,
  signatoryName:    "",
  signatoryTitle:   "",
  certifyText:      "This is to certify that",
  completionText:   "has successfully completed",
  fontFamily:       "serif",
  headingSize:      "md",
  paddingTop:       280,
  paddingLeft:      182,
  lineSpacing:      "normal",
  textPositions:    undefined,
};

/** Compute default per-element positions from the legacy padding values. */
export function defaultTextPositions(paddingTop = 280, paddingLeft = 182, headingSize: CertificateSettings["headingSize"] = "md"): Required<TextPositions> {
  const headingPx = headingSize === "sm" ? 52 : headingSize === "lg" ? 78 : 65;
  return {
    institutionName: { x: paddingLeft, y: paddingTop },
    header:          { x: paddingLeft, y: paddingTop + 34  },   // +28px text +6px mb
    certifyText:     { x: paddingLeft, y: paddingTop + 79  },   // +35px text +10px mb
    studentName:     { x: paddingLeft, y: paddingTop + 162 },   // +28px text +55px mb
    completionText:  { x: paddingLeft, y: paddingTop + 162 + headingPx + 25 },
    courseName:      { x: paddingLeft, y: paddingTop + 162 + headingPx + 25 + 55 },
    issueDate:       { x: paddingLeft, y: paddingTop + 162 + headingPx + 25 + 55 + 95 },
    signatory:       { x: paddingLeft, y: 980 },
    certificateId:   { x: 1580, y: 120 },
  };
}

const FONT_MAP: Record<CertificateSettings["fontFamily"], string> = {
  "serif":           "'Georgia', 'Times New Roman', serif",
  "sans-serif":      "'Inter', 'Arial', sans-serif",
  "script":          "'Georgia', 'Palatino Linotype', cursive",
  "lato":            "'Lato', 'Arial', sans-serif",
  "source-sans-pro": "'Source Sans 3', 'Source Sans Pro', 'Arial', sans-serif",
};

const SPACING_MUL: Record<NonNullable<CertificateSettings["lineSpacing"]>, number> = {
  tight:   0.6,
  normal:  1.0,
  relaxed: 1.5,
};

const HEADING_PX: Record<CertificateSettings["headingSize"], string> = {
  sm: "52px",
  md: "65px",
  lg: "78px",
};

// Constellation decoration (top-right)
const PTS: [number, number][] = [
  [148, 22], [182, 44], [116, 54], [202, 72], [145, 84],
  [90,  68], [178,112], [126,124], [166,144], [96, 148],
  [192,172], [140,186], [66,  98], [60, 164], [212,132],
  [186, 54], [50,  48], [70, 216], [222, 96], [152,222],
  [80, 250], [176,250], [110,270], [226,202],
];
const LINES: [number, number][] = [
  [0,1],[0,2],[1,3],[1,15],[2,5],[2,7],[3,4],[3,6],[4,6],
  [4,7],[5,7],[5,12],[6,8],[6,10],[7,8],[7,9],[8,10],[8,11],
  [9,13],[9,12],[10,14],[10,11],[11,14],[12,13],[13,17],
  [14,18],[15,3],[16,2],[16,12],[17,20],[18,23],[19,11],
  [19,21],[20,22],[21,23],[22,19],[23,10],
];

function Constellation() {
  return (
    <svg
      style={{ position: "absolute", top: 0, right: 0, pointerEvents: "none", zIndex: 2 }}
      width="248" height="308" viewBox="0 0 248 308"
    >
      {LINES.map(([a, b], i) => (
        <line key={i} x1={PTS[a][0]} y1={PTS[a][1]} x2={PTS[b][0]} y2={PTS[b][1]}
          stroke="rgba(255,255,255,0.28)" strokeWidth="0.9" />
      ))}
      {PTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 4.5 : 3} fill="#ffffff" />
      ))}
    </svg>
  );
}

export interface CertificateTemplateProps {
  certId?:      string;
  studentName:  string;
  courseName:   string;
  issueDate:    string;
  settings?:    CertificateSettings;
}

const CertificateTemplate = React.forwardRef<HTMLDivElement, CertificateTemplateProps>(
  ({ certId, studentName, courseName, issueDate, settings }, ref) => {
    const s               = { ...DEFAULT_CERT_SETTINGS, ...settings };
    const hasCustomBg     = Boolean(s.backgroundImageUrl);
    const fontFamily      = FONT_MAP[s.fontFamily];
    const headingSize     = HEADING_PX[s.headingSize];
    const primaryColor    = s.primaryColor  || C.bg;
    const accentColor     = s.accentColor   || C.orange;
    const accentDeep      = s.accentColor   || C.orangeDeep;

    // Resolve positions: saved overrides take priority, then defaults derived from paddingTop/paddingLeft
    const defaults = defaultTextPositions(s.paddingTop, s.paddingLeft, s.headingSize);
    const tp = { ...defaults, ...(s.textPositions ?? {}) } as Required<TextPositions>;
    const pos = (key: keyof TextPositions) => ({ position: "absolute" as const, left: `${tp[key].x}px`, top: `${tp[key].y}px` });

    return (
      <div
        ref={ref}
        style={{
          fontFamily,
          position: "relative",
          width: "1860px",
          height: "1200px",
          backgroundColor: hasCustomBg ? "transparent" : primaryColor,
          overflow: "hidden",
          border: hasCustomBg ? "none" : `22px solid ${s.primaryColor || C.bgDark}`,
          boxSizing: "border-box",
        }}
      >
        {/* Custom background image */}
        {hasCustomBg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.backgroundImageUrl!} alt="" crossOrigin="anonymous"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
        )}

        {/* Default decoration */}
        {!hasCustomBg && <Constellation />}

        {/* Bottom accent wave */}
        {!hasCustomBg && (
          <svg style={{ position: "absolute", bottom: 0, left: 0, zIndex: 10 }}
            width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="none">
            <path d="M -2 48 C 60 28, 140 100, 280 138 C 360 155, 440 158, 520 138 C 660 100, 740 28, 802 48 L 802 200 L -2 200 Z"
              fill={accentDeep} />
            <path d="M -2 72 C 70 48, 150 116, 290 150 C 370 164, 430 166, 510 150 C 650 116, 730 48, 802 72 L 802 200 L -2 200 Z"
              fill={accentColor} />
          </svg>
        )}

        {/* Logo */}
        {s.logoUrl && (
          <div style={{ position: "absolute", top: "60px", left: "120px", zIndex: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.logoUrl} alt={s.institutionName} crossOrigin="anonymous"
              style={{ height: "120px", width: "auto", objectFit: "contain" }} />
          </div>
        )}

        {/* Certificate ID */}
        <div style={{
          ...pos("certificateId"), zIndex: 20,
          fontFamily, fontSize: "25px", fontWeight: "400", color: C.white,
        }}>
          Certificate ID: {certId ? certId.slice(0, 8).toUpperCase() : 'PREVIEW'}
        </div>

        {/* Certificate header */}
        <p style={{ ...pos("header"), zIndex: 20, fontFamily, fontSize: "35px", fontWeight: "400",
          color: C.white, textTransform: "uppercase", letterSpacing: "4px", margin: 0, opacity: 0.9 }}>
          Certificate of Completion
        </p>

        {/* Certify text */}
        <p style={{ ...pos("certifyText"), zIndex: 20, fontFamily, fontSize: "28px", fontWeight: "300",
          color: C.white, margin: 0 }}>
          {s.certifyText}
        </p>

        {/* Student Name */}
        <p style={{ ...pos("studentName"), zIndex: 20, fontFamily, fontSize: headingSize, fontWeight: "700",
          color: C.white, letterSpacing: "1px", lineHeight: "1.1", textTransform: "capitalize", margin: 0 }}>
          {studentName}
        </p>

        {/* Completion text */}
        <p style={{ ...pos("completionText"), zIndex: 20, fontFamily, fontSize: "30px", fontWeight: "300",
          color: C.white, margin: 0 }}>
          {s.completionText}
        </p>

        {/* Course Title */}
        <p style={{ ...pos("courseName"), zIndex: 20, fontFamily, fontSize: "50px", fontWeight: "700",
          lineHeight: "1.2", maxWidth: "1400px", margin: 0,
          background: "linear-gradient(90deg, #0cc0df, #ffde59)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text", color: "transparent" }}>
          {courseName}
        </p>

        {/* Issue date */}
        <p style={{ ...pos("issueDate"), zIndex: 20, fontFamily, fontSize: "24px", fontWeight: "500",
          color: C.white, margin: 0, opacity: 0.80 }}>
          Verified and issued on {issueDate}.
        </p>

        {/* Signatory */}
        {(s.signatoryName || s.signatureUrl) && (
          <div style={{
            ...pos("signatory"), zIndex: 30, textAlign: "left",
          }}>
            {s.signatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.signatureUrl} alt="Signature" crossOrigin="anonymous"
                style={{ height: "80px", width: "auto", objectFit: "contain", marginBottom: "8px", display: "block" }} />
            )}
            <div style={{ borderTop: `2px solid ${C.w45}`, width: "280px", marginBottom: "10px" }} />
            {s.signatoryName && (
              <p style={{ fontFamily, fontSize: "26px", fontWeight: "700", color: C.white, margin: 0 }}>
                {s.signatoryName}
              </p>
            )}
            {s.signatoryTitle && (
              <p style={{ fontFamily, fontSize: "22px", fontWeight: "400", color: C.w70, margin: "4px 0 0" }}>
                {s.signatoryTitle}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

CertificateTemplate.displayName = "CertificateTemplate";
export default CertificateTemplate;
