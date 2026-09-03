'use strict';

/*
 * Split out of index.html, which was 5,800 lines in one file.
 *
 * The program was wrapped in a single IIFE, so every declaration was
 * function-scoped and invisible outside it. Splitting across <script> tags
 * therefore meant unwrapping it: these are plain scripts in the original
 * order, sharing global scope the way the IIFE's interior shared its own, and
 * `'use strict'` is restated per file because the wrapper that carried it for
 * everybody is gone.
 *
 * Not ES modules, deliberately: these names are reached for directly by the
 * other files, so imports would have meant rewriting all of that at the same
 * time as moving it — two changes at once, in a file there is no test to catch
 * either of them with.
 *
 * Boundaries were not chosen by eye. Each was checked to leave both halves
 * parsing on their own, which is how the theme controller turned out to be a
 * second IIFE *after* the main one rather than part of it.
 */

class ThreeDGridEngine {
  constructor() {
    this.container = null;
    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.latticeGroup = null;
    this.activeCube = null;
    this.animationFrameId = null;
    this.resizeObserver = null;
    this.resizeHandler = null;
    this.orientationHandler = null;
    this.textureLoader = null;
    this.textureRequestId = 0;
    this.activeTexture = null;
    this.latticeGeometry = null;
    this.latticeMaterial = null;
    this.activeIndex = -1;
    this.rotationSpeed = 40;

    this.CELL_SIZE = 1;
    this.GAP = 0.05;
    this.SPACING = this.CELL_SIZE + this.GAP;
    this.GRID_HALF = (this.SPACING * 3) / 2;
    this.ACTIVE_SIZE = 1;
    this.ACTIVE_SCALE = 1.18;
    this.VIEW_PADDING = 1.12;

    this._resizeRetryTimer = null;
  }

  addSegment(vertices, ax, ay, az, bx, by, bz) {
    vertices.push(ax, ay, az, bx, by, bz);
  }

