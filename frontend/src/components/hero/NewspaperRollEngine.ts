import * as THREE from 'three';
import {
  NEWSPAPER_CONFIGS,
  createNewspaperTexture,
  createRollEndcapTexture,
  NewspaperDesignConfig
} from './NewspaperTextureGenerator';
import { audioService } from '../../services/audioService';

export interface RollDefinition {
  id: string;
  config: NewspaperDesignConfig;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  width: number;
  rollRadius: number;
  startTime: number; // in seconds
  speed: number;
  tiltAngle?: number; // subtle surface tilt in degrees
  waveFreq: number;
  waveAmp: number;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  reducedMotion?: boolean;
  onFpsUpdate?: (fps: number) => void;
  onComplete?: () => void;
  onProgress?: (progress: number) => void;
}

interface RollInstance {
  def: RollDefinition;
  group: THREE.Group;
  spoolGroup: THREE.Group;
  spoolCylinderMesh: THREE.Mesh;
  endcapMeshTop: THREE.Mesh;
  endcapMeshBottom: THREE.Mesh;
  ribbonMesh: THREE.Mesh;
  ribbonGeom: THREE.PlaneGeometry;
  posAttr: THREE.BufferAttribute;
  uvAttr: THREE.BufferAttribute;
  posArray: Float32Array;
  uvArray: Float32Array;
  texture: THREE.CanvasTexture;
  material: THREE.MeshStandardMaterial;
  spoolMaterial: THREE.MeshStandardMaterial;

  // Computed trajectory basis vectors
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  travelVec: THREE.Vector3;    // T (unit direction of travel)
  widthVec: THREE.Vector3;     // W (unit direction along cylinder axis / ribbon width)
  normalVec: THREE.Vector3;    // N (unit normal facing camera)
  negTravelVec: THREE.Vector3; // -T
  totalDistance: number;
  duration: number;

  progress: number;
  hasPlayedSound: boolean;
}

// Reusable scratch objects to eliminate per-frame garbage collection
const _edgePos = new THREE.Vector3();
const _spoolCenter = new THREE.Vector3();
const _orientationMatrix = new THREE.Matrix4();

const SEGS_X = 48;
const SEGS_Y = 4;

export class NewspaperRollEngine {
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;
  private clock: THREE.Clock;
  private isRunning = true;
  private speedMultiplier = 1.0;
  private reducedMotion = false;
  private onFpsUpdate?: (fps: number) => void;
  private onComplete?: () => void;
  private onProgress?: (progress: number) => void;
  private hasTriggeredComplete = false;
  private timeOffset = 0;

  // Mouse & Parallax
  private mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private initialCameraPos = new THREE.Vector3(0, 0, 16.2);

  // Rolls and Meshes
  private rollInstances: RollInstance[] = [];
  private endcapTexture: THREE.CanvasTexture | null = null;
  private dustParticles: THREE.Points | null = null;

  // FPS tracking
  private frameCount = 0;
  private lastFpsTime = 0;

  constructor(options: EngineOptions) {
    this.canvas = options.canvas;
    this.reducedMotion = options.reducedMotion || false;
    this.onFpsUpdate = options.onFpsUpdate;
    this.onComplete = options.onComplete;
    this.onProgress = options.onProgress;

    this.clock = new THREE.Clock();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f6f2e8');
    this.scene.fog = new THREE.FogExp2('#f6f2e8', 0.010);

    // Camera
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const aspect = width / (height || 1);
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 100);
    this.updateCameraDistance(aspect);

    // Renderer (High-performance configuration)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Lighting & Particles
    this.setupLighting();
    this.setupDustParticles();

    // Shared endcap texture
    this.endcapTexture = createRollEndcapTexture();

    // Setup all 6 rolls
    this.setupRolls();

