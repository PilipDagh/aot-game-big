/**
 * SceneManager.js
 * Attack on Titan Wall Rose District Procedural Generator, Environment Lighting & Mesh Registry
 */
import * as THREE from 'three';

export class SceneManager {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.grappleMeshes = [];
    this.colliders = []; // AABB { min: THREE.Vector3, max: THREE.Vector3, isRoof: boolean }
    this.districtSize = 600;
    this.wallRadius = 300;
    this.wallHeight = 50;

    this.initAtmosphere();
    this.createGround();
    this.createWallRose();
    this.createDistrictBuildings();
    this.createStreetProps();
  }

  initAtmosphere() {
    // Sky color & exponential distance fog matching Wall Rose horizon
    const skyColor = 0xbfd1e5;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.0035);

    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Sky/ground hemisphere light for warm sunlight / cool ground bounce
    const hemiLight = new THREE.HemisphereLight(0xfff7e6, 0x6e7888, 0.45);
    hemiLight.position.set(0, 100, 0);
    this.scene.add(hemiLight);

    // Directional Sun Light with high-resolution shadow mapping
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sunLight.position.set(150, 200, 100);
    sunLight.castShadow = true;

    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 600;

    const shadowDist = 260;
    sunLight.shadow.camera.left = -shadowDist;
    sunLight.shadow.camera.right = shadowDist;
    sunLight.shadow.camera.top = shadowDist;
    sunLight.shadow.camera.bottom = -shadowDist;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;

    this.scene.add(sunLight);
    this.sunLight = sunLight;
  }

  // Generate procedural cobblestone canvas texture
  createCobblestoneTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base dirt/stone color
    ctx.fillStyle = '#655e53';
    ctx.fillRect(0, 0, 512, 512);

    // Draw irregular cobblestones
    ctx.fillStyle = '#8e8678';
    ctx.strokeStyle = '#423d34';
    ctx.lineWidth = 3;

    const rows = 32;
    const cols = 32;
    const cellW = 512 / cols;
    const cellH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 0) ? 0 : cellW * 0.5;
      for (let c = 0; c < cols; c++) {
        const x = c * cellW + offsetX;
        const y = r * cellH;
        const jitterX = (Math.random() - 0.5) * 4;
        const jitterY = (Math.random() - 0.5) * 4;

        ctx.beginPath();
        ctx.roundRect(x + 2 + jitterX, y + 2 + jitterY, cellW - 4, cellH - 4, 3);
        const shade = Math.floor(130 + Math.random() * 30);
        ctx.fillStyle = `rgb(${shade}, ${shade - 6}, ${shade - 14})`;
        ctx.fill();
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(30, 30);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  // Procedural medieval wall texture
  createWallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#a69f94';
    ctx.fillRect(0, 0, 512, 512);

    // Large stone blocks
    ctx.strokeStyle = '#5a544b';
    ctx.lineWidth = 4;
    const rows = 16;
    const cols = 8;
    const h = 512 / rows;
    const w = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (w / 2);
      ctx.beginPath();
      ctx.moveTo(0, r * h);
      ctx.lineTo(512, r * h);
      ctx.stroke();

      for (let c = 0; c < cols; c++) {
        const x = (c * w + offset) % 512;
        ctx.beginPath();
        ctx.moveTo(x, r * h);
        ctx.lineTo(x, (r + 1) * h);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  // Procedural timber/plaster building facade texture
  createBuildingTexture(colorVariant = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const baseColors = ['#d4ccb8', '#c9beac', '#e0d5c1', '#b8ae9d'];
    ctx.fillStyle = baseColors[colorVariant % baseColors.length];
    ctx.fillRect(0, 0, 256, 256);

    // Timber beams (dark wood framing)
    ctx.fillStyle = '#422817';
    // Vertical posts
    ctx.fillRect(0, 0, 16, 256);
    ctx.fillRect(120, 0, 16, 256);
    ctx.fillRect(240, 0, 16, 256);
    // Horizontal beams
    ctx.fillRect(0, 0, 256, 16);
    ctx.fillRect(0, 120, 256, 16);
    ctx.fillRect(0, 240, 256, 16);

    // Windows with glass reflections
    ctx.fillStyle = '#2a3b4c';
    ctx.fillRect(36, 36, 48, 64);
    ctx.fillRect(156, 36, 48, 64);
    ctx.fillRect(36, 156, 48, 64);
    ctx.fillRect(156, 156, 48, 64);

    // Window muntin bars
    ctx.fillStyle = '#e8f0f8';
    ctx.fillRect(58, 36, 4, 64);
    ctx.fillRect(36, 66, 48, 4);
    ctx.fillRect(178, 36, 4, 64);
    ctx.fillRect(156, 66, 48, 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  // Procedural terracotta roof tile texture
  createRoofTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#8f3d2e'; // terracotta red-brown
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#6e2a1e';
    for (let y = 0; y < 256; y += 16) {
      ctx.fillRect(0, y, 256, 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  createGround() {
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.createCobblestoneTexture(),
      roughness: 0.9,
      metalness: 0.1,
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    groundMesh.name = 'Ground';

    this.scene.add(groundMesh);
    this.grappleMeshes.push(groundMesh);

    // Collidable ground plane
    this.colliders.push({
      min: new THREE.Vector3(-600, -10, -600),
      max: new THREE.Vector3(600, 0, 600),
      isGround: true
    });
  }

  // Wall Rose: 50m tall circular perimeter, radius 300 units, with top walkable battlements
  createWallRose() {
    const wallGroup = new THREE.Group();
    wallGroup.name = 'WallRose';

    const wallTex = this.createWallTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.85,
      metalness: 0.1,
    });

    const wallInnerRadius = this.wallRadius - 6;
    const wallOuterRadius = this.wallRadius + 6;
    const wallHeight = this.wallHeight;

    // Circular Wall Cylinder Mesh (Hollow Tube)
    // We use a cylinder with 48 segments
    const segments = 64;
    const wallShape = new THREE.Shape();
    wallShape.absarc(0, 0, wallOuterRadius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, wallInnerRadius, 0, Math.PI * 2, true);
    wallShape.holes.push(hole);

    const extrudeSettings = {
      depth: wallHeight,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.8,
      bevelThickness: 0.8
    };

    const wallGeo = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);
    wallGeo.rotateX(Math.PI / 2); // Lay flat so extrusion goes up Y

    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(0, wallHeight, 0);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    wallGroup.add(wallMesh);
    this.grappleMeshes.push(wallMesh);

    // Add battlements / parapets and watchtowers along the rim
    const battlementMat = new THREE.MeshStandardMaterial({
      color: 0x888075,
      roughness: 0.9,
    });

    const towerCount = 12;
    for (let i = 0; i < towerCount; i++) {
      const angle = (i / towerCount) * Math.PI * 2;
      const tx = Math.cos(angle) * this.wallRadius;
      const tz = Math.sin(angle) * this.wallRadius;

      // Watchtower cylinder
      const towerGeo = new THREE.CylinderGeometry(8, 9, wallHeight + 10, 16);
      const towerMesh = new THREE.Mesh(towerGeo, wallMat);
      towerMesh.position.set(tx, (wallHeight + 10) / 2, tz);
      towerMesh.castShadow = true;
      towerMesh.receiveShadow = true;
      wallGroup.add(towerMesh);
      this.grappleMeshes.push(towerMesh);

      // Tower conical roof
      const roofGeo = new THREE.ConeGeometry(9.5, 8, 16);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a2d22, roughness: 0.7 });
      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.set(tx, wallHeight + 10 + 4, tz);
      wallGroup.add(roofMesh);
      this.grappleMeshes.push(roofMesh);

      // Tower collider
      this.colliders.push({
        min: new THREE.Vector3(tx - 9, 0, tz - 9),
        max: new THREE.Vector3(tx + 9, wallHeight + 14, tz + 9),
        isRoof: true
      });
    }

    // Wall top walkway collider ring segments
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      const midA = (a1 + a2) / 2;
      const mx = Math.cos(midA) * this.wallRadius;
      const mz = Math.sin(midA) * this.wallRadius;

      const segWidth = (Math.PI * 2 * this.wallRadius) / segments;
      const halfW = segWidth / 2 + 2;

      this.colliders.push({
        min: new THREE.Vector3(mx - halfW, 0, mz - halfW),
        max: new THREE.Vector3(mx + halfW, wallHeight, mz + halfW),
        isWall: true,
        isRoof: true
      });
    }

    this.scene.add(wallGroup);
  }

  // Procedural District Layout: 80+ buildings configured in grid blocks with canyons and spires
  createDistrictBuildings() {
    const buildingGroup = new THREE.Group();
    buildingGroup.name = 'DistrictBuildings';

    const roofMat = new THREE.MeshStandardMaterial({
      map: this.createRoofTexture(),
      roughness: 0.75,
      metalness: 0.1
    });

    const blockCountX = 6;
    const blockCountZ = 6;
    const blockSize = 65;
    const streetWidth = 24; // wide enough for Titan lumbering and ODM swinging

    let bIndex = 0;
    const startX = -((blockCountX * (blockSize + streetWidth)) / 2) + blockSize / 2;
    const startZ = -((blockCountZ * (blockSize + streetWidth)) / 2) + blockSize / 2;

    for (let bx = 0; bx < blockCountX; bx++) {
      for (let bz = 0; bz < blockCountZ; bz++) {
        // District block center
        const blockCenterX = startX + bx * (blockSize + streetWidth);
        const blockCenterZ = startZ + bz * (blockSize + streetWidth);

        // Distance from center of district
        const distFromCenter = Math.sqrt(blockCenterX * blockCenterX + blockCenterZ * blockCenterZ);
        if (distFromCenter > this.wallRadius - 35) continue; // Keep within wall bounds

        // Center church/spire in district core
        const isCoreSquare = (bx === 2 || bx === 3) && (bz === 2 || bz === 3);
        if (isCoreSquare && bx === 2 && bz === 2) {
          // Cathedral with 45m Spire
          this.createChurchCathedral(buildingGroup, blockCenterX, blockCenterZ, roofMat);
          continue;
        }

        // Each block contains 2 to 4 varied buildings
        const subBuildings = [
          { ox: -16, oz: -16, w: 26, d: 26 },
          { ox: 16, oz: -16, w: 24, d: 24 },
          { ox: -16, oz: 16, w: 24, d: 26 },
          { ox: 16, oz: 16, w: 26, d: 24 },
        ];

        for (const sub of subBuildings) {
          const posX = blockCenterX + sub.ox + (Math.random() - 0.5) * 3;
          const posZ = blockCenterZ + sub.oz + (Math.random() - 0.5) * 3;
          const width = sub.w + (Math.random() - 0.5) * 4;
          const depth = sub.d + (Math.random() - 0.5) * 4;
          const height = 16 + Math.random() * 18; // 16m to 34m

          this.createMedievalBuilding(
            buildingGroup,
            posX,
            posZ,
            width,
            height,
            depth,
            bIndex++,
            roofMat
          );
        }
      }
    }

    this.scene.add(buildingGroup);
  }

  // Create a 3-part medieval timber building with sloped tile roof & overhang
  createMedievalBuilding(parent, x, z, width, height, depth, variant, roofMat) {
    const buildingMeshGroup = new THREE.Group();
    buildingMeshGroup.position.set(x, 0, z);

    const facadeMat = new THREE.MeshStandardMaterial({
      map: this.createBuildingTexture(variant),
      roughness: 0.85,
      metalness: 0.1
    });

    // 1. Lower stone ground floor (slightly wider base)
    const baseHeight = Math.min(6, height * 0.25);
    const baseGeo = new THREE.BoxGeometry(width + 0.6, baseHeight, depth + 0.6);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x8a8479,
      roughness: 0.9,
    });
    const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    buildingMeshGroup.add(baseMesh);

    // 2. Main timber upper stories with architectural overhang
    const upperHeight = height - baseHeight;
    const upperGeo = new THREE.BoxGeometry(width, upperHeight, depth);
    const upperMesh = new THREE.Mesh(upperGeo, facadeMat);
    upperMesh.position.y = baseHeight + upperHeight / 2;
    upperMesh.castShadow = true;
    upperMesh.receiveShadow = true;
    buildingMeshGroup.add(upperMesh);

    // 3. Gable Roof with terracotta tiles
    const roofHeight = 5 + Math.random() * 3;
    const roofGeo = new THREE.ConeGeometry(
      Math.max(width, depth) * 0.72,
      roofHeight,
      4
    );
    roofGeo.rotateY(Math.PI / 4); // align square cone with building
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.y = height + roofHeight / 2;
    roofMesh.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    buildingMeshGroup.add(roofMesh);

    // 4. Chimney accent
    if (Math.random() > 0.4) {
      const chimneyGeo = new THREE.BoxGeometry(1.5, roofHeight + 2, 1.5);
      const chimneyMesh = new THREE.Mesh(chimneyGeo, stoneMat);
      chimneyMesh.position.set(width * 0.25, height + roofHeight * 0.5, depth * 0.25);
      chimneyMesh.castShadow = true;
      buildingMeshGroup.add(chimneyMesh);
    }

    parent.add(buildingMeshGroup);

    // Register for ODM raycast grappling
    this.grappleMeshes.push(baseMesh, upperMesh, roofMesh);

    // Precalculate AABB collider for physical movement & collision detection
    const totalTop = height + roofHeight;
    const halfW = (width + 0.6) / 2;
    const halfD = (depth + 0.6) / 2;

    this.colliders.push({
      min: new THREE.Vector3(x - halfW, 0, z - halfD),
      max: new THREE.Vector3(x + halfW, totalTop, z + halfD),
      wallTop: height,
      roofTop: totalTop,
      isRoof: true
    });
  }

  // Create High Church Cathedral with 45m Spire for epic vertical ODM grappling
  createChurchCathedral(parent, x, z, roofMat) {
    const cathedral = new THREE.Group();
    cathedral.position.set(x, 0, z);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x9e988e,
      roughness: 0.8,
    });

    // Nave body (wide hall)
    const naveGeo = new THREE.BoxGeometry(32, 24, 48);
    const nave = new THREE.Mesh(naveGeo, stoneMat);
    nave.position.y = 12;
    nave.castShadow = true;
    nave.receiveShadow = true;
    cathedral.add(nave);

    // Nave pitched roof
    const roofGeo = new THREE.ConeGeometry(32, 10, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 24 + 5;
    roof.scale.set(1, 1, 1.5);
    cathedral.add(roof);

    // Bell Tower & 45m Spire
    const towerGeo = new THREE.BoxGeometry(14, 38, 14);
    const tower = new THREE.Mesh(towerGeo, stoneMat);
    tower.position.set(0, 19, -20);
    tower.castShadow = true;
    cathedral.add(tower);

    // Needle Spire
    const spireGeo = new THREE.ConeGeometry(7, 18, 8);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x3d4a52, roughness: 0.5, metalness: 0.3 });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.set(0, 38 + 9, -20);
    spire.castShadow = true;
    cathedral.add(spire);

    parent.add(cathedral);

    this.grappleMeshes.push(nave, roof, tower, spire);

    this.colliders.push({
      min: new THREE.Vector3(x - 16, 0, z - 24),
      max: new THREE.Vector3(x + 16, 30, z + 24),
      roofTop: 30,
      isRoof: true
    });
    this.colliders.push({
      min: new THREE.Vector3(x - 8, 0, z - 28),
      max: new THREE.Vector3(x + 8, 47, z - 12),
      roofTop: 47,
      isRoof: true
    });
  }

  createStreetProps() {
    // Wall Rose battlements defense cannons
    const cannonCount = 16;
    const cannonGeo = new THREE.CylinderGeometry(0.4, 0.6, 3, 8);
    cannonGeo.rotateX(Math.PI / 2);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });

    for (let i = 0; i < cannonCount; i++) {
      const angle = (i / cannonCount) * Math.PI * 2;
      const cx = Math.cos(angle) * (this.wallRadius - 2);
      const cz = Math.sin(angle) * (this.wallRadius - 2);

      const cannon = new THREE.Mesh(cannonGeo, cannonMat);
      cannon.position.set(cx, this.wallHeight + 1.2, cz);
      cannon.lookAt(cx * 1.5, this.wallHeight + 1.2, cz * 1.5);
      this.scene.add(cannon);
      this.grappleMeshes.push(cannon);
    }
  }

  // Returns array of objects that can be grappled onto
  getGrappleMeshes() {
    return this.grappleMeshes;
  }

  // Returns list of bounding boxes for continuous Swept AABB checks
  getColliders() {
    return this.colliders;
  }
}
