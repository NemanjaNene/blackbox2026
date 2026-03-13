import * as THREE from 'three';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset } from 'postprocessing';

const random = base => {
  if (Array.isArray(base)) return Math.random() * (base[1] - base[0]) + base[0];
  return Math.random() * base;
};
const pickRandom = arr => Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr;
function lerp(current, target, speed = 0.1, limit = 0.001) {
  let change = (target - current) * speed;
  if (Math.abs(change) < limit) change = target - current;
  return change;
}
let nsin = val => Math.sin(val) * 0.5 + 0.5;

function resizeRendererToDisplaySize(renderer, setSize) {
  const canvas = renderer.domElement;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return false;
  const need = canvas.width !== w || canvas.height !== h;
  if (need) setSize(w, h, false);
  return need;
}

/* ========== SHADERS ========== */

const carLightsFragment = `
#define USE_FOG;
${THREE.ShaderChunk['fog_pars_fragment']}
varying vec3 vColor;
varying vec2 vUv;
uniform vec2 uFade;
void main() {
  vec3 color = vec3(vColor);
  float alpha = smoothstep(uFade.x, uFade.y, vUv.x);
  gl_FragColor = vec4(color, alpha);
  if (gl_FragColor.a < 0.0001) discard;
  ${THREE.ShaderChunk['fog_fragment']}
}`;

const carLightsVertex = `
#define USE_FOG;
${THREE.ShaderChunk['fog_pars_vertex']}
attribute vec3 aOffset;
attribute vec3 aMetrics;
attribute vec3 aColor;
uniform float uTravelLength;
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
#include <getDistortion_vertex>
void main() {
  vec3 transformed = position.xyz;
  float radius = aMetrics.r;
  float myLength = aMetrics.g;
  float speed = aMetrics.b;
  transformed.xy *= radius;
  transformed.z *= myLength;
  transformed.z += myLength - mod(uTime * speed + aOffset.z, uTravelLength);
  transformed.xy += aOffset.xy;
  float progress = abs(transformed.z / uTravelLength);
  transformed.xyz += getDistortion(progress);
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
  gl_Position = projectionMatrix * mvPosition;
  vUv = uv;
  vColor = aColor;
  ${THREE.ShaderChunk['fog_vertex']}
}`;

const sideSticksVertex = `
#define USE_FOG;
${THREE.ShaderChunk['fog_pars_vertex']}
attribute float aOffset;
attribute vec3 aColor;
attribute vec2 aMetrics;
uniform float uTravelLength;
uniform float uTime;
varying vec3 vColor;
mat4 rotationY(in float angle){
  return mat4(cos(angle),0,sin(angle),0, 0,1,0,0, -sin(angle),0,cos(angle),0, 0,0,0,1);
}
#include <getDistortion_vertex>
void main(){
  vec3 transformed = position.xyz;
  float width = aMetrics.x;
  float height = aMetrics.y;
  transformed.xy *= vec2(width, height);
  float time = mod(uTime * 60. * 2. + aOffset, uTravelLength);
  transformed = (rotationY(3.14/2.) * vec4(transformed,1.)).xyz;
  transformed.z += -uTravelLength + time;
  float progress = abs(transformed.z / uTravelLength);
  transformed.xyz += getDistortion(progress);
  transformed.y += height / 2.;
  transformed.x += -width / 2.;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
  gl_Position = projectionMatrix * mvPosition;
  vColor = aColor;
  ${THREE.ShaderChunk['fog_vertex']}
}`;

const sideSticksFragment = `
#define USE_FOG;
${THREE.ShaderChunk['fog_pars_fragment']}
varying vec3 vColor;
void main(){
  gl_FragColor = vec4(vColor, 1.);
  ${THREE.ShaderChunk['fog_fragment']}
}`;

const roadMarkings_vars = `
uniform float uLanes;
uniform vec3 uBrokenLinesColor;
uniform vec3 uShoulderLinesColor;
uniform float uShoulderLinesWidthPercentage;
uniform float uBrokenLinesWidthPercentage;
uniform float uBrokenLinesLengthPercentage;
`;

