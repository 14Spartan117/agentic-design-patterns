# 3D Space Invaders

A browser-based 3D twist on the arcade classic, built with [Three.js](https://threejs.org/).
You pilot a fighter at the front of the field and shoot down a descending swarm of
invaders rendered in real 3D with lighting, a starfield, and explosion particles.

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

## Controls

| Action | Keys |
| ------ | ---- |
| Move left  | `←` or `A` |
| Move right | `→` or `D` |
| Fire       | `Space` |

## Gameplay

- The swarm marches side to side, dropping closer each time it hits an edge.
- Destroy every invader to clear a wave. Clearing a wave grants a bonus life.
- Higher rows are worth more points; difficulty ramps each wave.
- You start with 3 lives. Survive 5 waves to win.
- It's game over if you run out of lives or the swarm reaches your line.

## How it works

Everything lives in `index.html`:

- **Scene** — Three.js `WebGLRenderer`, a perspective camera looking down the field,
  ambient + directional + point lighting, a `Fog`, a particle starfield, and a floor grid.
- **Entities** — the player ship, invaders, bullets, and explosion particles are all
  plain meshes tracked in arrays and updated each frame.
- **Loop** — a fixed-ish `requestAnimationFrame` loop with delta-time movement handles
  input, swarm AI, firing, collision detection (squared-distance checks), and HUD updates.
