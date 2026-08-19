import React, { useEffect, useRef, useState } from 'react';
import { NewspaperRollEngine } from './NewspaperRollEngine';

interface HeroNewspaperRollProps {
  reducedMotion?: boolean;
  onComplete?: () => void;
  isBackground?: boolean;
}

export const HeroNewspaperRoll: React.FC<HeroNewspaperRollProps> = ({
  reducedMotion: externalReducedMotion,
  onComplete,
  isBackground = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<NewspaperRollEngine | null>(null);

  const [reducedMotion, setReducedMotion] = useState(
    externalReducedMotion !== undefined ? externalReducedMotion : false
  );

  // Sync external reduced motion prop
  useEffect(() => {
    if (externalReducedMotion !== undefined) {
      setReducedMotion(externalReducedMotion);
      if (engineRef.current) {
        engineRef.current.setReducedMotion(externalReducedMotion);
      }
    }
  }, [externalReducedMotion]);

  // Check prefers-reduced-motion OS preference on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches && externalReducedMotion === undefined) {
      setReducedMotion(true);
      if (engineRef.current) {
        engineRef.current.setReducedMotion(true);
      }
    }

    const handler = (e: MediaQueryListEvent) => {
      if (externalReducedMotion === undefined) {
        setReducedMotion(e.matches);
        if (engineRef.current) {
          engineRef.current.setReducedMotion(e.matches);
        }
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [externalReducedMotion]);

  // Initialize Three.js Engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new NewspaperRollEngine({
      canvas: canvasRef.current,
      reducedMotion,
      onComplete: () => {
        if (onComplete) {
          onComplete();
        }
      }
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [onComplete, reducedMotion]);

  return (
    <section className="relative w-screen h-screen overflow-hidden bg-[#f6f2e8] select-none text-[#1a1b1f]">
      {/* Pure 3D WebGL Canvas for Continuous Newspaper Spools & Ribbons */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full block focus:outline-none ${
          isBackground ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'
        }`}
        tabIndex={0}
        aria-label="3D Continuous Newspaper Roll Animation"
      />

      {/* Atmospheric Warm Paper Soft Vignette Overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_45%,_rgba(224,214,196,0.45)_80%,_rgba(208,196,176,0.7)_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.7)_0%,_transparent_65%)] pointer-events-none" />
    </section>
  );
};

export default HeroNewspaperRoll;


