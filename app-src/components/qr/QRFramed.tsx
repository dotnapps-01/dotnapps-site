import { buildQr } from "@/lib/qr";
import type { QrVariant } from "@/lib/qr-types";

/** Logical size of the framed card in SVG units (the rendered size scales from this). */
export const FRAME_W = 240;
const PAD = 8;
const QR_SIZE = FRAME_W - PAD * 2;
const BAR_GAP = 6;
const BAR_H = 36;

export function frameHeight(label: string) {
  return label ? PAD + QR_SIZE + BAR_GAP + BAR_H : PAD * 2 + QR_SIZE;
}

type Props = {
  value: string;
  variant: QrVariant;
  color: string;
  /** Text on the bar under the code; empty for a bare code in a border. */
  label: string;
  /** Rendered width in px (height follows). */
  size?: number;
  title?: string;
  className?: string;
  /** Logo drawn in the centre of the code. Use a data: URL when the SVG is saved or turned into a PNG. */
  logoHref?: string;
};

/** Share of the code's width the logo box takes. With error correction H the code reads fine with well over this covered. */
const LOGO_SHARE = 0.2;

/**
 * The QR as designed in QR Studio: a coloured border, the code with its quiet zone, and a label bar.
 * One component draws the live preview and the PNG/SVG files people download.
 */
export function QRFramed({ value, variant, color, label, size = FRAME_W, title = "QR code", className, logoHref }: Props) {
  const g = buildQr(value, variant, true, logoHref ? "H" : undefined);
  const box = QR_SIZE * LOGO_SHARE;
  const logoPad = 2;
  const H = frameHeight(label);
  return (
    <svg
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${FRAME_W} ${H}`}
      width={size}
      height={(size * H) / FRAME_W}
      className={className}
      style={{ maxWidth: "100%", height: "auto" }}
    >
      <rect x="1" y="1" width={FRAME_W - 2} height={H - 2} fill="#FFFFFF" stroke={color} strokeWidth="2" />
      <svg x={PAD} y={PAD} width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${g.box} ${g.box}`} shapeRendering={variant === "square" ? "crispEdges" : "geometricPrecision"}>
        {g.faint ? <path d={g.faint} fill={color} opacity={0.28} /> : null}
        <path d={g.dark} fill={color} />
        {g.finders.map((p, i) => (
          <g key={i}>
            <rect x={p.x + 0.5} y={p.y + 0.5} width={6} height={6} rx={0.6} fill="none" stroke={color} strokeWidth={1} />
            <rect x={p.x + 2} y={p.y + 2} width={3} height={3} rx={0.3} fill={color} />
          </g>
        ))}
      </svg>
      {logoHref ? (
        <g>
          <rect x={FRAME_W / 2 - box / 2 - logoPad} y={PAD + QR_SIZE / 2 - box / 2 - logoPad} width={box + logoPad * 2} height={box + logoPad * 2} rx="4" fill="#FFFFFF" />
          <image href={logoHref} x={FRAME_W / 2 - box / 2} y={PAD + QR_SIZE / 2 - box / 2} width={box} height={box} preserveAspectRatio="xMidYMid meet" />
        </g>
      ) : null}
      {label ? (
        <>
          <rect x="1" y={PAD + QR_SIZE + BAR_GAP} width={FRAME_W - 2} height={BAR_H - 1} fill={color} />
          <text
            x={FRAME_W / 2}
            y={PAD + QR_SIZE + BAR_GAP + BAR_H / 2 + 4}
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="12"
            fontWeight="500"
            letterSpacing="1"
            fontFamily="Inter, Helvetica, Arial, sans-serif"
          >
            {label}
          </text>
        </>
      ) : null}
    </svg>
  );
}
