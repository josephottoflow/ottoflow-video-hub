/**
 * Reusable dark-themed browser window mockup
 */
import React from "react";
import { BRAND } from "../types";

interface Props {
  title: string;
  url: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
  favicon?: string;
  urlHighlight?: boolean;
}

export const BrowserFrame: React.FC<Props> = ({
  title,
  url,
  children,
  width = 940,
  height = 1100,
  favicon,
  urlHighlight = false,
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: BRAND.bgBrowser,
      border: `1px solid ${BRAND.border}`,
      boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px ${BRAND.border}`,
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Title bar with traffic lights */}
    <div
      style={{
        height: 48,
        backgroundColor: BRAND.bgBrowserBar,
        display: "flex",
        alignItems: "center",
        padding: "0 18px",
        gap: 10,
        borderBottom: `1px solid ${BRAND.border}`,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginRight: 12 }}>
        <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#ff5f56" }} />
        <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#ffbd2e" }} />
        <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#27c93f" }} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          backgroundColor: BRAND.bgBrowser,
          borderRadius: "8px 8px 0 0",
          fontSize: 14,
          fontFamily: "Inter",
          color: "#ccc",
          maxWidth: 300,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {favicon && <span style={{ fontSize: 14 }}>{favicon}</span>}
        <span>{title}</span>
      </div>
    </div>
    {/* URL bar */}
    <div
      style={{
        height: 44,
        backgroundColor: BRAND.bgBrowserBar,
        display: "flex",
        alignItems: "center",
        padding: "0 18px",
        borderBottom: `1px solid ${BRAND.border}`,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 30,
          borderRadius: 8,
          backgroundColor: urlHighlight ? `${BRAND.green}20` : BRAND.inputBg,
          border: urlHighlight ? `1px solid ${BRAND.green}60` : "1px solid transparent",
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          fontSize: 13,
          fontFamily: "Inter",
          color: urlHighlight ? BRAND.greenLight : "#888",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {url}
      </div>
    </div>
    {/* Content */}
    <div style={{ flex: 1, overflow: "hidden", position: "relative", backgroundColor: "#fff" }}>
      {children}
    </div>
  </div>
);
