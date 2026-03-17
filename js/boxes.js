import * as THREE from 'three';

export function initBoxes(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060618);

  const w = container.clientWidth;
  const h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(8, 6, 8);
  camera.lookAt(0, -0.5, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x111133, 0.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x6688cc, 0.6);
  dirLight.position.set(5, 8, 5);
  scene.add(dirLight);

  const pointLight1 = new THREE.PointLight(0x60a5fa, 2, 20);
  pointLight1.position.set(3, 4, 3);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x818cf8, 1.5, 20);
  pointLight2.position.set(-3, 3, -2);
  scene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0x22d3ee, 1, 15);
  pointLight3.position.set(0, 2, -4);
  scene.add(pointLight3);

  const gridSize = 5;
  const spacing = 1.15;
  const boxes = [];
  const edgeGroup = new THREE.Group();
  scene.add(edgeGroup);

  const boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const px = (x - (gridSize - 1) / 2) * spacing;
      const pz = (z - (gridSize - 1) / 2) * spacing;

      const height = Math.random() * 0.4;
      const baseY = height / 2;

      const boxMat = new THREE.MeshStandardMaterial({
        color: 0x0d0d2b,
        metalness: 0.7,
        roughness: 0.3,
        transparent: true,
        opacity: 0.85
      });

      const mesh = new THREE.Mesh(boxGeo, boxMat);
      mesh.position.set(px, baseY, pz);
      scene.add(mesh);

      const edgeMat = new THREE.LineBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.35
      });
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      edges.position.copy(mesh.position);
      edgeGroup.add(edges);

      boxes.push({
        mesh,
        edges,
        baseY,
        targetY: baseY,
        currentY: baseY,
        baseEdgeOpacity: 0.35,
        x: px,
        z: pz,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  const mouse = new THREE.Vector2(-999, -999);
  const raycaster = new THREE.Raycaster();
  const hoverRadius = 2.5;

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  });

  container.addEventListener('mouseleave', () => {
    mouse.x = -999;
    mouse.y = -999;
  });

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersectPoint = new THREE.Vector3();

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    raycaster.setFromCamera(mouse, camera);
    const ray = raycaster.ray;
    ray.intersectPlane(plane, intersectPoint);

    for (const box of boxes) {
      const dx = box.x - intersectPoint.x;
      const dz = box.z - intersectPoint.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const hover = Math.max(0, 1 - dist / hoverRadius);
      const breathe = Math.sin(t * 0.8 + box.phase) * 0.05;

      box.targetY = box.baseY + hover * 1.2 + breathe;
      box.currentY += (box.targetY - box.currentY) * 0.08;

      box.mesh.position.y = box.currentY;
      box.edges.position.y = box.currentY;

      const edgeOpacity = box.baseEdgeOpacity + hover * 0.6;
      box.edges.material.opacity = edgeOpacity;

      if (hover > 0.1) {
        box.edges.material.color.setHex(0x22d3ee);
      } else {
        box.edges.material.color.setHex(0x60a5fa);
      }

      box.mesh.material.opacity = 0.85 + hover * 0.15;
    }

    pointLight1.position.x = 3 + Math.sin(t * 0.3) * 2;
    pointLight1.position.z = 3 + Math.cos(t * 0.3) * 2;
    pointLight2.position.x = -3 + Math.sin(t * 0.5 + 1) * 1.5;

    renderer.render(scene, camera);
  }

  animate();

  const particles = createParticles(scene);

  function createParticles(scene) {
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = Math.random() * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.03,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    return { points, positions, count };
  }

  function animateParticles() {
    requestAnimationFrame(animateParticles);
    const pos = particles.points.geometry.attributes.position.array;
    for (let i = 0; i < particles.count; i++) {
      pos[i * 3 + 1] += 0.003;
      if (pos[i * 3 + 1] > 8) pos[i * 3 + 1] = 0;
    }
    particles.points.geometry.attributes.position.needsUpdate = true;
  }
  animateParticles();

  window.addEventListener('resize', () => {
    const nw = container.clientWidth;
    const nh = container.clientHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
}
