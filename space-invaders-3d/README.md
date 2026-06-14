# Orbital Defender — 3D Planet Defense

A browser-based 3D action game built with [Three.js](https://threejs.org/).
You pilot a fighter that **flies around a 3D planet** on great-circle orbits,
climbing and diving to intercept waves of invaders that dive in from deep space.
Every invader that reaches the surface damages the world — keep the planet's
integrity above zero for as long as you can.

Rendered in real 3D with a procedurally-textured planet, cloud layer, atmospheric
glow, a full starfield, synthesized sound effects, and explosion particles.

## Play

It's a single self-contained file — no build step required.

```bash
# from the repo root
cd space-invaders-3d
python3 -m http.server 8000
# then open http://localhost:8000 in a browser
```

> A local server is recommended because the page loads Three.js as an ES module.
> Opening `index.html` directly via `file://` may be blocked by the browser's
> module/CORS rules in some setups.

## Deploy to Vercel

This is a static site (no build step). A `vercel.json` at the repo root rewrites
`/` to this game, so the deployed site opens straight into the game.

**Option A — Vercel CLI (fastest):** from the repo root, on the branch with the game:

```bash
npm i -g vercel        # once
vercel login           # once
vercel --prod          # deploy; accept the defaults (no build, root output)
```

Vercel prints the live URL when it finishes.

**Option B — Git integration (auto-deploy on push):**

1. Go to <https://vercel.com/new> and import this GitHub repo.
2. Framework preset: **Other**. Leave Build Command empty and Output Directory as the repo root.
3. Set the Production Branch to the branch holding the game (or merge it to `main`).
4. Deploy. Every push to that branch then redeploys automatically.

## Controls

| Action | Keys |
| ------ | ---- |
| Steer around the planet | `←` `→` or `A` `D` |
| Climb / dive (and aim)  | `↑` `↓` or `W` `S` |
| Fire                    | `Space` |

On touch devices, on-screen pads appear automatically: steering on the left,
climb/dive plus fire on the right.

## Gameplay

- Your ship continuously flies forward along an orbit. Steer to circle the globe,
  and climb/dive to change altitude and tilt your aim at incoming threats.
- Invaders spawn out in space and descend straight toward the planet's surface.
  Shoot them before they hit — the higher you intercept one, the more points it's worth.
- A **red arrow** at the screen edge points to the nearest incoming invader, so
  you always know which way to turn.
- Each surface impact (or hit from an enemy shot) lowers **planet integrity**.
  Clearing a wave repairs a little of it.
- Waves get bigger and faster, and there's no win screen — it's an endless defense.
  It's game over when planet integrity reaches zero.

## How it works

Everything lives in `index.html`:

- **Scene** — Three.js `WebGLRenderer`, a chase camera, sun + fill lighting, a
  spherical starfield, and a planet built from canvas-generated textures (ocean,
  continents, ice caps) with a rotating cloud layer and an additive atmosphere glow.
- **Flight model** — the ship's position and heading live on an orbital sphere.
  Steering rotates the heading around the local "up"; forward motion advances the
  ship along a great circle; pitch changes altitude and the aim vector. This keeps
  movement smooth all the way around the globe without gimbal-lock at the poles.
- **Entities** — invaders, bullets, and explosion particles are plain meshes tracked
  in arrays and updated each frame, with cheap squared-distance collision checks.
- **Loop** — a delta-time `requestAnimationFrame` loop handles input, flight,
  spawning, enemy AI, collisions, the projected HUD (crosshair, threat arrow,
  score popups), and camera smoothing + shake.
