# Starfall Defender — 3D Space Combat

A browser-based, cinematic 3D space-combat sim built with [Three.js](https://threejs.org/).
You fly a fighter freely through open space, dogfighting a swarm of glowing invaders among
drifting asteroids while a photorealistic homeworld hangs in the distance. Bomber invaders
break off to dive at the planet — stop them before its integrity hits zero, and keep your own
hull intact.

Features a **first-person cockpit** (with a chase-cam toggle), a **photorealistic Earth** with
night-side city lights and an atmospheric rim glow, a distant moon, **bloom/cinematic** post-
processing, a **target-lock HUD** with lead indicator, a **radar**, a systems panel, and a
retro green status terminal.

## Play

It's a single self-contained file — no build step required.

```bash
# from the repo root
cd space-invaders-3d
python3 -m http.server 8000
# then open http://localhost:8000 in a browser
```

> A local server is recommended because browsers apply module/CORS rules to ES modules and
> textures. Production deploys should serve the vendored files in `vendor/` and `assets/` so
> startup does not depend on CDN availability.

## Deploy to Vercel

This is a static site (no build step). A `vercel.json` at the repo root rewrites `/` to this
game, so the deployed site opens straight into it.

**Option A — Vercel CLI (fastest):** from the repo root, on the branch with the game:

```bash
npm i -g vercel        # once
vercel login           # once
vercel --prod          # deploy; accept the defaults (no build, root output)
```

**Option B — Git integration (auto-deploy on push):** import the repo at
<https://vercel.com/new> (framework preset **Other**, no build command), set the production
branch, and every push redeploys.

## Asset strategy

Production reliability favors local static assets:

- `index.html` maps `three` and `three/addons/` to `./vendor/three/` in its importmap and
  tries those module files before falling back to pinned Three.js `0.160.0` CDN URLs.
- `space-invaders-3d/vendor/README.md` lists the Three.js module and add-on files that should
  be committed for fully offline production startup.
- Planet and moon textures live under `assets/planets/` and load from local paths first. If a
  local texture is absent or corrupt, the loader falls back to the matching pinned CDN texture;
  if both fail, the game uses generated canvas fallback textures so launch is not blocked.
- Keep CDN fallbacks pinned to the same Three.js version as the vendored modules to avoid shader
  or addon compatibility drift.

## Controls

| Action | Keyboard / Mouse | Touch |
| ------ | ---------------- | ----- |
| Pitch (nose up/down) | `W` `S` or `↑` `↓` | left stick (up/down) |
| Yaw (turn left/right) | `A` `D` or `←` `→` | left stick (left/right) |
| Roll | `Q` `E` | roll buttons |
| Throttle | mouse wheel or `Z` `X` | auto-cruise |
| Boost | `Shift` (hold) | `>>` button |
| Fire | `Space` or left-click | `◉` button |
| Toggle cockpit / chase | `C` | `VIEW` button |
| Resume after pause | click | — |

On desktop the game uses **pointer lock** for mouse aiming; press `Esc` to release it (the game
pauses and shows a click-to-resume prompt).

## Gameplay

- Fly freely through open space. Invaders spawn around you and stream in:
  - **Hunters** chase and shoot at you.
  - **Bombers** (orange) ignore you and dive for the planet — let one through and planet
    integrity drops.
  - **Drifters** wander for easy points.
- The HUD auto-**locks** the nearest hostile ahead of you and shows its distance plus a green
  **lead marker** — put your shots on the lead marker to hit moving targets.
- The **radar** (bottom-left) shows contacts relative to your heading; the **SYSTEMS** panel
  (bottom-right) tracks hull, shield, planet integrity, and weapon readiness.
- **Shields** absorb hits and recharge when you avoid damage for a few seconds; **hull** does
  not regenerate. Asteroid and invader collisions hurt.
- Waves escalate endlessly (more, faster, more aggressive invaders). Clearing a wave repairs
  some hull. It's game over if your **hull** or the **planet integrity** reaches zero.

## How it works

Everything lives in `index.html`:

- **Rendering** — Three.js `WebGLRenderer` with ACES tone mapping and an `EffectComposer`
  bloom chain (`UnrealBloomPass` + `OutputPass`). The importmap points to local vendored
  modules first, with pinned CDN fallback used only when local modules are missing. A `LOW_FX`
  path auto-detects weak/mobile devices and disables bloom and lowers pixel ratio.
- **Planet** — local Three.js-style planet textures (day map, night city lights, clouds,
  specular, normal, and moon) are loaded from `assets/planets/` first, then from the pinned CDN
  if local files are missing. They are blended in a custom day/night `ShaderMaterial` by the sun
  direction so city lights only glow on the dark side; a fresnel `ShaderMaterial` adds the blue
  atmosphere, with a separate cloud sphere and a distant moon. A canvas-texture fallback covers
  load errors.
- **Flight** — true 6DOF: the ship carries a position and a `Quaternion`; pitch/yaw/roll build a
  local-space delta quaternion (no gimbal lock, natural banking), throttle/boost drive velocity
  with inertia, and motion is soft-bounded to a play sphere.
- **Cameras** — one world camera for cockpit (locked to the ship, with a 3D canopy/dashboard
  rendered as a separate overlay pass so the frame never blooms or clips) and chase modes.
- **Entities** — invaders, bullets, and particles are object-pooled; asteroids are a drifting
  field. Collisions use cheap squared-distance checks.
- **HUD** — DOM/CSS cockpit panels; 3D positions are projected to screen for the lock box, lead
  marker, score popups, and radar blips.
- **Audio** — synthesized SFX via the Web Audio API (laser, lock, boost, explosions, hits).
