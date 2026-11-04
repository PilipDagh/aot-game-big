/**
 * TitanManager.js
 * Attack on Titan Pure Titan AI State Machine, Procedural Multi-Part Anatomical Mesh,
 * Nape Hitbox Velocity Gate (>= 45 km/h), Limb Tendon Incapacitation & QTE Grab Trigger
 */
import * as THREE from 'three';
import { soundEngine } from '../utils/SoundEngine.js';

export const TitanState = {
  IDLE_PATROL: 'IDLE_PATROL',
  TARGET_AGGRO: 'TARGET_AGGRO',
  ATTACK_REACH: 'ATTACK_REACH',
  STUNNED: 'STUNNED',
  DEAD: 'DEAD'
};

export class TitanManager {
  constructor(scene) {
    this.scene = scene;
    this.titans = [];
    this.titanCount = 10;
    this.killCount = 0;

    // Steam particle system for disintegrating Titans
    this.initSteamParticles();

    // Callbacks to notify UI
    this.onKill = null;
    this.onRicochet = null;
    this.onGrab = null;
  }

  initSteamParticles() {
    const pCount = 180;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    const sizes = new Float32Array(pCount);

    for (let i = 0; i < pCount; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = -100; // hidden initially
      positions[i * 3 + 2] = 0;
      sizes[i] = 1.5 + Math.random() * 2.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.5,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.steamPoints = new THREE.Points(geo, mat);
    this.scene.add(this.steamPoints);

    this.steamData = Array.from({ length: pCount }, () => ({
      active: false,
      pos: new THREE.Vector3(0, -100, 0),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 2.0
    }));
  }

  emitSteam(origin, count = 25) {
    soundEngine.playSteamSizzle();
    let emitted = 0;
    for (let i = 0; i < this.steamData.length && emitted < count; i++) {
      const p = this.steamData[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 1.5 + Math.random() * 1.5;
        p.pos.copy(origin).add(new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 2,
          (Math.random() - 0.5) * 3
        ));
        p.vel.set(
          (Math.random() - 0.5) * 3,
          4 + Math.random() * 5,
          (Math.random() - 0.5) * 3
        );
        emitted++;
      }
    }
  }