const roadMarkings_fragment = `
uv.y = mod(uv.y + uTime * 0.05, 1.);
float laneWidth = 1.0 / uLanes;
float brokenLineWidth = laneWidth * uBrokenLinesWidthPercentage;
float laneEmptySpace = 1. - uBrokenLinesLengthPercentage;
float brokenLines = step(1.0 - brokenLineWidth, fract(uv.x * 2.0)) * step(laneEmptySpace, fract(uv.y * 10.0));
float sideLines = step(1.0 - brokenLineWidth, fract((uv.x - laneWidth * (uLanes - 1.0)) * 2.0)) + step(brokenLineWidth, uv.x);
brokenLines = mix(brokenLines, sideLines, uv.x);
`;

const roadBaseFragment = `
#define USE_FOG;
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
#include <roadMarkings_vars>
${THREE.ShaderChunk['fog_pars_fragment']}
void main() {
  vec2 uv = vUv;
  vec3 color = vec3(uColor);
  #include <roadMarkings_fragment>
  gl_FragColor = vec4(color, 1.);
  ${THREE.ShaderChunk['fog_fragment']}
}`;

const islandFragment = roadBaseFragment
  .replace('#include <roadMarkings_fragment>', '')
  .replace('#include <roadMarkings_vars>', '');

const roadFragment = roadBaseFragment
  .replace('#include <roadMarkings_fragment>', roadMarkings_fragment)
  .replace('#include <roadMarkings_vars>', roadMarkings_vars);

const roadVertex = `
#define USE_FOG;
uniform float uTime;
${THREE.ShaderChunk['fog_pars_vertex']}
uniform float uTravelLength;
varying vec2 vUv;
#include <getDistortion_vertex>
void main() {
  vec3 transformed = position.xyz;
  vec3 distortion = getDistortion((transformed.y + uTravelLength / 2.) / uTravelLength);
  transformed.x += distortion.x;
  transformed.z += distortion.y;
  transformed.y += -1. * distortion.z;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
  gl_Position = projectionMatrix * mvPosition;
  vUv = uv;
  ${THREE.ShaderChunk['fog_vertex']}
}`;

/* ========== DISTORTIONS ========== */

const mountainUniforms = { uFreq: { value: new THREE.Vector3(3,6,10) }, uAmp: { value: new THREE.Vector3(30,30,20) } };
const xyUniforms = { uFreq: { value: new THREE.Vector2(5,2) }, uAmp: { value: new THREE.Vector2(25,15) } };
const LongRaceUniforms = { uFreq: { value: new THREE.Vector2(2,3) }, uAmp: { value: new THREE.Vector2(35,10) } };
const turbulentUniforms = { uFreq: { value: new THREE.Vector4(4,8,8,1) }, uAmp: { value: new THREE.Vector4(25,5,10,10) } };
const deepUniforms = { uFreq: { value: new THREE.Vector2(4,8) }, uAmp: { value: new THREE.Vector2(10,20) }, uPowY: { value: new THREE.Vector2(20,2) } };

