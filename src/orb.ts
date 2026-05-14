import * as THREE from 'three';

export type OrbTheme = 'cyan' | 'white' | 'red' | 'amber';

export const THEME_COLORS = {
  cyan: {
    core: '#0ea5e9',
    ring: '#38bdf8',
    base: '#0284c7',
    highlight: '#7dd3fc',
    bg: '#050508'
  },
  white: {
    core: '#e5e5e5',
    ring: '#ffffff',
    base: '#a3a3a3',
    highlight: '#ffffff',
    bg: '#000000'
  },
  red: {
    core: '#ef4444',
    ring: '#f87171',
    base: '#b91c1c',
    highlight: '#fca5a5',
    bg: '#080000'
  },
  amber: {
    core: '#f59e0b',
    ring: '#fbbf24',
    base: '#d97706',
    highlight: '#fde68a',
    bg: '#080500'
  }
};

export class ParticleOrb {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: THREE.Points;
  coreMesh: THREE.Mesh;
  rings: THREE.Mesh[] = [];
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  
  targetScale: number = 1.0;
  currentScale: number = 1.0;
  theme: OrbTheme = 'cyan';
  
  constructor(canvas: HTMLCanvasElement, initialTheme: OrbTheme = 'cyan') {
    this.theme = initialTheme;
    const colors = THEME_COLORS[this.theme];
    
    this.scene = new THREE.Scene();
    
    // Set up camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 6;

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 1. Core glowing sphere
    const coreGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({ 
        color: new THREE.Color(colors.core), 
        transparent: true, 
        opacity: 0.15,
        blending: THREE.AdditiveBlending 
    });
    this.coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    this.scene.add(this.coreMesh);

    // 2. Rings
    for (let i = 0; i < 3; i++) {
        const ringGeo = new THREE.TorusGeometry(2 + i*0.4, 0.015, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(colors.ring), 
            transparent: true, 
            opacity: 0.3 - (i*0.1),
            blending: THREE.AdditiveBlending
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.random() * Math.PI;
        ring.rotation.y = Math.random() * Math.PI;
        this.rings.push(ring);
        this.scene.add(ring);
    }

    // 3. Particle system
    const particleCount = 4000;
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colorArray = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const baseColor = new THREE.Color(colors.base);
    const highlightColor = new THREE.Color(colors.highlight);

    for (let i = 0; i < particleCount; i++) {
        const r = 1.8 + Math.random() * 0.5; 
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        const isHighlight = Math.random() > 0.8;
        const c = isHighlight ? highlightColor : baseColor;

        colorArray[i * 3] = c.r;
        colorArray[i * 3 + 1] = c.g;
        colorArray[i * 3 + 2] = c.b;

        sizes[i] = Math.random() * 2;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = 32;
    canvasTexture.height = 32;
    const ctx = canvasTexture.getContext('2d');
    if (ctx) {
        // Create radial gradient for soft particles
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvasTexture);

    this.material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
      map: texture,
      depthWrite: false
    });

    this.particles = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.particles);

    // Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Start loop
    this.animate();
  }

  setTheme(newTheme: OrbTheme) {
    this.theme = newTheme;
    const colors = THEME_COLORS[newTheme];
    
    (this.coreMesh.material as THREE.MeshBasicMaterial).color.set(colors.core);
    
    this.rings.forEach(ring => {
        (ring.material as THREE.MeshBasicMaterial).color.set(colors.ring);
    });

    const baseColor = new THREE.Color(colors.base);
    const highlightColor = new THREE.Color(colors.highlight);
    const colorAttribute = this.geometry.getAttribute('color') as THREE.BufferAttribute;

    for (let i = 0; i < colorAttribute.count; i++) {
        const isHighlight = Math.random() > 0.8;
        const c = isHighlight ? highlightColor : baseColor;
        colorAttribute.setXYZ(i, c.r, c.g, c.b);
    }
    colorAttribute.needsUpdate = true;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateAudioData(intensity: number) {
      this.targetScale = 1.0 + (intensity * 1.5); 
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const time = Date.now() * 0.001;

    // Smooth scaling
    this.currentScale += (this.targetScale - this.currentScale) * 0.15;
    
    // Base breathing effect
    const breath = this.targetScale <= 1.01 ? 1.0 + Math.sin(time * 2) * 0.03 : this.currentScale;

    // Apply scale to particles and core
    this.particles.scale.set(breath, breath, breath);
    this.coreMesh.scale.set(breath, breath, breath);

    // Rotate particles
    this.particles.rotation.y += 0.002;
    this.particles.rotation.x += 0.001;

    // Rotate rings
    this.rings.forEach((ring, i) => {
        ring.rotation.x += 0.005 * (i % 2 === 0 ? 1 : -1);
        ring.rotation.y += 0.003 * (i % 2 === 0 ? -1 : 1);
        ring.scale.set(breath, breath, breath);
    });

    // Make core pulse opacity with breath
    const coreMat = this.coreMesh.material as THREE.MeshBasicMaterial;
    coreMat.opacity = 0.15 + (breath - 1.0) * 0.5;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
      window.removeEventListener('resize', this.onWindowResize.bind(this));
      this.geometry.dispose();
      this.material.dispose();
      this.coreMesh.geometry.dispose();
      (this.coreMesh.material as THREE.Material).dispose();
      this.rings.forEach(r => {
          r.geometry.dispose();
          (r.material as THREE.Material).dispose();
      });
      this.renderer.dispose();
  }
}
