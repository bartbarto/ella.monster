import * as THREE from 'three';
import { updateFavicon } from './favicon.js';

const MONSTER_COLOR = 0x5a1888;
const CONTRAST_COLOR = 0x00bb0a;
const BLOB_RADIUS = 2.62;
const BLOB_SQUASH = 1;
const BLOB_CENTER_Y = BLOB_RADIUS / 1 * BLOB_SQUASH;
const BLOB_HEIGHT = BLOB_CENTER_Y + BLOB_RADIUS * BLOB_SQUASH;
const BLOB_VIEW_FRACTION = 0.85;
const BLOB_SCENE_OFFSET = -2;

const container = document.querySelector('.monster-container');
const canvas = document.getElementById('monster-canvas');

function radiusAtY(y) {
  const dy = (y - BLOB_CENTER_Y) / BLOB_SQUASH;
  const r2 = BLOB_RADIUS * BLOB_RADIUS - dy * dy;
  return r2 > 0 ? Math.sqrt(r2) : 0;
}

function createBlobGeometry() {
  const geometry = new THREE.SphereGeometry(BLOB_RADIUS, 72, 72);
  geometry.scale(1, BLOB_SQUASH, 1);
  geometry.translate(0, BLOB_CENTER_Y, 0);
  return geometry;
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);

scene.add(new THREE.AmbientLight(0xfff5ee, 0.45));

const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.6);
keyLight.position.set(4, 6, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9966cc, 0.35);
fillLight.position.set(-4, 3, 2);
scene.add(fillLight);

const rimLight = new THREE.PointLight(CONTRAST_COLOR, 0.45, 20);
rimLight.position.set(-2, 4, -3);
scene.add(rimLight);

function frameCamera() {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const contentHeight = BLOB_HEIGHT * 1.12;
  const visibleHeight = contentHeight / BLOB_VIEW_FRACTION;
  const distance = visibleHeight / (2 * Math.tan(vFov / 2));
  const lookY = visibleHeight * 0.5;

  camera.position.set(0, lookY, distance);
  camera.lookAt(0, lookY, 0);
}

const uTime = { value: 0 };
const uBlobHeight = { value: BLOB_HEIGHT };

const EYE_Y = BLOB_HEIGHT * 0.9;
const EYE_SPACING = 0.5;
const EYE_RADIUS = 0.5;
const PUPIL_RADIUS = 0.26;
const MAX_PUPIL_OFFSET = 0.09;
const EYE_Z = radiusAtY(EYE_Y) * 0.9;

const uEyeLeft = { value: new THREE.Vector3(-EYE_SPACING, EYE_Y, EYE_Z) };
const uEyeRight = { value: new THREE.Vector3(EYE_SPACING, EYE_Y, EYE_Z) };
const uEyeHairClear = { value: EYE_RADIUS * 2.4 };