const distortions = {
  mountainDistortion: {
    uniforms: mountainUniforms,
    getDistortion: `
      uniform vec3 uAmp; uniform vec3 uFreq;
      #define PI 3.14159265358979
      float nsin(float val){ return sin(val)*0.5+0.5; }
      vec3 getDistortion(float progress){
        float f=0.02;
        return vec3(
          cos(progress*PI*uFreq.x+uTime)*uAmp.x - cos(f*PI*uFreq.x+uTime)*uAmp.x,
          nsin(progress*PI*uFreq.y+uTime)*uAmp.y - nsin(f*PI*uFreq.y+uTime)*uAmp.y,
          nsin(progress*PI*uFreq.z+uTime)*uAmp.z - nsin(f*PI*uFreq.z+uTime)*uAmp.z
        );
      }`,
    getJS: (progress, time) => {
      let f=0.02, uF=mountainUniforms.uFreq.value, uA=mountainUniforms.uAmp.value;
      let d = new THREE.Vector3(
        Math.cos(progress*Math.PI*uF.x+time)*uA.x - Math.cos(f*Math.PI*uF.x+time)*uA.x,
        nsin(progress*Math.PI*uF.y+time)*uA.y - nsin(f*Math.PI*uF.y+time)*uA.y,
        nsin(progress*Math.PI*uF.z+time)*uA.z - nsin(f*Math.PI*uF.z+time)*uA.z
      );
      return d.multiply(new THREE.Vector3(2,2,2)).add(new THREE.Vector3(0,0,-5));
    }
  },
  xyDistortion: {
    uniforms: xyUniforms,
    getDistortion: `
      uniform vec2 uFreq; uniform vec2 uAmp;
      #define PI 3.14159265358979
      vec3 getDistortion(float progress){
        float f=0.02;
        return vec3(
          cos(progress*PI*uFreq.x+uTime)*uAmp.x - cos(f*PI*uFreq.x+uTime)*uAmp.x,
          sin(progress*PI*uFreq.y+PI/2.+uTime)*uAmp.y - sin(f*PI*uFreq.y+PI/2.+uTime)*uAmp.y,
          0.);
      }`,
    getJS: (progress, time) => {
      let f=0.02, uF=xyUniforms.uFreq.value, uA=xyUniforms.uAmp.value;
      let d = new THREE.Vector3(
        Math.cos(progress*Math.PI*uF.x+time)*uA.x - Math.cos(f*Math.PI*uF.x+time)*uA.x,
        Math.sin(progress*Math.PI*uF.y+time+Math.PI/2)*uA.y - Math.sin(f*Math.PI*uF.y+time+Math.PI/2)*uA.y,
        0);
      return d.multiply(new THREE.Vector3(2,0.4,1)).add(new THREE.Vector3(0,0,-3));
    }
  },
  LongRaceDistortion: {
    uniforms: LongRaceUniforms,
    getDistortion: `
      uniform vec2 uFreq; uniform vec2 uAmp;
      #define PI 3.14159265358979
      vec3 getDistortion(float progress){
        float c=0.0125;
        return vec3(
          sin(progress*PI*uFreq.x+uTime)*uAmp.x - sin(c*PI*uFreq.x+uTime)*uAmp.x,
          sin(progress*PI*uFreq.y+uTime)*uAmp.y - sin(c*PI*uFreq.y+uTime)*uAmp.y,
          0.);
      }`,
    getJS: (progress, time) => {
      let c=0.0125, uF=LongRaceUniforms.uFreq.value, uA=LongRaceUniforms.uAmp.value;
      let d = new THREE.Vector3(
        Math.sin(progress*Math.PI*uF.x+time)*uA.x - Math.sin(c*Math.PI*uF.x+time)*uA.x,
        Math.sin(progress*Math.PI*uF.y+time)*uA.y - Math.sin(c*Math.PI*uF.y+time)*uA.y,
        0);
      return d.multiply(new THREE.Vector3(1,1,0)).add(new THREE.Vector3(0,0,-5));
    }
  },
  turbulentDistortion: {
    uniforms: turbulentUniforms,
    getDistortion: `
      uniform vec4 uFreq; uniform vec4 uAmp;
      float nsin(float val){ return sin(val)*0.5+0.5; }
      #define PI 3.14159265358979
      float getDistortionX(float progress){
        return (cos(PI*progress*uFreq.r+uTime)*uAmp.r + pow(cos(PI*progress*uFreq.g+uTime*(uFreq.g/uFreq.r)),2.)*uAmp.g);
      }
      float getDistortionY(float progress){
        return (-nsin(PI*progress*uFreq.b+uTime)*uAmp.b + -pow(nsin(PI*progress*uFreq.a+uTime/(uFreq.b/uFreq.a)),5.)*uAmp.a);
      }
      vec3 getDistortion(float progress){
        return vec3(getDistortionX(progress)-getDistortionX(0.0125), getDistortionY(progress)-getDistortionY(0.0125), 0.);
      }`,
    getJS: (progress, time) => {
      const uF = turbulentUniforms.uFreq.value, uA = turbulentUniforms.uAmp.value;
      const getX = p => Math.cos(Math.PI*p*uF.x+time)*uA.x + Math.pow(Math.cos(Math.PI*p*uF.y+time*(uF.y/uF.x)),2)*uA.y;
      const getY = p => -nsin(Math.PI*p*uF.z+time)*uA.z - Math.pow(nsin(Math.PI*p*uF.w+time/(uF.z/uF.w)),5)*uA.w;
      let d = new THREE.Vector3(getX(progress)-getX(progress+0.007), getY(progress)-getY(progress+0.007), 0);
      return d.multiply(new THREE.Vector3(-2,-5,0)).add(new THREE.Vector3(0,0,-10));
    }
  },
  deepDistortion: {
    uniforms: deepUniforms,
    getDistortion: `
      uniform vec4 uFreq; uniform vec4 uAmp; uniform vec2 uPowY;
      float nsin(float val){ return sin(val)*0.5+0.5; }
      #define PI 3.14159265358979
      float getDistortionX(float progress){ return sin(progress*PI*uFreq.x+uTime)*uAmp.x; }
      float getDistortionY(float progress){ return pow(abs(progress*uPowY.x),uPowY.y)+sin(progress*PI*uFreq.y+uTime)*uAmp.y; }
      vec3 getDistortion(float progress){
        return vec3(getDistortionX(progress)-getDistortionX(0.02), getDistortionY(progress)-getDistortionY(0.02), 0.);
      }`,
    getJS: (progress, time) => {
      const uF=deepUniforms.uFreq.value, uA=deepUniforms.uAmp.value, uP=deepUniforms.uPowY.value;
      const getX = p => Math.sin(p*Math.PI*uF.x+time)*uA.x;
      const getY = p => Math.pow(p*uP.x,uP.y)+Math.sin(p*Math.PI*uF.y+time)*uA.y;
      let d = new THREE.Vector3(getX(progress)-getX(progress+0.01), getY(progress)-getY(progress+0.01), 0);
      return d.multiply(new THREE.Vector3(-2,-4,0)).add(new THREE.Vector3(0,0,-10));
    }
  }
};

