"use client";
import { useId } from "react";

const NAVY = "#1B1F3B";
const TURQUOISE = "#2A9D8F";
const GOLD = "#C9A24A";
const IVORY = "#F4F1EA";

/**
 * The Hamlaty mark: a shrine arch with a gold dot above and a keyhole cut through it (the room is ready).
 * The keyhole is a real cut-out, so it shows whatever is behind the logo.
 */
export function Mark({ size = 34, onDark = false }: { size?: number; onDark?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 112" width={size} height={(size * 112) / 120} aria-hidden="true" style={{ display: "block", flex: "none" }}>
      <defs>
        <mask id={`k${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#fff" />
          <circle cx="60" cy="68" r="9" fill="#000" />
          <path d="M60 77 L60 91" stroke="#000" strokeWidth="5" strokeLinecap="round" />
        </mask>
      </defs>
      <circle cx="60" cy="7" r="5" fill={GOLD} />
      <g mask={`url(#k${id})`}>
        <path d="M22 106 V58 C22 40 40 28 60 18 C80 28 98 40 98 58 V106 Z" fill={onDark ? IVORY : NAVY} />
        <path d="M38 106 V62 C38 50 48 42 60 36 C72 42 82 50 82 62 V106 Z" fill={TURQUOISE} />
      </g>
    </svg>
  );
}

/** Mark with the Arabic name and HAMLATY underneath. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="brand" role="img" aria-label="حملتي Hamlaty">
      <Mark size={size} />
      <span className="words" aria-hidden="true">
        <b>حملتي</b>
        <small>HAMLATY</small>
      </span>
    </span>
  );
}