  buildUnifiedLatticeGeometry() {
    const vertices = [];
    const h = this.GRID_HALF;
    const coords = [-h, -this.SPACING / 2, this.SPACING / 2, h];

    for (const y of coords) {
      for (const z of coords) {
        this.addSegment(vertices, -h, y, z, h, y, z);
      }
    }

    for (const x of coords) {
      for (const z of coords) {
        this.addSegment(vertices, x, -h, z, x, h, z);
      }
    }

    for (const x of coords) {
      for (const y of coords) {
        this.addSegment(vertices, x, y, -h, x, y, h);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.computeBoundingSphere();
    return geometry;
  }

  getNodePosition(index) {
    const safeIndex = Math.max(0, Math.min(26, Math.floor(Number(index) || 0)));
    const x = (safeIndex % 3) - 1;
    const y = (Math.floor(safeIndex / 3) % 3) - 1;
    const z = Math.floor(safeIndex / 9) - 1;

    return new THREE.Vector3(
      x * this.SPACING,
      y * this.SPACING,
      z * this.SPACING
    );
  }

  createInactiveNodes() {
    const geometry = new THREE.BoxGeometry(
      this.CELL_SIZE,
      this.CELL_SIZE,
      this.CELL_SIZE
    );

    for (let i = 0; i < 27; i++) {
      const edgeGeometry = new THREE.EdgesGeometry(geometry);
      const material = new THREE.LineBasicMaterial({
        color: 0x71839a,
        transparent: true,
        opacity: 0.28,
        depthTest: true,
        depthWrite: false,
        fog: false
      });

      const node = new THREE.LineSegments(edgeGeometry, material);
      node.name = `inactiveNode_${i}`;
      node.position.copy(this.getNodePosition(i));
      this.latticeGroup.add(node);
    }
  }

  createActiveCube() {
    const geometry = new THREE.BoxGeometry(
      this.ACTIVE_SIZE,
      this.ACTIVE_SIZE,
      this.ACTIVE_SIZE
    );

    const materials = Array.from(
      { length: 6 },
      () => new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.82,
        transmission: 0.12,
        thickness: 0.08,
        roughness: 0.62,
        metalness: 0.0,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );

    this.activeCube = new THREE.Mesh(geometry, materials);
    this.activeCube.name = 'ActiveStimulusCube';
    this.activeCube.visible = false;
    this.activeCube.scale.setScalar(this.ACTIVE_SCALE);
    this.latticeGroup.add(this.activeCube);
  }

  getCachedStimulusImage(imagePath) {
    const renderable = image =>
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0;

    if (!imagePath || typeof imagePath !== 'string') return null;

    // Resolve the exact selected Anime mode first. This prevents an Anime
    // stimulus from accidentally resolving through another mode or the
    // human FACE_IMAGE_CACHE.
    const selectedMode =
      typeof App !== 'undefined' &&
      App.engine?.stimulusType === 'anime_faces'
        ? (ANIME_MODES.includes(App.engine?.animeMode)
            ? App.engine.animeMode
            : 'standard')
        : null;

    if (selectedMode && typeof ANIME_IMAGE_CACHE !== 'undefined') {
      const selected = ANIME_IMAGE_CACHE[selectedMode]?.[imagePath];
      if (renderable(selected)) return selected;
    }

    if (typeof App !== 'undefined' && App.engine?.imageCache) {
      const candidate = App.engine.imageCache[imagePath];
      if (renderable(candidate)) return candidate;
    }

    if (typeof FACE_IMAGE_CACHE !== 'undefined') {
      const candidate = FACE_IMAGE_CACHE[imagePath];
      if (renderable(candidate)) return candidate;
    }

    return null;
  }

  configureTexture(texture) {
    if (!texture) return texture;

    texture.needsUpdate = true;

    if ('colorSpace' in texture && THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }

    if ('encoding' in texture && THREE.sRGBEncoding) {
      texture.encoding = THREE.sRGBEncoding;
    }

    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return texture;
  }

  createTextureFromImage(image) {
    if (!(image instanceof HTMLImageElement)) return null;
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return null;
    }

    // The image is already loaded by the application's preload cache.
    // THREE.Texture(image) avoids a second network request and is the most
    // reliable bridge from an HTMLImageElement into WebGL.
    const texture = new THREE.Texture(image);
    return this.configureTexture(texture);
  }

  loadStimulusTexture(imageSource) {
    const requestId = ++this.textureRequestId;
    this.clearActiveTexture();

    if (!imageSource || !this.activeCube) return;

    // IMPORTANT: runTrial() passes the preloaded HTMLImageElement directly.
    // Never send that object to TextureLoader.load(), which expects a URL.
    if (imageSource instanceof HTMLImageElement) {
      const texture = this.createTextureFromImage(imageSource);

      if (texture && requestId === this.textureRequestId && this.activeCube) {
        this.setActiveNodeTexture(this.activeIndex, texture);
      } else if (texture) {
        texture.dispose();
      }
      return;
    }

    const imagePath = String(imageSource);
    const cachedImage = this.getCachedStimulusImage(imagePath);

    if (cachedImage) {
      const texture = this.createTextureFromImage(cachedImage);
      if (texture && requestId === this.textureRequestId && this.activeCube) {
        this.setActiveNodeTexture(this.activeIndex, texture);
      } else if (texture) {
        texture.dispose();
      }
      return;
    }

    // Dynamic fallback for a preload race. TextureLoader is only used for a
    // genuine URL string, never for an HTMLImageElement.
    if (!this.textureLoader) return;

    this.textureLoader.load(
      imagePath,
      texture => {
        if (requestId !== this.textureRequestId || !this.activeCube) {
          texture.dispose();
          return;
        }
        this.configureTexture(texture);
        this.setActiveNodeTexture(this.activeIndex, texture);
      },
      undefined,
      error => {
        if (requestId !== this.textureRequestId) return;
        console.warn('[ThreeDGridEngine] Stimulus texture failed:', imagePath, error);

        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 256;
        fallbackCanvas.height = 256;
        const ctx = fallbackCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#00f0ff';
          ctx.fillRect(0, 0, 256, 256);
          ctx.fillStyle = '#06070a';
          ctx.fillRect(16, 16, 224, 224);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 8;
          ctx.strokeRect(24, 24, 208, 208);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 26px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('STIMULUS', 128, 128);
        }
        const fallbackTexture = this.configureTexture(new THREE.CanvasTexture(fallbackCanvas));
        this.setActiveNodeTexture(this.activeIndex, fallbackTexture);
      }
    );
  }

