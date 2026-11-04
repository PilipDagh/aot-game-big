/**
 * QTEOverlay.jsx
 * Attack on Titan Grabbed Survival QTE
 * 10-second countdown; mash Space / E / Tap 15 times to slice Titan fingers & break free!
 */
import React, { useEffect, useState } from 'react';
import { soundEngine } from '../utils/SoundEngine.js';

export default function QTEOverlay({
  isGrabbed,
  onEscape,
  onFail,
  titanHeight = 12
}) {
  const [mashCount, setMashCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10.0);
  const targetMashes = 15;

  // Reset when grabbed
  useEffect(() => {
    if (!isGrabbed) {
      setMashCount(0);
      setTimeLeft(10.0);
      return;
    }

    setMashCount(0);
    setTimeLeft(10.0);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 0.05);
        if (next <= 0) {
          clearInterval(timer);
          onFail();
        }
        return next;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [isGrabbed, onFail]);

  // Handle mash key presses (Space or E)
  useEffect(() => {
    if (!isGrabbed) return;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        handleMash();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGrabbed, mashCount]);

  const handleMash = () => {
    if (!isGrabbed || timeLeft <= 0) return;

    soundEngine.playQTEHit();
    const newCount = mashCount + 1;
    setMashCount(newCount);

    if (newCount >= targetMashes) {
      soundEngine.playNapeSlash(60);
      onEscape();
    }
  };

  if (!isGrabbed) return null;

  const progressPercent = Math.min(100, (mashCount / targetMashes) * 100);
  const isUrgent = timeLeft < 3.5;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center bg-red-950/40 select-none backdrop-brightness-75">
      {/* Pulsing red blood vignette on border */}
      <div className="absolute inset-0 border-8 border-red-600/80 pointer-events-none animate-pulse" />

      {/* Main QTE Card */}
      <div className="relative z-10 flex flex-col items-center bg-black/85 border-2 border-red-500 rounded-2xl p-6 sm:p-8 max-w-md w-11/12 shadow-[0_0_50px_rgba(239,68,68,0.7)] text-center text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
          <span className="text-red-400 text-xs font-mono tracking-widest uppercase font-bold">
            CRITICAL EMERGENCY • {titanHeight}M TITAN GRIP
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase drop-shadow-md">
          SEIZED BY TITAN!
        </h2>
        <p className="text-sm text-neutral-300 mt-1 mb-4">
          Mash <strong className="text-amber-400">SPACE</strong> or <strong className="text-amber-400">E</strong> to sever fingers before you are crushed!
        </p>

        {/* 10-Second Countdown Timer */}
        <div className="flex items-baseline justify-center gap-2 mb-5">
          <span className={`font-mono text-5xl sm:text-6xl font-black ${isUrgent ? 'text-red-500 animate-bounce' : 'text-amber-400'}`}>
            {timeLeft.toFixed(1)}
          </span>
          <span className="text-neutral-400 font-mono text-sm uppercase">SEC REMAINING</span>
        </div>

        {/* Sever Progress Bar */}
        <div className="w-full bg-neutral-900 rounded-full h-5 p-1 border border-neutral-700 mb-2 relative overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between w-full text-xs font-mono text-neutral-400 mb-6">
          <span>BLADE SLICES: {mashCount} / {targetMashes}</span>
          <span>{Math.round(progressPercent)}% FREED</span>
        </div>

        {/* Big Interactive Mash Button (Mobile/Touch and Clickable) */}
        <button
          onClick={handleMash}
          type="button"
          className="w-full py-4 px-6 rounded-xl font-black text-lg sm:text-xl tracking-wider uppercase text-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 active:scale-95 transition-transform shadow-[0_0_25px_rgba(250,204,21,0.5)] cursor-pointer"
        >
          ⚡ MASH TO SEVER FINGERS! ({mashCount}/{targetMashes})
        </button>

        <p className="text-neutral-400 text-xs mt-3 font-mono">
          [Keyboard: Rapidly spam <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-600 text-white">SPACE</kbd> or <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-600 text-white">E</kbd>]
        </p>
      </div>
    </div>
  );
}
