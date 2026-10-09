import * as THREE from 'three';
import { createWaterworks } from './waterworks.js';
import { resolveParkCamera } from './park-camera.js';
import { waveHeight, courseItem, clamp } from './game.js';
import { createSurfer, disposeSurfer, retroMaterial, pixelTexture, DEFAULT_PROFILE } from './appearance.js';
import { PARK_RAMPS, PARK_RAILS, PARK_BOUNDS, parkHeight, parkSurface, rampHeight } from './park.js';

const C = { sand: 0xcfaf79, rock: 0x537777, skin: 0xc18458, shirt: 0xf0653a, shorts: 0x203c4b, hair: 0x292d30, board: 0xf6d654 };
const TAU = Math.PI * 2;
const lerp = THREE.MathUtils.lerp;
const flat = (color) => retroMaterial(color);
const mat = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, flat(v)]));
const dark = flat(0x183e41), white = flat(0xfff2cf), green = flat(0x345e51);

function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m;
}
function box(parent, x, y, z, sx, sy, sz, material) {
  return mesh(new THREE.BoxGeometry(sx, sy, sz), material, parent, x, y, z);
}
function between(parent, a, b, radius, material, segments = 5) {
  const v1 = new THREE.Vector3(...a), v2 = new THREE.Vector3(...b), direction = v2.clone().sub(v1);
  const m = mesh(new THREE.CylinderGeometry(radius * .86, radius, direction.length(), segments), material, parent);
  m.position.copy(v1.add(v2).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return m;
}
function palm() {
  const g = new THREE.Group();
  between(g, [0, 0, 0], [.7, 5, .2], .19, flat(0x73694c));
  between(g, [.7, 5, .2], [1.3, 8.5, .4], .14, flat(0x73694c));
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU, verts = [];
    const origin = new THREE.Vector3(1.3, 8.5, .4);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const middle = origin.clone().addScaledVector(dir, 2.1).add(new THREE.Vector3(0, .6, 0));
    const tip = origin.clone().addScaledVector(dir, 4.2).add(new THREE.Vector3(0, -1.4, 0));
    const l = middle.clone().addScaledVector(side, .65), r = middle.clone().addScaledVector(side, -.65);
    for (const v of [origin, l, r, l, tip, r]) verts.push(v.x, v.y, v.z);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.computeVertexNormals();
    mesh(geo, new THREE.MeshLambertMaterial({ color: i % 2 ? 0x3d7052 : 0x274b43, side: THREE.DoubleSide, flatShading: true }), g);
  }
  return g;
}