  setActiveNodeTexture(index, texture) {
    if (!this.activeCube || !texture) return;
    this.activeTexture = texture;
    const materials = Array.from({length:6}, () => new THREE.MeshBasicMaterial({
      map: texture,
      transparent: false,
      side: THREE.FrontSide,
      depthTest: true,
      depthWrite: true
    }));
    const old = Array.isArray(this.activeCube.material) ? this.activeCube.material : [this.activeCube.material];
    old.forEach(m => { if (m) m.dispose(); });
    this.activeCube.material = materials;
  }

  clearActiveTexture() {
    if (this.activeTexture) {
      try { this.activeTexture.dispose(); } catch (_) {}
      this.activeTexture = null;
    }
  }

  resetNode() {
    if (!this.activeCube) return;

    this.clearActiveTexture();

    const restored = Array.from(
      { length: 6 },
      () => new THREE.MeshBasicMaterial({
        color: 0x101820,
        transparent: true,
        opacity: 0.18,
        depthTest: true,
        depthWrite: false,
        side: THREE.FrontSide
      })
    );

    if (this.activeCube.material) {
      const old = Array.isArray(this.activeCube.material)
        ? this.activeCube.material
        : [this.activeCube.material];

      old.forEach(material => {
        if (!material) return;
        try { material.dispose(); } catch (_) {}
      });
    }

    this.activeCube.material = restored;
    this.activeCube.scale.setScalar(this.ACTIVE_SCALE);
    this.activeCube.visible = false;
    this.activeIndex = -1;

    for (let i = 0; i < 27; i++) {
      const node = this.latticeGroup?.getObjectByName(
        `inactiveNode_${i}`
      );

      if (!node) continue;

      node.material.opacity = 0.28;
      node.material.needsUpdate = true;
    }
  }

  fitCameraToMatrix() {
    if (
      !this.renderer ||
      !this.camera ||
      !this.container ||
      !this.latticeGroup
    ) return;

    // Read live bounding sizes. If they are zero (which can happen during setup switches
    // or when the parent container is display:none), trigger a safe deferred lookup.
    const width = Math.round(this.container.clientWidth || 0);
    const height = Math.round(this.container.clientHeight || 0);

    if (width === 0 || height === 0) {
      const rect = this.container.getBoundingClientRect();
      const rWidth = Math.round(rect.width || 0);
      const rHeight = Math.round(rect.height || 0);

      if (rWidth > 0 && rHeight > 0) {
        this.applyDimensions(rWidth, rHeight);
        return;
      }

      // Schedule a subsequent loop retry frame to let flexbox paints finish
      if (!this._resizeRetryTimer) {
        this._resizeRetryTimer = setTimeout(() => {
          this._resizeRetryTimer = null;
          this.fitCameraToMatrix();
        }, 50);
      }
      return;
    }

    this.applyDimensions(width, height);
  }

