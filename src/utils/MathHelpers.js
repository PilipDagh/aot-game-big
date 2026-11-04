/**
 * Math and Physics calculation helpers for Attack on Titan ODM Engine
 */
import * as THREE from 'three';

export const MathHelpers = {
  // Linear interpolation
  lerp(start, end, factor) {
    return start + (end - start) * factor;
  },

  // Clamp value between min and max
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  // Unit conversions
  msToKmh(ms) {
    return ms * 3.6;
  },

  kmhToMs(kmh) {
    return kmh / 3.6;
  },

  // Clamped 1D Spring calculation
  clampedSpring(current, target, velocity, stiffness, damping, dt) {
    const delta = target - current;
    const springForce = delta * stiffness;
    const dampingForce = -velocity * damping;
    const acceleration = springForce + dampingForce;
    const newVelocity = velocity + acceleration * dt;
    const newPosition = current + newVelocity * dt;
    return { position: newPosition, velocity: newVelocity };
  },

  // Distance between two 3D points
  distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  // Horizontal (XZ) distance
  distanceXZ(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dz * dz);
  },

  // Calculate angle between two points on the XZ plane
  angleXZ(p1, p2) {
    return Math.atan2(p2.x - p1.x, p2.z - p1.z);
  },

  // Exponential decay smoothing (frame-rate independent)
  damp(current, target, lambda, dt) {
    return THREE.MathUtils.damp(current, target, lambda, dt);
  },

  // Safe vector normalize
  safeNormalize(vector, fallback = new THREE.Vector3(0, 0, 1)) {
    const length = vector.length();
    if (length < 0.00001) {
      vector.copy(fallback);
    } else {
      vector.divideScalar(length);
    }
    return vector;
  }
};
