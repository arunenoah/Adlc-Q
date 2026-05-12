"use client";

import React from "react";
import { C, mono } from "@/lib/theme";

// Shared primitives. KISS: only the two shapes used across the shell.
// SRP: this file owns no behavior beyond rendering.

type TagProps = {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  title?: string;
};

export const Tag = ({ children, color = C.ink, bg = "transparent", title }: TagProps) => (
  <span
    title={title}
    style={{
      ...mono,
      fontSize: 9,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color,
      background: bg,
      border: `1px solid ${color}`,
      padding: "2px 6px",
    }}
  >
    {children}
  </span>
);

type BtnProps = {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  primary?: boolean;
  disabled?: boolean;
  small?: boolean;
  title?: string;
  type?: "button" | "submit";
};

export const Btn = ({ children, onClick, primary, disabled, small, title, type = "button" }: BtnProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      background: disabled ? C.soft : primary ? C.accent : C.ink,
      color: disabled ? C.dim : C.paper,
      border: "none",
      padding: small ? "4px 8px" : "8px 14px",
      ...mono,
      fontSize: small ? 9 : 10,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    {children}
  </button>
);