export class SurfWorld {
  constructor(container, profile = DEFAULT_PROFILE) {
    this.container = container; this.time = 0; this.retro = true; this.mode = 'surf'; this.profile = profile;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xe7c48d);
    this.scene.fog = new THREE.Fog(0x91a7b0, 85, 265);
    this.camera = new THREE.PerspectiveCamera(50, 1, .18, 750);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0xdcc29a); container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xb4d9e3, 0x3a364b, 2.0));
    const sunLight = new THREE.DirectionalLight(0xffe3bb, 2.3); sunLight.position.set(-40, 45, -80); this.scene.add(sunLight);
    this.createSky();
    const shared = new Set(this.scene.children);
    mat.sand.map = pixelTexture('#9d9678','#d1c7a6',64,5);
    mat.rock.map = pixelTexture('#8a9495','#bdc8bf',32,2);
    this.createOcean(); this.createCoast(); this.createCourse();
    this.surfStage = new THREE.Group();
    for (const child of [...this.scene.children]) if (!shared.has(child)) this.surfStage.add(child);
    this.scene.add(this.surfStage);
    this.createPark();
    this.surfer = createSurfer(profile); this.scene.add(this.surfer.rig);
    this.createParticles();
    this.shadow = mesh(new THREE.CircleGeometry(.75, 12), new THREE.MeshBasicMaterial({ color: 0x154f58, transparent: true, opacity: .28, depthWrite: false }), this.scene);
    this.shadow.rotation.x = -Math.PI / 2;
    this.camera.position.set(14, 10, 20); this.lookAt = new THREE.Vector3(0, 2, -9);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
    this.resize();
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    const scale = this.retro ? Math.min(1, 640 / width) : Math.min(1.5, window.devicePixelRatio || 1);
    this.renderer.setSize(Math.round(width * scale), Math.round(height * scale), false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  toggleQuality() { this.retro = !this.retro; this.resize(); return this.retro; }
  setProfile(profile) {
    this.profile = profile;
    this.scene.remove(this.surfer.rig); disposeSurfer(this.surfer);
    this.surfer = createSurfer(profile); this.scene.add(this.surfer.rig);
  }
  setMode(mode) {
    this.mode = mode === 'park' ? 'park' : 'surf';
    this.surfStage.visible = this.mode === 'surf'; this.parkStage.visible = this.mode === 'park';
    this.scene.fog.color.set(this.mode==='park'?0x555e59:0x91a7b0);
    this.scene.fog.near=this.mode==='park'?115:85;
    this.scene.fog.far=this.mode==='park'?335:265;
    this.sky.visible=this.mode==='surf';
    this.scene.background.set(this.mode==='park'?0x69736c:0xe7c48d);
  }
  createPark() {
    const park=createWaterworks();
    this.parkStage=park.group;this.parkWaterMap=park.waterMap;this.parkFoam=park.foam;this.parkUpdate=park.update;
    this.scene.add(this.parkStage);this.parkStage.visible=false;
  }
  createSky() {
    this.sky = new THREE.Group(); this.scene.add(this.sky);
    const skyGeo = new THREE.SphereGeometry(500, 24, 16);
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec3 vPos; void main(){float h=normalize(vPos).y; vec3 horizon=vec3(.63,.73,.75); vec3 top=vec3(.22,.34,.55); vec3 col=mix(horizon,top,smoothstep(.0,.6,h)); col=mix(vec3(.52,.67,.73),col,smoothstep(-.04,.10,h));gl_FragColor=vec4(col,1.);}` });
    mesh(skyGeo, skyMat, this.sky);
    this.sun = mesh(new THREE.CircleGeometry(17, 16), new THREE.MeshBasicMaterial({ color: 0xf3dac0, fog: false }), this.sky, -95, 42, -280);
    this.birds = [];
    const birdMat = new THREE.LineBasicMaterial({ color: 0x365960 });
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.4, .2, 0), new THREE.Vector3(0, -.2, 0), new THREE.Vector3(1.4, .2, 0)]);
      const bird = new THREE.Line(geo, birdMat); this.sky.add(bird); this.birds.push(bird);
    }
  }
  createOcean() {
    const geo = new THREE.PlaneGeometry(340, 450, 68, 100); geo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, side: THREE.DoubleSide,
      vertexShader: `uniform float uTime; varying vec3 vWorld; varying float vRidge;
        void main(){vec3 p=position;vec3 w=(modelMatrix*vec4(p,1.)).xyz;
        float crest=-9.+sin(w.z*.026+uTime*.38)*1.1;
        float ridge=exp(-pow((w.x-crest)/5.4,2.));
        p.y=3.9*ridge+sin(w.z*.07+uTime*1.2)*.32+sin(w.z*.34+w.x*.45+uTime*2.)*.1;
        vWorld=(modelMatrix*vec4(p,1.)).xyz;vRidge=ridge;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);gl_Position.xy=floor(gl_Position.xy/gl_Position.w*vec2(256.,192.)+.5)/vec2(256.,192.)*gl_Position.w;}`,
      fragmentShader: `uniform float uTime;varying vec3 vWorld;varying float vRidge;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld))); if(n.y<0.) n=-n;
        float diffuse=max(dot(n,normalize(vec3(-.4,1.,-.6))),0.);
        vec3 deep=vec3(.045,.14,.28),light=vec3(.16,.54,.61);
        vec3 col=mix(deep,light,.18+floor(diffuse*5.)/5.*.70+vRidge*.13);
        float streak=sin(vWorld.z*.88+vWorld.x*2.2+uTime*2.8);
        float foam=smoothstep(.89,.98,vRidge)*(.55+.45*step(.1,streak));
        float lace=step(.975,hash(floor(vWorld.xz*1.8+vec2(uTime*.8,0.))));
        col=mix(col,vec3(.89,.91,.77),foam*.94+lace*.32);
        float sparkle=pow(max(0.,sin(vWorld.x*.28+vWorld.z*.35+uTime)),20.)*smoothstep(-80.,-20.,vWorld.x)*.13;
        col+=vec3(.7,.62,.32)*sparkle;
        float fog=smoothstep(90.,300.,length(vWorld-cameraPosition));col=mix(col,vec3(.52,.67,.73),fog);
        float dither=(mod(gl_FragCoord.x+mod(gl_FragCoord.y,2.),2.)-.5)*.032;
        col=floor((col+dither)*24.)/24.;gl_FragColor=vec4(col,1.);}` });
    this.ocean = mesh(geo, this.waterMat, this.scene); this.ocean.frustumCulled = false;
    this.foam = [];
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xf2efca, transparent: true, opacity: .67, depthWrite: false });
    for (let i = 0; i < 90; i++) {
      const f = mesh(new THREE.PlaneGeometry(.8 + (i % 3) * .25, 1.6), foamMat, this.scene);
      f.rotation.x = -Math.PI / 2; this.foam.push(f);
    }
  }
  createCoast() {
    this.coast = new THREE.Group(); this.scene.add(this.coast);
    // The coast follows the camera; palms and scenery wrap along the endless course.
    const beachGeo = new THREE.PlaneGeometry(145, 670, 12, 40); beachGeo.rotateX(-Math.PI / 2);
    const p = beachGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + 101, z = p.getZ(i);
      p.setXYZ(i, x + Math.sin(z * .045) * 2, x < 35 ? -.4 : .12 + Math.max(0, x - 42) * .015, z);
    }
    beachGeo.computeVertexNormals(); mesh(beachGeo, mat.sand, this.coast);
    const shoreGeo = new THREE.PlaneGeometry(2.5, 670, 1, 80); shoreGeo.rotateX(-Math.PI / 2);
    const sp = shoreGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setXYZ(i, sp.getX(i) + 29 + Math.sin(sp.getZ(i) * .045) * 2, -.13, sp.getZ(i));
    shoreGeo.computeVertexNormals(); mesh(shoreGeo, white, this.coast);
    this.scenery = [];
    for (let i = 0; i < 26; i++) {
      const tree = palm(); tree.position.set(38 + (i % 5) * 5, .2, -i * 24); const scale = .65 + (i % 4) * .14; tree.scale.setScalar(scale); tree.rotation.y = i * 1.71;
      this.scene.add(tree); this.scenery.push({ mesh: tree, initialZ: -i * 24, length: 624 });
    }
    for (let i = 0; i < 13; i++) {
      const rock = mesh(new THREE.IcosahedronGeometry(1, 0), i % 2 ? mat.rock : flat(0x677868), this.scene, 63 + (i % 4) * 21, 4, -i * 48);
      rock.scale.set(12 + i % 3 * 4, 10 + i % 4 * 5, 19); rock.rotation.y = i;
      this.scenery.push({ mesh: rock, initialZ: -i * 48, length: 624 });
    }
    for (let i = 0; i < 4; i++) {
      const island = mesh(new THREE.IcosahedronGeometry(1, 0), flat(0x779590), this.scene, -115 - i * 22, 2, -100 - i * 90);
      island.scale.set(35, 12 + i * 2, 21); this.scenery.push({ mesh: island, initialZ: -100 - i * 90, length: 720 });
    }
    // A compact original beach hut adds an arcade landmark.
    this.hut = new THREE.Group(); this.scene.add(this.hut);
    box(this.hut, 0, 1.5, 0, 5, 3, 4, flat(0xcd7950));
    const roof = mesh(new THREE.ConeGeometry(4, 1.8, 4), dark, this.hut, 0, 3.7, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = .8;
    box(this.hut, 0, 1.7, 2.05, 3, 1, .1, mat.board);
    for (const x of [-2.1, 2.1]) box(this.hut, x, 1.7, 3.5, .12, 3.4, .12, white);
    box(this.hut, 0, 3.35, 3, 5, .15, 2.5, mat.shirt);
    this.hut.position.set(43, 0, -125); this.scenery.push({ mesh: this.hut, initialZ: -125, length: 624 });
  }
  createCourse() {
    this.course = [];
    for (let i = 0; i < 7; i++) {
      const ringGroup = new THREE.Group(); this.scene.add(ringGroup);
      const ring = mesh(new THREE.TorusGeometry(2.5, .13, 5, 22), new THREE.MeshBasicMaterial({ color: 0xffd256 }), ringGroup);
      const sparkle = mesh(new THREE.OctahedronGeometry(.28), white, ringGroup, 0, 0, 0);
      const buoyGroup = new THREE.Group(); this.scene.add(buoyGroup);
      for (const x of [-2.75, 2.75]) {
        mesh(new THREE.CylinderGeometry(.32, .48, .7, 6), mat.shirt, buoyGroup, x, .3, 0);
        between(buoyGroup, [x, .6, 0], [x, 2.4, 0], .035, white);
        const flag = box(buoyGroup, x + .3, 2.1, 0, .6, .35, .03, mat.board); flag.rotation.y = .15;
      }
      const hazard = new THREE.Group(); this.scene.add(hazard);
      const rock = mesh(new THREE.IcosahedronGeometry(1, 0), mat.rock, hazard, 0, .3, 0); rock.scale.set(2, 1.35, 2.2);
      between(hazard, [.7, .2, .5], [.7, 3, .5], .055, dark);
      const warning = mesh(new THREE.ConeGeometry(.48, .65, 3), mat.shirt, hazard, .7, 2.7, .5); warning.rotation.z = Math.PI;
      this.course.push({ ringGroup, ring, sparkle, buoyGroup, hazard, index: i });
    }
  }
  createParticles() {
    this.particles = [];
    const geo = new THREE.TetrahedronGeometry(.08), material = new THREE.MeshBasicMaterial({ color: 0xf2edd5, transparent: true, opacity: .8 });
    for (let i = 0; i < 80; i++) {
      const m = mesh(geo, material, this.scene); m.visible = false;
      this.particles.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    this.particleIndex = 0; this.sprayClock = 0;
  }
  spray(x, y, z, power = 1, count = 4) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleIndex++ % this.particles.length];
      p.mesh.position.set(x + (Math.random() - .5) * .6, y + .2, z + .8); p.mesh.visible = true;
      p.life = .4 + Math.random() * .4; p.vx = (Math.random() - .5) * 5 * power; p.vy = (2 + Math.random() * 4) * power; p.vz = 5 + Math.random() * 4;
    }
  }
  onEvent(event, game) {
    if (event.type === 'start') {
      this.setMode(game.mode);
      const z=game.mode==='park'?game.z:-game.distance;
      this.cameraHeading=game.heading||0;
      this.camera.position.set(game.x + .95, game.y + 2.6, z + 4.5);
      this.lookAt.set(game.x, game.y + 1.35, z - 2.8);
    }
    if (['land', 'bail', 'jump'].includes(event.type)) this.spray(game.x, game.y, game.mode==='park'?game.z:-game.distance, event.type === 'bail' ? 1.7 : 1.2, 24);
    if (event.type === 'reset') for (const p of this.particles) { p.life = 0; p.mesh.visible = false; }
  }
  update(dt, game) {
    const attract = game.phase === 'ready';
    const isPark=game.mode==='park';
    if(this.mode!==(isPark?'park':'surf'))this.setMode(game.mode);
    if (game.phase !== 'paused' && game.phase !== 'finished') this.time += dt;
    const t = attract ? this.time : game.elapsed, d = attract ? this.time * 9 : game.distance;
    const x = attract ? (isPark?0:-1.4 + Math.sin(t * .6) * 1.1) : game.x;
    const z = isPark?(attract?22:game.z):-d;
    const y = attract ? (isPark?parkHeight(x,z):waveHeight(x, z, t)) : game.y;
    const heading=isPark?game.heading||0:0;
    this.waterMat.uniforms.uTime.value = t;
    this.ocean.position.z = Math.floor(-d / 30) * 30 - 90;
    this.coast.position.z = -d - 80; this.sky.position.z = isPark?0:-d;
    if(this.parkUpdate)this.parkUpdate(t);
    for(const f of this.parkFoam)f.mesh.position.y=f.y+Math.sin(t*3+f.phase)*.07;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i]; b.position.set(-28 + i * 13 + Math.sin(t * .14 + i) * 4, 25 + (i % 3) * 4 + Math.sin(t + i) * .4, -155 - i % 4 * 22); b.rotation.z = Math.sin(t * 2 + i) * .12;
    }
    for (const s of this.scenery) {
      const relative = ((s.initialZ + d + 90) % s.length + s.length) % s.length - 90;
      s.mesh.position.z = relative - d;
    }
    for (let i = 0; i < this.foam.length; i++) {
      const z = -d + 35 - i * 3.8;
      const fx = -9 + Math.sin(z * .026 + t * .38) * 1.1 + Math.sin(t * 3 + i) * .22;
      this.foam[i].position.set(fx, waveHeight(fx, z, t) + .07, z);
      this.foam[i].rotation.z = Math.sin(i * 2.4 + t) * .35;
    }
    const first = Math.max(0, Math.floor((d - 100) / 72));
    for (let i = 0; i < this.course.length; i++) {
      const c = this.course[i], item = courseItem(first + i); c.index = item.index;
      const gy = waveHeight(item.x, -item.distance, t);
      c.ringGroup.position.set(item.x, gy + 1.6, -item.distance);
      c.ringGroup.visible = !game.processed.has(`g${item.index}`) && !attract;
      c.ring.rotation.z = t * .3; c.sparkle.rotation.set(t * 2, t, 0);
      c.buoyGroup.position.set(item.x, gy, -item.distance); c.buoyGroup.visible = !attract;
      c.hazard.position.set(item.hazardX, waveHeight(item.hazardX, -(item.distance + 30), t), -(item.distance + 30)); c.hazard.visible = !attract;
    }
    const s = this.surfer;
    s.rig.position.set(x, y + .055, z);
    const lean = attract ? Math.sin(t * .7) * .10 : isPark ? -(game.steering||0)*.16 : -game.vx * .024;
    const air = !attract && game.airborne;
    const bail = !attract && game.bailTime > 0;
    let spin = air ? game.rotation : 0, flip = air ? game.flipRotation : 0, boardSpin=air?game.boardRotation||0:0;
    let grab = 0;
    if (air && game.trick) {
      const f = clamp(game.trick.age / game.trick.duration, 0, 1), smooth = f * f * (3 - 2 * f);
      spin += smooth*(game.trick.spin||0);
      flip += smooth*(game.trick.flip||0);
      boardSpin += smooth*(game.trick.boardSpin||0);
      grab = Math.sin(f*Math.PI)*(game.trick.grab||0);
    }
    s.rig.rotation.order='YXZ';
    s.rig.rotation.y=heading;
    s.yaw.rotation.y = spin - (isPark?(game.grinding?Math.PI/2:0):(attract ? .3 : game.vx * .035));
    const surface=isPark?(!attract&&game.surface?game.surface:parkSurface(x,z)):null;
    const slope=surface?Math.atan(surface.dx*-Math.sin(heading)+surface.dz*-Math.cos(heading)):0;
    const crossSlope=surface?Math.atan(surface.dx*Math.cos(heading)-surface.dz*Math.sin(heading)):0;
    s.rig.rotation.z = bail ? -1.8 : isPark&&!air&&!game.grinding?clamp(crossSlope,-1.1,1.1)+lean*.3:lean;
    s.rig.rotation.x = bail ? -.45 : air ? -.09 : game.grinding?0:isPark?clamp(slope,-1.1,1.1):.045 + Math.sin(t * 3.3) * .035;
    s.boardPivot.rotation.z = flip;
    s.boardPivot.rotation.y = boardSpin;
    s.boardPivot.position.y = air ? .12 : 0;
    s.pose?.({charge:game.charge,grab,air,time:t,lean,mode:game.mode});
    s.rider.visible = !bail || Math.floor(t * 12) % 2 === 0;
    const ground=isPark?(surface?.height??parkHeight(x,z)):waveHeight(x,z,t);
    this.shadow.position.set(x, ground + .055, z);
    this.shadow.scale.setScalar(air ? Math.max(.4, 1 - (y - ground) * .07) : 1);
    this.shadow.visible = !bail;
    if (game.phase !== 'paused' && game.phase !== 'finished') {
      this.sprayClock += dt;
      if (!air && !bail && this.sprayClock > .025 && game.speed>2) { this.spray(x, y, z, .6, 2); this.sprayClock = 0; }
      for (const p of this.particles) {
        if (p.life <= 0) continue;
        p.life -= dt; p.vy -= 9 * dt;
        p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
        p.mesh.scale.setScalar(Math.max(.1, p.life * 1.7)); p.mesh.visible = p.life > 0;
      }
    }
    let target,look;
    if(isPark){
      if(attract){target=new THREE.Vector3(25+Math.sin(t*.08)*8,15,117);look=new THREE.Vector3(0,4,16);}
      else{
        // Orbit around a reversing surfer instead of interpolating through them.
        const angleDelta=Math.atan2(Math.sin(heading-this.cameraHeading),Math.cos(heading-this.cameraHeading));
        this.cameraHeading+=angleDelta*(1-Math.exp(-dt*4));
        const sx=Math.sin(this.cameraHeading+.26),sz=Math.cos(this.cameraHeading+.26);
        target=new THREE.Vector3(x+sx*4.5,y+2.6,z+sz*4.5);
        target.y=Math.max(target.y,parkHeight(target.x,target.z)+1.5);
        target.copy(resolveParkCamera(x,y,z,target));
        look=new THREE.Vector3(x-sx*2.8,y+1.35,z-sz*2.8);
      }
    }else{
      target=attract?new THREE.Vector3(x+10,y+6.5,z+13):new THREE.Vector3(x+1,y+2.6,z+4.7+(game.speed-18)*.035);
      look=new THREE.Vector3(x-.25,y+1.35,z-2.8);
    }
    this.camera.position.lerp(target, 1 - Math.exp(-dt * (attract ? 1.5 : 4)));
    if(isPark&&!attract){
      // Keep the resolved view inside hollow pipes, including their ceiling.
      this.camera.position.copy(target);
    }
    this.lookAt.lerp(look, 1 - Math.exp(-dt * 6));
    this.camera.lookAt(this.lookAt);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.resizeObserver.disconnect();
    this.scene.traverse(o => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