  applyDimensions(width, height) {
    const aspect = width / height;
    const isMobile = window.innerWidth < 768;
    const fov = window.innerWidth < 480
      ? 72
      : (isMobile ? 68 : 52);

    this.camera.fov = fov;
    this.camera.aspect = aspect;

    const halfExtent = this.GRID_HALF * 1.45;
    const activeHalfExtent = this.ACTIVE_SIZE * this.ACTIVE_SCALE;
    const extent = Math.max(
      halfExtent,
      halfExtent + activeHalfExtent * 0.10
    );

    const radius =
      Math.sqrt(3) * extent * this.VIEW_PADDING;

    const verticalFov =
      THREE.MathUtils.degToRad(fov);

    const horizontalFov =
      2 *
      Math.atan(
        Math.tan(verticalFov / 2) *
        Math.max(0.1, aspect)
      );

    const verticalDistance =
      radius / Math.tan(verticalFov / 2);

    const horizontalDistance =
      radius / Math.tan(horizontalFov / 2);

    this.camera.position.set(
      0,
      0,
      Math.max(
        verticalDistance,
        horizontalDistance
      ) * 1.05
    );

    this.camera.near = 0.05;
    this.camera.far = Math.max(
      100,
      this.camera.position.z + radius * 8
    );

    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        isMobile ? 1.5 : 2
      )
    );

    this.renderer.setSize(
      width,
      height,
      false
    );
  }

  init(containerElement) {
    if (
      !containerElement ||
      typeof THREE === 'undefined'
    ) {
      console.error(
        '[ThreeDGridEngine] Three.js or #scene-3d is unavailable.'
      );
      return false;
    }

    this.destroy();

    this.container = containerElement;
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.overflow = 'hidden';

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(
      0x06070a,
      0.045
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    if (
      'outputColorSpace' in this.renderer &&
      THREE.SRGBColorSpace
    ) {
      this.renderer.outputColorSpace =
        THREE.SRGBColorSpace;
    }

    if (
      'outputEncoding' in this.renderer &&
      THREE.sRGBEncoding
    ) {
      this.renderer.outputEncoding =
        THREE.sRGBEncoding;
    }

    // Force canvas styling to inherit matching dimensions dynamically
    this.renderer.domElement.style.setProperty('width', '100%', 'important');
    this.renderer.domElement.style.setProperty('height', '100%', 'important');
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D spatial stimulus grid'
    );

    this.container.appendChild(
      this.renderer.domElement
    );

    this.camera = new THREE.PerspectiveCamera(
      52,
      1,
      0.05,
      100
    );

    this.latticeGroup = new THREE.Group();
    this.latticeGroup.name = 'SpatialLattice';
    this.latticeGroup.scale.setScalar(1.45);
    this.scene.add(this.latticeGroup);

    this.latticeGeometry =
      this.buildUnifiedLatticeGeometry();

    this.latticeMaterial =
      new THREE.LineBasicMaterial({
        color: 0x71839a,
        transparent: true,
        opacity: 0.32,
        linewidth: 3,
        depthTest: true,
        depthWrite: false,
        fog: false
      });

    const latticeLines =
      new THREE.LineSegments(
        this.latticeGeometry,
        this.latticeMaterial
      );

    latticeLines.name =
      'UnifiedWireLattice';

    latticeLines.renderOrder = 0;
    this.latticeGroup.add(latticeLines);

    this.createInactiveNodes();
    this.createActiveCube();

    this.textureLoader =
      new THREE.TextureLoader();

    this.resizeHandler =
      () => this.fitCameraToMatrix();

    window.addEventListener(
      'resize',
      this.resizeHandler,
      { passive: true }
    );

    this.orientationHandler =
      () => setTimeout(
        () => this.fitCameraToMatrix(),
        100
      );

    window.addEventListener(
      'orientationchange',
      this.orientationHandler,
      { passive: true }
    );

    if ('ResizeObserver' in window) {
      this.resizeObserver =
        new ResizeObserver(
          () => this.fitCameraToMatrix()
        );

      this.resizeObserver.observe(
        this.container
      );
    }

    // Delay multiple sizing passes to permit CSS/view transitions to finish painting
    this.fitCameraToMatrix();

    requestAnimationFrame(() => {
      this.fitCameraToMatrix();
      requestAnimationFrame(() => {
        this.fitCameraToMatrix();
      });
    });

    setTimeout(() => {
      this.fitCameraToMatrix();
    }, 150);

    this.animate();

    return true;
  }

  animate() {
    if (
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.container
    ) {
      this.animationFrameId = null;
      return;
    }

    if (this.latticeGroup) {
      const speed = Math.max(
        1,
        Math.min(
          100,
          Number(this.rotationSpeed) || 40
        )
      );

      const factor =
        0.35 + ((speed - 1) / 99) * 1.35;

      this.latticeGroup.rotation.x +=
        0.0020 * factor;

      this.latticeGroup.rotation.y +=
        0.0036 * factor;

      this.latticeGroup.rotation.z +=
        0.0014 * factor;
    }

    this.renderer.render(
      this.scene,
      this.camera
    );

    this.animationFrameId =
      requestAnimationFrame(
        () => this.animate()
      );
  }

  setRotationSpeed(value) {
    this.rotationSpeed =
      Math.max(
        1,
        Math.min(
          100,
          Number(value) || 40
        )
      );
  }

  setActiveCell(index, imageSource = null) {
    if (
      !this.activeCube ||
      !this.latticeGroup
    ) {
      return false;
    }

    const safeIndex =
      Math.max(
        0,
        Math.min(
          26,
          Math.floor(Number(index) || 0)
        )
      );

    this.activeIndex = safeIndex;

    this.activeCube.position.copy(
      this.getNodePosition(safeIndex)
    );

    this.activeCube.visible = true;
    this.activeCube.scale.setScalar(
      this.ACTIVE_SCALE
    );

    for (let i = 0; i < 27; i++) {
      const node =
        this.latticeGroup.getObjectByName(
          `inactiveNode_${i}`
        );

      if (!node) continue;

      node.material.opacity =
        i === safeIndex
          ? 0.10
          : 0.28;

      node.material.needsUpdate = true;
    }

    if (imageSource) {
      this.loadStimulusTexture(imageSource);
    } else {
      this.clearActiveTexture();
    }

    return true;
  }

  setStimulusPosition(index, imageSource = null) {
    return this.setActiveCell(
      index,
      imageSource
    );
  }

  clearStimulus() {
    ++this.textureRequestId;
    this.resetNode(this.activeIndex);
  }

  destroy() {
    ++this.textureRequestId;

    if (this._resizeRetryTimer) {
      clearTimeout(this._resizeRetryTimer);
      this._resizeRetryTimer = null;
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(
        this.animationFrameId
      );
      this.animationFrameId = null;
    }

    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (_) {}
      this.resizeObserver = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener(
        'resize',
        this.resizeHandler
      );
      this.resizeHandler = null;
    }

    if (this.orientationHandler) {
      window.removeEventListener(
        'orientationchange',
        this.orientationHandler
      );
      this.orientationHandler = null;
    }

    this.clearActiveTexture();

    if (this.scene) {
      this.scene.traverse(object => {
        if (object.geometry) {
          try { object.geometry.dispose(); } catch (_) {}
        }

        if (object.material) {
          const materials =
            Array.isArray(object.material)
              ? object.material
              : [object.material];

          materials.forEach(material => {
            if (!material) return;

            if (material.map) {
              try { material.map.dispose(); } catch (_) {}
            }

            try { material.dispose(); } catch (_) {}
          });
        }
      });
    }

    if (this.renderer) {
      const canvas =
        this.renderer.domElement;

      try { this.renderer.dispose(); } catch (_) {}

      try {
        if (
          typeof this.renderer.forceContextLoss ===
          'function'
        ) {
          this.renderer.forceContextLoss();
        }
      } catch (_) {}

      if (canvas?.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }

    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.latticeGroup = null;
    this.activeCube = null;
    this.animationFrameId = null;
    this.latticeGeometry = null;
    this.latticeMaterial = null;
    this.textureLoader = null;
    this.activeTexture = null;
    this.container = null;
    this.activeIndex = -1;
  }

  dispose() {
    this.destroy();
  }
}
const ThreeDGrid=new ThreeDGridEngine();