    // Event listeners
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });

    // Start render loop
    this.animate();
  }

  private updateCameraDistance(aspect: number) {
    if (aspect < 1.0) {
      this.initialCameraPos.set(0, 0, 21);
    } else if (aspect < 1.4) {
      this.initialCameraPos.set(0, 0, 18);
    } else {
      this.initialCameraPos.set(0, 0, 16.2);
    }
    this.camera.position.copy(this.initialCameraPos);
  }

  private setupLighting() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight('#ede3d0', 1.05);
    this.scene.add(ambientLight);

    // Key Light (Balanced 1024 shadow map for high FPS)
    const keyLight = new THREE.DirectionalLight('#fff4dc', 2.2);
    keyLight.position.set(12, 20, 22);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 70;
    keyLight.shadow.camera.left = -35;
    keyLight.shadow.camera.right = 35;
    keyLight.shadow.camera.top = 35;
    keyLight.shadow.camera.bottom = -35;
    keyLight.shadow.bias = -0.0002;
    this.scene.add(keyLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight('#94a8c0', 0.85);
    fillLight.position.set(-16, -12, 14);
    this.scene.add(fillLight);

    // Rim Light
    const rimLight = new THREE.DirectionalLight('#f0d6b0', 0.7);
    rimLight.position.set(0, -15, -4);
    this.scene.add(rimLight);
  }

  private setupDustParticles() {
    const count = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 34;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(140, 110, 80, 0.45)');
      grad.addColorStop(0.5, 'rgba(160, 130, 100, 0.15)');
      grad.addColorStop(1, 'rgba(180, 150, 120, 0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 32, 32);
    }
    const pTexture = new THREE.CanvasTexture(pCanvas);

    const material = new THREE.PointsMaterial({
      size: 0.28,
      map: pTexture,
      transparent: true,
      opacity: 0.4,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(geometry, material);
    this.scene.add(this.dustParticles);
  }

  private setupRolls() {
    const rollDefinitions: RollDefinition[] = [
      // Roll 0: "THE MORNING HERALD" — Upper Left to Lower Right Diagonal Sweep
      {
        id: 'roll-0-herald',
        config: NEWSPAPER_CONFIGS[0],
        startPos: new THREE.Vector3(-28, 14, 0.4),
        endPos: new THREE.Vector3(28, -6, 0.4),
        width: 8.4,
        rollRadius: 1.15,
        startTime: 0.0,
        speed: 12.5,
        tiltAngle: -4,
        waveFreq: 0.42,
        waveAmp: 0.16
      },
      // Roll 1: "THE NATIONAL CHRONICLE" — Top Right to Lower Left Counter-Diagonal
      {
        id: 'roll-1-chronicle',
        config: NEWSPAPER_CONFIGS[1],
        startPos: new THREE.Vector3(28, 15, -0.5),
        endPos: new THREE.Vector3(-28, -9, -0.5),
        width: 8.2,
        rollRadius: 1.10,
        startTime: 0.2,
        speed: 12.0,
        tiltAngle: 4,
        waveFreq: 0.46,
        waveAmp: 0.15
      },
      // Roll 2: "THE EVENING REGISTER" — Bottom Left Ascending Diagonal to Upper Right
      {
        id: 'roll-2-register',
        config: NEWSPAPER_CONFIGS[2],
        startPos: new THREE.Vector3(-28, -14, 1.2),
        endPos: new THREE.Vector3(28, 8, 1.2),
        width: 8.6,
        rollRadius: 1.18,
        startTime: 0.4,
        speed: 11.0,
        tiltAngle: -3,
        waveFreq: 0.40,
        waveAmp: 0.14
      },
      // Roll 3: "THE CITY DISPATCH" — Rapid Mid Horizontal Web Feed
      {
        id: 'roll-3-dispatch',
        config: NEWSPAPER_CONFIGS[3],
        startPos: new THREE.Vector3(28, -1.5, -1.8),
        endPos: new THREE.Vector3(-28, 1.5, -1.8),
        width: 8.8,
        rollRadius: 1.20,
        startTime: 0.6,
        speed: 10.0,
        tiltAngle: 3,
        waveFreq: 0.52,
        waveAmp: 0.14
      },
      // Roll 4: "THE CONTINENTAL GAZETTE" — Grand Wide-Format Full Top Backdrop Reel (Second Last Roll)
      {
        id: 'roll-4-gazette',
        config: NEWSPAPER_CONFIGS[4],
        startPos: new THREE.Vector3(-28, 16.0, -3.0),
        endPos: new THREE.Vector3(28, 11.0, -3.0),
        width: 10.2,
        rollRadius: 1.30,
        startTime: 0.8,
        speed: 14.5,
        tiltAngle: -2,
        waveFreq: 0.32,
        waveAmp: 0.18
      },
      // Roll 5: "THE METROPOLITAN POST" — Hero Lower-Foreground Diagonal Sweep (Last Roll, distinct non-overlapping path)
      {
        id: 'roll-5-post',
        config: NEWSPAPER_CONFIGS[5],
        startPos: new THREE.Vector3(28, -15.0, 2.2),
        endPos: new THREE.Vector3(-28, -4.0, 2.2),
        width: 9.2,
        rollRadius: 1.25,
        startTime: 1.0,
        speed: 12.5,
        tiltAngle: 5,
        waveFreq: 0.44,
        waveAmp: 0.20
      }
    ];

    rollDefinitions.forEach((def, index) => {
      const texture = createNewspaperTexture(def.config, index);

      // Ribbon Material
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        color: new THREE.Color('#f5eedc'),
        roughness: 0.85,
        metalness: 0.02,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide
      });

      // Spool Cylinder Material
      const spoolMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        color: new THREE.Color('#f5eedc'),
        roughness: 0.82,
        metalness: 0.03
      });

      // Endcap Material
      const endcapMaterial = new THREE.MeshStandardMaterial({
        map: this.endcapTexture || texture,
        color: new THREE.Color('#eddab5'),
        roughness: 0.9,
        metalness: 0.02,
        side: THREE.DoubleSide
      });

      // Trajectory Vectors
      const startPos = def.startPos.clone();
      const endPos = def.endPos.clone();
      const delta = new THREE.Vector3().subVectors(endPos, startPos);
      const totalDistance = delta.length();
      const travelVec = delta.clone().normalize();

      const tiltRad = ((def.tiltAngle || 0) * Math.PI) / 180;
      const refNormal = new THREE.Vector3(
        -Math.sin(tiltRad) * travelVec.y,
        Math.sin(tiltRad) * travelVec.x,
        Math.cos(tiltRad)
      ).normalize();

      const widthVec = new THREE.Vector3().crossVectors(refNormal, travelVec).normalize();
      const normalVec = new THREE.Vector3().crossVectors(travelVec, widthVec).normalize();
      const negTravelVec = travelVec.clone().negate();

      const duration = totalDistance / def.speed;

      // Spool Head
      const spoolGroup = new THREE.Group();

      const spoolCylinderGeom = new THREE.CylinderGeometry(
        def.rollRadius,
        def.rollRadius,
        def.width,
        28,
        1,
        false
      );
      const spoolCylinderMesh = new THREE.Mesh(spoolCylinderGeom, spoolMaterial);
      spoolCylinderMesh.castShadow = true;
      spoolCylinderMesh.receiveShadow = true;
      spoolCylinderMesh.frustumCulled = false;
      spoolGroup.add(spoolCylinderMesh);

      const capGeom = new THREE.CircleGeometry(def.rollRadius, 28);
      const endcapMeshTop = new THREE.Mesh(capGeom, endcapMaterial);
      endcapMeshTop.position.y = def.width / 2;
      endcapMeshTop.rotation.x = -Math.PI / 2;
      endcapMeshTop.castShadow = true;
      endcapMeshTop.frustumCulled = false;
      spoolGroup.add(endcapMeshTop);

      const endcapMeshBottom = new THREE.Mesh(capGeom, endcapMaterial);
      endcapMeshBottom.position.y = -def.width / 2;
      endcapMeshBottom.rotation.x = Math.PI / 2;
      endcapMeshBottom.castShadow = true;
      endcapMeshBottom.frustumCulled = false;
      spoolGroup.add(endcapMeshBottom);

      // Ribbon PlaneGeometry (optimized 48x4 vertex grid)
      const ribbonGeom = new THREE.PlaneGeometry(1, 1, SEGS_X, SEGS_Y);
      const posAttr = ribbonGeom.attributes.position as THREE.BufferAttribute;
      const uvAttr = ribbonGeom.attributes.uv as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;
      const uvArray = uvAttr.array as Float32Array;

      const ribbonMesh = new THREE.Mesh(ribbonGeom, material);
      ribbonMesh.castShadow = true;
      ribbonMesh.receiveShadow = true;
      ribbonMesh.frustumCulled = false;

      const masterGroup = new THREE.Group();
      masterGroup.add(ribbonMesh);
      masterGroup.add(spoolGroup);
      masterGroup.visible = false;

      this.scene.add(masterGroup);

      this.rollInstances.push({
        def,
        group: masterGroup,
        spoolGroup,
        spoolCylinderMesh,
        endcapMeshTop,
        endcapMeshBottom,
        ribbonMesh,
        ribbonGeom,
        posAttr,
        uvAttr,
        posArray,
        uvArray,
        texture,
        material,
        spoolMaterial,
        startPos,
        endPos,
        travelVec,
        widthVec,
        normalVec,
        negTravelVec,
        totalDistance,
        duration,
        progress: 0,
        hasPlayedSound: false
      });
    });
  }

  private onMouseMove = (e: MouseEvent) => {
    if (this.reducedMotion) return;
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    this.mouse.targetX = (e.clientX - halfW) / halfW;
    this.mouse.targetY = -(e.clientY - halfH) / halfH;
  };

  private onResize = () => {
    if (!this.canvas || !this.renderer || !this.camera) return;
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const aspect = width / (height || 1);

    this.camera.aspect = aspect;
    this.updateCameraDistance(aspect);
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
  };

  public replay() {
    this.hasTriggeredComplete = false;
    this.timeOffset = this.clock.getElapsedTime();
    this.rollInstances.forEach(roll => {
      roll.progress = 0;
      roll.hasPlayedSound = false;
      roll.group.visible = false;
    });
    audioService.playPaperRustle();
  }

  public setSpeed(multiplier: number) {
    this.speedMultiplier = Math.max(0.2, Math.min(3.0, multiplier));
  }

  public setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    if (reduced) {
      this.rollInstances.forEach(roll => {
        roll.progress = 1.0;
        roll.group.visible = true;
        this.updateRoll(roll, 1.0, 0);
      });
    }
  }

  public togglePause(): boolean {
    this.isRunning = !this.isRunning;
    return this.isRunning;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private updateRoll(roll: RollInstance, progress: number, activeTime: number) {
    const def = roll.def;
    const curDist = Math.max(0.15, roll.totalDistance * progress);

    const radiusScale = Math.max(0.70, 1.0 - progress * 0.28);
    const curRadius = def.rollRadius * radiusScale;

    // 1. Spool Center (Zero allocation via reused Vector3 objects)
    _edgePos.copy(roll.startPos).addScaledVector(roll.travelVec, curDist);
    _spoolCenter.copy(_edgePos).addScaledVector(roll.normalVec, curRadius);
    roll.spoolGroup.position.copy(_spoolCenter);

    // 2. Orient Spool Group (Zero allocation)
    _orientationMatrix.makeBasis(roll.normalVec, roll.widthVec, roll.negTravelVec);
    roll.spoolGroup.quaternion.setFromRotationMatrix(_orientationMatrix);
    roll.spoolGroup.scale.set(radiusScale, 1.0, radiusScale);

    // Rotation around cylinder axis
    const rotationAngle = (curDist / def.rollRadius) % (Math.PI * 2);
    roll.spoolCylinderMesh.rotation.y = rotationAngle;

    // 3. Fast direct Float32Array write for vertices & UVs
    const posArray = roll.posArray;
    const uvArray = roll.uvArray;
    const pageHeightUnits = def.width * 1.35;

    const sX = roll.startPos.x;
    const sY = roll.startPos.y;
    const sZ = roll.startPos.z;

    const tX = roll.travelVec.x;
    const tY = roll.travelVec.y;
    const tZ = roll.travelVec.z;

    const wX = roll.widthVec.x;
    const wY = roll.widthVec.y;
    const wZ = roll.widthVec.z;

    const nX = roll.normalVec.x;
    const nY = roll.normalVec.y;
    const nZ = roll.normalVec.z;

    let pIdx = 0;
    let uIdx = 0;

    for (let iy = 0; iy <= SEGS_Y; iy++) {
      const vRatio = iy / SEGS_Y;
      const wOffset = (vRatio - 0.5) * def.width;
      const uvU = 1.0 - vRatio;

      const wOffX = wX * wOffset;
      const wOffY = wY * wOffset;
      const wOffZ = wZ * wOffset;

      for (let ix = 0; ix <= SEGS_X; ix++) {
        const uRatio = ix / SEGS_X;
        const distAlongTrail = uRatio * curDist;

        // Wave flutter & physical aerodynamic sag
        const wave =
          Math.sin(uRatio * 14 * def.waveFreq - activeTime * 3.4) *
          def.waveAmp *
          Math.sin(uRatio * Math.PI);

        const tangentLift = Math.pow(uRatio, 6) * (curRadius * 0.22);
        const totalDisp = wave + tangentLift;

        posArray[pIdx++] = sX + tX * distAlongTrail + wOffX + nX * totalDisp;
        posArray[pIdx++] = sY + tY * distAlongTrail + wOffY + nY * totalDisp;
        posArray[pIdx++] = sZ + tZ * distAlongTrail + wOffZ + nZ * totalDisp;

        uvArray[uIdx++] = uvU;
        uvArray[uIdx++] = distAlongTrail / pageHeightUnits;
      }
    }

    roll.posAttr.needsUpdate = true;
    roll.uvAttr.needsUpdate = true;

    // 4. Continuous Rotary Stream once fully unrolled
    if (progress >= 1.0) {
      const extraTime = Math.max(0, activeTime - (roll.def.startTime + roll.duration));
      const streamDist = extraTime * (def.speed * 0.35);
      const uvOffset = (streamDist / pageHeightUnits) % 1.0;
      if (roll.material.map) {
        roll.material.map.offset.y = uvOffset;
      }
    }
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.1) * this.speedMultiplier;
    const currentClockTime = this.clock.getElapsedTime();
    const activeTime = (currentClockTime - this.timeOffset) * this.speedMultiplier;

    // FPS Counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      if (this.onFpsUpdate) {
        this.onFpsUpdate(Math.round((this.frameCount * 1000) / (now - this.lastFpsTime)));
      }
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (!this.isRunning && !this.reducedMotion) return;

    // Camera Parallax
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    this.camera.position.x = this.initialCameraPos.x + this.mouse.x * 1.4;
    this.camera.position.y = this.initialCameraPos.y + this.mouse.y * 1.1;
    this.camera.lookAt(0, 0, 0);

    // Dust particles
    if (this.dustParticles) {
      const posAttr = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        let y = posAttr.getY(i);
        y -= delta * 0.35;
        if (y < -17) y = 17;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
      this.dustParticles.rotation.y = activeTime * 0.01;
    }

    // Update each roll
    let totalProgress = 0;
    let allFinished = true;

    this.rollInstances.forEach(roll => {
      const def = roll.def;

      if (this.reducedMotion) {
        roll.group.visible = true;
        totalProgress += 1.0;
        return;
      }

      const rollActiveTime = activeTime - def.startTime;

      if (rollActiveTime < 0) {
        roll.group.visible = false;
        allFinished = false;
        return;
      }

      roll.group.visible = true;

      if (!roll.hasPlayedSound && rollActiveTime > 0.05) {
        roll.hasPlayedSound = true;
        audioService.playPaperRustle();
      }

      const rawProgress = Math.min(1.0, rollActiveTime / roll.duration);
      const progress = 1.0 - Math.pow(1.0 - rawProgress, 2.0);

      roll.progress = progress;
      totalProgress += progress;
      if (progress < 1.0) {
        allFinished = false;
      }
      this.updateRoll(roll, progress, activeTime);
    });

    const averageProgress = this.rollInstances.length > 0
      ? totalProgress / this.rollInstances.length
      : 1;

    if (this.onProgress) {
      this.onProgress(averageProgress);
    }

    if (allFinished && !this.hasTriggeredComplete && !this.reducedMotion) {
      const lastRoll = this.rollInstances[this.rollInstances.length - 1];
      const finishTime = lastRoll ? lastRoll.def.startTime + lastRoll.duration : 10;
      if (activeTime >= finishTime + 0.15) {
        this.hasTriggeredComplete = true;
        if (this.onComplete) {
          this.onComplete();
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);

    this.rollInstances.forEach(roll => {
      roll.ribbonGeom.dispose();
      roll.material.dispose();
      roll.spoolMaterial.dispose();
      roll.texture.dispose();
    });

    if (this.endcapTexture) this.endcapTexture.dispose();
    this.renderer.dispose();
  }
}
