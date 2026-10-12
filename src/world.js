import * as THREE from 'three';
import { sampleRiderTrick } from './rider-pose.js';
import { createStormBarrels, resolveBarrelCamera } from './barrel-wave.js';
import { stormDifficulty } from './storm-waves.js';
import { createWaterworks } from './waterworks.js';
import { createParkCameraState, stepParkCamera } from './park-camera-rig.js';
import { createRaceWorld } from './race-world.js';
import { OCEAN_MESH, renderedWaveHeight, alignRiderToOcean } from './ocean-surface.js';
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
    this.oceanRaceView = false;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xe7c48d);
    this.scene.fog = new THREE.Fog(0x91a7b0, 85, 265);
    this.camera = new THREE.PerspectiveCamera(50, 1, .18, 750);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0xdcc29a); container.appendChild(this.renderer.domElement);
    this.ambientLight = new THREE.HemisphereLight(0xb4d9e3, 0x3a364b, 2.0);
    this.scene.add(this.ambientLight);
    this.keyLight = new THREE.DirectionalLight(0xffe3bb, 2.3);
    this.keyLight.position.set(-40, 45, -80); this.scene.add(this.keyLight);
    this.createSky();
    const shared = new Set(this.scene.children);
    mat.sand.map = pixelTexture('#9d9678','#d1c7a6',64,5);
    mat.rock.map = pixelTexture('#8a9495','#bdc8bf',32,2);
    this.createOcean(); this.createCoast(); this.createCourse();
    this.stormBarrels=createStormBarrels();this.scene.add(this.stormBarrels.group);
    this.surfStage = new THREE.Group();
    for (const child of [...this.scene.children]) if (!shared.has(child)) this.surfStage.add(child);
    this.scene.add(this.surfStage);
    this.raceWorld=createRaceWorld(profile);this.scene.add(this.raceWorld.group);
    this.createPark();
    this.surfer = createSurfer(profile); this.scene.add(this.surfer.rig);
    this.createParticles();this.createRain();
    this.shadow = mesh(new THREE.CircleGeometry(.75, 12), new THREE.MeshBasicMaterial({ color: 0x154f58, transparent: true, opacity: .28, depthWrite: false }), this.scene);
    this.shadow.rotation.x = -Math.PI / 2;
    this.camera.position.set(14, 10, 20); this.lookAt = new THREE.Vector3(0, 2, -9);
    this.parkCamera=createParkCameraState();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
    this.resize();
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    // Wider race framing needs more source pixels to retain the same rider
    // detail as the closer freestyle camera. Keep the original texture style.
    const retroWidth = this.oceanRaceView ? 960 : 640;
    const scale = this.retro ? Math.min(1, retroWidth / width) : Math.min(1.5, window.devicePixelRatio || 1);
    this.renderer.setSize(Math.round(width * scale), Math.round(height * scale), false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  toggleQuality() { this.retro = !this.retro; this.resize(); return this.retro; }
  setProfile(profile) {
    this.profile = profile;
    this.raceWorld.setProfile(profile);
    this.scene.remove(this.surfer.rig); disposeSurfer(this.surfer);
    this.surfer = createSurfer(profile); this.scene.add(this.surfer.rig);
  }
  setMode(mode) {
    this.mode = mode === 'park' ? 'park' : 'surf';
    this.raceWorld.reset();
    this.surfStage.visible = this.mode === 'surf'; this.parkStage.visible = this.mode === 'park';
    this.scene.fog.color.set(this.mode==='park'?0x62686b:0x91a7b0);
    this.scene.fog.near=this.mode==='park'?115:85;
    this.scene.fog.far=this.mode==='park'?335:265;
    this.sky.visible=this.mode==='surf';
    this.scene.background.set(this.mode==='park'?0x70767a:0xe7c48d);
    // Factory light stays neutral so painted concrete, rust and clothing keep
    // their own colours; broad directional shading carries the low-poly forms.
    this.ambientLight.color.set(this.mode==='park'?0xd5d9df:0xb4d9e3);
    this.ambientLight.groundColor.set(this.mode==='park'?0x333a43:0x3a364b);
    this.ambientLight.intensity=this.mode==='park'?1.5:2;
    this.keyLight.color.set(this.mode==='park'?0xe5dfd1:0xffe3bb);
    this.keyLight.intensity=this.mode==='park'?1.85:2.3;
    this.shadow.material.color.set(this.mode==='park'?0x182029:0x154f58);
  }
  createPark() {
    const park=createWaterworks();
    this.parkStage=park.group;this.parkWaterMap=park.waterMap;this.parkFoam=park.foam;this.parkUpdate=park.update;
    this.scene.add(this.parkStage);this.parkStage.visible=false;
  }
  createSky() {
    this.sky = new THREE.Group(); this.scene.add(this.sky);
    const skyGeo = new THREE.SphereGeometry(500, 24, 16);
    const skyMat = new THREE.ShaderMaterial({ uniforms:{uStorm:{value:0}}, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform float uStorm;varying vec3 vPos; void main(){float h=normalize(vPos).y; vec3 horizon=vec3(.63,.73,.75); vec3 top=vec3(.22,.34,.55); vec3 col=mix(horizon,top,smoothstep(.0,.6,h)); col=mix(vec3(.52,.67,.73),col,smoothstep(-.04,.10,h));col=mix(col,vec3(.18,.23,.29)+h*.09,uStorm);gl_FragColor=vec4(col,1.);}` });
    mesh(skyGeo, skyMat, this.sky);this.skyMat=skyMat;
    this.sun = mesh(new THREE.CircleGeometry(17, 16), new THREE.MeshBasicMaterial({ color: 0xf3dac0, fog: false }), this.sky, -95, 42, -280);
    this.birds = [];
    const birdMat = new THREE.LineBasicMaterial({ color: 0x365960 });
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.4, .2, 0), new THREE.Vector3(0, -.2, 0), new THREE.Vector3(1.4, .2, 0)]);
      const bird = new THREE.Line(geo, birdMat); this.sky.add(bird); this.birds.push(bird);
    }
  }
  createOcean() {
    const {width,length,columns,rows}=OCEAN_MESH;
    const geo = new THREE.PlaneGeometry(width, length, columns, rows); geo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 },uStorm:{value:0} }, side: THREE.DoubleSide,
      vertexShader: `uniform float uTime; varying vec3 vWorld; varying float vRidge;
        void main(){vec3 p=position;vec3 w=(modelMatrix*vec4(p,1.)).xyz;
        float crest=-9.+sin(w.z*.026+uTime*.38)*1.1;
        float ridge=exp(-pow((w.x-crest)/5.4,2.));
        p.y=3.9*ridge+sin(w.z*.07+uTime*1.2)*.32+sin(w.z*.34+w.x*.45+uTime*2.)*.1;
        vWorld=(modelMatrix*vec4(p,1.)).xyz;vRidge=ridge;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);gl_Position.xy=floor(gl_Position.xy/gl_Position.w*vec2(256.,192.)+.5)/vec2(256.,192.)*gl_Position.w;}`,
      fragmentShader: `uniform float uTime;uniform float uStorm;varying vec3 vWorld;varying float vRidge;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld))); if(n.y<0.) n=-n;
        float diffuse=max(dot(n,normalize(vec3(-.4,1.,-.6))),0.);
        vec3 deep=vec3(.045,.14,.28),light=vec3(.16,.54,.61);
        vec3 col=mix(deep,light,.18+floor(diffuse*5.)/5.*.70+vRidge*.13);col=mix(col,col*vec3(.62,.73,.78),uStorm);
        float streak=sin(vWorld.z*.88+vWorld.x*2.2+uTime*2.8);
        float foam=smoothstep(.89,.98,vRidge)*(.55+.45*step(.1,streak));
        float lace=step(.975,hash(floor(vWorld.xz*1.8+vec2(uTime*.8,0.))));
        col=mix(col,vec3(.89,.91,.77),foam*.94+lace*.32);
        float sparkle=pow(max(0.,sin(vWorld.x*.28+vWorld.z*.35+uTime)),20.)*smoothstep(-80.,-20.,vWorld.x)*.13;
        col+=vec3(.7,.62,.32)*sparkle;
        float fog=smoothstep(90.,300.-uStorm*100.,length(vWorld-cameraPosition));col=mix(col,mix(vec3(.52,.67,.73),vec3(.27,.35,.41),uStorm),fog);
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
  createRain() {
    const vertices=[];
    for(let i=0;i<240;i++){
      const x=((i*73)%127)/127*36-18,y=((i*37)%97)/97*22,z=((i*41)%113)/113*48-36;
      vertices.push(x,y,z,x-.18,y-.85,z+.12);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    this.rain=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x9fb2bb,transparent:true,opacity:.45}));
    this.rain.frustumCulled=false;this.rain.visible=false;this.scene.add(this.rain);
  }
  cutbackSpray(x,y,z,direction,amount,heading=0) {
    // A fan peels off the rear rail, following the snap turn rather than the wake.
    for(let i=0;i<5;i++){
      const p=this.particles[this.particleIndex++%this.particles.length];
      const a=-.7+Math.random()*1.4;
      const c=Math.cos(heading),s=Math.sin(heading),side=-direction*.4;
      p.mesh.position.set(x+c*side+s*.2,y+.18,z-s*side+c*.2);p.mesh.visible=true;
      const vx=-direction*(4+Math.random()*5)*amount,vz=3+Math.sin(a)*7;
      p.life=.5+Math.random()*.45;p.vx=c*vx+s*vz;
      p.vy=(3+Math.random()*6)*amount;p.vz=-s*vx+c*vz;
    }
  }
  onEvent(event, game) {
    if (event.type === 'start') {
      this.raceWorld.reset();
      this.setMode(game.mode);
      const z=game.mode==='park'?game.z:-game.distance;
      this.cameraHeading=game.heading||0;
      this.camera.position.set(game.x + .95, game.y + 2.6, z + 4.5);
      this.lookAt.set(game.x, game.y + 1.35, z - 2.8);
      this.parkCamera=createParkCameraState();
    }
    if(event.type==='bail'&&game.mode==='park')this.parkCamera=createParkCameraState();
    if (['land', 'bail', 'jump'].includes(event.type)) this.spray(game.x, game.y, game.mode==='park'?game.z:-game.distance, event.type === 'bail' ? 1.7 : 1.2, 24);
    if (event.type === 'reset') { this.raceWorld.reset();for (const p of this.particles) { p.life = 0; p.mesh.visible = false; } }
  }
  update(dt, game) {
    const attract = game.phase === 'ready';
    const isPark=game.mode==='park';
    const oceanRaceView=!!game.isRace&&!isPark&&!attract;
    if(this.oceanRaceView!==oceanRaceView){this.oceanRaceView=oceanRaceView;this.resize();}
    if(this.mode!==(isPark?'park':'surf'))this.setMode(game.mode);
    if (game.phase !== 'paused' && game.phase !== 'finished') this.time += dt;
    const t = attract ? this.time : game.elapsed, d = attract ? this.time * 9 : game.distance;
    const x = attract ? (isPark?0:-1.4 + Math.sin(t * .6) * 1.1) : game.x;
    const z = isPark?(attract?22:game.z):-d;
    const oceanZ=Math.floor(-d/30)*30-90;
    const y = attract ? (isPark?parkHeight(x,z):waveHeight(x, z, t)) : game.isRace&&!isPark ? alignRiderToOcean(x,game.y,z,t,oceanZ) : game.y;
    const heading=isPark?game.heading||0:0;
    const storm=!isPark&&game.rulesId==='storm',intensity=storm?stormDifficulty(t):0;
    this.stormBarrels.update(d,t,intensity,storm);
    this.waterMat.uniforms.uTime.value = t;this.waterMat.uniforms.uStorm.value=storm?.62+intensity*.38:0;this.skyMat.uniforms.uStorm.value=storm?.68+intensity*.32:0;
    this.sun.visible=!storm;this.rain.visible=storm;this.rain.position.set(x,y-(t*16)%14,z);
    if(storm){this.rain.geometry.setDrawRange(0,Math.round(95+intensity*145)*2);this.rain.material.opacity=.29+intensity*.24;}
    if(!isPark){this.scene.fog.color.set(storm?0x576c79:0x91a7b0);this.scene.fog.near=storm?75-intensity*18:85;this.scene.fog.far=storm?215-intensity*55:265;}
    this.ocean.position.z = oceanZ;
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
    const rules=game.rules||{firstGate:70,spacing:64};
    const first = Math.max(0,Math.floor((d-rules.firstGate)/rules.spacing)-1);
    for (let i = 0; i < this.course.length; i++) {
      const c = this.course[i], item = courseItem(first+i,game.rulesId); c.index = item.index;
      const gy = waveHeight(item.x, -item.distance, t);
      c.ringGroup.position.set(item.x, gy + 1.6, -item.distance);
      c.ringGroup.visible = !game.isRace && !game.processed.has(`g${item.index}`) && !attract;
      c.ring.scale.setScalar(item.ringRadius/2.5);c.ring.rotation.z = t * .3; c.sparkle.rotation.set(t * 2, t, 0);
      c.buoyGroup.position.set(item.x, gy, -item.distance); c.buoyGroup.visible = !game.isRace && !attract;
      c.hazard.position.set(item.hazardX,waveHeight(item.hazardX,-item.hazardDistance,t),-item.hazardDistance);c.hazard.scale.set(item.hazardRadius/2,1,1); c.hazard.visible = !attract;
    }
    this.raceWorld.update(game,t,oceanZ);
    const s = this.surfer;
    const rideUp=game.pipeRide?game.rideUp:{x:0,y:1,z:0};
    s.rig.position.set(x+rideUp.x*.055, y+rideUp.y*.055, z+rideUp.z*.055);
    const cutback=!attract?(game.cutback||0):0;
    const turn=(game.cutbackDirection||1)*cutback;
    const lean = attract ? Math.sin(t * .7) * .10 : isPark ? -(game.steering||0)*.16 : -game.vx * .024;
    const air = !attract && game.airborne;
    const bail = !attract && game.bailTime > 0;
    const {spin,flip,boardSpin,grab,lipGrab,tweak=0,comboPose=null,boardBank=0,boardPitch=0,boardLift=0,boardSide=0,boardBack=0}=sampleRiderTrick(game,{air});
    s.rig.rotation.order='YXZ';
    s.rig.rotation.y=heading-(isPark?0:turn*1.05);
    s.yaw.rotation.y = spin - (isPark?(game.grinding?Math.PI/2:0):(attract ? .3 : game.vx * .035));
    const surface=isPark?(!attract&&game.surface?game.surface:parkSurface(x,z)):null;
    const slope=surface?Math.atan(surface.dx*-Math.sin(heading)+surface.dz*-Math.cos(heading)):0;
    const crossSlope=surface?Math.atan(surface.dx*Math.cos(heading)-surface.dz*Math.sin(heading)):0;
    s.rig.rotation.z = game.pipeRide?game.rideRoll:bail ? -1.8 : isPark&&!air&&!game.grinding?clamp(crossSlope,-1.1,1.1)+lean*.3:lean;
    s.rig.rotation.x = game.pipeRide?0:bail ? -.45 : air ? -.09 : game.grinding?0:isPark?clamp(slope,-1.1,1.1):.045 + Math.sin(t * 3.3) * .035;
    if(game.lipMove){s.rig.rotation.x*=1-lipGrab;s.rig.rotation.z*=1-lipGrab;}
    s.rig.rotation.z-=turn*(isPark?.32:.48);s.rig.rotation.x-=cutback*.10;
    s.boardPivot.rotation.order='YXZ';
    s.boardPivot.rotation.set(boardPitch,boardSpin,flip+boardBank);
    s.boardPivot.position.set(boardSide,(air?.12:0)+boardLift,boardBack);
    s.pose?.({charge:game.charge,grab,air,time:t,lean,mode:game.mode,lipGrab,tweak,comboPose,cutback,cutbackDirection:game.cutbackDirection||1});
    s.rider.visible = !bail || Math.floor(t * 12) % 2 === 0;
    const ground=isPark?(surface?.height??parkHeight(x,z)):game.isRace?renderedWaveHeight(x,z,t,oceanZ):waveHeight(x,z,t);
    this.shadow.position.set(x, ground + .055, z);
    this.shadow.scale.setScalar(air ? Math.max(.4, 1 - (y - ground) * .07) : 1);
    this.shadow.visible = !bail&&!game.pipeRide;
    if (game.phase !== 'paused' && game.phase !== 'finished') {
      this.sprayClock += dt;
      if (!air && !bail && this.sprayClock > .025 && game.speed>2) { if(cutback>.2)this.cutbackSpray(x,y,z,game.cutbackDirection,cutback,heading);else this.spray(x, y, z, .6, 2); this.sprayClock = 0; }
      for (const p of this.particles) {
        if (p.life <= 0) continue;
        p.life -= dt; p.vy -= 9 * dt;
        p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
        p.mesh.scale.setScalar(Math.max(.1, p.life * 1.7)); p.mesh.visible = p.life > 0;
      }
    }
    let target,look,parkFrame=null;
    if(isPark){
      if(attract){target=new THREE.Vector3(25+Math.sin(t*.08)*8,15,117);look=new THREE.Vector3(0,4,16);}
      else{
        const up=game.pipeRide?new THREE.Vector3(game.rideUp.x,game.rideUp.y,game.rideUp.z):new THREE.Vector3(0,1,0);
        const focus=new THREE.Vector3(x,y,z).addScaledVector(up,.85);
        if(!game.pipeRide){const headPosition=new THREE.Vector3();s.head.getWorldPosition(headPosition);focus.copy(s.rig.position).lerp(headPosition,.57);}
        parkFrame=stepParkCamera(this.parkCamera,{x,y,z,heading,speed:game.speed,rideUp:game.pipeRide?game.rideUp:null,focus},dt);
        target=parkFrame.position;look=parkFrame.look;
      }
    }else{
      target=attract?new THREE.Vector3(x+10,y+6.5,z+13):new THREE.Vector3(x+1,y+2.6,z+4.7+(game.speed-18)*.035);
      look=new THREE.Vector3(x-.25,y+.9,z-.4);
      if(game.isRace&&!attract){
        // Keep nearby head-to-head riders in shot without relocating either
        // racer or allowing a distant opponent to drag the camera away.
        const rival=game.opponent,gap=rival?Math.abs(rival.distance-d):Infinity;
        const together=gap<22?1-gap/22:0;
        const midpoint=rival?clamp((rival.x-x)*.4,-3,3)*together:0;
        target.set(x+.7+midpoint,y+3.3,z+6.5);
        look.set(x+midpoint,y+1.05,z-2.6);
      }
      if(!attract&&grab>0){target.x+=grab*1.8;target.y-=grab*.65;target.z-=grab*.9;look.set(x,y+.55,z);}
      if(storm&&!attract&&game.barrel?.inside){
        // A slightly lower, central view shows the opening and the moving roof.
        target.x=x+.65;target.y=y+2.15;target.z=z+4.4;
        resolveBarrelCamera(target,d,t);look.set(x,y+1.05,z-1.4);
      }
    }
    if(parkFrame)this.camera.position.copy(parkFrame.position);
    else this.camera.position.lerp(target, 1 - Math.exp(-dt * (attract ? 1.5 : 4)));
    if(storm&&!attract&&game.barrel?.inside)resolveBarrelCamera(this.camera.position,d,t);
    if(parkFrame){this.lookAt.copy(parkFrame.look);this.camera.up.copy(parkFrame.up);}
    else{this.lookAt.lerp(look,1-Math.exp(-dt*6));this.camera.up.set(0,1,0);}
    const fieldOfView=parkFrame?parkFrame.fov:oceanRaceView?54:50;
    if(Math.abs(this.camera.fov-fieldOfView)>.001){this.camera.fov=fieldOfView;this.camera.updateProjectionMatrix();}
    this.camera.lookAt(this.lookAt);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.resizeObserver.disconnect();
    this.raceWorld.dispose();
    this.scene.traverse(o => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
