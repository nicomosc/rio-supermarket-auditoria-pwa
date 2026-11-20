"use client";

import React from "react";

export const RIO_BRAND_COLORS = {
  greenPrimary: "#087334",    // Verde Corporativo Principal Río Supermarket (--color-primary en riomarket.com)
  greenLogo: "#00751E",       // Verde Isotipo Río®
  limeAccent: "#B2D034",      // Verde Lima Corporativo Secundario (--color-primary2 / subheader en riomarket.com)
  redAlert: "#DB0617",        // Rojo Corporativo Ofertas / Fallas Críticas (--product-nxp-backgroundColor)
  cartPink: "#ED4284",        // Barra 1 Carrito Río (Magenta)
  cartLime: "#94D200",        // Barra 2 Carrito Río (Lima)
  cartOrange: "#FF8700",      // Barra 3 Carrito Río (Naranja)
  cartCyan: "#0095D9",        // Barra 4 Carrito Río (Azul Cian)
} as const;

export const RIO_LOGO_WHITE_DATA_URL = "data:image/png;base64,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";
export const RIO_LOGO_COLOR_DATA_URL = "data:image/png;base64,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";

interface RioLogoProps {
  variant?: "color" | "white";
  size?: number;
  className?: string;
  showBadge?: boolean;
}

export default function RioLogo({
  variant = "color",
  size = 44,
  className = "",
  showBadge = true,
}: RioLogoProps) {
  const src = variant === "white" ? RIO_LOGO_WHITE_DATA_URL : RIO_LOGO_COLOR_DATA_URL;

  if (!showBadge) {
    return (
      <img
        src={src}
        alt="Río Supermarket Logo Oficial"
        width={size}
        height={size}
        className={`object-contain select-none ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden shrink-0 select-none ${
        variant === "color"
          ? "bg-white border-2 border-[#B2D034] shadow-md shadow-[#087334]/30"
          : "bg-[#087334] border-2 border-[#B2D034]/80 shadow-md shadow-[#087334]/40"
      } ${className}`}
    >
      {/* Franja superior multicromática inspirada en las 4 barras del carrito Río */}
      <div className="absolute top-0 inset-x-0 h-1 flex">
        <span className="flex-1 bg-[#ED4284]" />
        <span className="flex-1 bg-[#94D200]" />
        <span className="flex-1 bg-[#FF8700]" />
        <span className="flex-1 bg-[#0095D9]" />
      </div>
      <img
        src={src}
        alt="Río Supermarket"
        style={{ width: Math.round(size * 0.82), height: Math.round(size * 0.82) }}
        className="object-contain mt-0.5"
      />
    </div>
  );
}