/* ========== CLASSES ========== */

class CarLights {
  constructor(webgl, options, colors, speed, fade) {
    this.webgl = webgl; this.options = options; this.colors = colors; this.speed = speed; this.fade = fade;
  }
  init() {
    const o = this.options;
    let curve = new THREE.LineCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1));
    let geo = new THREE.TubeGeometry(curve, 40, 1, 8, false);
    let inst = new THREE.InstancedBufferGeometry().copy(geo);
    inst.instanceCount = o.lightPairsPerRoadWay * 2;
    let laneW = o.roadWidth / o.lanesPerRoad;
    let aOff=[], aMet=[], aCol=[];
    let colors = Array.isArray(this.colors) ? this.colors.map(c=>new THREE.Color(c)) : new THREE.Color(this.colors);
    for (let i=0; i<o.lightPairsPerRoadWay; i++) {
      let r=random(o.carLightsRadius), l=random(o.carLightsLength), s=random(this.speed);
      let lane=i%o.lanesPerRoad, lx=lane*laneW-o.roadWidth/2+laneW/2;
      let cw=random(o.carWidthPercentage)*laneW, cs=random(o.carShiftX)*laneW;
      lx+=cs;
      let oy=random(o.carFloorSeparation)+r*1.3, oz=-random(o.length);
      aOff.push(lx-cw/2,oy,oz, lx+cw/2,oy,oz);
      aMet.push(r,l,s, r,l,s);
      let c=pickRandom(colors);
      aCol.push(c.r,c.g,c.b, c.r,c.g,c.b);
    }
    inst.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(aOff),3,false));
    inst.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMet),3,false));
    inst.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(aCol),3,false));
    let mat = new THREE.ShaderMaterial({
      fragmentShader: carLightsFragment, vertexShader: carLightsVertex, transparent: true,
      uniforms: Object.assign({ uTime:{value:0}, uTravelLength:{value:o.length}, uFade:{value:this.fade} }, this.webgl.fogUniforms, o.distortion.uniforms)
    });
    mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <getDistortion_vertex>', o.distortion.getDistortion); };
    let mesh = new THREE.Mesh(inst, mat);
    mesh.frustumCulled = false;
    this.webgl.scene.add(mesh);
    this.mesh = mesh;
  }
  update(t) { this.mesh.material.uniforms.uTime.value = t; }
}

