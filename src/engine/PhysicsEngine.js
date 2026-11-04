/**
 * PhysicsEngine.js
 * Attack on Titan Character Kinematics, Swept AABB Collision Detection,
 * Ground/Wall Deflection Physics, Camera Impulse Shake & Velocity Impact Damage
 */
import * as THREE from 'three';
import { soundEngine } from '../utils/SoundEngine.js';

export class PhysicsEngine {
  constructor() {
    // Player physical properties
    this.mass = 70.0;               // kg
    this.gravity = -24.0;           // m/s^2 (snappy anime gravity)
    this.airDrag = 0.28;            // Air resistance factor
    this.groundFriction = 8.0;      // Ground deceleration
    this.walkSpeed = 9.0;           // m/s ground sprint speed

    // Player bounding dimensions
    this.playerHeight = 1.8;
    this.playerRadius = 0.45;

    // State vectors
    this.position = new THREE.Vector3(0, 1.2, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.isGrounded = false;

    // Health & Damage
    this.health = 100.0;
    this.maxHealth = 100.0;
    this.isDead = false;

    // Camera shake impulse
    this.shakeIntensity = 0;
    this.shakeDecay = 6.0; // decay rate per second

    // Impact damage parameters
    this.impactThreshold = 18.0; // m/s (64.8 km/h) triggers damage

    // Scratchpad vectors for zero GC
    this._moveDir = new THREE.Vector3();
    this._camForward = new THREE.Vector3();
    this._camRight = new THREE.Vector3();
    this._collisionNormal = new THREE.Vector3();
    this._prevPos = new THREE.Vector3();
    this._displacement = new THREE.Vector3();
  }

  // Set initial spawn position
  spawn(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
    this.health = 100.0;
    this.isDead = false;
    this.isGrounded = false;
  }

  // Trigger camera impulse shake
  addShake(intensity) {
    this.shakeIntensity = Math.min(1.5, this.shakeIntensity + intensity);
  }

  getShakeOffset() {
    if (this.shakeIntensity <= 0.001) return { x: 0, y: 0, z: 0 };
    return {
      x: (Math.random() - 0.5) * 2 * this.shakeIntensity * 0.35,
      y: (Math.random() - 0.5) * 2 * this.shakeIntensity * 0.35,
      z: (Math.random() - 0.5) * 2 * this.shakeIntensity * 0.2
    };
  }

  // Take damage with camera shake and sound
  takeDamage(amount) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    this.addShake(amount * 0.04);
    soundEngine.playImpactCrash();
    if (this.health <= 0) {
      this.isDead = true;
    }
  }

