import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FOV_BASE, LOW_FX, SUN_DIR } from "./config.js";

// ---------------------------------------------------------------------------
  // Renderer + post-processing
  // ---------------------------------------------------------------------------
export const app = document.getElementById("app");
export const renderer = new THREE.WebGLRenderer({ antialias: !LOW_FX });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_FX ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  app.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000007);

export const camera = new THREE.PerspectiveCamera(FOV_BASE, window.innerWidth / window.innerHeight, 0.05, 4000);

export const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
export const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    LOW_FX ? 0.7 : 0.95,   // strength
    0.5,                   // radius
    0.85                   // threshold
  );
export const useBloom = !LOW_FX;
  if (useBloom) {
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  // ---------------------------------------------------------------------------
  // Lighting
  // ---------------------------------------------------------------------------
scene.add(new THREE.AmbientLight(0x0a1426, 0.9));
export const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
sun.position.copy(SUN_DIR).multiplyScalar(100);
scene.add(sun);
export const fill = new THREE.DirectionalLight(0x3a5fb0, 0.4);
fill.position.copy(SUN_DIR).multiplyScalar(-80);
scene.add(fill);
