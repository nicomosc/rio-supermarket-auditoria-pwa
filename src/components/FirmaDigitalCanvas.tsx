'use client';

import { useRef, useEffect, useState } from 'react';
import { Eraser, CheckCircle2, PenTool } from 'lucide-react';

interface FirmaDigitalCanvasProps {
  titulo: string;
  subtitulo?: string;
  initialDataUrl: string | null;
  onChange: (dataUrl: string | null) => void;
}

export default function FirmaDigitalCanvas({
  titulo,
  subtitulo,
  initialDataUrl,
  onChange,
}: FirmaDigitalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dibujando, setDibujando] = useState(false);
  const [tieneTrazo, setTieneTrazo] = useState(Boolean(initialDataUrl));

  // Cargar imagen previa si existe en initialDataUrl
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = initialDataUrl;
      setTieneTrazo(true);
    } else {
      setTieneTrazo(false);
    }
  }, [initialDataUrl]);

  function obtenerCoordenadas(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function iniciarTrazo(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = obtenerCoordenadas(e);
    ctx.strokeStyle = '#042f16';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDibujando(true);
    setTieneTrazo(true);
  }

  function moverTrazo(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!dibujando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = obtenerCoordenadas(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function finalizarTrazo() {
    if (!dibujando) return;
    setDibujando(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  }

  function limpiarFirma() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
    onChange(null);
  }

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 border-2 border-[#087334]/25 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-[#087334] flex items-center gap-1.5">
            <PenTool size={13} /> {titulo}
          </p>
          {subtitulo && (
            <p className="text-[11px] text-slate-500">{subtitulo}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {tieneTrazo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#087334] bg-[#087334]/10 px-2 py-0.5 rounded-md">
              <CheckCircle2 size={11} /> Firmado
            </span>
          )}
          <button
            type="button"
            onClick={limpiarFirma}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-[#DB0617] bg-white hover:bg-red-50 border border-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
          >
            <Eraser size={12} /> Limpiar
          </button>
        </div>
      </div>

      <div className="relative bg-white rounded-xl border border-dashed border-slate-300 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={380}
          height={120}
          onMouseDown={iniciarTrazo}
          onMouseMove={moverTrazo}
          onMouseUp={finalizarTrazo}
          onMouseLeave={finalizarTrazo}
          onTouchStart={iniciarTrazo}
          onTouchMove={moverTrazo}
          onTouchEnd={finalizarTrazo}
          className="w-full h-28 touch-none cursor-crosshair block"
        />
        {!tieneTrazo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-slate-400 font-medium">
            Firma aquí con el dedo o el mouse
          </div>
        )}
      </div>
    </div>
  );
}