function cleanupRenderers(){
  const grid2d=document.getElementById('grid-2d'),scene3d=document.getElementById('scene-3d');
  try{ThreeDGrid.destroy();}catch(error){console.warn('[Renderer] Three.js teardown warning:',error);}
  if(scene3d){scene3d.classList.remove('active');scene3d.style.display='none';scene3d.setAttribute('aria-hidden','true');scene3d.querySelectorAll('canvas').forEach(c=>c.remove());}
  if(grid2d){grid2d.classList.remove('active');grid2d.style.display='none';grid2d.setAttribute('aria-hidden','true');}
  document.querySelectorAll('.word-interference').forEach(el=>el.remove());
}
function activate2DRenderer(){const g=document.getElementById('grid-2d'),s=document.getElementById('scene-3d');if(s){s.classList.remove('active');s.style.display='none';s.setAttribute('aria-hidden','true');}if(g){g.classList.add('active');g.style.display='grid';g.setAttribute('aria-hidden','false');}}
function activate3DRenderer(){const g=document.getElementById('grid-2d'),s=document.getElementById('scene-3d');if(g){g.classList.remove('active');g.style.display='none';g.setAttribute('aria-hidden','true');g.replaceChildren();}if(!s)return null;s.classList.add('active');s.style.display='flex';s.setAttribute('aria-hidden','false');return s;}


// ==================== GAME ENGINE ====================