class LightsSticks {
  constructor(webgl, options) { this.webgl = webgl; this.options = options; }
  init() {
    const o = this.options;
    const geo = new THREE.PlaneGeometry(1,1);
    let inst = new THREE.InstancedBufferGeometry().copy(geo);
    let total = o.totalSideLightSticks;
    inst.instanceCount = total;
    let stickOff = o.length/(total-1);
    let aOff=[], aCol=[], aMet=[];
    let colors = Array.isArray(o.colors.sticks) ? o.colors.sticks.map(c=>new THREE.Color(c)) : new THREE.Color(o.colors.sticks);
    for (let i=0; i<total; i++) {
      let w=random(o.lightStickWidth), h=random(o.lightStickHeight);
      aOff.push((i-1)*stickOff*2+stickOff*Math.random());
      let c=pickRandom(colors);
      aCol.push(c.r,c.g,c.b);
      aMet.push(w,h);
    }
    inst.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(aOff),1,false));
    inst.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(aCol),3,false));
    inst.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMet),2,false));
    const mat = new THREE.ShaderMaterial({
      fragmentShader: sideSticksFragment, vertexShader: sideSticksVertex, side: THREE.DoubleSide,
      uniforms: Object.assign({ uTravelLength:{value:o.length}, uTime:{value:0} }, this.webgl.fogUniforms, o.distortion.uniforms)
    });
    mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <getDistortion_vertex>', o.distortion.getDistortion); };
    const mesh = new THREE.Mesh(inst, mat);
    mesh.frustumCulled = false;
    this.webgl.scene.add(mesh);
    this.mesh = mesh;
  }
  update(t) { this.mesh.material.uniforms.uTime.value = t; }
}

class Road {
  constructor(webgl, options) { this.webgl = webgl; this.options = options; this.uTime = {value:0}; }
  createPlane(side, width, isRoad) {
    const o = this.options;
    const geo = new THREE.PlaneGeometry(isRoad?o.roadWidth:o.islandWidth, o.length, 20, 100);
    let u = { uTravelLength:{value:o.length}, uColor:{value:new THREE.Color(isRoad?o.colors.roadColor:o.colors.islandColor)}, uTime:this.uTime };
    if (isRoad) Object.assign(u, {
      uLanes:{value:o.lanesPerRoad}, uBrokenLinesColor:{value:new THREE.Color(o.colors.brokenLines)},
      uShoulderLinesColor:{value:new THREE.Color(o.colors.shoulderLines)},
      uShoulderLinesWidthPercentage:{value:o.shoulderLinesWidthPercentage},
      uBrokenLinesLengthPercentage:{value:o.brokenLinesLengthPercentage},
      uBrokenLinesWidthPercentage:{value:o.brokenLinesWidthPercentage}
    });
    const mat = new THREE.ShaderMaterial({
      fragmentShader: isRoad?roadFragment:islandFragment, vertexShader: roadVertex, side: THREE.DoubleSide,
      uniforms: Object.assign(u, this.webgl.fogUniforms, o.distortion.uniforms)
    });
    mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <getDistortion_vertex>', o.distortion.getDistortion); };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI/2;
    mesh.position.z = -o.length/2;
    mesh.position.x += (o.islandWidth/2+o.roadWidth/2)*side;
    this.webgl.scene.add(mesh);
    return mesh;
  }
  init() {
    this.leftRoadWay = this.createPlane(-1, this.options.roadWidth, true);
    this.rightRoadWay = this.createPlane(1, this.options.roadWidth, true);
    this.island = this.createPlane(0, this.options.islandWidth, false);
  }
  update(t) { this.uTime.value = t; }
}