function createClayMaterial(color, options = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.62,
    metalness: 0,
    clearcoat: options.clearcoat ?? 0.28,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.35,
    sheen: 0.2,
    sheenRoughness: 0.2,
    sheenColor: new THREE.Color(0xcc88ff),
  });

  if (!options.hair) return mat;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uBlobHeight = uBlobHeight;
    shader.uniforms.uEyeLeft = uEyeLeft;
    shader.uniforms.uEyeRight = uEyeRight;
    shader.uniforms.uEyeHairClear = uEyeHairClear;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uBlobHeight;
      uniform vec3 uEyeLeft;
      uniform vec3 uEyeRight;
      uniform float uEyeHairClear;
      attribute vec3 restPosition;
      varying vec3 vRestPos;
      varying vec3 vViewNormal;
      varying float vFuzz;
      ${shader.vertexShader}`;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float heightMask = clamp(restPosition.y / uBlobHeight, 0.0, 1.0);
       heightMask = pow(heightMask, 0.65);
       float hairSeed = sin(restPosition.x * 62.0 + restPosition.y * 47.0 + restPosition.z * 55.0);
       float hairSeed2 = cos(restPosition.x * 37.0 - restPosition.z * 71.0 + uTime * 0.9);
       float hairSeed3 = sin(restPosition.x * 19.0 + restPosition.z * 23.0 - uTime * 1.1);
       float fuzz = pow(max(0.0, hairSeed * hairSeed2 * hairSeed3), 2.2) * heightMask;
       float eyeDist = min(distance(restPosition, uEyeLeft), distance(restPosition, uEyeRight));
       float eyeClear = smoothstep(uEyeHairClear * 0.45, uEyeHairClear, eyeDist);
       fuzz *= eyeClear;
       vFuzz = fuzz;
       vRestPos = restPosition;
       float spike = fuzz * 0.4;
       vec3 wobbleDir = vec3(
         sin(uTime * 1.4 + restPosition.y * 5.5 + restPosition.z * 3.0),
         cos(uTime * 1.8 + restPosition.x * 4.5),
         sin(uTime * 1.2 + restPosition.z * 6.5 + restPosition.x * 2.0)
       ) * 0.28;
       vec3 spikeDir = normalize(normal + wobbleDir);
       transformed += spikeDir * spike;
       transformed.y += sin(uTime * 2.0 + restPosition.x * 8.0 + restPosition.z * 7.0) * fuzz * 0.028
                      - pow(fuzz, 1.8) * 0.018;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <defaultnormal_vertex>',
      `#include <defaultnormal_vertex>
       vViewNormal = normalize(normal);`
    );

    shader.fragmentShader = `
      uniform float uTime;
      varying vec3 vRestPos;
      varying vec3 vViewNormal;
      varying float vFuzz;
      ${shader.fragmentShader}`;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       vec3 baseColor = diffuseColor.rgb * 0.68;

       float strandA = sin(vRestPos.x * 44.0 + vRestPos.y * 39.0 + vRestPos.z * 41.0 + uTime * 3.2);
       float strandB = cos(vRestPos.z * 31.0 - vRestPos.x * 27.0 + uTime * 2.3);
       float strand = pow(smoothstep(0.25, 0.82, strandA * strandB * 0.5 + 0.5), 1.5);
       float hairMask = strand * vFuzz;

       diffuseColor.rgb = mix(baseColor, baseColor * 1.22 + vec3(0.07, 0.02, 0.11), hairMask);

       vec3 lightDir = normalize(vec3(0.35, 0.85, 0.4));
       float shadowA = sin(dot(vRestPos + lightDir * 0.04, vec3(17.0, 21.0, 15.0)) + uTime * 1.4);
       float shadowB = cos(dot(vRestPos + lightDir * 0.08, vec3(13.0, 19.0, 23.0)) - uTime * 1.1);
       float hairShadow = smoothstep(0.1, 0.72, shadowA * shadowB * 0.5 + 0.5);
       hairShadow = mix(1.0, 0.48, hairShadow * hairMask * 0.85);
       diffuseColor.rgb *= hairShadow;

       float lump = sin(vRestPos.x * 4.5 + uTime * 0.2)
                  * sin(vRestPos.y * 3.8)
                  * sin(vRestPos.z * 4.2);
       diffuseColor.rgb *= 1.0 + lump * 0.025;

       vec3 viewDir = normalize(-vViewPosition);
       float fresnel = pow(1.0 - max(0.0, dot(vViewNormal, viewDir)), 3.0);
       diffuseColor.rgb += fresnel * vec3(0.3, 0.5, 0.8) * 0.15;

       vec3 lightDirVS = normalize((viewMatrix * vec4(0.35, 0.85, 0.4, 0.0)).xyz);
       float spec = pow(max(0.0, dot(vViewNormal, lightDirVS)), 90.0);
       diffuseColor.rgb += spec * hairMask * 0.2 * hairShadow;`
    );
  };

  return mat;
}

const blobGroup = new THREE.Group();
scene.add(blobGroup);

const blobGeometry = createBlobGeometry();
const originalPositions = Float32Array.from(blobGeometry.attributes.position.array);
const positionAttr = blobGeometry.attributes.position;
blobGeometry.setAttribute('restPosition', new THREE.BufferAttribute(originalPositions.slice(), 3));

const blobMaterial = createClayMaterial(MONSTER_COLOR, {
  roughness: 0.52,
  clearcoat: 0.42,
  clearcoatRoughness: 1,
  hair: true,
});
const blob = new THREE.Mesh(blobGeometry, blobMaterial);
blob.renderOrder = 0;
blobGroup.add(blob);

const groundShadow = new THREE.Mesh(
  new THREE.CircleGeometry(BLOB_RADIUS * 1.1, 48),
  new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  })
);
groundShadow.rotation.x = -Math.PI / 2;
groundShadow.position.y = 0.005;
blobGroup.add(groundShadow);

const eyeWhiteMaterial = createClayMaterial(0xf8f4ee, { roughness: 0.7, clearcoat: 0.15 });

const pupilMaterial = new THREE.MeshStandardMaterial({
  color: 0x111111,
  roughness: 0.35,
  metalness: 0.1,
});

function createEye(side) {
  const group = new THREE.Group();
  group.renderOrder = 1;

  const white = new THREE.Mesh(new THREE.SphereGeometry(EYE_RADIUS, 32, 32), eyeWhiteMaterial);
  white.renderOrder = 1;
  group.add(white);

  const pupil = new THREE.Mesh(new THREE.SphereGeometry(PUPIL_RADIUS, 24, 24), pupilMaterial);
  pupil.position.z = EYE_RADIUS * 0.58;
  pupil.renderOrder = 2;
  group.add(pupil);

  group.userData.pupil = pupil;
  group.userData.anchor = {
    x: side * EYE_SPACING,
    y: EYE_Y,
    z: EYE_Z,
  };

  return group;
}

const eyes = [createEye(-1), createEye(1)];
eyes.forEach((eye) => blobGroup.add(eye));

let mouseY = window.innerHeight / 2;
let mouseX = window.innerWidth / 2;
let pointerTarget = { x: 0, y: 0.6 };
let smoothTarget = { x: 0, y: 0.6 };
let time = 0;

