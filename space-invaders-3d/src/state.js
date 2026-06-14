import * as THREE from "three";
import { HISCORE_KEY } from "./config.js";

// Flight state (6DOF)
export const shipPos = new THREE.Vector3(0, 0, 0);
export const shipQuat = new THREE.Quaternion();
export const shipVel = new THREE.Vector3();
export const forward = new THREE.Vector3(0, 0, -1);
export const rightV = new THREE.Vector3(1, 0, 0);
export const upV = new THREE.Vector3(0, 1, 0);

export const tmpA = new THREE.Vector3();
export const tmpB = new THREE.Vector3();
export const tmpC = new THREE.Vector3();
export const tmpQ = new THREE.Quaternion();
export const tmpQ2 = new THREE.Quaternion();
export const tmpMat = new THREE.Matrix4();
export const _proj = new THREE.Vector3();

export const controlAxes = { pitch: 0, yaw: 0, roll: 0, throttle: 0.6, boost: false, fire: false };

export const state = {
  running: false, paused: false,
  score: 0, wave: 1,
  hull: 100, shield: 100, integrity: 100,
  hiscore: Number(localStorage.getItem(HISCORE_KEY) || 0),
  fireCooldown: 0, shieldRegenTimer: 0, shake: 0,
  cameraMode: "cockpit",
  target: null, lockTimer: 0,
  toSpawn: 0, spawnTimer: 0, spawnInterval: 1.3, invSpeed: 14, hunterRatio: 0.5,
  enemyFireBudget: 0,
};
