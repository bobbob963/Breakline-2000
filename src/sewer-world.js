import * as THREE from 'three';
import { createSurfer, disposeSurfer } from './appearance.js';
import { rivalProfile } from './race-world.js';
import { sampleRiderTrick } from './rider-pose.js';
import { sewerPoint, sewerWaterHeight, sewerBarrelState } from './sewer-course.js';

const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, value));
export const SEWER_TUNNEL_RADIUS = 14;
export const SEWER_TUNNEL_CENTRE_Y = 7;
export const SEWER_DRAW_AHEAD = 245;

export function sewerTrackStyle(trackId) {
  const pressure = trackId === 'sewer-depths';
  return pressure
    ? { pressure, wall: 0x454f4b, rust: 0x985a35, water: 0x497b35, foam: 0xc3d888, light: 0xadd7b2, fog: 0x172827, name: 'THE DEEP WORKS' }
    : { pressure, wall: 0x8f6550, rust: 0x684b36, water: 0x5b8b34, foam: 0xd4db93, light: 0xffc575, fog: 0x293a28, name: 'RUNOFF RUN' };
}

function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function positionAlong(object, distance, x, y, trackId, path = null) {
  const point = sewerPoint(distance, x, y, trackId, path);
  object.position.set(point.x, point.y, point.z); object.rotation.y = point.heading; return point;
}
function masonryTexture(pressure) {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 8), mortar = y % 8 === 0 || (x + row % 2 * 8) % 16 === 0;
    const grain = ((x * 73 + y * 131 + x * y * 7) % 31) - 15;
    const seam = pressure ? x % 32 < 1 || y % 32 < 1 : mortar;
    const streak = pressure && x % 19 < 3 ? .65 : 1;
    const shade = (seam ? 104 : 192 + grain) * streak, offset = (y * size + x) * 4;
    data.set([shade, shade * .94, shade * .85, 255], offset);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; return texture;
}
function pipeGeometry(course, start, end, trackId, path = null, radius = SEWER_TUNNEL_RADIUS, centreY = SEWER_TUNNEL_CENTRE_Y) {
  const positions = [], uv = [], indices = [], rows = Math.max(1, Math.ceil((end - start) / 8)), sectors = path ? 14 : 20;
  const centreX = path?.entryX || 0;
  for (let row = 0; row <= rows; row++) {
    const distance = start + (end - start) * row / rows;
    for (let side = 0; side <= sectors; side++) {
      const angle = side / sectors * TAU;
      const point = sewerPoint(distance, centreX + Math.cos(angle) * radius, centreY + Math.sin(angle) * radius, trackId, path);
      positions.push(point.x, point.y, point.z); uv.push(side / sectors * (path ? 8 : 22), distance / 6);
      if (row === rows || side === sectors) continue;
      const middle = angle + Math.PI / sectors;
      // Real openings in the main wall show the connecting side pipes. Their
      // mouths share the exact entry/exit distances used by the simulation.
      const mouth = !path && course.shortcuts?.some(shortcut =>
        Math.min(Math.abs(distance - shortcut.start), Math.abs(distance - shortcut.end)) < 10 &&
        Math.sign(Math.cos(middle)) === Math.sign(shortcut.entryX) && Math.abs(Math.sin(middle)) < .49);
      if (mouth) continue;
      const a = row * (sectors + 1) + side, b = a + sectors + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function waterGeometry(start, end, trackId, path = null) {
  const positions = [], uv = [], indices = [], columns = path ? 4 : 12, rows = Math.max(1, Math.ceil((end - start) / 6));
  const width = path ? 3.9 : 11.7, centreX = path?.entryX || 0, samples = [];
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const distance = start + (end - start) * row / rows, x = centreX + (column / columns * 2 - 1) * width;
    const point = sewerPoint(distance, x, sewerWaterHeight(x, distance, 0, trackId, path), trackId, path);
    positions.push(point.x, point.y, point.z); uv.push(column / columns, distance / 10); samples.push({ distance, x });
    if (row < rows && column < columns) {
      const a = row * (columns + 1) + column, b = a + columns + 1; indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData = { samples, trackId, path }; return geometry;
}
function waterMaterial(style) {
  // This authored retro shader outputs display values directly, like the
  // ocean shader. Keep the green palette and fog in the same colour space.
  const colour=hex=>new THREE.Color().setHex(hex,THREE.LinearSRGBColorSpace);
  return new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { time: { value: 0 }, base: { value: colour(style.water) }, foam: { value: colour(style.foam) }, fog: { value: colour(style.fog) } },
    vertexShader: 'varying vec2 uvWater;varying vec3 world;void main(){uvWater=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader: `uniform float time;uniform vec3 base;uniform vec3 foam;uniform vec3 fog;varying vec2 uvWater;varying vec3 world;
      void main(){float flow=sin(uvWater.y*18.+time*3.+sin(uvWater.x*23.+uvWater.y*2.))*sin(uvWater.x*49.-uvWater.y*3.);
      float ripple=smoothstep(.64,.84,flow);float edge=smoothstep(.34,.5,abs(uvWater.x-.5));
      vec3 colour=mix(base*(.72+.16*sin(uvWater.y*5.+uvWater.x*14.)),foam,ripple*(.15+edge*.23));
      colour=mix(colour,fog,smoothstep(80.,220.,length(world-cameraPosition)));gl_FragColor=vec4(floor(colour*48.)/48.,1.);}` });
}
function makeLabel(text, accent = '#d8db7c') {
  if (typeof document === 'undefined') return new THREE.Group();
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64; const context = canvas.getContext('2d');
  context.fillStyle = '#17211a'; context.fillRect(0, 0, 256, 64); context.fillStyle = accent; context.fillRect(0, 0, 256, 5);
  context.font = 'italic 900 27px Arial'; context.fillStyle = '#f2eed7'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 128, 34, 244);
  const texture = new THREE.CanvasTexture(canvas); texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false })); sprite.scale.set(4.8, 1.2, 1); return sprite;
}
function makeRing(checkpoint) {
  const group = new THREE.Group(), radius = checkpoint.radius || 2.7;
  group.name = `sewer-checkpoint-${checkpoint.index}`; group.userData = { checkpointIndex: checkpoint.index, radius };
  const material = new THREE.MeshBasicMaterial({ color: 0xffd95b });
  const rim = addMesh(group, new THREE.TorusGeometry(radius + .16, .16, 5, 28), material); rim.name = 'sewer-sun-ring-aperture';
  const rays = new THREE.Group(); group.add(rays);
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * TAU, ray = addMesh(rays, new THREE.ConeGeometry(.13, .68, 3), material, Math.cos(angle) * (radius + .67), Math.sin(angle) * (radius + .67), 0);
    ray.rotation.z = angle - Math.PI / 2;
  }
  const label = makeLabel(checkpoint.finish ? 'FINISH' : `${String(checkpoint.index + 1).padStart(2, '0')}  SUN RING`, '#ffc95c'); label.position.y = radius + 1.05; group.add(label);
  return { group, rim, rays, checkpoint, material };
}
function closingWaveGeometry() {
  const geometry=new THREE.BufferGeometry(),rows=14,sectors=20,positions=new Float32Array((rows+1)*(sectors+1)*3),indices=[];
  for(let row=0;row<rows;row++)for(let side=0;side<sectors;side++){
    const a=row*(sectors+1)+side,b=a+sectors+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  geometry.userData={rows,sectors};return geometry;
}
function updateClosingWave(geometry,item,trackId,time,closure) {
  const {rows,sectors}=geometry.userData,positions=geometry.attributes.position;
  for(let row=0;row<=rows;row++)for(let side=0;side<=sectors;side++){
    const u=row/rows,angle=side/sectors*Math.PI,distance=item.startDistance+(item.endDistance-item.startDistance)*u;
    const curl=Math.pow(Math.sin(Math.PI*u),.55),height=(7+(1-curl)*12)*(1-closure*.94);
    const lane=Math.cos(angle)*(item.width/2+.6),surface=sewerWaterHeight(lane,distance,time,trackId);
    const point=sewerPoint(distance,lane,surface+Math.sin(angle)*height+.12,trackId);
    positions.setXYZ(row*(sectors+1)+side,point.x,point.y,point.z);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}
function hazardMesh(item, style) {
  const group = new THREE.Group(); group.name = `sewer-${item.type}-${item.id}`; group.userData = { hazardId: item.id, type: item.type, path: item.path || 'main' };
  const radius = item.radius || item.width / 2 || 2;
  if (item.type === 'whirlpool') {
    const material = new THREE.MeshBasicMaterial({ color: 0x182c16, side: THREE.DoubleSide });
    const core = addMesh(group, new THREE.ConeGeometry(radius, .9, 20, 1, true), material, 0, -.4, 0); core.rotation.z = Math.PI;
    const foam = new THREE.MeshBasicMaterial({ color: style.foam, side: THREE.DoubleSide, transparent: true, opacity: .7 });
    for (let i = 0; i < 3; i++) {
      const points = [];
      for (let j = 0; j < 28; j++) { const u = j / 27, angle = u * TAU * 1.35 + i * TAU / 3, r = radius * (.1 + u * .95); points.push(new THREE.Vector3(Math.cos(angle) * r, .045 + u * .06, Math.sin(angle) * r)); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: style.foam })); group.add(line);
    }
    const rim = addMesh(group, new THREE.TorusGeometry(radius, .10, 4, 24), foam); rim.rotation.x = Math.PI / 2;
  } else if (item.type === 'driftwood') {
    const wood = new THREE.MeshLambertMaterial({ color: 0x7d6643, flatShading: true });
    const log = addMesh(group, new THREE.CylinderGeometry(.16, .23, item.width || radius * 2, 6), wood, 0, .20, 0); log.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) { const twig = addMesh(group, new THREE.CylinderGeometry(.07, .13, 1.2, 5), wood, side * .6, .27, .25); twig.rotation.set(.3, .1, side * .8); }
  } else if (item.type === 'barrel') {
    const water = new THREE.MeshLambertMaterial({ color: style.water, flatShading: true, side: THREE.DoubleSide });
    const roll = addMesh(group,closingWaveGeometry(),water);roll.name='sewer-closing-wave';roll.frustumCulled=false;
    const foam = new THREE.MeshBasicMaterial({ color: style.foam, wireframe:true,transparent:true,opacity:.16 });
    const lip=addMesh(group,roll.geometry,foam);lip.name='sewer-wave-foam';lip.frustumCulled=false;
    const crash=addMesh(group,new THREE.PlaneGeometry(item.width+1,12),water);crash.name='sewer-pressure-crash';crash.visible=false;
    const label=makeLabel('PRESSURE WAVE','#d8db7c');group.add(label);
    group.userData.roll=roll;group.userData.crash=crash;group.userData.label=label;
  }
  return group;
}

export function poseSewerRider(surfer, rider, trackId, time, dt = 1 / 60) {
  const point = sewerPoint(rider.distance || 0, rider.x || 0, rider.y || 0, trackId, rider.activeShortcut);
  const air = !!rider.airborne, bail = rider.bailTime > 0, cutback = rider.cutback || 0, turn = (rider.cutbackDirection || 1) * cutback;
  const lean = -(rider.vx || 0) * .024, pose = sampleRiderTrick(rider, { air });
  surfer.rig.position.set(point.x, point.y + .055, point.z); surfer.rig.rotation.order = 'YXZ';
  surfer.rig.rotation.set(bail ? -.45 : (air ? -.09 : .035) - cutback * .1, point.heading - turn * 1.05, (bail ? -1.8 : lean) - turn * .48);
  surfer.yaw.rotation.set(pose.bodyPitch, pose.spin - (rider.vx || 0) * .035, pose.bodyRoll, 'YXZ');
  surfer.boardPivot.rotation.order = 'YXZ'; surfer.boardPivot.rotation.set(pose.boardPitch, pose.boardSpin, pose.flip + pose.boardBank);
  surfer.boardPivot.position.set(pose.boardSide, (air ? .12 : 0) + pose.boardLift, pose.boardBack);
  surfer.rig.userData.railBalance = THREE.MathUtils.damp(surfer.rig.userData.railBalance || 0, 0, 12, dt);
  surfer.pose?.({ charge: rider.charge || 0, grab: pose.grab, air, time, lean, mode: 'surf', lipGrab: pose.lipGrab, tweak: pose.tweak, comboPose: pose.comboPose, cutback, cutbackDirection: rider.cutbackDirection || 1, balance: 0 });
  surfer.rider.visible = !bail || Math.floor(time * 12) % 2 === 0;
  return { ...point, air, bail, pose, lean };
}

export function createSewerWorld(playerProfile) {
  const group = new THREE.Group(); group.name = 'sewer-tracks'; group.visible = false;
  let course = null, trackId = null, player = playerProfile, opponent = null, opponentLabel = null, disposed = false;
  let water = [], rings = [], hazards = [], props = [], shortcutSigns = [], materials = [], style = sewerTrackStyle('sewer-run');
  const resources = new Set();
  function clear() {
    if (opponent) { group.remove(opponent.rig); disposeSurfer(opponent); }
    group.traverse(object => { if (object.geometry) resources.add(object.geometry); for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) { resources.add(material); if (material.map) resources.add(material.map); } });
    for (const resource of resources) resource.dispose(); resources.clear(); group.clear();
    water = []; rings = []; hazards = []; props = []; shortcutSigns = []; materials = []; opponent = null; opponentLabel = null; course = null; group.visible = false;
  }
  function prepare(game) {
    clear(); course = game.course; trackId = game.trackId || course.trackId || 'sewer-run'; style = sewerTrackStyle(trackId);
    const wall = new THREE.MeshLambertMaterial({ color: style.wall, map: masonryTexture(style.pressure), flatShading: true, side: THREE.DoubleSide });
    const rust = new THREE.MeshLambertMaterial({ color: style.rust, flatShading: true });
    const steel = new THREE.MeshLambertMaterial({ color: style.pressure ? 0x243a39 : 0x454a37, flatShading: true });
    const light = new THREE.MeshBasicMaterial({ color: style.light });
    const sludge = waterMaterial(style); materials.push(sludge);
    const tunnel = addMesh(group, pipeGeometry(course, -45, course.length + 80, trackId), wall); tunnel.name = 'sewer-main-pipe'; tunnel.userData = { radius: SEWER_TUNNEL_RADIUS, centreY: SEWER_TUNNEL_CENTRE_Y };
    water.push(addMesh(group, waterGeometry(-45, course.length + 80, trackId), sludge)); water[0].name = 'sewer-green-water';
    const ribGeometry = new THREE.TorusGeometry(13.85, style.pressure ? .38 : .24, 5, 20);
    const lampGeometry = new THREE.BoxGeometry(.32, .4, 2.8);
    for (let distance = -28, i = 0; distance < course.length + 65; distance += 28, i++) {
      const section = new THREE.Group(); section.name = `sewer-rib-${i}`; section.userData.distance = distance; group.add(section);
      positionAlong(section, distance, 0, 0, trackId); props.push(section);
      addMesh(section, ribGeometry, i % 3 === 0 ? rust : steel, 0, 7, 0);
      for (const side of [-1, 1]) {
        addMesh(section, new THREE.BoxGeometry(.45, .7, 3.2), steel, side * 10.8, 6.5, 0);
        addMesh(section, lampGeometry, light, side * 10.52, 6.5, 0);
        if (style.pressure || i % 2 === 0) {
          const pipe = addMesh(section, new THREE.CylinderGeometry(style.pressure ? .75 : .45, style.pressure ? .75 : .45, 28.3, 8), rust, side * 8.8, style.pressure ? 15.6 : 13.5, -14); pipe.rotation.x = Math.PI / 2;
        }
      }
      if (style.pressure && i % 3 === 1) {
        const machinery = new THREE.Group(); machinery.position.set(i % 2 ? 10 : -10, 9, -7); machinery.rotation.y = i % 2 ? -Math.PI / 3 : Math.PI / 3; section.add(machinery);
        addMesh(machinery, new THREE.CylinderGeometry(3.6, 3.6, 1.2, 12), steel).rotation.x = Math.PI / 2;
        const fan = new THREE.Group(); fan.name = 'pressure-drain-fan'; fan.position.z = .7; machinery.add(fan); section.userData.fan = fan;
        for (let blade = 0; blade < 4; blade++) { const arm = new THREE.Group(); arm.rotation.z = blade * Math.PI / 2; fan.add(arm); addMesh(arm, new THREE.BoxGeometry(1.1, 2.6, .22), rust, .35, 1.3, 0).rotation.z = -.4; }
        addMesh(fan, new THREE.SphereGeometry(.6, 8, 4), light);
      }
    }
    for (const shortcut of course.shortcuts || []) {
      const branch = addMesh(group, pipeGeometry(course, shortcut.start, shortcut.end, trackId, shortcut, 5, 3), wall); branch.name = `shortcut-pipe-${shortcut.id}`; branch.userData = { shortcutId: shortcut.id, start: shortcut.start, end: shortcut.end };
      const stream = addMesh(group, waterGeometry(shortcut.start, shortcut.end, trackId, shortcut), sludge); stream.name = `shortcut-water-${shortcut.id}`; water.push(stream);
      for (const distance of [shortcut.start + 6, shortcut.end - 6]) {
        const mouth = new THREE.Group(); group.add(mouth); positionAlong(mouth, distance, shortcut.entryX, 3, trackId, shortcut);
        addMesh(mouth, new THREE.TorusGeometry(4.9, .28, 5, 14), rust);
        addMesh(mouth, new THREE.TorusGeometry(4.5, .08, 4, 14), light);
        mouth.userData.distance = distance; props.push(mouth);
      }
      const sign = makeLabel(`${shortcut.entryX < 0 ? '◀ ' : ''}SHORTCUT${shortcut.entryX > 0 ? ' ▶' : ''}`, '#b6e575');
      positionAlong(sign, shortcut.start - 12, shortcut.entryX * .75, 4.2, trackId); sign.userData.distance = shortcut.start; group.add(sign); shortcutSigns.push(sign);
      // Repeated arrows lead right into the pipe, rather than advertising a
      // shortcut whose entrance cannot be located from the racing camera.
      for (let arrow = 0; arrow < 3; arrow++) {
        const marker = addMesh(group, new THREE.ConeGeometry(.42, 1.25, 3), light);
        positionAlong(marker, shortcut.start - 12 + arrow * 5, shortcut.entryX, 1.8, trackId); marker.rotation.z = shortcut.entryX > 0 ? -Math.PI / 2 : Math.PI / 2;
        marker.userData.distance = shortcut.start; props.push(marker);
      }
    }
    for (const checkpoint of [...(course.checkpoints || []),{index:course.checkpoints.length,distance:course.length,x:0,radius:10.9,finish:true}]) { const ring = makeRing(checkpoint); rings.push(ring); group.add(ring.group); }
    for (const item of course.hazards || []) { const mesh = hazardMesh(item, style); hazards.push({ mesh, item }); group.add(mesh); }
    if (game.opponent && typeof document !== 'undefined') {
      opponent = createSurfer(rivalProfile(game.rival, player)); opponent.rig.name = 'sewer-rival'; group.add(opponent.rig);
      opponentLabel = makeLabel(game.rival?.name || 'RIVAL', '#efbc63'); opponentLabel.scale.set(1.8, .45, 1); group.add(opponentLabel);
    }
    group.visible = true;
  }
  function update(game, time, dt = 1 / 60) {
    if (disposed) return;
    if (!game.isSewer || !game.course) { group.visible = false; return; }
    if (course !== game.course || trackId !== game.trackId) prepare(game);
    group.visible = true;
    for (const material of materials) material.uniforms.time.value = time;
    for (const stream of water) {
      const { samples, path } = stream.geometry.userData, positions = stream.geometry.attributes.position;
      for (let i = 0; i < samples.length; i++) { const sample = samples[i]; positions.setY(i, sewerWaterHeight(sample.x, sample.distance, time, trackId, path)); }
      positions.needsUpdate = true;
    }
    for (const prop of props) {
      prop.visible = prop.userData.distance > game.distance - 48 && prop.userData.distance < game.distance + SEWER_DRAW_AHEAD;
      if (prop.userData.fan) prop.userData.fan.rotation.z = time * (style.pressure ? .75 : .2);
    }
    for (const sign of shortcutSigns) sign.visible = sign.userData.distance > game.distance - 8 && sign.userData.distance < game.distance + 150;
    for (const ring of rings) {
      const checkpoint = ring.checkpoint, next = checkpoint.index === game.nextCheckpoint;
      const height = sewerWaterHeight(checkpoint.x, checkpoint.distance, time, trackId, checkpoint.path === 'main' ? null : checkpoint.path) + (checkpoint.y || 2);
      positionAlong(ring.group, checkpoint.distance, checkpoint.x, height, trackId, checkpoint.path === 'main' ? null : checkpoint.path);
      ring.group.visible = checkpoint.index >= (game.nextCheckpoint || 0) && checkpoint.distance > game.distance - 8 && checkpoint.distance < game.distance + SEWER_DRAW_AHEAD;
      ring.material.color.set(next ? 0xffdc62 : 0xa8aa6a); ring.rays.rotation.z = time * .3; ring.rays.visible = next;
    }
    for (const { mesh, item } of hazards) {
      const path = item.path && item.path !== 'main' ? item.path : null;
      if(item.type!=='barrel')positionAlong(mesh, item.distance, item.x || 0, sewerWaterHeight(item.x || 0, item.distance, time, trackId, path), trackId, path);
      mesh.visible = item.distance > game.distance - 30 && item.distance < game.distance + SEWER_DRAW_AHEAD;
      if (item.type === 'whirlpool') mesh.rotation.y += time * -.7;
      if (item.type === 'driftwood') mesh.rotation.z = Math.sin(time * 2 + item.distance) * .035;
      if (item.type === 'barrel') {
        const timing = game.hazardStates?.get?.(item.id), state = sewerBarrelState(item, time, timing);
        const closure = clamp01(state.closure ?? 1 - (state.opening ?? 1));
        updateClosingWave(mesh.userData.roll.geometry,item,trackId,time,closure);
        positionAlong(mesh.userData.label,item.startDistance-6,0,7,trackId);
        positionAlong(mesh.userData.crash,item.distance,0,6,trackId);mesh.userData.crash.visible=closure>=1;
        mesh.userData.closure = closure;
      }
    }
    if (opponent && game.opponent) {
      const frame = poseSewerRider(opponent, game.opponent, trackId, time, dt), visible = Math.abs(game.opponent.distance - game.distance) < 150;
      opponent.rig.visible = visible; opponentLabel.visible = visible; opponentLabel.position.set(frame.x, frame.y + 2.8, frame.z);
      if (opponentLabel.material) opponentLabel.material.color.set(game.opponent.boostTime > 0 ? 0xffd46b : 0xffffff);
    }
  }
  return { group, update, reset: clear, setProfile(profile) { player = profile; clear(); }, dispose() { if (!disposed) clear(); disposed = true; },
    get style() { return style; }, get rings() { return rings; }, get hazards() { return hazards; }, get waters() { return water; } };
}