  updateSteam(dt) {
    if (!this.steamPoints) return;
    const posAttr = this.steamPoints.geometry.attributes.position;
    for (let i = 0; i < this.steamData.length; i++) {
      const p = this.steamData[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.pos.set(0, -100, 0);
        } else {
          p.pos.addScaledVector(p.vel, dt);
          p.vel.y *= 0.98; // gentle rise
        }
      }
      posAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
    }
    posAttr.needsUpdate = true;
  }

  // Spawn all 10 Titans across the district street grid
  spawnAll(districtSize = 240) {
    for (let i = 0; i < this.titanCount; i++) {
      const angle = (i / this.titanCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const radius = 60 + Math.random() * (districtSize - 70);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Heights: 8m, 12m, 15m
      const heightOptions = [8, 12, 15];
      const height = heightOptions[i % heightOptions.length];

      this.spawnTitan(x, z, height);
    }
  }

  // Create single procedural Titan
  spawnTitan(x, z, height = 12) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const scale = height / 12; // Base model designed around 12m

    // Procedural Skin Material (eerie pale human flesh tone)
    const skinTones = [0xe8c7b0, 0xdfbfa8, 0xd0ab94, 0xdfc2b2];
    const skinColor = skinTones[Math.floor(Math.random() * skinTones.length)];

    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.65,
      metalness: 0.05
    });

    const muscleMat = new THREE.MeshStandardMaterial({
      color: 0x9b3a32, // exposed crimson sinew
      roughness: 0.5,
      metalness: 0.1
    });

    // 1. Pelvis / Lower Abdomen
    const pelvisGeo = new THREE.BoxGeometry(2.4 * scale, 1.4 * scale, 1.8 * scale);
    const pelvis = new THREE.Mesh(pelvisGeo, skinMat);
    pelvis.position.y = 5.2 * scale;
    pelvis.castShadow = true;
    group.add(pelvis);

    // 2. Muscular Upper Torso / Chest with hunched back
    const torsoGeo = new THREE.BoxGeometry(3.6 * scale, 3.2 * scale, 2.5 * scale);
    const torso = new THREE.Mesh(torsoGeo, skinMat);
    torso.position.y = 7.3 * scale;
    torso.position.z = 0.3 * scale;
    torso.castShadow = true;
    group.add(torso);

    // 3. Thick Abnormal Neck
    const neckGeo = new THREE.CylinderGeometry(1.0 * scale, 1.3 * scale, 1.2 * scale, 8);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, 9.3 * scale, 0.4 * scale);
    neck.castShadow = true;
    group.add(neck);

    // 4. Large Grotesque Head
    const headGeo = new THREE.SphereGeometry(1.6 * scale, 10, 10);
    headGeo.scale(0.9, 1.15, 1.0);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 10.6 * scale, 0.5 * scale);
    head.castShadow = true;
    group.add(head);

    // 5. Creepy Gaping Grin / Mouth
    const mouthGeo = new THREE.BoxGeometry(1.4 * scale, 0.5 * scale, 0.6 * scale);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x220505, roughness: 0.8 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 10.1 * scale, 1.4 * scale);
    group.add(mouth);

    // Teeth bar
    const teethGeo = new THREE.BoxGeometry(1.3 * scale, 0.2 * scale, 0.1 * scale);
    const teethMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.3 });
    const teeth = new THREE.Mesh(teethGeo, teethMat);
    teeth.position.set(0, 10.15 * scale, 1.68 * scale);
    group.add(teeth);

    // 6. Glowing Creepy Eyes
    const eyeGeo = new THREE.SphereGeometry(0.22 * scale, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.55 * scale, 10.8 * scale, 1.35 * scale);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.55 * scale, 10.8 * scale, 1.35 * scale);
    group.add(leftEye, rightEye);

    // 7. Wild Hair
    const hairGeo = new THREE.ConeGeometry(1.8 * scale, 1.2 * scale, 6);
    const hairColors = [0x221a15, 0x4a3220, 0x6e5239, 0x1a1a1a];
    const hairMat = new THREE.MeshStandardMaterial({
      color: hairColors[Math.floor(Math.random() * hairColors.length)],
      roughness: 0.9
    });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 11.9 * scale, 0.3 * scale);
    hair.rotation.x = -0.2;
    group.add(hair);

    // 8. Arms & Huge Grasping Hands
    const armGeo = new THREE.CylinderGeometry(0.55 * scale, 0.45 * scale, 4.0 * scale, 6);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-2.2 * scale, 6.8 * scale, 0.3 * scale);
    leftArm.rotation.z = 0.25;
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(2.2 * scale, 6.8 * scale, 0.3 * scale);
    rightArm.rotation.z = -0.25;
    rightArm.castShadow = true;
    group.add(rightArm);

    // Hands (Reach & Grab Hitboxes)
    const handGeo = new THREE.BoxGeometry(0.9 * scale, 0.9 * scale, 1.2 * scale);
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.set(-2.6 * scale, 4.6 * scale, 0.8 * scale);
    group.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, skinMat);
    rightHand.position.set(2.6 * scale, 4.6 * scale, 0.8 * scale);
    group.add(rightHand);

    // 9. Powerful Legs (Hip to Knee to Foot)
    const legGeo = new THREE.CylinderGeometry(0.7 * scale, 0.5 * scale, 4.8 * scale, 6);
    const leftLeg = new THREE.Mesh(legGeo, skinMat);
    leftLeg.position.set(-0.9 * scale, 2.4 * scale, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, skinMat);
    rightLeg.position.set(0.9 * scale, 2.4 * scale, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Large Stomping Feet
    const footGeo = new THREE.BoxGeometry(0.9 * scale, 0.5 * scale, 1.8 * scale);
    const leftFoot = new THREE.Mesh(footGeo, skinMat);
    leftFoot.position.set(-0.9 * scale, 0.25 * scale, 0.3 * scale);
    group.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, skinMat);
    rightFoot.position.set(0.9 * scale, 0.25 * scale, 0.3 * scale);
    group.add(rightFoot);

    // --- HITBOXES ---
    // NAPE HITBOX: 1.5 x 1.0 x 0.8 units behind neck joint
    const napeWidth = 1.5 * scale;
    const napeHeight = 1.0 * scale;
    const napeDepth = 0.8 * scale;
    const napeGeo = new THREE.BoxGeometry(napeWidth, napeHeight, napeDepth);
    const napeMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      wireframe: true,
      visible: false // invisible hitbox in production
    });
    const napeBox = new THREE.Mesh(napeGeo, napeMat);
    // Positioned strictly at the rear of the neck
    napeBox.position.set(0, 9.4 * scale, -0.6 * scale);
    napeBox.name = 'TitanNape';
    group.add(napeBox);

    // Leg Tendon Hitboxes (for disabling/stunning limbs)
    const legHitboxGeo = new THREE.BoxGeometry(2.4 * scale, 2.0 * scale, 1.2 * scale);
    const legHitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const legHitbox = new THREE.Mesh(legHitboxGeo, legHitboxMat);
    legHitbox.position.set(0, 2.0 * scale, 0);
    legHitbox.name = 'TitanLegs';
    group.add(legHitbox);

    this.scene.add(group);

    const titan = {
      id: Math.random().toString(36).substr(2, 9),
      mesh: group,
      height,
      scale,
      state: TitanState.IDLE_PATROL,
      speed: (1.8 + Math.random() * 1.5) * (14 / height), // smaller titans run faster
      rotationSpeed: 1.5,
      napeBox,
      legHitbox,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      leftHand,
      rightHand,
      walkCycle: Math.random() * Math.PI * 2,
      patrolTarget: new THREE.Vector3(x + (Math.random() - 0.5) * 80, 0, z + (Math.random() - 0.5) * 80),
      patrolWaitTimer: 0,
      stunTimer: 0,
      deathTimer: 0,
      reachTimer: 0,
      stepTimer: 0,
      lastDistToPlayer: 999
    };

    this.titans.push(titan);
    return titan;
  }

  // Main AI loop for all Titans
  update(dt, playerPos, playerVel, playerHealth, onGrabTrigger) {
    const playerSpeedKmh = playerVel.length() * 3.6;

    for (let i = this.titans.length - 1; i >= 0; i--) {
      const titan = this.titans[i];

      // Handle Death State & Steam Disintegration
      if (titan.state === TitanState.DEAD) {
        titan.deathTimer += dt;
        titan.mesh.position.y -= 0.6 * dt; // sink into ground
        titan.mesh.scale.multiplyScalar(Math.max(0.01, 1 - 0.25 * dt));

        if (titan.deathTimer >= 4.0) {
          // Despawn and respawn new Titan to maintain wave
          this.scene.remove(titan.mesh);
          this.titans.splice(i, 1);

          // Respawn replacement Titan at random district rim
          const angle = Math.random() * Math.PI * 2;
          const r = 120 + Math.random() * 100;
          this.spawnTitan(Math.cos(angle) * r, Math.sin(angle) * r, [8, 12, 15][Math.floor(Math.random() * 3)]);
        }
        continue;
      }

      // Handle Stunned State (limbs cut)
      if (titan.state === TitanState.STUNNED) {
        titan.stunTimer -= dt;
        // Collapse posture
        titan.mesh.position.y = THREE.MathUtils.damp(titan.mesh.position.y, -1.8 * titan.scale, 5, dt);
        titan.leftLeg.rotation.x = -1.2;
        titan.rightLeg.rotation.x = -1.2;

        if (titan.stunTimer <= 0) {
          titan.state = TitanState.IDLE_PATROL;
          titan.mesh.position.y = 0;
          soundEngine.playTitanRoar();
        }
        continue;
      }

      // Calculate distance to player
      const dx = playerPos.x - titan.mesh.position.x;
      const dz = playerPos.z - titan.mesh.position.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);
      const dy = playerPos.y - titan.mesh.position.y;
      titan.lastDistToPlayer = distToPlayer;

      // Titan lumbering footstep audio trigger
      titan.stepTimer += dt;
      if (titan.stepTimer >= (1.0 / (titan.speed * 0.4))) {
        titan.stepTimer = 0;
        if (distToPlayer < 90) {
          soundEngine.playTitanFootstep(distToPlayer);
        }
      }

      // State transitions
      const aggroRange = 70.0;
      const reachRange = 7.5 * titan.scale;

      if (distToPlayer < reachRange && Math.abs(dy) < 9 * titan.scale) {
        titan.state = TitanState.ATTACK_REACH;
      } else if (distToPlayer < aggroRange) {
        if (titan.state === TitanState.IDLE_PATROL) {
          soundEngine.playTitanRoar();
        }
        titan.state = TitanState.TARGET_AGGRO;
      } else {
        titan.state = TitanState.IDLE_PATROL;
      }

      // AI Behavior Execution
      switch (titan.state) {
        case TitanState.IDLE_PATROL:
          this.executePatrol(titan, dt);
          break;

        case TitanState.TARGET_AGGRO:
          this.executeAggro(titan, playerPos, dt);
          break;

        case TitanState.ATTACK_REACH:
          this.executeAttackReach(titan, playerPos, dt, onGrabTrigger);
          break;
      }

      // Procedural walking animation (limb swing)
      this.animateLimbs(titan, dt);
    }

    // Update steam particles
    this.updateSteam(dt);
  }

  executePatrol(titan, dt) {
    const distToTarget = titan.mesh.position.distanceTo(titan.patrolTarget);
    if (distToTarget < 5.0) {
      titan.patrolWaitTimer += dt;
      if (titan.patrolWaitTimer > 3.0) {
        // Pick new waypoint in district
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        titan.patrolTarget.set(
          Math.max(-230, Math.min(230, titan.mesh.position.x + Math.cos(angle) * dist)),
          0,
          Math.max(-230, Math.min(230, titan.mesh.position.z + Math.sin(angle) * dist))
        );
        titan.patrolWaitTimer = 0;
      }
      return;
    }

    // Turn toward waypoint
    const targetAngle = Math.atan2(
      titan.patrolTarget.x - titan.mesh.position.x,
      titan.patrolTarget.z - titan.mesh.position.z
    );
    titan.mesh.rotation.y = THREE.MathUtils.damp(
      titan.mesh.rotation.y,
      targetAngle,
      titan.rotationSpeed,
      dt
    );

    // Walk forward
    const forwardX = Math.sin(titan.mesh.rotation.y);
    const forwardZ = Math.cos(titan.mesh.rotation.y);
    titan.mesh.position.x += forwardX * (titan.speed * 0.6) * dt;
    titan.mesh.position.z += forwardZ * (titan.speed * 0.6) * dt;
  }

  executeAggro(titan, playerPos, dt) {
    // Face player
    const targetAngle = Math.atan2(
      playerPos.x - titan.mesh.position.x,
      playerPos.z - titan.mesh.position.z
    );
    titan.mesh.rotation.y = THREE.MathUtils.damp(
      titan.mesh.rotation.y,
      targetAngle,
      titan.rotationSpeed * 1.5,
      dt
    );

    // Stride forward toward player
    const forwardX = Math.sin(titan.mesh.rotation.y);
    const forwardZ = Math.cos(titan.mesh.rotation.y);
    titan.mesh.position.x += forwardX * titan.speed * dt;
    titan.mesh.position.z += forwardZ * titan.speed * dt;
  }

  executeAttackReach(titan, playerPos, dt, onGrabTrigger) {
    // Face player eagerly
    const targetAngle = Math.atan2(
      playerPos.x - titan.mesh.position.x,
      playerPos.z - titan.mesh.position.z
    );
    titan.mesh.rotation.y = THREE.MathUtils.damp(
      titan.mesh.rotation.y,
      targetAngle,
      titan.rotationSpeed * 2.0,
      dt
    );

    // Lunge forward slightly
    const forwardX = Math.sin(titan.mesh.rotation.y);
    const forwardZ = Math.cos(titan.mesh.rotation.y);
    titan.mesh.position.x += forwardX * (titan.speed * 0.4) * dt;
    titan.mesh.position.z += forwardZ * (titan.speed * 0.4) * dt;

    // Extend arms forward in grasping lunge
    titan.leftArm.rotation.x = THREE.MathUtils.damp(titan.leftArm.rotation.x, -1.6, 6, dt);
    titan.rightArm.rotation.x = THREE.MathUtils.damp(titan.rightArm.rotation.x, -1.6, 6, dt);
    titan.reachTimer += dt;

    // Check grab contact
    const handWorldPos = new THREE.Vector3();
    titan.leftHand.getWorldPosition(handWorldPos);
    const grabDistLeft = handWorldPos.distanceTo(playerPos);

    titan.rightHand.getWorldPosition(handWorldPos);
    const grabDistRight = handWorldPos.distanceTo(playerPos);

    if ((grabDistLeft < 2.4 * titan.scale || grabDistRight < 2.4 * titan.scale) && onGrabTrigger) {
      onGrabTrigger(titan);
    }
  }

  animateLimbs(titan, dt) {
    if (titan.state === TitanState.ATTACK_REACH) return;

    titan.walkCycle += dt * titan.speed * 1.4;
    const legSwing = Math.sin(titan.walkCycle) * 0.6;
    titan.leftLeg.rotation.x = legSwing;
    titan.rightLeg.rotation.x = -legSwing;

    // Arm swing counter-motion
    titan.leftArm.rotation.x = -legSwing * 0.7;
    titan.rightArm.rotation.x = legSwing * 0.7;
  }

  // --- COMBAT INTERACTION: BLADE STRIKE CHECK ---
  // Evaluates blade intersection against Titan hitboxes
  checkBladeStrike(playerPos, playerVel, hookSystem) {
    const playerSpeedKmh = playerVel.length() * 3.6;
    const bladeReach = 2.4; // meter strike sphere around player during swing

    for (let i = 0; i < this.titans.length; i++) {
      const titan = this.titans[i];
      if (titan.state === TitanState.DEAD) continue;

      // 1. Check Nape Strike
      const napeWorldPos = new THREE.Vector3();
      titan.napeBox.getWorldPosition(napeWorldPos);
      const distToNape = napeWorldPos.distanceTo(playerPos);

      if (distToNape < bladeReach + (0.8 * titan.scale)) {
        // Intersected nape! Now evaluate Velocity Gate: >= 45 km/h (12.5 m/s)
        if (playerSpeedKmh >= 45.0) {
          // FATAL NAPE DECAPITATION!
          this.killTitan(titan, napeWorldPos, playerSpeedKmh);
          hookSystem.consumeBlade(15);
          return {
            type: 'KILL',
            speedKmh: Math.round(playerSpeedKmh),
            titanHeight: titan.height
          };
        } else {
          // Non-lethal ricochet! Blade bounce
          soundEngine.playRicochet();
          hookSystem.consumeBlade(25);
          if (this.onRicochet) this.onRicochet(playerSpeedKmh);
          return {
            type: 'RICOCHET',
            speedKmh: Math.round(playerSpeedKmh)
          };
        }
      }

      // 2. Check Leg Tendon Strike (Stun Titan)
      if (titan.state !== TitanState.STUNNED) {
        const legWorldPos = new THREE.Vector3();
        titan.legHitbox.getWorldPosition(legWorldPos);
        const distToLegs = legWorldPos.distanceTo(playerPos);

        if (distToLegs < bladeReach + (1.2 * titan.scale)) {
          titan.state = TitanState.STUNNED;
          titan.stunTimer = 8.0;
          this.emitSteam(legWorldPos, 15);
          soundEngine.playNapeSlash(playerSpeedKmh * 0.7);
          hookSystem.consumeBlade(10);
          return {
            type: 'STUN',
            titanHeight: titan.height
          };
        }
      }
    }

    return null;
  }

  killTitan(titan, hitPoint, speedKmh) {
    titan.state = TitanState.DEAD;
    titan.deathTimer = 0;
    this.killCount++;

    // High velocity slice sound & massive steam release
    soundEngine.playNapeSlash(speedKmh);
    this.emitSteam(hitPoint, 45);

    // Ragdoll fall forward
    titan.mesh.rotation.x = 1.3;

    if (this.onKill) {
      this.onKill({
        killCount: this.killCount,
        speedKmh: Math.round(speedKmh),
        titanHeight: titan.height
      });
    }
  }

  // Get active Titans for Radar HUD display
  getRadarData(playerPos) {
    return this.titans
      .filter(t => t.state !== TitanState.DEAD)
      .map(t => {
        const dx = t.mesh.position.x - playerPos.x;
        const dz = t.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return {
          id: t.id,
          x: dx,
          z: dz,
          distance: Math.round(dist),
          height: t.height,
          state: t.state
        };
      });
  }
}
