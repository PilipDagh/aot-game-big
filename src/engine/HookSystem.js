/**
 * HookSystem.js
 * Dual Independent ODM Grapple Hooks, Hooke's Law Spring-Damper Physics,
 * Reel-in Slingshot Acceleration & Gas Thruster Propulsion
 */
import * as THREE from 'three';
import { soundEngine } from '../utils/SoundEngine.js';

export class HookSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Raycaster for grappling
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 140; // Max grapple range in meters

    // Physics parameters
    this.k = 120.0;            // Spring stiffness coefficient (Hooke's Law)
    this.d = 8.5;              // Dampening coefficient
    this.reelSpeed = 25.0;     // Reel-in rate (m/s)
    this.thrustForce = 45.0;   // Directional gas thrust (N)
    this.minCableLength = 2.5; // Minimum cable spool length

    // Resources
    this.gas = 100.0;          // Gas tank level (0 - 100%)
    this.maxGasTanks = 4;
    this.gasTanks = 4;
    this.gasConsumptionRate = 8.0; // % per second during boost

    this.bladeDurability = 100.0;  // Blade durability (0 - 100%)
    this.maxBladePairs = 4;
    this.bladePairs = 4;

    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 3.0; // 3 sec reload

    // Dual hook data structures
    this.hooks = {
      left: {
        active: false,
        anchor: new THREE.Vector3(),
        restLength: 0,
        currentLength: 0,
        lineMesh: null,
        markerMesh: null,
        targetObject: null
      },
      right: {
        active: false,
        anchor: new THREE.Vector3(),
        restLength: 0,
        currentLength: 0,
        lineMesh: null,
        markerMesh: null,
        targetObject: null
      }
    };

    // Reusable math vectors to prevent garbage collection in render loop
    this._hipPosLeft = new THREE.Vector3();
    this._hipPosRight = new THREE.Vector3();
    this._cableVec = new THREE.Vector3();
    this._cableDir = new THREE.Vector3();
    this._forceVec = new THREE.Vector3();
    this._totalForce = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._tempV = new THREE.Vector3();

    this.initVisuals();
  }

  initVisuals() {
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xcccccc,
      linewidth: 2,
    });

    const markerGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

    // Setup Left Hook visual line
    const leftPositions = new Float32Array(6);
    const leftGeo = new THREE.BufferGeometry();
    leftGeo.setAttribute('position', new THREE.BufferAttribute(leftPositions, 3));
    this.hooks.left.lineMesh = new THREE.Line(leftGeo, lineMat);
    this.hooks.left.lineMesh.visible = false;
    this.scene.add(this.hooks.left.lineMesh);

    this.hooks.left.markerMesh = new THREE.Mesh(markerGeo, markerMat);
    this.hooks.left.markerMesh.visible = false;
    this.scene.add(this.hooks.left.markerMesh);

    // Setup Right Hook visual line
    const rightPositions = new Float32Array(6);
    const rightGeo = new THREE.BufferGeometry();
    rightGeo.setAttribute('position', new THREE.BufferAttribute(rightPositions, 3));
    this.hooks.right.lineMesh = new THREE.Line(rightGeo, lineMat.clone());
    this.hooks.right.lineMesh.visible = false;
    this.scene.add(this.hooks.right.lineMesh);

    this.hooks.right.markerMesh = new THREE.Mesh(markerGeo, markerMat.clone());
    this.hooks.right.markerMesh.visible = false;
    this.scene.add(this.hooks.right.markerMesh);

    // Procedural Gas Jet Particle Stream
    this.initGasParticles();
  }

  initGasParticles() {
    const particleCount = 40;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const opacities = new Float32Array(particleCount);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.6,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.gasParticles = new THREE.Points(geo, mat);
    this.gasParticles.visible = false;
    this.scene.add(this.gasParticles);

    this.particleData = Array.from({ length: particleCount }, () => ({
      life: 0,
      maxLife: 0.2 + Math.random() * 0.15,
      vel: new THREE.Vector3(),
      pos: new THREE.Vector3()
    }));
  }

  // Calculate local player hip socket coordinates in world space
  getHipPosition(playerPos, playerQuat, isLeft = true) {
    const offset = new THREE.Vector3(isLeft ? -0.45 : 0.45, -0.2, 0.1);
    offset.applyQuaternion(playerQuat);
    return offset.add(playerPos);
  }

  // Fire grapple hook (left or right)
  fireHook(side, playerPos, playerQuat, camera, grappleTargets) {
    const isLeft = side === 'left';
    const hook = this.hooks[side];
    const hipPos = this.getHipPosition(playerPos, playerQuat, isLeft);

    // Raycast from camera center with a subtle lateral bias
    camera.getWorldDirection(this._camDir);

    // Add tiny screen-space spread for dual hooks
    const rayDir = this._camDir.clone();
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    rayDir.addScaledVector(rightVec, isLeft ? -0.04 : 0.04);
    rayDir.normalize();

    this.raycaster.set(camera.position, rayDir);
    const intersects = this.raycaster.intersectObjects(grappleTargets, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      hook.active = true;
      hook.anchor.copy(hit.point);
      hook.targetObject = hit.object;

      // Distance from hip to hit point
      const dist = hipPos.distanceTo(hit.point);
      hook.restLength = dist;
      hook.currentLength = dist;

      // Update visual meshes
      hook.lineMesh.visible = true;
      hook.markerMesh.visible = true;
      hook.markerMesh.position.copy(hit.point);

      soundEngine.playHookLaunch();
      soundEngine.playAnchorImpact();
      return true;
    }
    return false;
  }

  // Release grapple hook
  releaseHook(side) {
    const hook = this.hooks[side];
    if (hook.active) {
      hook.active = false;
      hook.lineMesh.visible = false;
      hook.markerMesh.visible = false;
      hook.targetObject = null;
    }
  }

  // Toggle hook firing (if active -> release, else -> fire)
  toggleHook(side, playerPos, playerQuat, camera, grappleTargets) {
    if (this.hooks[side].active) {
      this.releaseHook(side);
      return false;
    } else {
      return this.fireHook(side, playerPos, playerQuat, camera, grappleTargets);
    }
  }

  // Release both hooks (e.g. slingshot leap)
  releaseBoth() {
    this.releaseHook('left');
    this.releaseHook('right');
  }

  hasActiveHooks() {
    return this.hooks.left.active || this.hooks.right.active;
  }

  // Hooke's Law Spring & Dampening Force Calculation
  calculateForces(playerPos, playerVel, playerQuat, dt, isReeling, isBoosting) {
    this._totalForce.set(0, 0, 0);

    // Calculate left hip position
    const leftHip = this.getHipPosition(playerPos, playerQuat, true);
    const rightHip = this.getHipPosition(playerPos, playerQuat, false);

    // Process Left Hook
    if (this.hooks.left.active) {
      const fLeft = this.calculateCableForce(
        this.hooks.left,
        leftHip,
        playerVel,
        dt,
        isReeling
      );
      this._totalForce.add(fLeft);
    }

    // Process Right Hook
    if (this.hooks.right.active) {
      const fRight = this.calculateCableForce(
        this.hooks.right,
        rightHip,
        playerVel,
        dt,
        isReeling
      );
      this._totalForce.add(fRight);
    }

    // Gas Thruster Propulsion (Left Shift)
    if (isBoosting && this.gas > 0 && !this.isReloading) {
      this.camera.getWorldDirection(this._camDir);
      // Gas thrusters apply high pressure force in camera look direction
      const thrustVector = this._camDir.clone().multiplyScalar(this.thrustForce);
      this._totalForce.add(thrustVector);

      // Gas consumption
      this.gas = Math.max(0, this.gas - this.gasConsumptionRate * dt);
      if (this.gas <= 0) {
        this.gas = 0;
      }
    }

    return this._totalForce;
  }

  // Single cable spring-damper calculation
  calculateCableForce(hook, hipPos, playerVel, dt, isReeling) {
    // Vector from hip to anchor
    this._cableVec.subVectors(hook.anchor, hipPos);
    const currentDist = this._cableVec.length();
    hook.currentLength = currentDist;

    // Unit direction towards anchor
    this._cableDir.copy(this._cableVec).normalize();

    // Reel-in mechanism continuously shortens rest length r0 at 25 m/s
    if (isReeling) {
      hook.restLength = Math.max(
        this.minCableLength,
        hook.restLength - this.reelSpeed * dt
      );
    }

    // Only apply spring tension force if cable is stretched (currentDist > restLength)
    if (currentDist > hook.restLength) {
      const stretch = currentDist - hook.restLength;

      // Project player velocity onto cable direction
      const vAlongCable = playerVel.dot(this._cableDir);

      // F_spring = -k * (r - r0) - d * v
      // Direction is toward anchor (_cableDir)
      const springMagnitude = (this.k * stretch) - (this.d * vAlongCable);

      if (springMagnitude > 0) {
        this._forceVec.copy(this._cableDir).multiplyScalar(springMagnitude);
        return this._forceVec;
      }
    }

    this._forceVec.set(0, 0, 0);
    return this._forceVec;
  }

  // Update visual lines connecting hip sockets to anchors
  updateVisuals(playerPos, playerQuat, isBoosting, dt) {
    const leftHip = this.getHipPosition(playerPos, playerQuat, true);
    const rightHip = this.getHipPosition(playerPos, playerQuat, false);

    // Left line update
    if (this.hooks.left.active) {
      const posAttr = this.hooks.left.lineMesh.geometry.attributes.position;
      posAttr.setXYZ(0, leftHip.x, leftHip.y, leftHip.z);
      posAttr.setXYZ(1, this.hooks.left.anchor.x, this.hooks.left.anchor.y, this.hooks.left.anchor.z);
      posAttr.needsUpdate = true;
    }

    // Right line update
    if (this.hooks.right.active) {
      const posAttr = this.hooks.right.lineMesh.geometry.attributes.position;
      posAttr.setXYZ(0, rightHip.x, rightHip.y, rightHip.z);
      posAttr.setXYZ(1, this.hooks.right.anchor.x, this.hooks.right.anchor.y, this.hooks.right.anchor.z);
      posAttr.needsUpdate = true;
    }

    // Update Gas Jet Particles
    this.updateGasParticles(playerPos, playerQuat, isBoosting, dt);

    // Update reload animation timer
    if (this.isReloading) {
      this.reloadTimer += dt;
      if (this.reloadTimer >= this.reloadDuration) {
        this.completeReload();
      }
    }
  }

  updateGasParticles(playerPos, playerQuat, isBoosting, dt) {
    if (!this.gasParticles) return;

    if (!isBoosting || this.gas <= 0) {
      this.gasParticles.visible = false;
      return;
    }

    this.gasParticles.visible = true;
    const posAttr = this.gasParticles.geometry.attributes.position;
    this.camera.getWorldDirection(this._camDir);
    const exhaustDir = this._camDir.clone().negate(); // jets blast backwards

    const leftNozzle = this.getHipPosition(playerPos, playerQuat, true).addScaledVector(exhaustDir, 0.4);
    const rightNozzle = this.getHipPosition(playerPos, playerQuat, false).addScaledVector(exhaustDir, 0.4);

    for (let i = 0; i < this.particleData.length; i++) {
      const p = this.particleData[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.life = 0;
        const nozzle = (i % 2 === 0) ? leftNozzle : rightNozzle;
        p.pos.copy(nozzle);
        p.vel.copy(exhaustDir)
          .multiplyScalar(15 + Math.random() * 8)
          .add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));
      } else {
        p.pos.addScaledVector(p.vel, dt);
      }

      posAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
    }
    posAttr.needsUpdate = true;
  }

  // Trigger blade replacement & gas cylinder reload (Key R)
  startReload() {
    if (this.isReloading) return;
    if (this.gasTanks <= 1 && this.bladePairs <= 1 && this.gas > 90 && this.bladeDurability > 90) return;

    this.isReloading = true;
    this.reloadTimer = 0;
    soundEngine.playReload();
  }

  completeReload() {
    this.isReloading = false;
    this.reloadTimer = 0;

    // Replenish gas if spare tanks available
    if (this.gasTanks > 1) {
      this.gasTanks--;
      this.gas = 100.0;
    } else {
      this.gas = 100.0; // keep usable
    }

    // Replenish blades if spare pairs available
    if (this.bladePairs > 1) {
      this.bladePairs--;
      this.bladeDurability = 100.0;
    } else {
      this.bladeDurability = 100.0;
    }

    soundEngine.playReload();
  }

  // Deduct blade durability (e.g. on strike or ricochet)
  consumeBlade(amount) {
    this.bladeDurability = Math.max(0, this.bladeDurability - amount);
    if (this.bladeDurability <= 0) {
      // Auto reload if pairs remaining
      if (this.bladePairs > 1) {
        this.startReload();
      }
    }
  }

  // Raycast distance probe to check if center reticle is facing a grappleable surface
  probeGrappleTarget(camera, grappleTargets) {
    camera.getWorldDirection(this._camDir);
    this.raycaster.set(camera.position, this._camDir);
    const intersects = this.raycaster.intersectObjects(grappleTargets, true);
    if (intersects.length > 0) {
      return {
        hasTarget: true,
        distance: intersects[0].distance,
        point: intersects[0].point
      };
    }
    return { hasTarget: false, distance: Infinity, point: null };
  }
}
