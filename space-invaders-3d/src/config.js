import * as THREE from "three";

export const WORLD_R = 230;              // play-space radius
export const BASE_SPEED = 36;            // top cruise speed
export const BOOST_MULT = 2.3;
export const PITCH_RATE = 1.7;
export const YAW_RATE = 1.4;
export const ROLL_RATE = 2.6;            // rad/s at full input
export const BULLET_SPEED = 170;
export const BULLET_RANGE = 320;
export const FIRE_CD = 0.13;
export const ENEMY_BULLET_SPEED = 75;
export const ENEMY_BULLET_RANGE = 260;
export const FOV_BASE = 70;
export const FOV_BOOST = 84;
export const RADAR_RANGE = 280;
export const HISCORE_KEY = "starfall_defender_hiscore";

export const TEX_BASE = "https://unpkg.com/three@0.160.0/examples/textures/planets/";
export const LOW_FX = window.matchMedia("(pointer: coarse)").matches ||
  (navigator.hardwareConcurrency || 8) <= 4;
export const IS_TOUCH = window.matchMedia("(pointer: coarse)").matches;

// Sun direction (world space) shared by light + planet shader.
export const SUN_DIR = new THREE.Vector3(0.7, 0.35, 0.5).normalize();
