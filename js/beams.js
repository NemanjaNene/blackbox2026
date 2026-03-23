import * as THREE from 'three';

const noise = `
float random2(in vec2 st){return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);}
float noise2(in vec2 st){
  vec2 i=floor(st);vec2 f=fract(st);
  float a=random2(i);float b=random2(i+vec2(1.,0.));
  float c=random2(i+vec2(0.,1.));float d=random2(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
}
vec4 permute(vec4 x){return mod(((x*34.)+1.)*x,289.);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.-15.)+10.);}
float cnoise(vec3 P){
  vec3 Pi0=floor(P);vec3 Pi1=Pi0+vec3(1.);
  Pi0=mod(Pi0,289.);Pi1=mod(Pi1,289.);
  vec3 Pf0=fract(P);vec3 Pf1=Pf0-vec3(1.);
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);
  vec4 iy=vec4(Pi0.yy,Pi1.yy);
  vec4 iz0=Pi0.zzzz;vec4 iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy);
  vec4 ixy0=permute(ixy+iz0);vec4 ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0/7.;vec4 gy0=fract(floor(gx0)/7.)-.5;gx0=fract(gx0);
  vec4 gz0=vec4(.5)-abs(gx0)-abs(gy0);vec4 sz0=step(gz0,vec4(0.));
  gx0-=sz0*(step(0.,gx0)-.5);gy0-=sz0*(step(0.,gy0)-.5);
  vec4 gx1=ixy1/7.;vec4 gy1=fract(floor(gx1)/7.)-.5;gx1=fract(gx1);
  vec4 gz1=vec4(.5)-abs(gx1)-abs(gy1);vec4 sz1=step(gz1,vec4(0.));
  gx1-=sz1*(step(0.,gx1)-.5);gy1-=sz1*(step(0.,gy1)-.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x);vec3 g100=vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010=vec3(gx0.z,gy0.z,gz0.z);vec3 g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x);vec3 g101=vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011=vec3(gx1.z,gy1.z,gz1.z);vec3 g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=norm0.x;g010*=norm0.y;g100*=norm0.z;g110*=norm0.w;
  vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=norm1.x;g011*=norm1.y;g101*=norm1.z;g111*=norm1.w;
  float n000=dot(g000,Pf0);float n100=dot(g100,vec3(Pf1.x,Pf0.yz));
  float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z));float n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z));float n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011=dot(g011,vec3(Pf0.x,Pf1.yz));float n111=dot(g111,Pf1);
  vec3 fade_xyz=fade(Pf0);
  vec4 n_z=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz=mix(n_z.xy,n_z.zw,fade_xyz.y);
  return 2.2*mix(n_yz.x,n_yz.y,fade_xyz.x);
}
`;

function createStackedPlanes(n, width, height, heightSegs) {
  const geo = new THREE.BufferGeometry();
  const vCount = n * (heightSegs + 1) * 2;
  const fCount = n * heightSegs * 2;
  const pos = new Float32Array(vCount * 3);
  const idx = new Uint32Array(fCount * 3);
  const uvs = new Float32Array(vCount * 2);

  let vi = 0, ii = 0, ui = 0;
  const totalW = n * width;
  const xBase = -totalW / 2;

  for (let i = 0; i < n; i++) {
    const xOff = xBase + i * width;
    const uvXOff = Math.random() * 300;
    const uvYOff = Math.random() * 300;

    for (let j = 0; j <= heightSegs; j++) {
      const y = height * (j / heightSegs - 0.5);
      pos.set([xOff, y, 0, xOff + width, y, 0], vi * 3);
      const uvY = j / heightSegs;
      uvs.set([uvXOff, uvY + uvYOff, uvXOff + 1, uvY + uvYOff], ui);

      if (j < heightSegs) {
        idx.set([vi, vi + 1, vi + 2, vi + 2, vi + 1, vi + 3], ii);
        ii += 6;
      }
      vi += 2;
      ui += 4;
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

export function initBeams(container, {
  beamWidth = 3,
  beamHeight = 30,
  beamNumber = 20,
  lightColor = '#ffffff',
  speed = 2,
  noiseIntensity = 1.75,
  scale = 0.2,
  rotation = 30
} = {}) {
  if (!container) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 20);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(new THREE.Color(lightColor), 1);
  dirLight.position.set(0, 3, 10);
  scene.add(dirLight);

  const geo = createStackedPlanes(beamNumber, beamWidth, beamHeight, 100);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.3,
    metalness: 0.3
  });

  const timeUniform = { value: 0 };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.time = timeUniform;
    shader.uniforms.uSpeed = { value: speed };
    shader.uniforms.uNoiseIntensity = { value: noiseIntensity };
    shader.uniforms.uScale = { value: scale };

    const preamble = `
      uniform float time;
      uniform float uSpeed;
      uniform float uNoiseIntensity;
      uniform float uScale;
      ${noise}
    `;

    shader.vertexShader = preamble + shader.vertexShader;
    shader.fragmentShader = preamble + shader.fragmentShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 nPos = vec3(transformed.x * 0., transformed.y - uv.y, transformed.z + time * uSpeed * 3.) * uScale;
       transformed.z += cnoise(nPos);`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
       {
         vec3 cp = position;
         vec3 np1 = position + vec3(0.01, 0.0, 0.0);
         vec3 np2 = position + vec3(0.0, -0.01, 0.0);
         vec3 cnp = vec3(cp.x*0., cp.y-uv.y, cp.z+time*uSpeed*3.)*uScale;
         vec3 cnp1 = vec3(np1.x*0., np1.y-uv.y, np1.z+time*uSpeed*3.)*uScale;
         vec3 cnp2 = vec3(np2.x*0., np2.y-uv.y, np2.z+time*uSpeed*3.)*uScale;
         vec3 curP = cp; curP.z += cnoise(cnp);
         vec3 nextX = np1; nextX.z += cnoise(cnp1);
         vec3 nextZ = np2; nextZ.z += cnoise(cnp2);
         objectNormal = normalize(cross(normalize(nextZ-curP), normalize(nextX-curP)));
       }`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       float rn = noise2(gl_FragCoord.xy);
       gl_FragColor.rgb -= rn / 15. * uNoiseIntensity;`
    );
  };

  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.rotation.z = THREE.MathUtils.degToRad(rotation);
  group.add(mesh);
  scene.add(group);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let running = true;
  const clock = new THREE.Clock();

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    timeUniform.value += clock.getDelta() * 0.1;
    renderer.render(scene, camera);
  }
  animate();

  return () => {
    running = false;
    ro.disconnect();
    renderer.dispose();
    geo.dispose();
    mat.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  };
}
