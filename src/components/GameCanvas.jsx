/**
 * GameCanvas.jsx
 * WebGL 3D Viewport, Three.js Render Loop, Dynamic Trailing Camera Rig with Velocity FOV & Roll,
 * Speed Lines Canvas & PointerLock Controls
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { SceneManager } from '../engine/SceneManager.js';
import { PhysicsEngine } from '../engine/PhysicsEngine.js';
import { HookSystem } from '../engine/HookSystem.js';
import { TitanManager, TitanState } from '../engine/TitanManager.js';
import { soundEngine } from '../utils/SoundEngine.js';

export default function GameCanvas({
  onTelemetryUpdate,
  isGrabbed,
  setIsGrabbed,
  currentTitanGrabbed,
  setCurrentTitanGrabbed,
  // Virtual control inputs from mobile buttons
  virtualInput
}) {
  const mountRef = useRef(null);
  const speedLinesCanvasRef = useRef(null);

  // References to engine instances
  const engineRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    sceneManager: null,
    physics: null,
    hookSystem: null,
    titanManager: null,
    clock: null,
    isPointerLocked: false,
    pitch: 0.1, // radians
    yaw: 0.0,
    keys: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
      keyQ: false,
      keyE: false,
      keyR: false
    },
    // Trailing camera target & smooth lerping
    camCurrentPos: new THREE.Vector3(0, 5, 10),
    camCurrentLookAt: new THREE.Vector3(0, 2, 0),
    // Dynamic FOV & Roll
    baseFov: 68,
    maxFov: 96,
    camRoll: 0,
    isSoftwareGl: false,
    frameId: 0
  });

  const [clickToStart, setClickToStart] = useState(true);

  // Initialize Three.js scene & engine modules
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect Software WebGL per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();
    engineRef.current.isSoftwareGl = isSoftwareGl;

    // 2. Initialize Three.js WebGLRenderer
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: !isSoftwareGl,
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);
    engineRef.current.renderer = renderer;

    // 3. Scene & Camera setup
    const scene = new THREE.Scene();
    engineRef.current.scene = scene;

    const camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 1000);
    camera.position.set(0, 15, 25);
    engineRef.current.camera = camera;

    // Studio Environment reflection map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Instantiate Engine Subsystems
    const sceneManager = new SceneManager(scene, renderer);
    engineRef.current.sceneManager = sceneManager;

    const physics = new PhysicsEngine();
    // Spawn player atop district building for an immediate breathtaking view
    physics.spawn(0, 24, -40);
    engineRef.current.physics = physics;

    const hookSystem = new HookSystem(scene, camera);
    engineRef.current.hookSystem = hookSystem;

    const titanManager = new TitanManager(scene);
    titanManager.spawnAll(230);
    engineRef.current.titanManager = titanManager;

    // Titan Kill callbacks
    titanManager.onKill = (killData) => {
      if (onTelemetryUpdate) {
        onTelemetryUpdate({ newKill: killData });
      }
    };

    titanManager.onRicochet = (speedKmh) => {
      physics.addShake(0.3);
    };

    // Grab QTE trigger callback
    const handleGrabTrigger = (titan) => {
      if (engineRef.current.physics.isDead) return;
      setCurrentTitanGrabbed(titan);
      setIsGrabbed(true);
      soundEngine.playTitanRoar();
      physics.addShake(0.8);
    };

    // 5. Clock for delta time
    const clock = new THREE.Clock();
    engineRef.current.clock = clock;

    // Pre-warm shaders
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Window Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);

      if (speedLinesCanvasRef.current) {
        speedLinesCanvasRef.current.width = w;
        speedLinesCanvasRef.current.height = h;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // 7. Mouse & PointerLock Controls
    const onMouseDown = (e) => {
      soundEngine.ensureContext();
      if (!engineRef.current.isPointerLocked) {
        container.requestPointerLock?.();
        return;
      }

      // Left click fires Left Hook (Q), Right click fires Right Hook (E)
      const playerPos = physics.position;
      const playerQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, engineRef.current.yaw, 0, 'YXZ')
      );
      const grappleTargets = sceneManager.getGrappleMeshes();

      if (e.button === 0) {
        // Left Click
        hookSystem.toggleHook('left', playerPos, playerQuat, camera, grappleTargets);
      } else if (e.button === 2) {
        // Right Click
        hookSystem.toggleHook('right', playerPos, playerQuat, camera, grappleTargets);
      }
    };

    const onContextMenu = (e) => {
      e.preventDefault(); // prevent context menu on right click
    };

    const onMouseMove = (e) => {
      if (!engineRef.current.isPointerLocked) return;
      const sensitivity = 0.0022;

      engineRef.current.yaw -= e.movementX * sensitivity;
      engineRef.current.pitch -= e.movementY * sensitivity;

      // Clamp vertical camera pitch (-85 to +85 degrees)
      const maxPitch = Math.PI / 2 - 0.08;
      engineRef.current.pitch = Math.max(-maxPitch, Math.min(maxPitch, engineRef.current.pitch));
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === container;
      engineRef.current.isPointerLocked = locked;
      setClickToStart(!locked);
    };

    // 8. Keyboard Controls
    const onKeyDown = (e) => {
      soundEngine.ensureContext();
      const keys = engineRef.current.keys;
      const playerPos = physics.position;
      const playerQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, engineRef.current.yaw, 0, 'YXZ')
      );
      const grappleTargets = sceneManager.getGrappleMeshes();

      switch (e.code) {
        case 'KeyW':
          keys.forward = true;
          break;
        case 'KeyS':
          keys.backward = true;
          break;
        case 'KeyA':
          keys.left = true;
          break;
        case 'KeyD':
          keys.right = true;
          break;
        case 'Space':
          keys.space = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.shift = true;
          break;
        case 'KeyQ':
          if (!e.repeat) {
            hookSystem.toggleHook('left', playerPos, playerQuat, camera, grappleTargets);
          }
          break;
        case 'KeyE':
          if (!e.repeat) {
            hookSystem.toggleHook('right', playerPos, playerQuat, camera, grappleTargets);
          }
          break;
        case 'KeyR':
          if (!e.repeat) {
            hookSystem.startReload();
          }
          break;
      }
    };

    const onKeyUp = (e) => {
      const keys = engineRef.current.keys;
      switch (e.code) {
        case 'KeyW':
          keys.forward = false;
          break;
        case 'KeyS':
          keys.backward = false;
          break;
        case 'KeyA':
          keys.left = false;
          break;
        case 'KeyD':
          keys.right = false;
          break;
        case 'Space':
          keys.space = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.shift = false;
          break;
      }
    };

    // Attach DOM Event Listeners
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 9. Main Animation Loop
    let animationFrameId = 0;

    const renderTick = () => {
      const dt = Math.min(0.05, clock.getDelta());

      const eng = engineRef.current;
      const keys = eng.keys;

      // Merge virtual mobile inputs if active
      if (virtualInput) {
        if (virtualInput.isReeling !== undefined) keys.space = virtualInput.isReeling;
        if (virtualInput.isBoosting !== undefined) keys.shift = virtualInput.isBoosting;
      }

      const isBoosting = keys.shift;
      const isReeling = keys.space;
      const hasActiveHooks = hookSystem.hasActiveHooks();

      // If player is seized in Titan grab, freeze physics & lock camera onto Titan head
      if (isGrabbed && currentTitanGrabbed) {
        // Freeze velocity
        physics.velocity.set(0, 0, 0);

        // Lock camera directly looking at Titan's menacing face
        const headPos = new THREE.Vector3();
        currentTitanGrabbed.mesh.getWorldPosition(headPos);
        headPos.y += 10 * currentTitanGrabbed.scale;

        camera.position.set(
          headPos.x + Math.sin(eng.yaw) * 4,
          headPos.y + 1,
          headPos.z + Math.cos(eng.yaw) * 4
        );
        camera.lookAt(headPos);
      } else {
        // Standard ODM Movement & Physics Loop
        // Calculate hook spring forces & gas thrusters
        const playerQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, eng.yaw, 0, 'YXZ')
        );

        const hookForces = hookSystem.calculateForces(
          physics.position,
          physics.velocity,
          playerQuat,
          dt,
          isReeling,
          isBoosting
        );

        // Update kinematics and collision
        physics.update(
          dt,
          keys,
          camera,
          hookForces,
          sceneManager.getColliders(),
          hasActiveHooks
        );

        // Update grapple wire lines & gas jet particles
        hookSystem.updateVisuals(physics.position, playerQuat, isBoosting, dt);

        // Update Titans AI & state machines
        titanManager.update(
          dt,
          physics.position,
          physics.velocity,
          physics.health,
          handleGrabTrigger
        );

        // Check Blade strike on Titans (Fatal nape cut or leg stun)
        titanManager.checkBladeStrike(physics.position, physics.velocity, hookSystem);

        // Dynamic Third-Person Camera Trailing Arm Rig
        updateCameraRig(dt);
      }

      // Audio loop update (thrusters hiss, wind, reel-in hum)
      const currentSpeedKmh = physics.getSpeedKmh();
      soundEngine.updateContinuous({
        isBoosting: isBoosting && hookSystem.gas > 0,
        isReeling: isReeling && hasActiveHooks,
        speedKmh: currentSpeedKmh
      });

      // Probe Grapple Target for Crosshair reticle
      const probe = hookSystem.probeGrappleTarget(camera, sceneManager.getGrappleMeshes());

      // Render 3D Scene
      renderer.render(scene, camera);

      // Render 2D Speed Lines Canvas Overlay (when speed > 50 km/h)
      renderSpeedLines(currentSpeedKmh);

      // Report telemetry to React HUD
      if (onTelemetryUpdate) {
        onTelemetryUpdate({
          speedKmh: currentSpeedKmh,
          gas: hookSystem.gas,
          gasTanks: hookSystem.gasTanks,
          bladeDurability: hookSystem.bladeDurability,
          bladePairs: hookSystem.bladePairs,
          health: physics.health,
          isReloading: hookSystem.isReloading,
          reloadTimer: hookSystem.reloadTimer,
          reloadDuration: hookSystem.reloadDuration,
          killCount: titanManager.killCount,
          radarTitans: titanManager.getRadarData(physics.position),
          reticleLock: probe.hasTarget && probe.distance <= 135,
          reticleDist: probe.distance,
          hasLeftHook: hookSystem.hooks.left.active,
          hasRightHook: hookSystem.hooks.right.active,
          isBoosting,
          isReeling
        });
      }

      animationFrameId = requestAnimationFrame(renderTick);
    };

    // Camera Rig with dynamic trailing arm, velocity-based FOV, and roll
    const updateCameraRig = (dt) => {
      const eng = engineRef.current;
      const speedKmh = physics.getSpeedKmh();

      // 1. Dynamic FOV: Lerp from 68° at rest up to 96° at max speed (> 60 km/h)
      const speedRatio = Math.min(1.0, speedKmh / 70.0);
      const targetFov = eng.baseFov + speedRatio * (eng.maxFov - eng.baseFov);
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6.0, dt);
      camera.updateProjectionMatrix();

      // 2. Trailing Arm Target calculation
      // Desired offset: [0, 2.5, -5.5] behind player in look direction
      const forwardDir = new THREE.Vector3(
        -Math.sin(eng.yaw) * Math.cos(eng.pitch),
        Math.sin(eng.pitch),
        -Math.cos(eng.yaw) * Math.cos(eng.pitch)
      ).normalize();

      // Look Target: slightly in front of player
      const lookTarget = physics.position.clone().add(new THREE.Vector3(0, 1.6, 0));
      lookTarget.addScaledVector(forwardDir, 4.0);

      // Dynamic distance pulled back at higher speeds
      const trailingDist = 5.5 + speedRatio * 1.5;
      const targetCamPos = physics.position.clone();
      targetCamPos.y += 2.2;
      targetCamPos.subScaledVector(forwardDir, trailingDist);

      // Add impulse camera shake
      const shake = physics.getShakeOffset();
      targetCamPos.x += shake.x;
      targetCamPos.y += shake.y;
      targetCamPos.z += shake.z;

      // Smooth dampening to prevent jittery camera
      eng.camCurrentPos.x = THREE.MathUtils.damp(eng.camCurrentPos.x, targetCamPos.x, 14.0, dt);
      eng.camCurrentPos.y = THREE.MathUtils.damp(eng.camCurrentPos.y, targetCamPos.y, 14.0, dt);
      eng.camCurrentPos.z = THREE.MathUtils.damp(eng.camCurrentPos.z, targetCamPos.z, 14.0, dt);

      eng.camCurrentLookAt.x = THREE.MathUtils.damp(eng.camCurrentLookAt.x, lookTarget.x, 16.0, dt);
      eng.camCurrentLookAt.y = THREE.MathUtils.damp(eng.camCurrentLookAt.y, lookTarget.y, 16.0, dt);
      eng.camCurrentLookAt.z = THREE.MathUtils.damp(eng.camCurrentLookAt.z, lookTarget.z, 16.0, dt);

      camera.position.copy(eng.camCurrentPos);
      camera.lookAt(eng.camCurrentLookAt);

      // 3. Camera Bank/Roll: Apply up to ±8° roll based on lateral swing velocity
      const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const lateralVel = physics.velocity.dot(rightDir);
      const targetRoll = (-lateralVel / 25.0) * (8 * Math.PI / 180);
      eng.camRoll = THREE.MathUtils.damp(eng.camRoll, targetRoll, 5.0, dt);

      // Apply z-axis roll
      camera.rotation.z += eng.camRoll;
    };

    // Render radial speed streak lines onto 2D overlay canvas
    const renderSpeedLines = (speedKmh) => {
      const canvas = speedLinesCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (speedKmh < 48) return; // Only trigger at high speeds (> 48 km/h)

      const intensity = Math.min(1.0, (speedKmh - 48) / 32);
      const lineCount = Math.floor(25 * intensity);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * intensity})`;

      for (let i = 0; i < lineCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const startRadius = Math.min(cx, cy) * (0.65 + Math.random() * 0.2);
        const endRadius = Math.max(cx, cy) * 1.3;

        const x1 = cx + Math.cos(angle) * startRadius;
        const y1 = cy + Math.sin(angle) * startRadius;
        const x2 = cx + Math.cos(angle) * endRadius;
        const y2 = cy + Math.sin(angle) * endRadius;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };

    animationFrameId = requestAnimationFrame(renderTick);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onTelemetryUpdate, isGrabbed, currentTitanGrabbed, virtualInput]);

  // Method to request pointerlock on start click
  const handleStartClick = () => {
    soundEngine.ensureContext();
    mountRef.current?.requestPointerLock?.();
  };

  // Exposed helper methods for virtual mobile buttons
  const triggerLeftHook = useCallback(() => {
    const eng = engineRef.current;
    if (!eng.physics || !eng.hookSystem || !eng.sceneManager) return;
    const playerQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, eng.yaw, 0, 'YXZ')
    );
    eng.hookSystem.toggleHook('left', eng.physics.position, playerQuat, eng.camera, eng.sceneManager.getGrappleMeshes());
  }, []);

  const triggerRightHook = useCallback(() => {
    const eng = engineRef.current;
    if (!eng.physics || !eng.hookSystem || !eng.sceneManager) return;
    const playerQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, eng.yaw, 0, 'YXZ')
    );
    eng.hookSystem.toggleHook('right', eng.physics.position, playerQuat, eng.camera, eng.sceneManager.getGrappleMeshes());
  }, []);

  const triggerReload = useCallback(() => {
    engineRef.current.hookSystem?.startReload();
  }, []);

  const triggerRespawn = useCallback(() => {
    engineRef.current.physics?.spawn(0, 24, -40);
  }, []);

  // Expose triggers to parent via ref or attributes
  GameCanvas.triggerLeftHook = triggerLeftHook;
  GameCanvas.triggerRightHook = triggerRightHook;
  GameCanvas.triggerReload = triggerReload;
  GameCanvas.triggerRespawn = triggerRespawn;

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* 2D Speed Lines Particle Canvas Overlay */}
      <canvas
        ref={speedLinesCanvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />

      {/* Click To Start / Pointer Lock Overlay Screen */}
      {clickToStart && (
        <div
          onClick={handleStartClick}
          className="absolute inset-0 z-40 bg-black/65 backdrop-brightness-75 flex flex-col items-center justify-center text-white cursor-pointer select-none p-6 text-center"
        >
          <div className="bg-black/85 border border-neutral-700 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center transform transition-transform hover:scale-[1.02]">
            <div className="text-4xl mb-3">⚔️</div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-amber-400">
              ATTACK ON TITAN: ODM
            </h1>
            <p className="text-xs font-mono text-neutral-400 uppercase tracking-widest mt-1 mb-5">
              WALL ROSE DISTRICT DEFENSE
            </p>

            <div className="w-full py-3.5 px-6 rounded-xl font-black text-sm tracking-widest uppercase bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg mb-4">
              CLICK TO ENGAGE ODM TRAVERSAL
            </div>

            <div className="text-xs text-neutral-400 space-y-1 font-mono text-left w-full bg-neutral-950 p-3 rounded-xl border border-neutral-800">
              <div>• <strong className="text-cyan-400">Q / Left Click:</strong> Left Grapple Wire</div>
              <div>• <strong className="text-cyan-400">E / Right Click:</strong> Right Grapple Wire</div>
              <div>• <strong className="text-amber-400">SPACE:</strong> Reel-In Slingshot</div>
              <div>• <strong className="text-orange-400">SHIFT:</strong> Directional Gas Boost</div>
              <div>• <strong className="text-red-400">NAPE STRIKE:</strong> Need 45+ km/h speed!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
