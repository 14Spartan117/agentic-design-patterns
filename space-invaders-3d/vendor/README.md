# Vendored runtime modules

Production deployments should place the Three.js `0.160.0` ESM runtime here so the game does not depend on CDN availability at startup:

- `three/three.module.js`
- `three/addons/postprocessing/EffectComposer.js`
- `three/addons/postprocessing/RenderPass.js`
- `three/addons/postprocessing/UnrealBloomPass.js`
- `three/addons/postprocessing/OutputPass.js`
- any transitive addon imports under `three/addons/`

`index.html` attempts these local module paths first and falls back to the pinned unpkg URLs only if the local files are missing.
