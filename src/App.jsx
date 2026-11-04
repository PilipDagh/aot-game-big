/**
 * App.jsx
 * Attack on Titan (AOT) Omni-Directional Mobility (ODM) Traversal Engine & Wave Survival
 * Main UI Container, Telemetry Pipeline, QTE State Routing & Game Over / Victory Flows
 */
import React, { useState, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas.jsx';
import HUD from './components/HUD.jsx';
import QTEOverlay from './components/QTEOverlay.jsx';
import { soundEngine } from './utils/SoundEngine.js';

export default function App() {
  // Telemetry state received from GameCanvas Three.js render loop
  const [telemetry, setTelemetry] = useState({
    speedKmh: 0,
    gas: 100,
    gasTanks: 4,
    bladeDurability: 100,
    bladePairs: 4,
    health: 100,
    isReloading: false,
    reloadTimer: 0,
    reloadDuration: 3,
    killCount: 0,
    radarTitans: [],
    reticleLock: false,
    reticleDist: 0,
    hasLeftHook: false,
    hasRightHook: false,
    isBoosting: false,
    isReeling: false
  });

  const [killFeed, setKillFeed] = useState([]);
  const [isGrabbed, setIsGrabbed] = useState(false);
  const [currentTitanGrabbed, setCurrentTitanGrabbed] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Virtual inputs for touch / mobile
  const [virtualInput, setVirtualInput] = useState({
    isReeling: false,
    isBoosting: false
  });

  // Handle telemetry updates from Three.js engine loop
  const handleTelemetryUpdate = useCallback((data) => {
    if (data.newKill) {
      const newEntry = {
        id: Date.now() + Math.random(),
        speedKmh: data.newKill.speedKmh,
        titanHeight: data.newKill.titanHeight
      };
      setKillFeed((prev) => [newEntry, ...prev.slice(0, 4)]);
    }

    setTelemetry((prev) => ({
      ...prev,
      ...data
    }));

    if (data.health <= 0) {
      setGameOver(true);
    }
  }, []);

  // Audio mute toggle
  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  }, [isMuted]);

  // QTE Escape routine: player severed Titan fingers!
  const handleQTEEscape = useCallback(() => {
    setIsGrabbed(false);
    if (currentTitanGrabbed) {
      currentTitanGrabbed.state = 'STUNNED';
      currentTitanGrabbed.stunTimer = 4.0;
    }
    setCurrentTitanGrabbed(null);
  }, [currentTitanGrabbed]);

  // QTE Fail routine: player crushed by Titan grip!
  const handleQTEFail = useCallback(() => {
    setIsGrabbed(false);
    setCurrentTitanGrabbed(null);
    setGameOver(true);
    soundEngine.playImpactCrash();
  }, []);

  // Action handlers wired to GameCanvas
  const handleReload = () => {
    GameCanvas.triggerReload?.();
  };

  const handleRespawn = () => {
    setGameOver(false);
    setIsGrabbed(false);
    setCurrentTitanGrabbed(null);
    GameCanvas.triggerRespawn?.();
  };

  const handleLeftHook = () => {
    GameCanvas.triggerLeftHook?.();
  };

  const handleRightHook = () => {
    GameCanvas.triggerRightHook?.();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans">
      {/* 3D WebGL Game Canvas Viewport */}
      <GameCanvas
        onTelemetryUpdate={handleTelemetryUpdate}
        isGrabbed={isGrabbed}
        setIsGrabbed={setIsGrabbed}
        currentTitanGrabbed={currentTitanGrabbed}
        setCurrentTitanGrabbed={setCurrentTitanGrabbed}
        virtualInput={virtualInput}
      />

      {/* Real-time HUD Telemetry Overlays */}
      {!gameOver && (
        <HUD
          speedKmh={telemetry.speedKmh}
          gas={telemetry.gas}
          gasTanks={telemetry.gasTanks}
          bladeDurability={telemetry.bladeDurability}
          bladePairs={telemetry.bladePairs}
          health={telemetry.health}
          isReloading={telemetry.isReloading}
          reloadTimer={telemetry.reloadTimer}
          reloadDuration={telemetry.reloadDuration}
          killCount={telemetry.killCount}
          killFeed={killFeed}
          radarTitans={telemetry.radarTitans}
          reticleLock={telemetry.reticleLock}
          reticleDist={telemetry.reticleDist}
          hasLeftHook={telemetry.hasLeftHook}
          hasRightHook={telemetry.hasRightHook}
          isBoosting={telemetry.isBoosting}
          isReeling={telemetry.isReeling}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onReload={handleReload}
          onReset={handleRespawn}
          onLeftHookPress={handleLeftHook}
          onRightHookPress={handleRightHook}
          onReelStart={() => setVirtualInput((v) => ({ ...v, isReeling: true }))}
          onReelEnd={() => setVirtualInput((v) => ({ ...v, isReeling: false }))}
          onBoostStart={() => setVirtualInput((v) => ({ ...v, isBoosting: true }))}
          onBoostEnd={() => setVirtualInput((v) => ({ ...v, isBoosting: false }))}
        />
      )}

      {/* Interactive 10-Second QTE Grab Mash Prompt */}
      <QTEOverlay
        isGrabbed={isGrabbed}
        titanHeight={currentTitanGrabbed?.height || 12}
        onEscape={handleQTEEscape}
        onFail={handleQTEFail}
      />

      {/* Game Over Screen */}
      {gameOver && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="bg-neutral-950 border border-red-600 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.5)]">
            <div className="text-5xl mb-3">💀</div>
            <h1 className="text-3xl font-black uppercase text-red-500 tracking-tight mb-1">
              KILLED IN ACTION
            </h1>
            <p className="text-xs font-mono text-neutral-400 uppercase tracking-widest mb-6">
              WALL ROSE CASUALTY REPORT
            </p>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-6 space-y-2 font-mono text-sm">
              <div className="flex justify-between text-neutral-400">
                <span>Titans Sliced:</span>
                <span className="text-amber-400 font-bold">{telemetry.killCount}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Top Velocity:</span>
                <span className="text-cyan-400 font-bold">{Math.round(telemetry.speedKmh)} km/h</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>District Status:</span>
                <span className="text-red-400 font-bold">OVERRUN</span>
              </div>
            </div>

            <button
              onClick={handleRespawn}
              type="button"
              className="w-full py-4 px-6 rounded-xl font-black text-base uppercase tracking-wider bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg cursor-pointer active:scale-95 transition-transform"
            >
              ⚔️ RESPAWN &amp; RETAKE WALL ROSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
