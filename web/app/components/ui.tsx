"use client";

import React from "react";
import { C, R } from "@/lib/theme";

// Shared primitives. Modern, professional defaults — no ALL CAPS, no
// brutalist 1px-solid-black borders.
//
// SRP: presentation only. Behavior comes from the onClick handler.

type TagProps = {
  children: React.ReactNode;
  color?: string;          // foreground (text) — defaults to text2
  bg?: string;             // background — defaults to a tinted soft chip
  title?: string;
  variant?: "soft" | "outline";
};

const tintBg = (c: string): string => {
  // 12% alpha tint of the foreground color → readable + brand-coherent.
  const hex = c.replace("#", "");
  if (hex.length !== 6) return C.soft;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.12)`;
};

export const Tag = ({ children, color = C.text2, bg, title, variant = "soft" }: TagProps) => {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.4,
    borderRadius: R.full,
    color,
    whiteSpace: "nowrap",
  };
  const skin: React.CSSProperties = variant === "outline"
    ? { background: "transparent", border: `1px solid ${color}` }
    : { background: bg ?? tintBg(color), border: "1px solid transparent" };
  return (
    <span title={title} style={{ ...base, ...skin }}>
      {children}
    </span>
  );
};

type BtnProps = {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  primary?: boolean;
  disabled?: boolean;
  small?: boolean;
  title?: string;
  type?: "button" | "submit";
  variant?: "solid" | "ghost" | "outline";
};

export const Btn = ({
  children,
  onClick,
  primary,
  disabled,
  small,
  title,
  type = "button",
  variant,
}: BtnProps) => {
  const v = variant ?? (primary ? "solid" : "outline");
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: small ? "5px 10px" : "8px 14px",
    fontSize: small ? 12 : 13,
    fontWeight: 500,
    lineHeight: 1.2,
    borderRadius: R.md,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 120ms, border-color 120ms, color 120ms",
    whiteSpace: "nowrap",
  };
  let skin: React.CSSProperties;
  if (disabled) {
    skin = { background: C.soft, color: C.text3, border: `1px solid ${C.border1}` };
  } else if (v === "solid") {
    skin = primary
      ? { background: C.text1, color: C.card, border: `1px solid ${C.text1}` }
      : { background: C.text1, color: C.card, border: `1px solid ${C.text1}` };
  } else if (v === "ghost") {
    skin = { background: "transparent", color: C.text1, border: `1px solid transparent` };
  } else {
    skin = { background: C.card, color: C.text1, border: `1px solid ${C.border2}` };
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} style={{ ...base, ...skin }}>
      {children}
    </button>
  );
};
