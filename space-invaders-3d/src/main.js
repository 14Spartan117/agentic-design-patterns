import * as THREE from "three";
import { Sfx } from "./audio.js";
import { renderer, scene, camera, composer, bloomPass, useBloom } from "./rendering.js";
import { shipPos, shipQuat, shipVel, forward, rightV, upV, tmpA, tmpB, tmpC, tmpQ, tmpQ2, tmpMat, _proj, controlAxes, state } from "./state.js";
import { WORLD_R, BASE_SPEED, BOOST_MULT, PITCH_RATE, YAW_RATE, ROLL_RATE, BULLET_SPEED, BULLET_RANGE, FIRE_CD, ENEMY_BULLET_SPEED, ENEMY_BULLET_RANGE, FOV_BASE, FOV_BOOST, RADAR_RANGE, HISCORE_KEY, TEX_BASE, LOW_FX, IS_TOUCH, SUN_DIR } from "./config.js";

  const { clamp, lerp } = THREE.MathUtils;

  // ---------------------------------------------------------------------------
  // Starfield (full surrounding sphere)
  // ---------------------------------------------------------------------------
  function makeStarfield() {
    const count = LOW_FX ? 2200 : 4000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
       .normalize().multiplyScalar(WORLD_R * 3 + Math.random() * WORLD_R * 4);
      positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
      c.setHSL(0.55 + Math.random() * 0.12, 0.5, 0.6 + Math.random() * 0.4);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 1.4, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true });
    return new THREE.Points(geo, mat);
  }
  const stars = makeStarfield();
  scene.add(stars);

  // ---------------------------------------------------------------------------
  // Planet, clouds, atmosphere, moon, sun flare
  //   Textures load async; the start button unlocks when ready.
  // ---------------------------------------------------------------------------
  const PR = 78;                    // planet radius
  const planetGroup = new THREE.Group();
  planetGroup.position.set(-110, -55, -210);
  scene.add(planetGroup);

  // Fallback canvas texture if a CDN texture fails
  function fallbackEarthTexture() {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
    const x = c.getContext("2d");
    // ocean
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#0a2f54"); g.addColorStop(0.5, "#0e4a78"); g.addColorStop(1, "#0a2f54");
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    // continents — clustered blobs of varied land colors
    const land = ["#2f7d3a", "#3a8f45", "#6b8f3a", "#8a7a3e", "#4a8a52", "#7a6a3a"];
    for (let i = 0; i < 34; i++) {
      const cx = Math.random() * 1024, cy = 70 + Math.random() * 372;
      x.fillStyle = land[Math.random() * land.length | 0];
      const blobs = 10 + (Math.random() * 16 | 0);
      for (let b = 0; b < blobs; b++) {
        const r = 10 + Math.random() * 44;
        x.beginPath(); x.arc(cx + (Math.random() - 0.5) * 130, cy + (Math.random() - 0.5) * 90, r, 0, Math.PI * 2); x.fill();
      }
    }
    // scattered islands
    x.fillStyle = "#3a8f45";
    for (let i = 0; i < 120; i++) { x.beginPath(); x.arc(Math.random() * 1024, Math.random() * 512, 2 + Math.random() * 6, 0, Math.PI * 2); x.fill(); }
    // city light dots
    x.fillStyle = "rgba(255,228,150,0.5)";
    for (let i = 0; i < 200; i++) x.fillRect(Math.random() * 1024, 90 + Math.random() * 330, 1.5, 1.5);
    // ice caps
    x.fillStyle = "rgba(235,245,255,0.92)"; x.fillRect(0, 0, 1024, 46); x.fillRect(0, 466, 1024, 46);
    return new THREE.CanvasTexture(c);
  }
  function neutralNormalTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 4;
    const x = c.getContext("2d"); x.fillStyle = "#8080ff"; x.fillRect(0, 0, 4, 4);
    return new THREE.CanvasTexture(c);
  }

  let planet, clouds, moon;
  let satellites = [];
  let defenseRing = null;
  let assetsReady = false;

  // Orbital structures around the homeworld — adds shapes/detail near the planet
  function buildOrbitalStructures() {
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x223047, metalness: 0.85, roughness: 0.4, emissive: 0x0a2a3a, emissiveIntensity: 0.7 });
    defenseRing = new THREE.Mesh(new THREE.TorusGeometry(PR * 1.55, 0.8, 8, 90), ringMat);
    defenseRing.rotation.x = Math.PI * 0.46; defenseRing.rotation.y = 0.3;
    planetGroup.add(defenseRing);
    // a second thin ring of debris/segments
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(PR * 1.92, 0.3, 6, 64), ringMat);
    ring2.rotation.x = Math.PI * 0.5; ring2.rotation.z = 0.6;
    planetGroup.add(ring2);

    const satMat = new THREE.MeshStandardMaterial({ color: 0x9fb3c8, metalness: 0.7, roughness: 0.5, emissive: 0x113355, emissiveIntensity: 0.5 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1b3a6b, metalness: 0.5, roughness: 0.4, emissive: 0x0a2a4a, emissiveIntensity: 0.5 });
    for (let i = 0; i < 12; i++) {
      const sat = new THREE.Group();
      sat.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.2), satMat));
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.1), panelMat); p1.position.x = 2.6; sat.add(p1);
      const p2 = p1.clone(); p2.position.x = -2.6; sat.add(p2);
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.7, 0.5, 12), satMat); dish.rotation.x = Math.PI / 2; dish.position.z = 0.9; sat.add(dish);
      sat.userData.angle = Math.random() * Math.PI * 2;
      sat.userData.rad = PR * (1.32 + Math.random() * 0.8);
      sat.userData.speed = 0.04 + Math.random() * 0.08;
      sat.userData.y = (Math.random() - 0.5) * PR * 0.9;
      planetGroup.add(sat); satellites.push(sat);
    }
  }

  function buildPlanet(tex) {
    const day = tex.day, night = tex.night, spec = tex.spec, cloud = tex.cloud, moonT = tex.moon;
    const nrm = tex.normal || neutralNormalTexture();

    const planetMat = new THREE.ShaderMaterial({
      uniforms: {
        uDay: { value: day }, uNight: { value: night }, uSpec: { value: spec }, uNormal: { value: nrm },
        uSunDir: { value: SUN_DIR.clone() },
      },
      vertexShader: `
        varying vec2 vUv; varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uDay, uNight, uSpec, uNormal; uniform vec3 uSunDir;
        varying vec2 vUv; varying vec3 vWorldNormal;
        vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
        void main() {
          // relief from the normal map gives terrain "shape" to the lighting
          vec3 nmap = texture2D(uNormal, vUv).rgb * 2.0 - 1.0;
          float relief = (nmap.x + nmap.y) * 0.22;
          float d = dot(normalize(vWorldNormal), normalize(uSunDir)) + relief;
          float day = smoothstep(-0.12, 0.30, d);
          vec3 dayc = lin(texture2D(uDay, vUv).rgb) * (0.80 + 0.4 * clamp(0.5 + nmap.y, 0.0, 1.0));
          vec3 nightc = lin(texture2D(uNight, vUv).rgb) * 2.2;   // boost city lights for bloom
          float spec = texture2D(uSpec, vUv).r;
          float glint = pow(max(d, 0.0), 18.0) * spec;
          vec3 col = mix(nightc, dayc, day) + vec3(0.9, 0.95, 1.0) * glint * 0.6;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 96, 64), planetMat);
    planetGroup.add(planet);

    if (cloud) {
      cloud.colorSpace = THREE.SRGBColorSpace;
      clouds = new THREE.Mesh(
        new THREE.SphereGeometry(PR * 1.012, 48, 32),
        new THREE.MeshStandardMaterial({ map: cloud, alphaMap: cloud, transparent: true, opacity: 0.7, depthWrite: false })
      );
      planetGroup.add(clouds);
    }

    // Atmosphere — classic fresnel glow on a back-side shell
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(PR * 1.16, 48, 32),
      new THREE.ShaderMaterial({
        transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color(0x3aa0ff) } },
        vertexShader: `
          varying vec3 vN;
          void main(){ vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform vec3 uColor; varying vec3 vN;
          void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 4.0);
            gl_FragColor = vec4(uColor, 1.0) * clamp(i, 0.0, 1.0); }`,
      })
    );
    planetGroup.add(atmo);

    if (moonT) {
      moonT.colorSpace = THREE.SRGBColorSpace;
      moon = new THREE.Mesh(
        new THREE.SphereGeometry(PR * 0.27, 32, 24),
        new THREE.MeshStandardMaterial({ map: moonT, roughness: 1.0, metalness: 0.0 })
      );
      moon.position.set(PR * 2.4, PR * 0.6, PR * 0.5);
      planetGroup.add(moon);
    }
    buildOrbitalStructures();
  }

  // Visible sun flare (additive billboard, blooms into a star)
  function makeSunFlare() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const g = cv.getContext("2d").createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,240,200,0.9)");
    g.addColorStop(1, "rgba(255,200,120,0)");
    const ctx = cv.getContext("2d"); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const tx = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    spr.scale.setScalar(140);
    spr.position.copy(SUN_DIR).multiplyScalar(1600);
    return spr;
  }
  scene.add(makeSunFlare());

  function loadAssets() {
    const mgr = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(mgr);
    const tex = {};
    const get = (file, key, srgb) => loader.load(
      TEX_BASE + file,
      (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); },
      undefined,
      () => { tex[key] = fallbackEarthTexture(); }   // on error
    );
    tex.day = get("earth_atmos_2048.jpg", "day", true);
    tex.night = get("earth_lights_2048.png", "night", true);
    tex.spec = get("earth_specular_2048.jpg", "spec", false);
    tex.normal = get("earth_normal_2048.jpg", "normal", false);
    tex.cloud = get("earth_clouds_1024.png", "cloud", true);
    tex.moon = get("moon_1024.jpg", "moon", true);
    mgr.onLoad = () => finishLoad(tex);
    mgr.onError = () => finishLoad(tex);
    // Safety: don't hang forever if the CDN is slow/unreachable
    setTimeout(() => { if (!assetsReady) finishLoad(tex); }, 8000);
  }
  function finishLoad(tex) {
    if (assetsReady) return;
    if (!planet) buildPlanet(tex);
    assetsReady = true;
    const btn = document.getElementById("startBtn");
    btn.disabled = false; btn.textContent = "LAUNCH";
  }

  // ---------------------------------------------------------------------------
  // Cockpit overlay scene (rendered on top, never bloomed/clipped)
  // ---------------------------------------------------------------------------
  const cockpitScene = new THREE.Scene();
  const cockpitCam = new THREE.PerspectiveCamera(FOV_BASE, window.innerWidth / window.innerHeight, 0.01, 10);
  cockpitScene.add(new THREE.AmbientLight(0x6688aa, 0.8));
  const cpLight = new THREE.PointLight(0x88ccff, 1.2, 8);
  cpLight.position.set(0, 0.5, 0.5);
  cockpitScene.add(cpLight);

  function buildCockpit() {
    const g = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x161b24, metalness: 0.7, roughness: 0.5, emissive: 0x05080d });
    // Canopy rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 10, 40), frameMat);
    rim.position.set(0, 0, -1.35);
    g.add(rim);
    // Top center strut
    const strutGeo = new THREE.BoxGeometry(0.05, 0.05, 0.9);
    const topStrut = new THREE.Mesh(strutGeo, frameMat);
    topStrut.position.set(0, 0.7, -1.0); topStrut.rotation.x = 0.5;
    g.add(topStrut);
    // Side struts
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), frameMat);
      side.position.set(s * 0.92, 0, -1.15); side.rotation.z = s * 0.5;
      g.add(side);
    }
    // Dashboard
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0c1018, metalness: 0.6, roughness: 0.6, emissive: 0x040608 }));
    dash.position.set(0, -0.95, -1.0); dash.rotation.x = -0.35;
    g.add(dash);
    // A couple of subtle dash glow strips
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x1b6f8f }));
    strip.position.set(0, -0.78, -0.82); strip.rotation.x = -0.35;
    g.add(strip);
    return g;
  }
  const cockpit = buildCockpit();
  cockpitScene.add(cockpit);

  // ---------------------------------------------------------------------------
  // Player ship (nose along -Z)
  // ---------------------------------------------------------------------------
  function makeShip() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x39ff8c, emissive: 0x0c3322, metalness: 0.5, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 10), bodyMat);
    body.rotation.x = -Math.PI / 2;
    group.add(body);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x1fd1ff, emissive: 0x05303a, metalness: 0.55, roughness: 0.4 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.22, 0.95), wingMat);
    wing.position.z = 0.55; group.add(wing);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.8), wingMat);
    fin.position.set(0, 0.45, 0.8); group.add(fin);
    const flare = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8),
      new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.9 }));
    flare.rotation.x = Math.PI / 2; flare.position.z = 1.55;
    group.add(flare);
    group.userData.flare = flare;
    return group;
  }
  const player = makeShip();
  scene.add(player);

  // ---------------------------------------------------------------------------
  // Generic object pool
  // ---------------------------------------------------------------------------
  function makePool(factory) {
    return {
      free: [], active: [],
      acquire() { const o = this.free.pop() || factory(); o.visible = true; this.active.push(o); return o; },
      release(o) { o.visible = false; const i = this.active.indexOf(o); if (i >= 0) this.active.splice(i, 1); this.free.push(o); },
      releaseAll() { while (this.active.length) this.release(this.active[this.active.length - 1]); },
    };
  }

  // Shared geometry / materials
  const playerBulletGeo = new THREE.CapsuleGeometry(0.12, 1.4, 4, 8);
  const playerBulletMat = new THREE.MeshBasicMaterial({ color: 0x9dffb0 });
  const enemyBulletGeo = new THREE.SphereGeometry(0.34, 10, 10);
  const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xff5d73 });
  const particleGeo = new THREE.SphereGeometry(0.18, 6, 6);

  const playerBullets = makePool(() => { const m = new THREE.Mesh(playerBulletGeo, playerBulletMat); scene.add(m); return m; });
  const enemyBullets = makePool(() => { const m = new THREE.Mesh(enemyBulletGeo, enemyBulletMat); scene.add(m); return m; });
  const particlePool = makePool(() => { const m = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ transparent: true })); scene.add(m); return m; });

  const invaderGeo = new THREE.IcosahedronGeometry(1.0, 0);
  const invaderRingGeo = new THREE.TorusGeometry(1.15, 0.16, 8, 20);
  const invaderEyeGeo = new THREE.SphereGeometry(0.26, 12, 12);
  function makeInvaderMesh() {
    const group = new THREE.Group();
    const core = new THREE.Mesh(invaderGeo, new THREE.MeshStandardMaterial({
      color: 0xff2d3a, emissive: 0xff2d3a, emissiveIntensity: 1.4, metalness: 0.4, roughness: 0.4, flatShading: true,
    }));
    group.add(core);
    const ring = new THREE.Mesh(invaderRingGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a22, emissive: 0x330008, metalness: 0.8, roughness: 0.3 }));
    group.add(ring);
    const eye = new THREE.Mesh(invaderEyeGeo, new THREE.MeshBasicMaterial({ color: 0xffe8a0 }));
    eye.position.z = -0.9; group.add(eye);
    group.userData.core = core; group.userData.ring = ring;
    scene.add(group);
    return group;
  }
  const invaderPool = makePool(makeInvaderMesh);

  // Asteroids (static field, collidable)
  let asteroids = [];
  function makeAsteroid(radius) {
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const f = 0.78 + Math.random() * 0.44;
      pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 1.0, metalness: 0.1, flatShading: true }));
    m.userData.radius = radius;
    m.userData.spin = new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
    m.userData.drift = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(1.5);
    return m;
  }
  function spawnAsteroidField() {
    for (const a of asteroids) scene.remove(a);
    asteroids = [];
    const n = LOW_FX ? 16 : 28;
    for (let i = 0; i < n; i++) {
      const a = makeAsteroid(2 + Math.random() * 6);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      a.position.copy(v.multiplyScalar(40 + Math.random() * (WORLD_R - 60)));
      scene.add(a); asteroids.push(a);
    }
  }

  // ---------------------------------------------------------------------------
  // Spawning helpers
  // ---------------------------------------------------------------------------
  function spawnPlayerBullet() {
    const b = playerBullets.acquire();
    b.position.copy(player.position).addScaledVector(forward, 1.6);
    b.quaternion.copy(shipQuat); b.rotateX(Math.PI / 2);
    b.userData.vel = forward.clone().multiplyScalar(BULLET_SPEED).addScaledVector(shipVel, 0.5);
    b.userData.from = b.position.clone();
  }
  function spawnEnemyBullet(inv) {
    const b = enemyBullets.acquire();
    b.position.copy(inv.position);
    // lead the player a little
    const dist = inv.position.distanceTo(player.position);
    const lead = tmpA.copy(player.position).addScaledVector(shipVel, dist / ENEMY_BULLET_SPEED * 0.6);
    b.userData.vel = lead.sub(inv.position).normalize().multiplyScalar(ENEMY_BULLET_SPEED);
    b.userData.from = b.position.clone();
  }
  function spawnExplosion(pos, color, n) {
    n = n || 14;
    for (let i = 0; i < n; i++) {
      const m = particlePool.acquire();
      m.material.color.set(color); m.material.opacity = 1;
      m.position.copy(pos);
      m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
      m.userData.life = 0.6;
    }
  }

  // ---------------------------------------------------------------------------
  // HUD references
  // ---------------------------------------------------------------------------
  const ui = {
    score: document.getElementById("score"), hiscore: document.getElementById("hiscoreVal"), wave: document.getElementById("wave"),
    thr: document.getElementById("thr"), viewMode: document.getElementById("viewMode"),
    hullVal: document.getElementById("hullVal"), hullFill: document.getElementById("hullFill"),
    shieldVal: document.getElementById("shieldVal"), shieldFill: document.getElementById("shieldFill"),
    planetVal: document.getElementById("planetVal"), planetFill: document.getElementById("planetFill"),
    weaponVal: document.getElementById("weaponVal"), weaponFill: document.getElementById("weaponFill"),
    thrFill: document.getElementById("thrFill"), thrVal2: document.getElementById("thrVal2"),
    lockbox: document.getElementById("lockbox"), lockDist: document.querySelector("#lockbox .dist"),
    lead: document.getElementById("lead"), reticle: document.getElementById("aim"),
    radar: document.getElementById("radar"),
    terminal: document.getElementById("terminal"),
    startScreen: document.getElementById("startScreen"), pauseScreen: document.getElementById("pauseScreen"),
    gameOverScreen: document.getElementById("gameOverScreen"), finalScore: document.getElementById("finalScore"),
    gameOverTitle: document.getElementById("gameOverTitle"), gameOverMsg: document.getElementById("gameOverMsg"),
    newHi: document.getElementById("newHi"),
  };
  const radarCtx = ui.radar.getContext("2d");

  const termLines = [];
  function term(msg) {
    termLines.push(msg);
    while (termLines.length > 5) termLines.shift();
    ui.terminal.innerHTML = termLines.map((l) => "<div>&gt; " + l + "</div>").join("");
  }

  const popupLayer = document.getElementById("popups");
  function worldToScreen(v) {
    _proj.copy(v).project(camera);
    return { x: (_proj.x * 0.5 + 0.5) * window.innerWidth, y: (-_proj.y * 0.5 + 0.5) * window.innerHeight, visible: _proj.z < 1 };
  }
  function scorePopup(worldPos, text, color) {
    const s = worldToScreen(worldPos); if (!s.visible) return;
    const el = document.createElement("div"); el.className = "popup"; el.textContent = text;
    el.style.left = s.x + "px"; el.style.top = s.y + "px"; el.style.color = color || "#ffd166";
    popupLayer.appendChild(el); setTimeout(() => el.remove(), 950);
  }
  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text; toastEl.classList.remove("show"); void toastEl.offsetWidth; toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  function barColor(el, pct, hi, mid) {
    el.style.background = pct > 50 ? hi : pct > 25 ? mid : "linear-gradient(90deg, #ff5d73, #ff2d55)";
  }
  function syncHud() {
    ui.score.textContent = state.score; ui.hiscore.textContent = state.hiscore; ui.wave.textContent = state.wave;
    ui.thr.textContent = Math.round(controlAxes.throttle * 100);
    ui.hullVal.textContent = Math.round(state.hull); ui.hullFill.style.width = clamp(state.hull, 0, 100) + "%";
    ui.shieldVal.textContent = Math.round(state.shield); ui.shieldFill.style.width = clamp(state.shield, 0, 100) + "%";
    ui.planetVal.textContent = Math.round(state.integrity); ui.planetFill.style.width = clamp(state.integrity, 0, 100) + "%";
    barColor(ui.hullFill, state.hull, "linear-gradient(90deg,#39ff8c,#7df9ff)", "linear-gradient(90deg,#ffd166,#ffae42)");
    barColor(ui.planetFill, state.integrity, "linear-gradient(90deg,#b388ff,#7df9ff)", "linear-gradient(90deg,#ffd166,#ffae42)");
    const wpct = clamp((1 - state.fireCooldown / FIRE_CD) * 100, 0, 100);
    ui.weaponFill.style.width = wpct + "%"; ui.weaponVal.textContent = state.fireCooldown <= 0 ? "RDY" : "...";
    const tpct = Math.round(controlAxes.throttle * 100);
    ui.thrFill.style.width = tpct + "%"; ui.thrVal2.textContent = tpct;
  }

  function addScore(points, atPos, color) {
    state.score += points;
    if (state.score > state.hiscore) state.hiscore = state.score;
    if (atPos) scorePopup(atPos, "+" + points, color);
  }

  function damageHull(amount) {
    let a = amount;
    if (state.shield > 0) { const s = Math.min(state.shield, a); state.shield -= s; a -= s; }
    if (a > 0) state.hull -= a;
    state.shieldRegenTimer = 4;
    state.shake = Math.max(state.shake, 1.0);
    syncHud();
    if (state.hull <= 0) endGame("SHIP DESTROYED", "Your fighter was torn apart in the void.");
  }
  function damagePlanet(amount) {
    state.integrity = Math.max(0, state.integrity - amount);
    state.shake = Math.max(state.shake, 0.8); Sfx.impact();
    term("PLANET STRUCK — INTEGRITY " + Math.round(state.integrity) + "%");
    syncHud();
    if (state.integrity <= 0) endGame("PLANET LOST", "The bombers broke through to the homeworld.");
  }

  // ---------------------------------------------------------------------------
  // Waves
  // ---------------------------------------------------------------------------
  function beginWave(n) {
    state.wave = n;
    state.toSpawn = 4 + n * 2;
    state.spawnTimer = 0.6;
    state.spawnInterval = Math.max(0.4, 1.4 - (n - 1) * 0.1);
    state.invSpeed = 13 + (n - 1) * 1.6;
    state.hunterRatio = Math.min(0.85, 0.45 + (n - 1) * 0.06);
    syncHud(); toast("WAVE " + n); term("WAVE " + n + " INBOUND");
  }

  function spawnInvader() {
    const inv = invaderPool.acquire();
    // spawn out near the play-space edge, biased ahead of the player
    let dir;
    if (Math.random() < 0.6) {
      dir = forward.clone().applyAxisAngle(upV, (Math.random() - 0.5) * 2.2).applyAxisAngle(rightV, (Math.random() - 0.5) * 1.2).normalize();
    } else {
      dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    }
    inv.position.copy(player.position).addScaledVector(dir, 140 + Math.random() * 60);
    if (inv.position.length() > WORLD_R) inv.position.setLength(WORLD_R * 0.9);
    inv.userData.vel = new THREE.Vector3();
    inv.userData.speed = state.invSpeed * (0.85 + Math.random() * 0.4);
    inv.userData.fireTimer = 1 + Math.random() * 2;
    inv.userData.hp = 1;
    const r = Math.random();
    inv.userData.role = r < state.hunterRatio ? "hunter" : r < state.hunterRatio + 0.25 ? "bomber" : "drifter";
    inv.userData.spin = (Math.random() - 0.5) * 2;
    if (inv.userData.role === "bomber") inv.userData.core.material.color.set(0xff8c1a), inv.userData.core.material.emissive.set(0xff8c1a);
    else inv.userData.core.material.color.set(0xff2d3a), inv.userData.core.material.emissive.set(0xff2d3a);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const keys = {};
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.code === "KeyC") toggleView();
    if (e.code === "KeyZ" || e.code === "KeyF") controlAxes.throttle = clamp(controlAxes.throttle - 0.1, 0, 1);
    if (e.code === "KeyX" || e.code === "KeyR") controlAxes.throttle = clamp(controlAxes.throttle + 0.1, 0, 1);
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  window.addEventListener("wheel", (e) => {
    if (!state.running) return;
    controlAxes.throttle = clamp(controlAxes.throttle - Math.sign(e.deltaY) * 0.06, 0, 1);
  }, { passive: true });

  function readKeyboard() {
    let pitch = 0, yaw = 0, roll = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) pitch -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) pitch += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) yaw += 1;
    if (keys["KeyD"] || keys["ArrowRight"]) yaw -= 1;
    if (keys["KeyQ"]) roll += 1;
    if (keys["KeyE"]) roll -= 1;
    controlAxes.pitch = pitch; controlAxes.yaw = yaw; controlAxes.roll = roll;
    controlAxes.boost = !!keys["ShiftLeft"] || !!keys["ShiftRight"];
    controlAxes.fire = !!keys["Space"] || mouseFire;
  }

  // Mouse aim via pointer lock (desktop only)
  let mouseAim = { x: 0, y: 0 };
  let mouseFire = false;
  const canvas = renderer.domElement;
  if (!IS_TOUCH) {
    canvas.addEventListener("mousedown", (e) => { if (e.button === 0) mouseFire = true; });
    window.addEventListener("mouseup", (e) => { if (e.button === 0) mouseFire = false; });
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === canvas) {
        mouseAim.x += e.movementX * 0.06; mouseAim.y += e.movementY * 0.06;
        mouseAim.x = clamp(mouseAim.x, -1.5, 1.5); mouseAim.y = clamp(mouseAim.y, -1.5, 1.5);
      }
    });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === canvas) {
        if (state.paused) { state.paused = false; ui.pauseScreen.classList.add("hidden"); }
      } else if (state.running) {
        state.paused = true; ui.pauseScreen.classList.remove("hidden");
      }
    });
    ui.pauseScreen.addEventListener("click", () => { if (state.running) canvas.requestPointerLock(); });
  }

  // Touch controls
  function setupTouch() {
    const stick = document.getElementById("stick"), nub = document.getElementById("nub");
    let stickId = null, cx = 0, cy = 0;   // track the specific pointer driving the stick
    const R = 52;
    const move = (e) => {
      if (stickId === null || e.pointerId !== stickId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy); if (len > R) { dx *= R / len; dy *= R / len; }
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
      controlAxes.yaw = -clamp(dx / R, -1, 1);   // push right -> yaw right
      controlAxes.pitch = clamp(dy / R, -1, 1);  // push down -> nose up
    };
    const endStick = (e) => {
      if (stickId === null || e.pointerId !== stickId) return;   // ignore other fingers
      stickId = null; nub.style.transform = "translate(0,0)"; controlAxes.yaw = 0; controlAxes.pitch = 0;
    };
    stick.addEventListener("pointerdown", (e) => {
      stickId = e.pointerId;
      const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e); e.preventDefault();
    });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", endStick);
    window.addEventListener("pointercancel", endStick);

    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      el.addEventListener("pointerdown", (e) => { on(); e.preventDefault(); });
      el.addEventListener("pointerup", (e) => { off(); e.preventDefault(); });
      el.addEventListener("pointerleave", () => off());
    };
    hold("fireBtnT", () => controlAxes.fire = true, () => controlAxes.fire = false);
    hold("boostBtnT", () => controlAxes.boost = true, () => controlAxes.boost = false);
    hold("rollLBtn", () => controlAxes.roll = 1, () => controlAxes.roll = 0);
    hold("rollRBtn", () => controlAxes.roll = -1, () => controlAxes.roll = 0);
    const tap = (id, fn) => document.getElementById(id).addEventListener("pointerdown", (e) => { fn(); e.preventDefault(); });
    tap("thrUpBtn", () => controlAxes.throttle = clamp(controlAxes.throttle + 0.15, 0, 1));
    tap("thrDownBtn", () => controlAxes.throttle = clamp(controlAxes.throttle - 0.15, 0, 1));
    tap("viewBtnT", () => toggleView());
  }
  setupTouch();
  window.addEventListener("touchstart", () => document.body.classList.add("show-touch"), { once: true });

  function toggleView() {
    state.cameraMode = state.cameraMode === "cockpit" ? "chase" : "cockpit";
    ui.viewMode.textContent = state.cameraMode.toUpperCase();
    player.visible = state.cameraMode === "chase";
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------
  function startGame() {
    if (!assetsReady) return;
    Sfx.init(); Sfx.resume();
    state.running = true; state.paused = false;
    state.score = 0; state.hull = 100; state.shield = 100; state.integrity = 100;
    state.fireCooldown = 0; state.shieldRegenTimer = 0; state.shake = 0; state.target = null;
    controlAxes.throttle = 0.6;
    shipPos.set(0, 0, 60); shipVel.set(0, 0, 0);
    shipQuat.identity(); mouseAim.x = 0; mouseAim.y = 0;
    player.position.copy(shipPos); player.quaternion.copy(shipQuat);

    invaderPool.releaseAll(); playerBullets.releaseAll(); enemyBullets.releaseAll(); particlePool.releaseAll();
    spawnAsteroidField();
    termLines.length = 0; term("SYSTEMS ONLINE"); term("DEFEND THE HOMEWORLD");
    beginWave(1); syncHud();
    ui.startScreen.classList.add("hidden"); ui.gameOverScreen.classList.add("hidden"); ui.pauseScreen.classList.add("hidden");
    if (!IS_TOUCH) canvas.requestPointerLock();
  }
  function endGame(title, msg) {
    if (!state.running) return;
    state.running = false;
    const prevHi = Number(localStorage.getItem(HISCORE_KEY) || 0);
    const isNewHi = state.score > prevHi && state.score > 0;
    if (isNewHi) localStorage.setItem(HISCORE_KEY, String(state.score));
    ui.finalScore.textContent = state.score;
    ui.gameOverTitle.textContent = title;
    ui.gameOverMsg.textContent = msg + " You reached wave " + state.wave + ".";
    ui.newHi.classList.toggle("hidden", !isNewHi);
    ui.gameOverScreen.classList.remove("hidden");
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  document.getElementById("startBtn").addEventListener("click", startGame);
  document.getElementById("restartBtn").addEventListener("click", startGame);

  // ---------------------------------------------------------------------------
  // Targeting
  // ---------------------------------------------------------------------------
  function updateTarget() {
    let best = null, bestDot = 0.6;
    for (const inv of invaderPool.active) {
      tmpA.copy(inv.position).sub(shipPos).normalize();
      const d = tmpA.dot(forward);
      if (d > bestDot) { bestDot = d; best = inv; }
    }
    if (best !== state.target) { state.target = best; if (best) Sfx.lock(); }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  function update(dt, t) {
    stars.rotation.y += dt * 0.002;
    if (planet) planet.rotation.y += dt * 0.012;
    if (clouds) clouds.rotation.y += dt * 0.018;
    if (defenseRing) defenseRing.rotation.z += dt * 0.05;
    for (const s of satellites) {
      s.userData.angle += dt * s.userData.speed;
      const a = s.userData.angle;
      s.position.set(Math.cos(a) * s.userData.rad, s.userData.y, Math.sin(a) * s.userData.rad);
      s.rotation.y = -a;
    }
    if (player.userData.flare) player.userData.flare.scale.y = 0.7 + Math.sin(t * 30) * 0.3 + (controlAxes.boost ? 0.8 : 0);

    if (state.running && !state.paused) {
      if (!IS_TOUCH) readKeyboard();   // touch writes controlAxes directly

      // --- Flight integration ---
      // Mouse adds to yaw/pitch then decays toward center
      const pitchIn = clamp(controlAxes.pitch + mouseAim.y, -1, 1);
      const yawIn = clamp(controlAxes.yaw - mouseAim.x, -1, 1);
      mouseAim.x *= (1 - Math.min(1, dt * 6)); mouseAim.y *= (1 - Math.min(1, dt * 6));

      tmpQ2.setFromEuler(new THREE.Euler(pitchIn * PITCH_RATE * dt, yawIn * YAW_RATE * dt, controlAxes.roll * ROLL_RATE * dt, "XYZ"));
      shipQuat.multiply(tmpQ2).normalize();

      forward.set(0, 0, -1).applyQuaternion(shipQuat);
      rightV.set(1, 0, 0).applyQuaternion(shipQuat);
      upV.set(0, 1, 0).applyQuaternion(shipQuat);

      const targetSpeed = BASE_SPEED * controlAxes.throttle * (controlAxes.boost ? BOOST_MULT : 1);
      tmpA.copy(forward).multiplyScalar(targetSpeed);
      shipVel.lerp(tmpA, 1 - Math.pow(0.1, dt));
      shipPos.addScaledVector(shipVel, dt);

      // Soft world bound
      if (shipPos.length() > WORLD_R) {
        tmpA.copy(shipPos).normalize();
        shipVel.addScaledVector(tmpA, -targetSpeed * dt * 2);
        if (shipPos.length() > WORLD_R * 1.05) shipPos.setLength(WORLD_R * 1.05);
        if (Math.random() < 0.02) term("RETURN TO COMBAT ZONE");
      }

      player.position.copy(shipPos); player.quaternion.copy(shipQuat);

      // Boost SFX (gated)
      if (controlAxes.boost && !state._wasBoost) Sfx.boost();
      state._wasBoost = controlAxes.boost;

      // --- Firing ---
      state.fireCooldown -= dt;
      if (controlAxes.fire && state.fireCooldown <= 0) { spawnPlayerBullet(); Sfx.laser(); state.fireCooldown = FIRE_CD; }

      // --- Shield regen ---
      if (state.shieldRegenTimer > 0) state.shieldRegenTimer -= dt;
      else if (state.shield < 100) { state.shield = Math.min(100, state.shield + 16 * dt); }

      // --- Spawn ---
      if (state.toSpawn > 0) { state.spawnTimer -= dt; if (state.spawnTimer <= 0) { spawnInvader(); state.toSpawn--; state.spawnTimer = state.spawnInterval; } }

      // --- Invader AI ---
      const planetWorld = tmpC.copy(planetGroup.position);
      state.enemyFireBudget += dt;
      for (let i = invaderPool.active.length - 1; i >= 0; i--) {
        const inv = invaderPool.active[i];
        const ud = inv.userData;
        let desired;
        if (ud.role === "bomber") {
          desired = tmpA.copy(planetWorld).sub(inv.position).normalize();
          // reached the planet?
          if (inv.position.distanceTo(planetWorld) < PR + 6) {
            spawnExplosion(inv.position, 0xff8c1a, 18); invaderPool.release(inv);
            if (state.target === inv) state.target = null;
            damagePlanet(9); if (!state.running) return; continue;
          }
        } else if (ud.role === "hunter") {
          desired = tmpA.copy(shipPos).sub(inv.position);
          const d = desired.length(); desired.normalize();
          // keep a strafing distance
          if (d < 35) desired.multiplyScalar(-1);
        } else {
          // drifter: wander slowly, but steer back toward the fight if it strays
          // out of engagement range, so an unshot drifter can never stall a wave
          if (inv.position.distanceTo(shipPos) > 170) {
            desired = tmpA.copy(shipPos).sub(inv.position).normalize();
          } else {
            desired = tmpA.copy(ud.vel).normalize();
            if (desired.lengthSq() < 0.01) desired.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          }
        }
        ud.vel.lerp(desired.multiplyScalar(ud.speed), 1 - Math.pow(0.2, dt));
        inv.position.addScaledVector(ud.vel, dt);
        inv.rotation.y += dt * ud.spin; inv.userData.ring.rotation.x += dt * 2;

        // hunter fire
        if (ud.role === "hunter") {
          ud.fireTimer -= dt;
          if (ud.fireTimer <= 0 && state.enemyFireBudget > 0.25 && inv.position.distanceTo(shipPos) < 160) {
            spawnEnemyBullet(inv); state.enemyFireBudget = 0;
            ud.fireTimer = 1.6 + Math.random() * 2;
          }
        }
      }

      // --- Player bullets ---
      for (let i = playerBullets.active.length - 1; i >= 0; i--) {
        const b = playerBullets.active[i];
        b.position.addScaledVector(b.userData.vel, dt);
        let hit = false;
        for (let j = invaderPool.active.length - 1; j >= 0; j--) {
          const inv = invaderPool.active[j];
          if (b.position.distanceToSquared(inv.position) < 2.2 * 2.2) {
            spawnExplosion(inv.position, inv.userData.core.material.color.getHex(), 16);
            Sfx.explosion();
            const dist = inv.position.distanceTo(shipPos);
            const points = inv.userData.role === "bomber" ? 75 : inv.userData.role === "hunter" ? 50 : 30;
            addScore(points, inv.position, "#ffd166");
            if (state.target === inv) state.target = null;
            invaderPool.release(inv); hit = true; break;
          }
        }
        if (!hit) for (const a of asteroids) {
          if (b.position.distanceToSquared(a.position) < (a.userData.radius + 0.4) ** 2) { spawnExplosion(b.position, 0x9a9a9a, 6); hit = true; break; }
        }
        if (hit || b.position.distanceToSquared(b.userData.from) > BULLET_RANGE * BULLET_RANGE) playerBullets.release(b);
      }

      // --- Enemy bullets ---
      for (let i = enemyBullets.active.length - 1; i >= 0; i--) {
        const b = enemyBullets.active[i];
        b.position.addScaledVector(b.userData.vel, dt);
        if (b.position.distanceToSquared(shipPos) < 2.2 * 2.2) {
          spawnExplosion(shipPos, 0xff5d73, 10); Sfx.playerHit(); enemyBullets.release(b);
          term("INCOMING FIRE — SHIELD " + Math.round(state.shield) + "%");
          damageHull(12); if (!state.running) return; continue;
        }
        if (b.position.distanceToSquared(b.userData.from) > ENEMY_BULLET_RANGE * ENEMY_BULLET_RANGE) enemyBullets.release(b);
      }

      // --- Asteroids (drift/spin) + ship collision ---
      for (const a of asteroids) {
        a.rotation.x += a.userData.spin.x * dt; a.rotation.y += a.userData.spin.y * dt; a.rotation.z += a.userData.spin.z * dt;
        a.position.addScaledVector(a.userData.drift, dt);
        if (a.position.lengthSq() > WORLD_R * WORLD_R) a.userData.drift.multiplyScalar(-1);
        const rr = a.userData.radius + 1.4;
        if (shipPos.distanceToSquared(a.position) < rr * rr) {
          tmpA.copy(shipPos).sub(a.position).normalize();
          shipPos.copy(a.position).addScaledVector(tmpA, rr + 0.2);
          shipVel.addScaledVector(tmpA, 14);
          spawnExplosion(shipPos, 0xffb86b, 8); Sfx.hit();
          damageHull(16 * dt * 60 * 0.02 + 8); if (!state.running) return;
        }
      }

      // --- Invader ram ---
      for (let j = invaderPool.active.length - 1; j >= 0; j--) {
        const inv = invaderPool.active[j];
        if (shipPos.distanceToSquared(inv.position) < 3 * 3) {
          spawnExplosion(inv.position, 0xff2d3a, 14); Sfx.explosion();
          if (state.target === inv) state.target = null;
          invaderPool.release(inv); damageHull(22); if (!state.running) return;
        }
      }

      // --- Targeting ---
      updateTarget();

      // --- Wave cleared ---
      if (state.toSpawn === 0 && invaderPool.active.length === 0) {
        Sfx.waveClear(); addScore(150);
        state.hull = Math.min(100, state.hull + 12); term("WAVE CLEARED — HULL REPAIRED");
        beginWave(state.wave + 1);
      }
    }

    // --- Particles (always) ---
    for (let i = particlePool.active.length - 1; i >= 0; i--) {
      const p = particlePool.active[i];
      p.userData.life -= dt; p.position.addScaledVector(p.userData.vel, dt);
      p.material.opacity = Math.max(0, p.userData.life / 0.6);
      if (p.userData.life <= 0) particlePool.release(p);
    }

    // --- Camera ---
    const fovTarget = controlAxes.boost && state.running ? FOV_BOOST : FOV_BASE;
    camera.fov = lerp(camera.fov, fovTarget, 1 - Math.pow(0.01, dt));
    camera.updateProjectionMatrix();

    if (state.cameraMode === "cockpit") {
      tmpA.set(0, 0.35, 0.1).applyQuaternion(shipQuat).add(shipPos);
      camera.position.copy(tmpA);
      camera.quaternion.copy(shipQuat);
    } else {
      tmpA.set(0, 1.8, 7).applyQuaternion(shipQuat).add(shipPos);
      camera.position.lerp(tmpA, 1 - Math.pow(0.0015, dt));
      tmpB.copy(shipPos).addScaledVector(forward, 12);
      tmpMat.lookAt(camera.position, tmpB, upV);
      tmpQ.setFromRotationMatrix(tmpMat);
      camera.quaternion.slerp(tmpQ, 1 - Math.pow(0.002, dt));
    }
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 2.2);
      camera.position.x += (Math.random() - 0.5) * state.shake;
      camera.position.y += (Math.random() - 0.5) * state.shake;
    }

    // --- HUD overlays ---
    if (state.running) { updateHudOverlays(); syncHud(); }
  }

  function updateHudOverlays() {
    // Lock box + distance + lead
    if (state.target) {
      const s = worldToScreen(state.target.position);
      if (s.visible) {
        ui.lockbox.style.display = "block";
        ui.lockbox.style.left = s.x + "px"; ui.lockbox.style.top = s.y + "px";
        ui.lockDist.textContent = Math.round(shipPos.distanceTo(state.target.position));
        // lead indicator
        const dist = shipPos.distanceTo(state.target.position);
        tmpA.copy(state.target.userData.vel).multiplyScalar(dist / BULLET_SPEED).add(state.target.position);
        const ls = worldToScreen(tmpA);
        if (ls.visible) { ui.lead.style.display = "block"; ui.lead.style.left = ls.x + "px"; ui.lead.style.top = ls.y + "px"; }
        else ui.lead.style.display = "none";
      } else { ui.lockbox.style.display = "none"; ui.lead.style.display = "none"; }
    } else { ui.lockbox.style.display = "none"; ui.lead.style.display = "none"; }

    // Radar
    const ctx = radarCtx, W = 150, H = 150, cx = W / 2, cy = H / 2, rad = 68;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(125,249,255,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad); ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy); ctx.stroke();
    // player triangle (forward = up)
    ctx.fillStyle = "#39ff8c"; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx + 4, cy + 4); ctx.closePath(); ctx.fill();
    tmpQ.copy(shipQuat).invert();
    const plot = (pos, color) => {
      tmpA.copy(pos).sub(shipPos);
      if (tmpA.lengthSq() > RADAR_RANGE * RADAR_RANGE) return;
      tmpA.applyQuaternion(tmpQ); // ship-local
      const px = cx + (tmpA.x / RADAR_RANGE) * rad;
      const py = cy - (-tmpA.z / RADAR_RANGE) * rad; // forward(-z) -> up
      ctx.fillStyle = color; ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    };
    for (const inv of invaderPool.active) plot(inv.position, inv.userData.role === "bomber" ? "#ff8c1a" : "#ff3340");
    for (const a of asteroids) plot(a.position, "rgba(150,150,160,0.7)");

    // Terminal: bearing of nearest hostile
    if (state.target && Math.random() < 0.01) {
      tmpA.copy(state.target.position).sub(shipPos).applyQuaternion(tmpQ);
      const side = tmpA.x > 4 ? "STARBOARD" : tmpA.x < -4 ? "PORT" : tmpA.z > 0 ? "ASTERN" : "AHEAD";
      term("HOSTILE OFF " + side);
    }
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    update(dt, clock.elapsedTime);

    renderer.clear();
    if (useBloom) composer.render(); else renderer.render(scene, camera);
    if (state.cameraMode === "cockpit") {
      cockpitCam.fov = camera.fov; cockpitCam.updateProjectionMatrix();
      renderer.clearDepth();
      renderer.render(cockpitScene, cockpitCam);
    }
  }

  // Idle menu pose: drift looking toward the planet
  shipPos.set(0, 0, 60);
  player.position.copy(shipPos);
  camera.position.set(0, 6, 90);
  camera.lookAt(planetGroup.position);
  player.visible = false;
  syncHud();
  loadAssets();
  animate();

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------
  window.addEventListener("resize", () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    cockpitCam.aspect = w / h; cockpitCam.updateProjectionMatrix();
    renderer.setSize(w, h); composer.setSize(w, h); bloomPass.setSize(w, h);
  });
