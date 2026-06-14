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

> A local server is recommended because the page loads Three.js (and its post-processing
> add-ons + the Earth/moon textures) as ES modules / assets from a CDN. Opening `index.html`
> directly via `file://` may be blocked by the browser's module/CORS rules.

## Validate

Run the dependency-free validation script with Node.js before changing the game HTML or
splitting JavaScript into separate modules:

```bash
# from the repo root
node space-invaders-3d/tools/validate.mjs
```

The script checks that JavaScript-referenced DOM IDs exist, importmap entries cover bare
module imports, IDs are unique, key game functions are still present, and current/future
JavaScript modules parse without installing packages.

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
  bloom chain (`UnrealBloomPass` + `OutputPass`, loaded from the same unpkg CDN via the
  importmap). A `LOW_FX` path auto-detects weak/mobile devices and disables bloom and lowers
  pixel ratio.
- **Planet** — real Three.js example textures (day map, night city lights, clouds, specular)
  loaded from the CDN, blended in a custom day/night `ShaderMaterial` by the sun direction so
  city lights only glow on the dark side; a fresnel `ShaderMaterial` adds the blue atmosphere,
  with a separate cloud sphere and a distant moon. A canvas-texture fallback covers load errors.
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
