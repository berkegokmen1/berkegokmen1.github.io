import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { feature } from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';

(() => {
  const canvas = document.getElementById('world-canvas');
  const toggle = document.getElementById('world-toggle');
  const exitButton = document.getElementById('world-exit');
  const status = document.getElementById('world-status');
  const worldUi = document.getElementById('world-ui');
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!canvas || !toggle || !exitButton || !status || !worldUi) return;
  if (reducedMotion) {
    toggle.disabled = true;
    toggle.title = '3D world disabled by reduced-motion preference';
    return;
  }

  const keys = new Set();
  const portals = [];
  const animated = [];
  const clock = new THREE.Clock();
  const loader = new THREE.TextureLoader();
  const player = {
    position: new THREE.Vector3(0, 1.65, 8),
    velocity: new THREE.Vector3(),
    verticalVelocity: 0,
    grounded: true,
    yaw: 0,
    pitch: 0,
    boundary: 28
  };

  let renderer;
  let scene;
  let camera;
  let world;
  let stars;
  let nebula;
  let animationId = null;
  let active = false;
  let nearestPortal = null;
  let nearestDistance = Infinity;
  let mode = 'lobby';
  let countryFeatures = null;
  let globeGroup = null;
  let globeHitTarget = null;
  let globeTargetRotation = null;
  let isDraggingGlobe = false;
  let lastPointer = { x: 0, y: 0 };
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  let publications = [];
  let visitedPlaces = [];
  let berkeley = { lat: 37.8715, lon: -122.273 };
  let dataReady = null;

  const loadWorldData = async () => {
    if (dataReady) return dataReady;
    dataReady = Promise.all([
      fetch('data/publications.json').then((response) => response.json()),
      fetch('data/visited-map.json').then((response) => response.json()),
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((response) => response.json())
    ]).then(([publicationData, mapData, worldTopo]) => {
      publications = publicationData.map((publication) => ({
        title: publication.shortTitle || publication.title,
        authors: publication.authors,
        image: publication.media?.src,
        href: publication.links?.find((link) => link.label === 'Project')?.href || publication.links?.[0]?.href,
        color: publication.world?.color || '#4fd1ff',
        position: publication.world?.position || [0, 1.9, -8]
      }));

      const palette = ['#6ee7b7', '#93c5fd', '#60a5fa', '#a78bfa', '#38bdf8', '#f472b6', '#f97316', '#fbbf24'];
      visitedPlaces = [...mapData.countries, ...mapData.states].flatMap((entry) =>
        entry.visits.map((visit, index) => ({
          ...visit,
          year: Number(String(visit.date).slice(0, 4)),
          color: palette[(Number(entry.id) + index) % palette.length]
        }))
      );
      berkeley = mapData.home || berkeley;
      countryFeatures = feature(worldTopo, worldTopo.objects.countries).features;
    });
    return dataReady;
  };

  const resetPlayer = (position = [0, 1.65, 8], yaw = 0, boundary = 28) => {
    globeGroup = null;
    globeHitTarget = null;
    globeTargetRotation = null;
    if (camera) camera.up.set(0, 1, 0);
    player.position.set(...position);
    player.velocity.set(0, 0, 0);
    player.verticalVelocity = 0;
    player.grounded = true;
    player.yaw = yaw;
    player.pitch = 0;
    player.boundary = boundary;
  };

  const clearWorld = () => {
    portals.length = 0;
    animated.length = 0;
    nearestPortal = null;
    nearestDistance = Infinity;
    if (!world) return;
    while (world.children.length) world.remove(world.children[0]);
  };

  const makeTextTexture = ({
    title,
    lines = [],
    accent = '#73d2ff',
    hint = 'Press E',
    width = 1024,
    height = 512,
    titleSize = 78
  }) => {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = width;
    labelCanvas.height = height;
    const ctx = labelCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(6, 10, 24, 0.96)');
    gradient.addColorStop(1, 'rgba(22, 31, 58, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, width - 48, height - 48);
    ctx.fillStyle = accent;
    ctx.fillRect(56, 62, 120, 8);
    ctx.font = `750 ${titleSize}px Inter, Arial, sans-serif`;
    ctx.fillStyle = '#f8fbff';
    wrapText(ctx, title, 56, 190, width - 112, titleSize * 1.02, 2);
    ctx.font = '500 34px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(226, 235, 255, 0.82)';
    lines.slice(0, 4).forEach((line, index) => {
      wrapText(ctx, line, 58, 282 + index * 45, width - 116, 38, 1);
    });
    ctx.font = '700 28px Inter, Arial, sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(hint, 58, height - 72);

    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  };

  const wrapText = (ctx, text, x, y, maxWidth, lineHeight, maxLines) => {
    const words = String(text).split(' ');
    let line = '';
    let lines = 0;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        line = word;
        lines += 1;
        if (lines >= maxLines) return;
      } else {
        line = test;
      }
    }
    if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
  };

  const makePortal = (data, options = {}) => {
    const group = new THREE.Group();
    group.position.set(...data.position);
    group.lookAt(options.lookAt || new THREE.Vector3(0, 1.55, 8));
    group.userData = {
      ...data,
      baseY: data.position[1],
      action: data.action || 'href',
      scene: data.scene || null
    };

    const color = new THREE.Color(data.color);
    const isProject = options.kind === 'project';
    const width = isProject ? 4.2 : 3.8;
    const height = isProject ? 2.45 : 2.25;
    const accent = `#${color.getHexString()}`;

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.14),
      new THREE.MeshPhysicalMaterial({
        color: 0x101827,
        roughness: 0.33,
        metalness: 0.22,
        clearcoat: 0.7,
        emissive: color,
        emissiveIntensity: 0.08
      })
    );
    group.add(panel);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.22, height - 0.35),
      new THREE.MeshBasicMaterial({
        map: makeTextTexture({
          title: data.title,
          lines: data.lines || [data.subtitle || '', data.authors || ''],
          accent,
          hint: data.hint || 'Press E to enter',
          titleSize: isProject ? 58 : 78
        }),
        transparent: true
      })
    );
    label.position.z = 0.09;
    group.add(label);

    if (data.image?.endsWith('.mp4')) {
      const video = document.createElement('video');
      video.src = data.image;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.play().catch(() => {});
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      const image = new THREE.Mesh(
        new THREE.PlaneGeometry(isProject ? 1.35 : 1.15, isProject ? 0.78 : 0.66),
        new THREE.MeshBasicMaterial({ map: texture })
      );
      image.position.set(isProject ? 1.16 : 0.94, isProject ? -0.54 : -0.44, 0.1);
      group.add(image);
    } else if (data.image) {
      loader.load(data.image, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const image = new THREE.Mesh(
          new THREE.PlaneGeometry(isProject ? 1.35 : 1.15, isProject ? 0.78 : 0.66),
          new THREE.MeshBasicMaterial({ map: texture })
        );
        image.position.set(isProject ? 1.16 : 0.94, isProject ? -0.54 : -0.44, 0.1);
        group.add(image);
      });
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(width * 0.62, 0.035, 12, 128),
      new THREE.MeshBasicMaterial({ color: data.color })
    );
    ring.position.z = -0.03;
    ring.scale.y = 0.58;
    group.add(ring);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, width * 0.13, 7.4, 28, 1, true),
      new THREE.MeshBasicMaterial({
        color: data.color,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
    );
    beam.position.y = -0.9;
    group.add(beam);

    animated.push({ group, ring, beam, kind: options.kind || 'portal' });
    portals.push(group);
    world.add(group);
    return group;
  };

  const addFloor = (radius = 32, color = 0x09111f) => {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 128),
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.68,
        metalness: 0.22,
        emissive: 0x06152d,
        emissiveIntensity: 0.45
      })
    );
    floor.rotation.x = -Math.PI / 2;
    world.add(floor);

    const grid = new THREE.GridHelper(radius * 2, radius * 2, 0x38bdf8, 0x1e3a8a);
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    world.add(grid);
  };

  const addNeonPath = (x, z, width, depth, color, opacity = 0.28) => {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, 0.012, z);
    world.add(strip);
  };

  const addFloatingLabel = (title, lines, position, accent = '#73d2ff', size = [4.8, 1.5]) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({
        map: makeTextTexture({ title, lines, accent, hint: '', titleSize: 64 }),
        transparent: true
      })
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 1.65, 8);
    world.add(mesh);
    animated.push({ group: mesh, kind: 'label', baseY: position[1] });
    return mesh;
  };

  const addLobbyPortal = (position = [0, 1.8, 7]) => {
    makePortal(
      {
        title: 'Lobby',
        subtitle: 'Return to the main hub',
        lines: ['Return to the main hub'],
        color: 0x73d2ff,
        position,
        action: 'scene',
        scene: 'lobby',
        hint: 'Press E to return'
      },
      { lookAt: new THREE.Vector3(0, 1.5, -5) }
    );
  };

  const buildLobby = () => {
    mode = 'lobby';
    clearWorld();
    scene.background = new THREE.Color(0x050813);
    scene.fog = new THREE.FogExp2(0x070b18, 0.035);
    resetPlayer([0, 1.65, 8], 0, 28);
    addFloor(32, 0x09111f);
    addNeonPath(-3.4, -2.6, 1.4, 16, 0x2563eb);
    addNeonPath(3.4, -2.6, 1.4, 16, 0x7c3aed);
    addNeonPath(0, 3.4, 12, 1.1, 0x06b6d4, 0.22);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 2.25, 0.42, 80),
      new THREE.MeshPhysicalMaterial({
        color: 0x101827,
        metalness: 0.5,
        roughness: 0.28,
        emissive: 0x123e78,
        emissiveIntensity: 0.3
      })
    );
    hub.position.y = 0.21;
    world.add(hub);
    addFloatingLabel('Berke Gokmen', ['3D research portfolio lobby'], [0, 2.65, -0.8], '#73d2ff');

    makePortal(
      {
        title: 'Publications',
        subtitle: 'Project portals',
        lines: ['Walk through to browse papers as floating project gates.'],
        color: 0x4fd1ff,
        position: [-4.4, 1.9, -7],
        action: 'scene',
        scene: 'publications',
        hint: 'Press E to browse'
      },
      { lookAt: new THREE.Vector3(0, 1.5, 8) }
    );

    makePortal(
      {
        title: 'Visited Places',
        subtitle: 'World globe',
        lines: ['A 3D globe based on the visited-places map.'],
        color: 0xfbbf24,
        position: [4.4, 1.9, -7],
        action: 'scene',
        scene: 'map',
        hint: 'Press E to explore'
      },
      { lookAt: new THREE.Vector3(0, 1.5, 8) }
    );

    addSkyline(20);
  };

  const buildPublications = () => {
    mode = 'publications';
    clearWorld();
    scene.background = new THREE.Color(0x070714);
    scene.fog = new THREE.FogExp2(0x09091d, 0.032);
    resetPlayer([0, 1.65, 8], 0, 30);
    addFloor(34, 0x0d1022);
    addNeonPath(0, -8, 2.0, 18, 0x4fd1ff, 0.26);
    addNeonPath(-5.2, -8, 1.0, 13, 0x8b5cf6, 0.18);
    addNeonPath(5.2, -8, 1.0, 13, 0x38f2a6, 0.18);
    addFloatingLabel('Publications', ['Approach a project and press E to open its page.'], [0, 3.2, -1.5], '#a7f3d0');
    addLobbyPortal([0, 1.75, 18]);

    publications.forEach((pub, index) => {
      const portal = makePortal(
        {
          ...pub,
          lines: [pub.authors],
          hint: 'Press E to open project'
        },
        { kind: 'project', lookAt: new THREE.Vector3(0, 1.55, 8) }
      );
      portal.userData.floatPhase = index * 0.8;
    });
  };

  const buildMap = () => {
    mode = 'map';
    clearWorld();
    scene.background = new THREE.Color(0x030814);
    scene.fog = new THREE.FogExp2(0x030814, 0.024);
    resetPlayer([0, 1.65, 12], 0, 34);
    addFloor(36, 0x07111f);
    addFloatingLabel('Visited Places', ['Walk around the room. The floor beam returns home.'], [0, 7.2, -10], '#fbbf24', [6.4, 1.7]);

    const globeRadius = 6.2;
    const globeCenter = new THREE.Vector3(0, 4.2, -10);
    globeGroup = new THREE.Group();
    globeGroup.position.copy(globeCenter);
    world.add(globeGroup);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius, 160, 96),
      new THREE.MeshPhysicalMaterial({
        color: 0x0b4f78,
        map: makeWorldMapTexture(),
        roughness: 0.62,
        metalness: 0.08,
        clearcoat: 0.35,
        emissive: 0x06304f,
        emissiveIntensity: 0.35
      })
    );
    globeGroup.add(globe);
    globeHitTarget = globe;
    animated.push({ group: globe, kind: 'globe' });

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(globeRadius * 1.035, 96, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
      })
    );
    globeGroup.add(atmosphere);

    addGlobeGrid(new THREE.Vector3(), globeRadius, globeGroup);
    addCountryBorders(new THREE.Vector3(), globeRadius, globeGroup);
    addVisitedPins(new THREE.Vector3(), globeRadius, globeGroup);
    addHomeGate([-5.2, 1.75, 7]);
  };

  const makeWorldMapTexture = () => {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 2048;
    textureCanvas.height = 1024;
    const ctx = textureCanvas.getContext('2d');
    const ocean = ctx.createLinearGradient(0, 0, 0, textureCanvas.height);
    ocean.addColorStop(0, '#0b4f78');
    ocean.addColorStop(1, '#062d4f');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

    if (countryFeatures) {
      ctx.fillStyle = '#1fbf9a';
      ctx.strokeStyle = 'rgba(219, 245, 255, 0.72)';
      ctx.lineWidth = 1.1;
      countryFeatures.forEach((country) => {
        const polygons = country.geometry.type === 'Polygon' ? [country.geometry.coordinates] : country.geometry.coordinates;
        polygons.forEach((polygon) => {
          polygon.forEach((ring) => {
            drawProjectedRing(ctx, ring, textureCanvas.width, textureCanvas.height);
            ctx.fill();
            ctx.stroke();
          });
        });
      });
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  };

  const drawProjectedRing = (ctx, ring, width, height) => {
    let started = false;
    let previousX = 0;
    ctx.beginPath();
    ring.forEach(([lon, lat]) => {
      const x = ((lon + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (!started || Math.abs(x - previousX) > width * 0.5) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      previousX = x;
    });
    ctx.closePath();
  };

  const latLngToVector = (lat, lon, radius) => {
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon + 122);
    return new THREE.Vector3(
      radius * Math.cos(latRad) * Math.sin(lonRad),
      radius * Math.sin(latRad),
      radius * Math.cos(latRad) * Math.cos(lonRad)
    );
  };

  const addGlobeGrid = (center, radius, target = world) => {
    const material = new THREE.LineBasicMaterial({
      color: 0x9bdcff,
      transparent: true,
      opacity: 0.23,
      blending: THREE.AdditiveBlending
    });

    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let lon = -180; lon <= 180; lon += 4) {
        points.push(center.clone().add(latLngToVector(lat, lon, radius + 0.025)));
      }
      target.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material));
    }

    for (let lon = -180; lon < 180; lon += 30) {
      const points = [];
      for (let lat = -84; lat <= 84; lat += 4) {
        points.push(center.clone().add(latLngToVector(lat, lon, radius + 0.03)));
      }
      target.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    }
  };

  const addCountryBorders = (center, radius, target = world) => {
    if (!countryFeatures) return;
    const material = new THREE.LineBasicMaterial({
      color: 0xb9e6ff,
      transparent: true,
      opacity: 0.52
    });

    const addRing = (ring) => {
      if (!ring || ring.length < 2) return;
      const points = ring.map(([lon, lat]) => center.clone().add(latLngToVector(lat, lon, radius + 0.055)));
      target.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    };

    countryFeatures.forEach((country) => {
      if (country.geometry.type === 'Polygon') {
        country.geometry.coordinates.forEach(addRing);
      }
      if (country.geometry.type === 'MultiPolygon') {
        country.geometry.coordinates.forEach((polygon) => polygon.forEach(addRing));
      }
    });
  };

  const addVisitedPins = (center, radius, target = world) => {
    const berkeleyPoint = center.clone().add(latLngToVector(berkeley.lat, berkeley.lon, radius + 0.18));
    visitedPlaces.forEach((place, index) => {
      const normal = latLngToVector(place.lat, place.lon, 1).normalize();
      const surface = center.clone().add(normal.clone().multiplyScalar(radius + 0.22));
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 18, 18),
        new THREE.MeshBasicMaterial({ color: place.color })
      );
      pin.position.copy(surface);
      target.add(pin);
      animated.push({ group: pin, kind: 'pin', baseScale: 1, phase: index * 0.45 });

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.5, 10),
        new THREE.MeshBasicMaterial({ color: place.color })
      );
      stem.position.copy(center).add(normal.clone().multiplyScalar(radius + 0.02));
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      target.add(stem);

      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.18, 0.38),
        new THREE.MeshBasicMaterial({
          map: makeTextTexture({
            title: place.name,
            lines: [String(place.year)],
            accent: `#${new THREE.Color(place.color).getHexString()}`,
            hint: '',
            width: 768,
            height: 256,
            titleSize: 32
          }),
          transparent: true
        })
      );
      label.position.copy(center).add(normal.clone().multiplyScalar(radius + 0.46));
      label.lookAt(camera.position);
      target.add(label);
      animated.push({ group: label, kind: 'billboard' });

      const connector = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          surface,
          label.position.clone()
        ]),
        new THREE.LineBasicMaterial({
          color: place.color,
          transparent: true,
          opacity: 0.58
        })
      );
      target.add(connector);

      if (place.name !== 'Berkeley EECS Visit Days') {
        addGlobeArc(berkeleyPoint, surface, place.color, target);
      }
    });
  };

  const addGlobeArc = (from, to, color, target = world) => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const lift = mid.clone().normalize().multiplyScalar(1.6);
    const curve = new THREE.QuadraticBezierCurve3(from, mid.add(lift), to);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(36)),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.44,
        blending: THREE.AdditiveBlending
      })
    );
    target.add(line);
  };

  const addHomeGate = (position) => {
    makePortal(
      {
        title: 'Home',
        subtitle: 'Return to lobby',
        lines: ['Return to the lobby'],
        color: 0xfbbf24,
        position,
        action: 'scene',
        scene: 'lobby',
        hint: 'Press E'
      },
      { lookAt: new THREE.Vector3(0, 1.55, 12), kind: 'home' }
    );
  };

  const addSkyline = (count) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.35,
      roughness: 0.38,
      transparent: true,
      opacity: 0.78,
      emissive: 0x123e78,
      emissiveIntensity: 0.2
    });
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 16 + Math.sin(i * 1.7) * 4;
      const height = 2 + Math.random() * 6;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.7, height, 0.7), material);
      tower.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      tower.rotation.y = angle;
      world.add(tower);
    }
  };

  const initScene = () => {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 130);
    world = new THREE.Group();
    scene.add(world);

    scene.add(new THREE.HemisphereLight(0x9cc7ff, 0x080b12, 1.45));
    const keyLight = new THREE.DirectionalLight(0x9cc7ff, 2.2);
    keyLight.position.set(4, 8, 6);
    scene.add(keyLight);
    const glowLight = new THREE.PointLight(0x5eead4, 70, 30);
    glowLight.position.set(0, 4, 0);
    scene.add(glowLight);

    addAtmosphere();
    resizeWorld();
    buildLobby();
  };

  const addAtmosphere = () => {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1800;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 90;
      positions[i3 + 1] = Math.random() * 34 + 1;
      positions[i3 + 2] = (Math.random() - 0.5) * 90;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xbcd7ff,
        size: 0.055,
        transparent: true,
        opacity: 0.76
      })
    );
    scene.add(stars);

    const nebulaGeometry = new THREE.BufferGeometry();
    const nebulaCount = 320;
    const nebulaPositions = new Float32Array(nebulaCount * 3);
    for (let i = 0; i < nebulaCount; i += 1) {
      const i3 = i * 3;
      nebulaPositions[i3] = (Math.random() - 0.5) * 54;
      nebulaPositions[i3 + 1] = Math.random() * 12 + 2;
      nebulaPositions[i3 + 2] = (Math.random() - 0.5) * 54;
    }
    nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(nebulaPositions, 3));
    nebula = new THREE.Points(
      nebulaGeometry,
      new THREE.PointsMaterial({
        color: 0x5eead4,
        size: 0.22,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending
      })
    );
    scene.add(nebula);
  };

  const resizeWorld = () => {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };

  const requestLook = () => {
    if (!active || document.pointerLockElement === canvas) return;
    try {
      const lockRequest = canvas.requestPointerLock?.();
      if (lockRequest?.catch) lockRequest.catch(() => {});
    } catch {
      // Pointer lock may be unavailable in embedded/headless browsers.
    }
  };

  const pointerHitsGlobe = (event) => {
    if (!globeHitTarget || !camera) return false;
    pointerNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    return raycaster.intersectObject(globeHitTarget, false).length > 0;
  };

  const switchScene = (nextMode) => {
    if (nextMode === 'lobby') buildLobby();
    if (nextMode === 'publications') buildPublications();
    if (nextMode === 'map') buildMap();
  };

  const interact = () => {
    if (!nearestPortal) return;
    const data = nearestPortal.userData;
    if (nearestDistance >= 4.2) return;
    if (data.action === 'scene') {
      switchScene(data.scene);
      return;
    }
    if (data.href) window.location.href = data.href;
  };

  const updateCamera = (delta) => {
    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const side = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 8.2 : 4.8;
    const direction = new THREE.Vector3();
    const front = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

    direction.addScaledVector(front, forward);
    direction.addScaledVector(right, side);
    if (direction.lengthSq() > 0) direction.normalize();

    player.velocity.x += direction.x * speed * delta * 7;
    player.velocity.z += direction.z * speed * delta * 7;
    player.velocity.multiplyScalar(Math.pow(0.0008, delta));
    player.position.x += player.velocity.x * delta;
    player.position.z += player.velocity.z * delta;

    const radius = Math.hypot(player.position.x, player.position.z);
    if (radius > player.boundary) {
      player.position.x *= player.boundary / radius;
      player.position.z *= player.boundary / radius;
    }

    player.verticalVelocity -= 18 * delta;
    player.position.y += player.verticalVelocity * delta;
    if (player.position.y <= 1.65) {
      player.position.y = 1.65;
      player.verticalVelocity = 0;
      player.grounded = true;
    }

    camera.position.copy(player.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  };

  const updatePortalState = (time) => {
    nearestPortal = null;
    nearestDistance = Infinity;

    portals.forEach((portal) => {
      const portalPosition = new THREE.Vector3();
      portal.getWorldPosition(portalPosition);
      const distance = portalPosition.distanceTo(player.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPortal = portal;
      }
    });

    animated.forEach((item, index) => {
      if (item.kind === 'label') {
        item.group.position.y = item.baseY + Math.sin(time * 1.2 + index) * 0.08;
        return;
      }
      if (item.kind === 'billboard') {
        item.group.lookAt(camera.position);
        return;
      }
      if (item.kind === 'pin') {
        const scale = 1 + Math.sin(time * 3 + item.phase) * 0.22;
        item.group.scale.setScalar(scale);
        return;
      }
      if (item.kind === 'globe') {
        return;
      }
      if (item.kind === 'home') {
        item.ring.rotation.z = time * 0.4;
        item.beam.material.opacity = 0.12 + Math.sin(time * 2 + index) * 0.04;
        return;
      }
      if (item.kind === 'marker') {
        item.group.position.y = item.baseY + Math.sin(time * 2.5) * 0.18;
        item.group.rotation.y = time * 1.2;
        return;
      }
      const pulse = 1 + Math.sin(time * 2.2 + index) * 0.035;
      item.ring.scale.set(1, 0.58 * pulse, 1);
      item.ring.rotation.z = time * 0.4;
      item.beam.material.opacity = 0.12 + Math.sin(time * 2 + index) * 0.04;
      item.group.position.y = item.group.userData.baseY + Math.sin(time * 1.4 + index) * 0.09;
    });

    const promptRadius = 4.2;
    if (nearestPortal && nearestDistance < promptRadius) {
      status.textContent = `${nearestPortal.userData.title} - press E`;
    } else if (mode === 'map') {
      status.textContent = 'map | arrows rotate globe | WASD walk | Space jump | drag globe | Home beam returns';
    } else if (document.pointerLockElement === canvas) {
      status.textContent = `${mode} | WASD move | Space jump | mouse look | Shift sprint | E enter | X exit`;
    } else {
      status.textContent = `${mode} | click to look | WASD move | Space jump | E enter`;
    }
  };

  const animateWorld = () => {
    if (!active) return;
    const delta = Math.min(clock.getDelta(), 0.045);
    const time = clock.elapsedTime;

    updateCamera(delta);
    updatePortalState(time);
    if (mode === 'map' && globeGroup) {
      const rotateY = Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'));
      const rotateX = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
      globeGroup.rotation.y += rotateY * delta * 1.8;
      globeGroup.rotation.x += rotateX * delta * 1.25;
      globeGroup.rotation.x = Math.max(-1.15, Math.min(1.15, globeGroup.rotation.x));
      if (rotateX || rotateY) globeTargetRotation = null;
    }
    if (globeGroup && globeTargetRotation) {
      globeGroup.rotation.x += (globeTargetRotation.x - globeGroup.rotation.x) * 0.07;
      globeGroup.rotation.y += (globeTargetRotation.y - globeGroup.rotation.y) * 0.07;
      globeGroup.rotation.z += (globeTargetRotation.z - globeGroup.rotation.z) * 0.07;
    }
    stars.rotation.y = time * 0.012;
    nebula.rotation.y = -time * 0.025;
    world.rotation.y = Math.sin(time * 0.08) * 0.006;

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animateWorld);
  };

  const setWorldMode = async (enabled) => {
    active = enabled;
    root.classList.toggle('world-3d', active);
    toggle.setAttribute('aria-pressed', String(active));
    worldUi.setAttribute('aria-hidden', String(!active));

    if (active) {
      await loadWorldData();
      if (!renderer) initScene();
      buildLobby();
      clock.start();
      animateWorld();
    } else {
      document.exitPointerLock?.();
      keys.clear();
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
  };

  window.addEventListener('resize', resizeWorld);
  window.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (player.grounded) {
        player.verticalVelocity = 7.2;
        player.grounded = false;
      }
    }
    keys.add(event.code);
    if (event.code === 'KeyE' || event.code === 'Enter') interact();
    if (event.code === 'KeyX') setWorldMode(false);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('mousemove', (event) => {
    if (!active || isDraggingGlobe || document.pointerLockElement !== canvas) return;
    player.yaw -= event.movementX * 0.0021;
    player.pitch -= event.movementY * 0.0021;
    player.pitch = Math.max(-1.08, Math.min(1.08, player.pitch));
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (!active) return;
    if (mode === 'map' && pointerHitsGlobe(event)) {
      isDraggingGlobe = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      return;
    }
    requestLook();
  });
  window.addEventListener('pointerup', () => {
    isDraggingGlobe = false;
  });
  window.addEventListener('pointermove', (event) => {
    if (!isDraggingGlobe || !globeGroup) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    globeGroup.rotation.y += dx * 0.006;
    globeGroup.rotation.x -= dy * 0.004;
    globeGroup.rotation.x = Math.max(-0.9, Math.min(0.9, globeGroup.rotation.x));
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  exitButton.addEventListener('click', () => setWorldMode(false));
  toggle.addEventListener('click', () => setWorldMode(!active));
})();
