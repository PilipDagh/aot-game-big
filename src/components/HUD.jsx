/**
 * HUD.jsx
 * Attack on Titan Real-Time Telemetry Overlay
 * Speedometer, Gas/Blade Meters, Titan Threat Radar, High-Velocity Kill Feed & Collapsible Controls Dock
 */
import React, { useState } from 'react';
import {
  Gauge,
  Flame,
  Sword,
  Compass,
  Crosshair,
  Volume2,
  VolumeX,
  RotateCcw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Zap
} from 'lucide-react';

export default function HUD({
  speedKmh = 0,
  gas = 100,
  gasTanks = 4,
  bladeDurability = 100,
  bladePairs = 4,
  health = 100,
  isReloading = false,
  reloadTimer = 0,
  reloadDuration = 3,
  killCount = 0,
  killFeed = [],
  radarTitans = [],
  reticleLock = false,
  reticleDist = 0,
  hasLeftHook = false,
  hasRightHook = false,
  isBoosting = false,
  isReeling = false,
  isMuted = false,
  onToggleMute,
  onReload,
  onReset,
  // Virtual touch controls triggers
  onLeftHookPress,
  onRightHookPress,
  onReelStart,
  onReelEnd,
  onBoostStart,
  onBoostEnd,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [collapsedDock, setCollapsedDock] = useState(false);

  // Velocity color indicator: >= 45 km/h is lethal nape cut threshold
  const isLethalSpeed = speedKmh >= 45.0;
  const speedColor = isLethalSpeed
    ? 'text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]'
    : speedKmh >= 25
    ? 'text-amber-400'
    : 'text-cyan-400';

  const reloadProgress = isReloading
    ? Math.min(100, (reloadTimer / reloadDuration) * 100)
    : 0;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 sm:p-5 select-none font-sans">
      {/* --- TOP ROW: STATUS BAR & KILL FEED --- */}
      <div className="flex justify-between items-start w-full">
        {/* Top-Left: Scout Regiment Badge & Health / Kill Counter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5 bg-black/70 backdrop-blur-none border border-neutral-700/80 rounded-xl px-3.5 py-2 text-white shadow-lg pointer-events-auto">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center font-black text-emerald-400 text-xs">
              ⚔️
            </div>
            <div>
              <div className="text-[10px] tracking-wider text-neutral-400 font-mono uppercase font-bold">
                SURVEY CORPS • WALL ROSE
              </div>
              <div className="text-sm font-extrabold tracking-wide flex items-center gap-2">
                <span className="text-white">TITANS ELIMINATED:</span>
                <span className="text-amber-400 font-mono text-base">{killCount}</span>
              </div>
            </div>
          </div>

          {/* Health Bar */}
          <div className="bg-black/70 border border-neutral-700/80 rounded-xl px-3.5 py-2 w-56 text-white shadow-lg">
            <div className="flex justify-between text-[11px] font-mono text-neutral-300 mb-1">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> VITALITY
              </span>
              <span className="font-bold text-red-400">{Math.round(health)}%</span>
            </div>
            <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-rose-400 transition-all duration-150"
                style={{ width: `${Math.max(0, health)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top-Center: Kill Feed Notifications */}
        <div className="flex flex-col items-center gap-1.5 max-w-sm pointer-events-none">
          {killFeed.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="bg-red-950/90 border border-red-500/90 text-white px-4 py-1.5 rounded-lg text-xs font-mono tracking-wide flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)] transform animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <span className="text-amber-400 font-bold">⚡ NAPE CUT</span>
              <span className="text-neutral-200">[{item.titanHeight}M TITAN]</span>
              <span className="text-red-400 font-extrabold">@{item.speedKmh} KM/H</span>
            </div>
          ))}
        </div>

        {/* Top-Right: Titan Threat Mini-Radar */}
        <div className="flex flex-col items-end gap-2">
          <div className="bg-black/75 border border-neutral-700/80 rounded-2xl p-2.5 text-white shadow-xl pointer-events-auto">
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-1.5 px-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <Compass className="w-3 h-3" /> RADAR
              </span>
              <span>ACTIVE: {radarTitans.length}</span>
            </div>

            {/* Circular Radar Screen (Diameter 110px) */}
            <div className="relative w-28 h-28 rounded-full bg-neutral-950/90 border border-neutral-700 flex items-center justify-center overflow-hidden">
              {/* Radar Rings */}
              <div className="absolute w-20 h-20 rounded-full border border-neutral-800 pointer-events-none" />
              <div className="absolute w-10 h-10 rounded-full border border-neutral-800 pointer-events-none" />
              <div className="absolute w-full h-[1px] bg-neutral-800/80 pointer-events-none" />
              <div className="absolute h-full w-[1px] bg-neutral-800/80 pointer-events-none" />

              {/* Player Center Blip */}
              <div className="w-2 h-2 rounded-full bg-cyan-400 border border-white z-10 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />

              {/* Titan Blips */}
              {radarTitans.map((t) => {
                // Map district range (~120m) to radar 56px radius
                const radarScale = 52 / 120;
                const bx = 56 + t.x * radarScale;
                const by = 56 + t.z * radarScale;

                // Clamp to edge of circle if outside
                const clampedX = Math.max(4, Math.min(108, bx));
                const clampedY = Math.max(4, Math.min(108, by));

                const isAggro = t.state === 'TARGET_AGGRO' || t.state === 'ATTACK_REACH';
                const isStunned = t.state === 'STUNNED';

                return (
                  <div
                    key={t.id}
                    title={`${t.height}m Titan (${t.distance}m)`}
                    className={`absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
                      isStunned
                        ? 'bg-purple-400 ring-1 ring-purple-300'
                        : isAggro
                        ? 'bg-red-500 ring-2 ring-red-400 shadow-[0_0_6px_rgba(239,68,68,0.9)]'
                        : 'bg-amber-400'
                    }`}
                    style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Quick Audio & Help Buttons */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={onToggleMute}
              className="p-2 rounded-xl bg-black/70 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/80 shadow cursor-pointer transition-colors"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 rounded-xl bg-black/70 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/80 shadow cursor-pointer transition-colors"
              title="Controls & Instructions"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </button>
            <button
              onClick={onReset}
              className="p-2 rounded-xl bg-black/70 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/80 shadow cursor-pointer transition-colors"
              title="Respawn / Reset"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        </div>
      </div>

      {/* --- CENTER RETICLE & HOOK INDICATORS --- */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Main Crosshair */}
          <div
            className={`w-6 h-6 border rounded-full transition-all duration-150 flex items-center justify-center ${
              reticleLock
                ? 'border-emerald-400 scale-125 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                : 'border-white/40'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${reticleLock ? 'bg-emerald-400' : 'bg-white/60'}`} />
          </div>

          {/* Target Distance Readout */}
          {reticleLock && (
            <div className="absolute top-8 text-[11px] font-mono text-emerald-400 bg-black/75 px-2 py-0.5 rounded border border-emerald-500/50">
              {Math.round(reticleDist)}M ANCHOR
            </div>
          )}

          {/* Left Hook Active Indicator Bracket */}
          <div
            className={`absolute -left-9 flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
              hasLeftHook
                ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300'
                : 'bg-black/40 border-neutral-800 text-neutral-500'
            }`}
          >
            <span>Q</span>
          </div>

          {/* Right Hook Active Indicator Bracket */}
          <div
            className={`absolute -right-9 flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
              hasRightHook
                ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300'
                : 'bg-black/40 border-neutral-800 text-neutral-500'
            }`}
          >
            <span>E</span>
          </div>
        </div>
      </div>

      {/* --- SPEEDOMETER GAUGE & VELOCITY THRESHOLD BADGE --- */}
      <div className="self-center flex flex-col items-center pointer-events-none mb-1">
        <div className="flex items-baseline gap-1.5 bg-black/75 border border-neutral-700/80 rounded-2xl px-5 py-2 shadow-2xl">
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest font-bold">
            VELOCITY
          </span>
          <span className={`font-mono text-3xl sm:text-4xl font-black ${speedColor}`}>
            {Math.round(speedKmh)}
          </span>
          <span className="text-xs font-mono text-neutral-400 uppercase font-bold">
            KM/H
          </span>

          {/* Velocity Gate Status Badge */}
          <div className="ml-3 pl-3 border-l border-neutral-700 flex items-center gap-1 text-[10px] font-mono">
            {isLethalSpeed ? (
              <span className="text-red-400 font-extrabold uppercase bg-red-950/80 px-2 py-0.5 rounded border border-red-500/60">
                ⚡ LETHAL CUT READY
              </span>
            ) : (
              <span className="text-neutral-400 font-semibold uppercase">
                NEED 45+ KM/H FOR NAPE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* --- RELOAD PROGRESS BAR OVERLAY --- */}
      {isReloading && (
        <div className="self-center flex flex-col items-center bg-black/85 border border-amber-500 rounded-xl px-6 py-2.5 mb-2 shadow-lg">
          <div className="text-xs font-mono text-amber-400 font-bold mb-1">
            REPLACING BLADES &amp; GAS CANISTERS...
          </div>
          <div className="w-56 bg-neutral-900 rounded-full h-2 overflow-hidden border border-neutral-700">
            <div
              className="h-full bg-amber-400 transition-all duration-75"
              style={{ width: `${reloadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* --- TOUCH CONTROLS FOR MOBILE / TABLET VIEWPORTS --- */}
      <div className="sm:hidden w-full flex justify-between items-end mb-2 pointer-events-auto">
        {/* Left Side: Hook Q & Thruster */}
        <div className="flex flex-col gap-2">
          <button
            onPointerDown={onLeftHookPress}
            type="button"
            className="w-14 h-14 rounded-2xl bg-cyan-900/80 active:bg-cyan-600 text-white font-mono font-bold text-sm border-2 border-cyan-400 shadow flex items-center justify-center cursor-pointer"
          >
            HOOK L
          </button>
          <button
            onPointerDown={onBoostStart}
            onPointerUp={onBoostEnd}
            type="button"
            className="w-14 h-14 rounded-2xl bg-orange-900/80 active:bg-orange-600 text-white font-mono font-bold text-sm border-2 border-orange-400 shadow flex items-center justify-center cursor-pointer"
          >
            GAS
          </button>
        </div>

        {/* Right Side: Reel-in & Hook E */}
        <div className="flex flex-col gap-2 items-end">
          <button
            onPointerDown={onRightHookPress}
            type="button"
            className="w-14 h-14 rounded-2xl bg-cyan-900/80 active:bg-cyan-600 text-white font-mono font-bold text-sm border-2 border-cyan-400 shadow flex items-center justify-center cursor-pointer"
          >
            HOOK R
          </button>
          <button
            onPointerDown={onReelStart}
            onPointerUp={onReelEnd}
            type="button"
            className="w-14 h-14 rounded-2xl bg-amber-900/80 active:bg-amber-600 text-white font-mono font-bold text-sm border-2 border-amber-400 shadow flex items-center justify-center cursor-pointer"
          >
            REEL
          </button>
        </div>
      </div>

      {/* --- BOTTOM TELEMETRY & CONTROLS DOCK (UNIFIED COLLAPSIBLE) --- */}
      <div className="self-center w-full max-w-4xl pointer-events-auto flex flex-col items-center">
        {/* Collapse / Expand Toggle Tab */}
        <button
          onClick={() => setCollapsedDock(!collapsedDock)}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1 rounded-t-xl bg-black/80 hover:bg-neutral-800 text-neutral-300 border-t border-x border-neutral-700 text-xs font-mono tracking-wider cursor-pointer transition-colors shadow-md"
        >
          {collapsedDock ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>SHOW METERS &amp; CONTROLS</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              <span>HIDE DOCK</span>
            </>
          )}
        </button>

        {/* Consolidated Dock Panel */}
        {!collapsedDock && (
          <div className="w-full bg-black/85 border border-neutral-700/90 rounded-2xl p-3 sm:p-4 text-white shadow-2xl flex flex-wrap items-center justify-between gap-3 sm:gap-6">
            {/* 1. Gas Pressure Meter */}
            <div className="flex items-center gap-3 flex-1 min-w-[170px]">
              <div className="w-8 h-8 rounded-lg bg-orange-950/80 border border-orange-500/60 flex items-center justify-center text-orange-400">
                <Flame className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[11px] font-mono text-neutral-300 mb-1">
                  <span>GAS PRESSURE</span>
                  <span className="font-bold text-orange-400">{Math.round(gas)}% ({gasTanks} TANKS)</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-orange-600 to-amber-400 transition-all duration-75"
                    style={{ width: `${Math.max(0, gas)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Dual Blade Durability Meter */}
            <div className="flex items-center gap-3 flex-1 min-w-[170px]">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/60 flex items-center justify-center text-cyan-400">
                <Sword className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[11px] font-mono text-neutral-300 mb-1">
                  <span>BLADE SHARPNESS</span>
                  <span className="font-bold text-cyan-400">{Math.round(bladeDurability)}% ({bladePairs} PAIRS)</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-600 to-sky-300 transition-all duration-75"
                    style={{ width: `${Math.max(0, bladeDurability)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Reload Button & Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onReload}
                disabled={isReloading}
                type="button"
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 disabled:opacity-50 text-xs font-mono font-bold text-amber-300 border border-neutral-600 flex items-center gap-1.5 cursor-pointer transition-all shadow"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>RELOAD [R]</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- INSTRUCTIONS MODAL --- */}
      {showHelp && (
        <div className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center bg-black/80 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-800">
              <h3 className="text-lg font-black tracking-wide text-white uppercase flex items-center gap-2">
                ⚔️ ODM ENGINE OPERATING MANUAL
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-neutral-400 hover:text-white font-mono text-sm px-2 py-1 rounded bg-neutral-800 cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-neutral-300 font-sans">
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
                  <strong className="text-cyan-400">KEY Q / L-CLICK:</strong> Left Hook
                </div>
                <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
                  <strong className="text-cyan-400">KEY E / R-CLICK:</strong> Right Hook
                </div>
                <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
                  <strong className="text-amber-400">SPACE (HOLD):</strong> Reel-In Slingshot
                </div>
                <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
                  <strong className="text-orange-400">L-SHIFT (HOLD):</strong> Gas Thrusters
                </div>
                <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
                  <strong className="text-white">WASD:</strong> Run / Air Strafe
                </div>
                <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
                  <strong className="text-yellow-400">KEY R:</strong> Reload Blades &amp; Gas
                </div>
              </div>

              <h4 className="font-bold text-white uppercase text-xs pt-2">TITAN COMBAT PROTOCOL:</h4>
              <ul className="list-disc pl-4 space-y-1 text-xs text-neutral-300">
                <li>
                  <strong className="text-red-400">Nape Strike Velocity Gate:</strong> Strikes to the Titan nape only decapitate if speed is <span className="text-red-400 font-bold">&ge; 45 km/h</span>. Sub-speed hits ricochet and dull blades!
                </li>
                <li>
                  <strong className="text-amber-400">Limb Tendons:</strong> Slicing leg hitboxes grounds Titans for 8 seconds.
                </li>
                <li>
                  <strong className="text-purple-400">Grab QTE:</strong> If seized in a Titan fist, rapidly mash <kbd className="bg-neutral-800 px-1 rounded">SPACE</kbd> or <kbd className="bg-neutral-800 px-1 rounded">E</kbd> 15 times before the 10-second timer expires.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
