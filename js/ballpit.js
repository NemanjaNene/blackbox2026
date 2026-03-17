import {
  Vector3, Vector2, MeshPhysicalMaterial, InstancedMesh, Clock,
  AmbientLight, SphereGeometry, ShaderChunk, Scene, Color, Object3D,
  SRGBColorSpace, MathUtils, PMREMGenerator, WebGLRenderer,
  PerspectiveCamera, PointLight, ACESFilmicToneMapping, Plane, Raycaster
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const { randFloat, randFloatSpread } = MathUtils;

class Physics {
  constructor(cfg) {
    this.cfg = cfg;
    this.pos = new Float32Array(3 * cfg.count).fill(0);
    this.vel = new Float32Array(3 * cfg.count).fill(0);
    this.sizes = new Float32Array(cfg.count).fill(1);
    this.center = new Vector3();
    this.initPositions();
    this.initSizes();
  }
  initPositions() {
    const { cfg, pos } = this;
    for (let i = 1; i < cfg.count; i++) {
      const b = 3 * i;
      pos[b] = randFloatSpread(2 * cfg.maxX);
      pos[b + 1] = randFloatSpread(2 * cfg.maxY);
      pos[b + 2] = randFloatSpread(2 * cfg.maxZ);
    }
  }
  initSizes() {
    const { cfg, sizes } = this;
    sizes[0] = cfg.size0;
    for (let i = 1; i < cfg.count; i++) sizes[i] = randFloat(cfg.minSize, cfg.maxSize);
  }
  update(dt) {
    const { cfg, center, pos, sizes, vel } = this;
    const _a = new Vector3(), _b = new Vector3(), _c = new Vector3();
    const _d = new Vector3(), _e = new Vector3(), _f = new Vector3();
    const _s0 = new Vector3();

    let start = 0;
    if (cfg.controlSphere0) {
      start = 1;
      _s0.fromArray(pos, 0).lerp(center, 0.1).toArray(pos, 0);
      vel[0] = vel[1] = vel[2] = 0;
    }

    for (let i = start; i < cfg.count; i++) {
      const b = 3 * i;
      _a.fromArray(pos, b);
      _b.fromArray(vel, b);
      _b.y -= dt.delta * cfg.gravity * sizes[i];
      _b.multiplyScalar(cfg.friction);
      _b.clampLength(0, cfg.maxVelocity);
      _a.add(_b);
      _a.toArray(pos, b);
      _b.toArray(vel, b);
    }

    for (let i = start; i < cfg.count; i++) {
      const bi = 3 * i;
      _a.fromArray(pos, bi);
      _b.fromArray(vel, bi);
      const ri = sizes[i];

      for (let j = i + 1; j < cfg.count; j++) {
        const bj = 3 * j;
        _c.fromArray(pos, bj);
        _d.fromArray(vel, bj);
        const rj = sizes[j];
        _e.copy(_c).sub(_a);
        const dist = _e.length();
        const sumR = ri + rj;
        if (dist < sumR) {
          const overlap = sumR - dist;
          _f.copy(_e).normalize().multiplyScalar(0.5 * overlap);
          const pushA = _f.clone().multiplyScalar(Math.max(_b.length(), 1));
          const pushB = _f.clone().multiplyScalar(Math.max(_d.length(), 1));
          _a.sub(_f); _b.sub(pushA);
          _a.toArray(pos, bi); _b.toArray(vel, bi);
          _c.add(_f); _d.add(pushB);
          _c.toArray(pos, bj); _d.toArray(vel, bj);
        }
      }

      if (cfg.controlSphere0) {
        _e.copy(_s0).sub(_a);
        const dist = _e.length();
        const sumR0 = ri + sizes[0];
        if (dist < sumR0) {
          const diff = sumR0 - dist;
          _f.copy(_e.normalize()).multiplyScalar(diff);
          const push = _f.clone().multiplyScalar(Math.max(_b.length(), 2));
          _a.sub(_f); _b.sub(push);
        }
      }

      if (Math.abs(_a.x) + ri > cfg.maxX) {
        _a.x = Math.sign(_a.x) * (cfg.maxX - ri);
        _b.x *= -cfg.wallBounce;
      }
      if (cfg.gravity === 0) {
        if (Math.abs(_a.y) + ri > cfg.maxY) {
          _a.y = Math.sign(_a.y) * (cfg.maxY - ri);
          _b.y *= -cfg.wallBounce;
        }
      } else if (_a.y - ri < -cfg.maxY) {
        _a.y = -cfg.maxY + ri;
        _b.y *= -cfg.wallBounce;
      }
      const maxBound = Math.max(cfg.maxZ, cfg.maxSize);
      if (Math.abs(_a.z) + ri > maxBound) {
        _a.z = Math.sign(_a.z) * (cfg.maxZ - ri);
        _b.z *= -cfg.wallBounce;
      }
      _a.toArray(pos, bi);
      _b.toArray(vel, bi);
    }
  }
}

class SSSMaterial extends MeshPhysicalMaterial {
  constructor(opts) {
    super(opts);
    this.uniforms = {
      thicknessDistortion: { value: 0.1 },
      thicknessAmbient: { value: 0 },
      thicknessAttenuation: { value: 0.1 },
      thicknessPower: { value: 2 },
      thicknessScale: { value: 10 }
    };
    this.defines.USE_UV = '';
    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader =
        `uniform float thicknessPower;
         uniform float thicknessScale;
         uniform float thicknessDistortion;
         uniform float thicknessAmbient;
         uniform float thicknessAttenuation;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `void RE_Direct_Scattering(const in IncidentLight directLight, const in vec2 uv, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, inout ReflectedLight reflectedLight) {
          vec3 scatteringHalf = normalize(directLight.direction + (geometryNormal * thicknessDistortion));
          float scatteringDot = pow(saturate(dot(geometryViewDir, -scatteringHalf)), thicknessPower) * thicknessScale;
          #ifdef USE_COLOR
            vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * vColor;
          #else
            vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * diffuse;
          #endif
          reflectedLight.directDiffuse += scatteringIllu * thicknessAttenuation * directLight.color;
        }
        void main() {`
      );
      const patched = ShaderChunk.lights_fragment_begin.replaceAll(
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
        `RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
         RE_Direct_Scattering(directLight, vUv, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);`
      );
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', patched);
    };
  }
}

function makeColorGradient(colors) {
  const cols = colors.map(c => new Color(c));
  return (ratio) => {
    const t = Math.max(0, Math.min(1, ratio)) * (cols.length - 1);
    const i = Math.floor(t);
    if (i >= cols.length - 1) return cols[cols.length - 1].clone();
    const a = t - i;
    const out = new Color();
    out.r = cols[i].r + a * (cols[i + 1].r - cols[i].r);
    out.g = cols[i].g + a * (cols[i + 1].g - cols[i].g);
    out.b = cols[i].b + a * (cols[i + 1].b - cols[i].b);
    return out;
  };
}

const DEFAULTS = {
  count: 100,
  colors: [0x060618, 0x3b82f6, 0x22d3ee],
  ambientColor: 0xffffff,
  ambientIntensity: 1,
  lightIntensity: 200,
  materialParams: { metalness: 0.5, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.15 },
  minSize: 0.5, maxSize: 1, size0: 1,
  gravity: 0.01, friction: 0.9975, wallBounce: 0.95,
  maxVelocity: 0.15, maxX: 5, maxY: 5, maxZ: 2,
  controlSphere0: false, followCursor: false
};

export function initBallpit(container, userOpts = {}) {
  const cfg = { ...DEFAULTS, ...userOpts };

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  container.appendChild(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  const env = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer, 0.04);
  const envMap = pmrem.fromScene(env).texture;

  const geo = new SphereGeometry();
  const mat = new SSSMaterial({ envMap, ...cfg.materialParams });
  mat.envMapRotation = { x: -Math.PI / 2, y: 0, z: 0 };
  const mesh = new InstancedMesh(geo, mat, cfg.count);
  scene.add(mesh);

  const ambient = new AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
  scene.add(ambient);
  const light = new PointLight(0x3b82f6, cfg.lightIntensity);
  scene.add(light);

  const physics = new Physics(cfg);

  if (cfg.colors.length > 1) {
    const getColor = makeColorGradient(cfg.colors);
    for (let i = 0; i < cfg.count; i++) {
      mesh.setColorAt(i, getColor(i / cfg.count));
      if (i === 0) light.color.copy(getColor(0));
    }
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const intersect = new Vector3();
  const mouseNDC = new Vector2(-999, -999);

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x == null) return;
    mouseNDC.x = ((x - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    camera.getWorldDirection(plane.normal);
    raycaster.ray.intersectPlane(plane, intersect);
    physics.center.copy(intersect);
    cfg.controlSphere0 = true;
  }
  function onPointerLeave() { cfg.controlSphere0 = false; }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('touchmove', onPointerMove, { passive: true });
  canvas.addEventListener('touchend', onPointerLeave);
  canvas.style.touchAction = 'none';

  const clock = new Clock();
  let wW = 0, wH = 0;

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;

    const maxAsp = 1.5;
    if (camera.aspect > maxAsp) {
      const t = Math.tan(MathUtils.degToRad(50 / 2)) / (camera.aspect / maxAsp);
      camera.fov = 2 * MathUtils.radToDeg(Math.atan(t));
    } else {
      camera.fov = 50;
    }

    camera.updateProjectionMatrix();
    const fovRad = (camera.fov * Math.PI) / 180;
    wH = 2 * Math.tan(fovRad / 2) * camera.position.length();
    wW = wH * camera.aspect;
    cfg.maxX = wW / 2;
    cfg.maxY = wH / 2;
  }

  resize();
  window.addEventListener('resize', resize);

  let raf;
  const dt = { delta: 0, elapsed: 0 };

  function animate() {
    raf = requestAnimationFrame(animate);
    dt.delta = clock.getDelta();
    dt.elapsed += dt.delta;

    physics.update(dt);
    for (let i = 0; i < cfg.count; i++) {
      dummy.position.fromArray(physics.pos, 3 * i);
      if (i === 0 && !cfg.followCursor) {
        dummy.scale.setScalar(0);
      } else {
        dummy.scale.setScalar(physics.sizes[i]);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (i === 0) light.position.copy(dummy.position);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }

  clock.start();
  animate();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    renderer.dispose();
    canvas.remove();
  };
}