class App {
  constructor(container, options) {
    this.options = options;
    this.container = container;
    this.hasValidSize = false;
    const w = Math.max(1, container.offsetWidth), h = Math.max(1, container.offsetHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.composer = new EffectComposer(this.renderer);
    container.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(options.fov, w/h, 0.1, 10000);
    this.camera.position.set(0, 8, -5);
    this.scene = new THREE.Scene();
    this.scene.background = null;
    let fog = new THREE.Fog(options.colors.background, options.length*0.2, options.length*500);
    this.scene.fog = fog;
    this.fogUniforms = { fogColor:{value:fog.color}, fogNear:{value:fog.near}, fogFar:{value:fog.far} };
    this.clock = new THREE.Clock();
    this.disposed = false;
    this.road = new Road(this, options);
    this.leftCarLights = new CarLights(this, options, options.colors.leftCars, options.movingAwaySpeed, new THREE.Vector2(0, 1-options.carLightsFade));
    this.rightCarLights = new CarLights(this, options, options.colors.rightCars, options.movingCloserSpeed, new THREE.Vector2(1, 0+options.carLightsFade));
    this.leftSticks = new LightsSticks(this, options);
    this.fovTarget = options.fov;
    this.speedUpTarget = 0;
    this.speedUp = 0;
    this.timeOffset = 0;
    this.tick = this.tick.bind(this);
    this.init = this.init.bind(this);
    this.setSize = this.setSize.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    if (w > 0 && h > 0) this.hasValidSize = true;
  }
  onResize() {
    const w=this.container.offsetWidth, h=this.container.offsetHeight;
    if (w<=0||h<=0) { this.hasValidSize=false; return; }
    this.renderer.setSize(w,h);
    this.camera.aspect=w/h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w,h);
    this.hasValidSize=true;
  }
  initPasses() {
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new EffectPass(this.camera, new BloomEffect({ luminanceThreshold:0.2, luminanceSmoothing:0, resolutionScale:1 }));
    const smaa = new EffectPass(this.camera, new SMAAEffect({ preset:SMAAPreset.MEDIUM }));
    this.renderPass.renderToScreen = false;
    this.bloomPass.renderToScreen = false;
    smaa.renderToScreen = true;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(smaa);
  }
  init() {
    this.initPasses();
    const o = this.options;
    this.road.init();
    this.leftCarLights.init();
    this.leftCarLights.mesh.position.setX(-o.roadWidth/2-o.islandWidth/2);
    this.rightCarLights.init();
    this.rightCarLights.mesh.position.setX(o.roadWidth/2+o.islandWidth/2);
    this.leftSticks.init();
    this.leftSticks.mesh.position.setX(-(o.roadWidth+o.islandWidth/2));
    this.container.addEventListener('mousedown', this.onMouseDown);
    this.container.addEventListener('mouseup', this.onMouseUp);
    this.container.addEventListener('mouseout', this.onMouseUp);
    this.container.addEventListener('touchstart', this.onMouseDown, {passive:true});
    this.container.addEventListener('touchend', this.onMouseUp, {passive:true});
    this.tick();
  }
  onMouseDown() { this.fovTarget=this.options.fovSpeedUp; this.speedUpTarget=this.options.speedUp; }
  onMouseUp() { this.fovTarget=this.options.fov; this.speedUpTarget=0; }
  update(delta) {
    let lp = Math.exp(-(-60*Math.log2(1-0.1))*delta);
    this.speedUp += lerp(this.speedUp, this.speedUpTarget, lp, 0.00001);
    this.timeOffset += this.speedUp*delta;
    let time = this.clock.elapsedTime+this.timeOffset;
    this.rightCarLights.update(time);
    this.leftCarLights.update(time);
    this.leftSticks.update(time);
    this.road.update(time);
    let uc=false;
    let fc=lerp(this.camera.fov, this.fovTarget, lp);
    if(fc!==0){ this.camera.fov+=fc*delta*6; uc=true; }
    if(this.options.distortion.getJS){
      const d=this.options.distortion.getJS(0.025,time);
      this.camera.lookAt(new THREE.Vector3(this.camera.position.x+d.x, this.camera.position.y+d.y, this.camera.position.z+d.z));
      uc=true;
    }
    if(uc) this.camera.updateProjectionMatrix();
  }
  render(delta) { this.composer.render(delta); }
  dispose() {
    this.disposed=true;
    this.scene.traverse(o=>{if(!o.isMesh)return;if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
    this.scene.clear();
    this.renderer.dispose(); this.renderer.forceContextLoss();
    if(this.renderer.domElement?.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    if(this.composer) this.composer.dispose();
    window.removeEventListener('resize', this.onResize);
    this.container.removeEventListener('mousedown', this.onMouseDown);
    this.container.removeEventListener('mouseup', this.onMouseUp);
    this.container.removeEventListener('mouseout', this.onMouseUp);
    this.container.removeEventListener('touchstart', this.onMouseDown);
    this.container.removeEventListener('touchend', this.onMouseUp);
  }
  setSize(w,h,s){ if(w<=0||h<=0){this.hasValidSize=false;return;} this.composer.setSize(w,h,s); this.hasValidSize=true; }
  tick() {
    if(this.disposed)return;
    if(!this.hasValidSize){
      const w=this.container.offsetWidth,h=this.container.offsetHeight;
      if(w>0&&h>0){this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.composer.setSize(w,h);this.hasValidSize=true;}
      else{requestAnimationFrame(this.tick);return;}
    }
    if(resizeRendererToDisplaySize(this.renderer,this.setSize)){
      const c=this.renderer.domElement;
      if(this.hasValidSize){this.camera.aspect=c.clientWidth/c.clientHeight;this.camera.updateProjectionMatrix();}
    }
    if(this.hasValidSize){const d=this.clock.getDelta();this.render(d);this.update(d);}
    requestAnimationFrame(this.tick);
  }
}

/* ========== PUBLIC API ========== */

export function initHyperspeed(container, effectOptions = {}) {
  const defaults = {
    distortion: 'turbulentDistortion',
    length: 400, roadWidth: 9, islandWidth: 2, lanesPerRoad: 3,
    fov: 90, fovSpeedUp: 150, speedUp: 2, carLightsFade: 0.4,
    totalSideLightSticks: 50, lightPairsPerRoadWay: 50,
    shoulderLinesWidthPercentage: 0.05, brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12,0.5], lightStickHeight: [1.3,1.7],
    movingAwaySpeed: [60,80], movingCloserSpeed: [-120,-160],
    carLightsLength: [400*0.05,400*0.15], carLightsRadius: [0.05,0.14],
    carWidthPercentage: [0.3,0.5], carShiftX: [-0.2,0.2],
    carFloorSeparation: [0.05,1],
    colors: {
      roadColor: 0x080808, islandColor: 0x0a0a0a, background: 0x000000,
      shoulderLines: 0x131318, brokenLines: 0x131318,
      leftCars: [0xdc5b20,0xdca320,0xdc2020],
      rightCars: [0x334bf7,0xe5e6ed,0xbfc6f3],
      sticks: 0xc5e8eb
    }
  };

  const options = { ...defaults, ...effectOptions, colors: { ...defaults.colors, ...(effectOptions.colors||{}) } };
  options.distortion = distortions[options.distortion] || distortions.turbulentDistortion;

  const app = new App(container, options);
  app.init();
  return () => app.dispose();
}