  // Update physical integration step (Euler / Verlet)
  update(dt, inputKeys, camera, hookForces, colliders, hasActiveHooks) {
    if (this.isDead) return;

    // Update shake decay
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);
    }

    this._prevPos.copy(this.position);

    // 1. Calculate Ground Input / Air Strafe Movement
    this.calculateMovementInput(inputKeys, camera, dt, hasActiveHooks);

    // 2. Accumulate External Forces: Gravity + Hooks + Gas Thrusters
    this.acceleration.set(0, this.gravity, 0);
    // Add ODM Hook & Gas Forces: a = F / m
    if (hookForces) {
      this.acceleration.x += hookForces.x / this.mass;
      this.acceleration.y += hookForces.y / this.mass;
      this.acceleration.z += hookForces.z / this.mass;
    }

    // 3. Integrate Velocity: v += a * dt
    this.velocity.addScaledVector(this.acceleration, dt);

    // 4. Apply Aerodynamic Drag & Friction
    if (this.isGrounded && !hasActiveHooks) {
      // Ground friction damping
      const dampingFactor = Math.exp(-this.groundFriction * dt);
      this.velocity.x *= dampingFactor;
      this.velocity.z *= dampingFactor;
    } else {
      // High-speed air drag
      const airDamp = Math.exp(-this.airDrag * dt);
      this.velocity.x *= airDamp;
      this.velocity.z *= airDamp;
      // Slight terminal velocity limit on Y
      this.velocity.y = Math.max(-55, this.velocity.y);
    }

    // 5. Predict Position & Perform Swept AABB Collision Resolution
    this.resolveCollisions(dt, colliders);

    // 6. District Outer Perimeter Constraint (Wall Rose radius 296)
    this.constrainToDistrict(294);
  }

  calculateMovementInput(input, camera, dt, hasActiveHooks) {
    this._moveDir.set(0, 0, 0);

    // Camera planar vectors
    camera.getWorldDirection(this._camForward);
    this._camForward.y = 0;
    this._camForward.normalize();

    this._camRight.crossVectors(this._camForward, new THREE.Vector3(0, 1, 0)).normalize();

    if (input.forward) this._moveDir.add(this._camForward);
    if (input.backward) this._moveDir.sub(this._camForward);
    if (input.right) this._moveDir.add(this._camRight);
    if (input.left) this._moveDir.sub(this._camRight);

    if (this._moveDir.lengthSq() > 0.001) {
      this._moveDir.normalize();

      if (this.isGrounded && !hasActiveHooks) {
        // Direct ground sprinting
        const targetVx = this._moveDir.x * this.walkSpeed;
        const targetVz = this._moveDir.z * this.walkSpeed;
        this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVx, 12, dt);
        this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVz, 12, dt);
      } else {
        // Air strafing / body control mid-air (AOT aerial control)
        const strafePower = 18.0;
        this.velocity.x += this._moveDir.x * strafePower * dt;
        this.velocity.z += this._moveDir.z * strafePower * dt;
      }
    }
  }

  // Swept Continuous AABB Collision Detection against Buildings & Wall
  resolveCollisions(dt, colliders) {
    const nextPos = this.position.clone().addScaledVector(this.velocity, dt);
    const speedBeforeCollision = this.velocity.length();

    let groundedThisFrame = false;

    // Check ground plane (Y = 0)
    if (nextPos.y <= 0) {
      nextPos.y = 0;
      groundedThisFrame = true;

      // Vertical impact landing check
      if (this.velocity.y < -this.impactThreshold) {
        const excessSpeed = Math.abs(this.velocity.y) - this.impactThreshold;
        this.takeDamage(excessSpeed * 1.5);
      }
      this.velocity.y = 0;
    }

    // Player AABB dimensions
    const pr = this.playerRadius;
    const ph = this.playerHeight;

    // Iterate through environment colliders
    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      if (col.isGround) continue;

      // Expand collider by player radius/height
      const cMinX = col.min.x - pr;
      const cMaxX = col.max.x + pr;
      const cMinY = col.min.y;
      const cMaxY = col.max.y;
      const cMinZ = col.min.z - pr;
      const cMaxZ = col.max.z + pr;

      // Check if next position intersects expanded box
      if (
        nextPos.x >= cMinX && nextPos.x <= cMaxX &&
        nextPos.z >= cMinZ && nextPos.z <= cMaxZ &&
        nextPos.y <= cMaxY && (nextPos.y + ph) >= cMinY
      ) {
        // Determine collision axis & normal
        const overlapLeft   = nextPos.x - cMinX;
        const overlapRight  = cMaxX - nextPos.x;
        const overlapTop    = cMaxY - nextPos.y;
        const overlapFront  = nextPos.z - cMinZ;
        const overlapBack   = cMaxZ - nextPos.z;

        // Rooftop landing check (coming down from above)
        if (this.position.y >= col.max.y - 0.2 && this.velocity.y <= 0) {
          nextPos.y = col.max.y;
          this.velocity.y = 0;
          groundedThisFrame = true;
          continue;
        }

        // Horizontal Wall Impact
        const minOverlapH = Math.min(overlapLeft, overlapRight, overlapFront, overlapBack);

        // High velocity impact damage check (> 18 m/s = 64.8 km/h)
        if (speedBeforeCollision > this.impactThreshold) {
          const excess = speedBeforeCollision - this.impactThreshold;
          this.takeDamage(excess * 1.8);
          this.addShake(excess * 0.05);
        }

        // Slide along wall normal rather than dead stop
        if (minOverlapH === overlapLeft) {
          nextPos.x = cMinX;
          this.velocity.x = Math.min(0, this.velocity.x);
        } else if (minOverlapH === overlapRight) {
          nextPos.x = cMaxX;
          this.velocity.x = Math.max(0, this.velocity.x);
        } else if (minOverlapH === overlapFront) {
          nextPos.z = cMinZ;
          this.velocity.z = Math.min(0, this.velocity.z);
        } else if (minOverlapH === overlapBack) {
          nextPos.z = cMaxZ;
          this.velocity.z = Math.max(0, this.velocity.z);
        }
      }
    }

    this.isGrounded = groundedThisFrame;
    this.position.copy(nextPos);
  }

  // Constrain inside Wall Rose perimeter (circular boundary)
  constrainToDistrict(radius) {
    const horizontalDistSq = this.position.x * this.position.x + this.position.z * this.position.z;
    if (horizontalDistSq > radius * radius) {
      const dist = Math.sqrt(horizontalDistSq);
      const normalX = this.position.x / dist;
      const normalZ = this.position.z / dist;

      // Project position back inside
      this.position.x = normalX * radius;
      this.position.z = normalZ * radius;

      // Reflect outward horizontal velocity
      const vOutward = this.velocity.x * normalX + this.velocity.z * normalZ;
      if (vOutward > 0) {
        this.velocity.x -= vOutward * normalX;
        this.velocity.z -= vOutward * normalZ;
      }
    }
  }

  // Returns current speed in km/h
  getSpeedKmh() {
    return this.velocity.length() * 3.6;
  }
}
