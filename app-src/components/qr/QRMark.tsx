import { buildQr, type QREcc, type QRVariant } from "@/lib/qr";

type Props = {
  /** The URL or text the code encodes. A real, scannable QR is generated from it. */
  value: string;
  /** Rendered width/height in px (scales down with its container). */
  size?: number;
  variant?: QRVariant;
  /** Module colour. Keep high contrast against `bg`. */
  color?: string;
  /** Background fill. Defaults to white so printed/saved codes stay readable. */
  bg?: string;
  /** Add the 4-module quiet zone phones need around the code. */
  quiet?: boolean;
  /** Error-correction level. Defaults: M for square, Q for dot/halftone. */
  ecc?: QREcc;
  label?: string;
  className?: string;
};

/**
 * Real QR code as inline SVG (crisp at any size, printable, no client JS).
 * Styles: square, dot, halftone.
 */
export function QRMark({
  value,
  size = 300,
  variant = "square",
  color = "#0E0E10",
  bg = "#FFFFFF",
  quiet = true,
  ecc,
  label = "QR code",
  className,
}: Props) {
  const g = buildQr(value, variant, quiet, ecc);
  return (
    <svg
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${g.box} ${g.box}`}
      width={size}
      height={size}
      shapeRendering={variant === "square" ? "crispEdges" : "geometricPrecision"}
      className={className}
      style={{ maxWidth: "100%", height: "auto", aspectRatio: "1 / 1" }}
    >
      {bg !== "transparent" ? <rect width={g.box} height={g.box} fill={bg} /> : null}
      {g.faint ? <path d={g.faint} fill={color} opacity={0.28} /> : null}
      <path d={g.dark} fill={color} />
      {g.finders.map((p, i) => (
        <g key={i}>
          {/* outer ring: 7×7 with a 1-module stroke, then the 3×3 eye */}
          <rect x={p.x + 0.5} y={p.y + 0.5} width={6} height={6} rx={0.6} fill="none" stroke={color} strokeWidth={1} />
          <rect x={p.x + 2} y={p.y + 2} width={3} height={3} rx={0.3} fill={color} />
        </g>
      ))}
    </svg>
  );
}
