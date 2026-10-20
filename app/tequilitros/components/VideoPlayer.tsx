"use client";

import { useRef, useState } from "react";

export default function VideoPlayer({
  src = "/tequilitros/barra-movil-tequilitros.mp4",
  poster = "/tequilitros/cantarito.jpg",
}: {
  src?: string;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <div
      onClick={togglePlay}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#2A343D] bg-[#0E1318] shadow-2xl transition-all duration-300 hover:border-[#E28735]/40"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        loop
        muted={isMuted}
        onEnded={() => setIsPlaying(false)}
        className="aspect-[16/9] w-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
      />

      {/* Gradiente cinemático superpuesto */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080B0E]/80 via-transparent to-transparent transition-opacity duration-300 ${
          isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        }`}
      />

      {/* Botón central de reproducción */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#E28735]/50 bg-[#080B0E]/80 text-[#E28735] shadow-xl backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
            <span className="translate-x-0.5 text-2xl">▶</span>
          </div>
        </div>
      )}

      {/* Barra de controles flotante */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-[#F5F2EB]">
        <div className="flex items-center gap-2 rounded-full border border-[#2A343D] bg-[#080B0E]/80 px-3 py-1 font-mono text-[10px] uppercase tracking-wider backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-[#E28735] animate-pulse" />
          <span>Barra Móvil en Acción · Video Real</span>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2A343D] bg-[#080B0E]/80 text-sm backdrop-blur hover:bg-[#1A222B]"
          aria-label={isMuted ? "Activar sonido" : "Silenciar sonido"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