function pointerToBlobSpace(clientX, clientY) {
  const rect = container.getBoundingClientRect();
  const nx = ((clientX - rect.left) / rect.width - 0.5) * 2;
  const ny = 1 - (clientY - rect.top) / rect.height;
  return { x: nx * 1.6, y: ny * 1.2 };
}

function trackMovement(e) {
  const x = e.clientX ?? e.touches?.[0]?.clientX;
  const y = e.clientY ?? e.touches?.[0]?.clientY;
  if (x === undefined || y === undefined) return;
  mouseX = x;
  mouseY = y;
  pointerTarget = pointerToBlobSpace(x, y);
}

function deformPoint(ox, oy, oz, tx, ty, t) {
  const heightNorm = THREE.MathUtils.clamp(oy / BLOB_HEIGHT, 0, 1);
  const anchorWeight = Math.pow(heightNorm, 2.1);

  const leanX = tx * anchorWeight * 0.65;
  const leanY = ty * anchorWeight * 0.18;
  const leanZ = -Math.abs(tx) * anchorWeight * 0.05;

  const lump =
    Math.sin(ox * 7 + oy * 5 + t * 0.4) * Math.cos(oz * 6 + t * 0.3) * 0.018 * anchorWeight +
    Math.sin(oy * 9 + oz * 4) * 0.01 * anchorWeight;

  const wobble = Math.sin(t * 1.4 + ox * 3 + oz * 2) * 0.008 * anchorWeight;

  return {
    x: ox + leanX + lump,
    y: oy + leanY + wobble,
    z: oz + leanZ + lump * 0.35,
  };
}

function updateBlob() {
  const positions = positionAttr.array;

  for (let i = 0; i < positions.length; i += 3) {
    const d = deformPoint(
      originalPositions[i],
      originalPositions[i + 1],
      originalPositions[i + 2],
      smoothTarget.x,
      smoothTarget.y,
      time
    );
    positions[i] = d.x;
    positions[i + 1] = d.y;
    positions[i + 2] = d.z;
  }

  positionAttr.needsUpdate = true;
  blobGeometry.computeVertexNormals();
}

function updateEyes() {
  const camLocal = camera.position.clone();
  blobGroup.worldToLocal(camLocal);
  const rect = container.getBoundingClientRect();
  const eyeWorld = new THREE.Vector3();

  eyes.forEach((eye) => {
    const { x: ax, y: ay, z: az } = eye.userData.anchor;
    const deformed = deformPoint(ax, ay, az, smoothTarget.x, smoothTarget.y, time);

    eye.position.set(deformed.x, deformed.y, deformed.z);

    const lookTarget = new THREE.Vector3(camLocal.x, deformed.y, camLocal.z);
    eye.lookAt(lookTarget);

    const toCam = new THREE.Vector3(
      lookTarget.x - deformed.x,
      0,
      lookTarget.z - deformed.z
    );
    if (toCam.lengthSq() > 0.0001) {
      toCam.normalize();
      eye.position.addScaledVector(toCam, -EYE_RADIUS * 0.2);
    }

    eye.updateMatrixWorld(true);

    const pupil = eye.userData.pupil;
    eye.getWorldPosition(eyeWorld);
    eyeWorld.project(camera);

    const screenX = (eyeWorld.x * 0.5 + 0.5) * rect.width + rect.left;
    const screenY = (-eyeWorld.y * 0.5 + 0.5) * rect.height + rect.top;

    const dx = mouseX - screenX;
    const dy = mouseY - screenY;
    const len = Math.hypot(dx, dy) || 1;
    const dist = Math.min(MAX_PUPIL_OFFSET, len / 120);

    pupil.position.set(
      (dx / len) * dist,
      (-dy / len) * dist,
      EYE_RADIUS * 0.55
    );
  });
}

function resize() {
  const { width, height } = container.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  frameCamera();
}

function animate() {
  time += 0.016;
  uTime.value = time;

  smoothTarget.x += (pointerTarget.x - smoothTarget.x) * 0.065;
  smoothTarget.y += (pointerTarget.y - smoothTarget.y) * 0.065;

  updateBlob();
  updateEyes();

  groundShadow.scale.set(
    1 + Math.abs(smoothTarget.x) * 0.08,
    1 + Math.abs(smoothTarget.x) * 0.05,
    1
  );
  groundShadow.material.opacity = 0.28 - Math.abs(smoothTarget.x) * 0.04;

  blobGroup.position.y = BLOB_SCENE_OFFSET + Math.sin(time * 1.1) * 0.012;

  renderer.render(scene, camera);
  updateFavicon({ time, smoothTarget, mouseX, mouseY });
  requestAnimationFrame(animate);
}

window.addEventListener('mousemove', trackMovement);
window.addEventListener('touchmove', trackMovement, { passive: true });
window.addEventListener('touchstart', trackMovement, { passive: true });
window.addEventListener('resize', resize);

resize();
animate();
