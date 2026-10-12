import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCharacter } from '../src/character-model.js';
import { createCharacter as createV8Character } from '../src/character-model-v8-reference.js';
import { CHARACTERS, OUTFITS, createSurfer, disposeSurfer } from '../src/appearance.js';
import { GRAB_HOLD_START, GRAB_HOLD_END, grabEnvelope, sampleRiderTrick } from '../src/rider-pose.js';
import { TRICKS } from '../src/game.js';
import { CHARACTER_TARGETS, measurePointBounds, measureCharacterLandmarks, auditCharacterProportions } from '../src/character-spec.js';

// Geometry tests only. The mock intentionally cannot validate paint, UV imagery,
// light, color management, pose appeal or a model's resemblance to a reference.
const canvasContext = new Proxy({}, {
  get: (_, key) => ['createLinearGradient', 'createRadialGradient'].includes(key) ? () => ({ addColorStop() {} }) : () => {},
  set: () => true,
});
const canvasDocument = { createElement: () => ({ width: 1, height: 1, getContext: () => canvasContext }) };

function makeModel(character, outfit, builder = createCharacter) {
  const saved = globalThis.document;
  globalThis.document = canvasDocument;
  try {
    return builder({ id: character, character: CHARACTERS[character], outfit: OUTFITS[outfit], fabricTexture: () => new THREE.Texture() });
  } finally {
    if (saved === undefined) delete globalThis.document;
    else globalThis.document = saved;
  }
}

function makeSurfer(character, outfit) {
  const saved = globalThis.document;
  globalThis.document = canvasDocument;
  try { return createSurfer({ character, outfit, boardColor: '#24c5ba', boardDesign: 'bolt' }); }
  finally {
    if (saved === undefined) delete globalThis.document;
    else globalThis.document = saved;
  }
}

function visibleGeometry(model) {
  model.rider.updateMatrixWorld(true);
  const meshes = [], vertices = [];
  model.rider.traverseVisible(object => {
    if (!object.isMesh) return;
    const attribute = object.geometry.getAttribute('position');
    const points = Array.from({ length: attribute.count }, (_, i) => object.localToWorld(new THREE.Vector3().fromBufferAttribute(attribute, i)));
    vertices.push(...points);
    meshes.push({ object, points });
  });
  return { meshes, vertices, bounds: measurePointBounds(vertices) };
}

// Intersect actual world-space triangles with a horizontal plane. This measures
// cloth silhouette rather than trusting an authored radius or marker position.
function sliceWidth(meshes, y) {
  const x = [];
  for (const { object, points } of meshes) {
    const index = object.geometry.getIndex();
    const count = index ? index.count : points.length;
    for (let i = 0; i < count; i += 3) {
      const tri = [0, 1, 2].map(k => points[index ? index.getX(i + k) : i + k]);
      for (let j = 0; j < 3; j++) {
        const a = tri[j], b = tri[(j + 1) % 3];
        if (Math.abs(a.y - y) < 1e-8) x.push(a.x);
        if ((a.y < y && b.y > y) || (a.y > y && b.y < y)) x.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y));
      }
    }
  }
  assert.ok(x.length, `No actual model surface crosses measurement plane y=${y}`);
  return Math.max(...x) - Math.min(...x);
}

function sliceBounds(meshes, y) {
  const crossings=[];
  for(const {object,points} of meshes){
    const index=object.geometry.getIndex(),count=index?index.count:points.length;
    for(let i=0;i<count;i+=3){
      const tri=[0,1,2].map(k=>points[index?index.getX(i+k):i+k]);
      for(let j=0;j<3;j++){
        const a=tri[j],b=tri[(j+1)%3];
        if(Math.abs(a.y-y)<1e-8)crossings.push(a);
        if((a.y<y&&b.y>y)||(a.y>y&&b.y<y))crossings.push(a.clone().lerp(b,(y-a.y)/(b.y-a.y)));
      }
    }
  }
  assert.ok(crossings.length,`No rendered cloth triangles at height ${y}`);
  return measurePointBounds(crossings);
}

function disposeModel(model) {
  const geometries = new Set(), materials = new Set(), maps = new Set();
  model.rider.traverse(object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      if (material.map) maps.add(material.map);
    }
  });
  for (const value of [...geometries, ...materials, ...maps]) value.dispose();
}

const poses = [
  { standing: true, time: 0 }, { standing: true, time: 1.5, mode: 'park' },
  { standing: false, mode: 'surf' }, { standing: false, charge: 1, mode: 'surf' },
  { standing: false, grab: 1, air: true, mode: 'surf' },
  { standing: false, charge: 1, grab: 1, air: true, lean: 1, mode: 'park' },
  { standing: false, lean: -1, time: 10, mode: 'park' },
  { standing: false, lean: 1, time: 10, mode: 'surf' },
  { standing: false, lipGrab: 1, time: 15, mode: 'park' },
];

test('all 48 authored character/outfit combinations have measured adult standing silhouettes', t => {
  const reports = [];
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    const model = makeModel(character, outfit), label = `${character}/${outfit}`;
    try {
      model.pose({ standing: true, time: 0 });
      const geometry = visibleGeometry(model), H = geometry.bounds.height;
      const face = geometry.meshes.find(entry => entry.object.name === 'face');
      assert.ok(face, `${label}: face geometry must be identifiable`);
      const faceBounds = measurePointBounds(face.points);
      const measurement = measureCharacterLandmarks(model.landmarks);
      const shoulderY = (model.landmarks.leftShoulder.y + model.landmarks.rightShoulder.y) / 2;
      const actualShoulderWidth = sliceWidth(geometry.meshes, shoulderY);
      // Painted face extent is checked separately from crown/chin markers:
      // caps and long hair must not be mistaken for anatomical head length.
      const faceHeightRatio = faceBounds.height / H;
      assert.ok(faceHeightRatio >= CHARACTER_TARGETS.headHeight.min && faceHeightRatio <= CHARACTER_TARGETS.headHeight.max, `${label}: actual face/body ratio ${faceHeightRatio}`);
      assert.ok(faceBounds.width / H >= CHARACTER_TARGETS.headWidth.min && faceBounds.width / H <= CHARACTER_TARGETS.headWidth.max, `${label}: actual face width/body ratio ${faceBounds.width / H}`);
      assert.ok(H > 1.65 && H < 1.98, `${label}: visible geometry height ${H}`);
      // Retain independently measured joint lengths, but replace the broad
      // garment shoulder estimate with the actual intersected mesh surface.
      // The image target is one adult male; intentional rider build variations
      // should not force every original character to have identical breadth.
      const ratios = { ...measurement.ratios, shoulderWidth: actualShoulderWidth / measurement.height / (CHARACTERS[character].build || 1) };
      delete ratios.headHeight;
      delete ratios.chinY;
      const baggy = ['baggy', 'oversized', 'raglan', 'open', 'layered', 'sweatshirt'].includes(OUTFITS[outfit].top);
      const required = ['shoulderJointWidth', 'shoulderY', 'kneeY', 'upperArm', 'forearm', 'thigh', 'shin'];
      if (baggy) required.push('shoulderWidth');
      else delete ratios.shoulderWidth; // Fitted wetsuits/bare shoulders do not need sweatshirt width.
      const audit = auditCharacterProportions({ ...measurement, ratios }, { required });
      assert.equal(audit.pass, true, `${label}: ${audit.issues.map(item => `${item.key}=${item.value.toFixed(4)} [${item.min},${item.max}]`).join('; ')} ${audit.missing.join(',')}`);
      reports.push({ character, outfit, H, faceHeightRatio, shoulder: actualShoulderWidth / measurement.height, baggy });
    } finally { disposeModel(model); }
  }
  assert.equal(reports.length, 48);
  const range = (key, rows = reports) => `${Math.min(...rows.map(row => row[key])).toFixed(4)}–${Math.max(...rows.map(row => row[key])).toFixed(4)}`;
  t.diagnostic(`Measured geometry: standing height ${range('H')}m; face height/body ${range('faceHeightRatio')}; actual baggy shoulder slice/body ${range('shoulder', reports.filter(row => row.baggy))}.`);
});

test('all 48 characters keep finite authored geometry and normals through 9 demanding poses', () => {
  let checked = 0;
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    const model = makeModel(character, outfit);
    try {
      for (const pose of poses) {
        model.pose(pose);
        const geometry = visibleGeometry(model);
        assert.ok(geometry.vertices.length > 200, `${character}/${outfit}: missing visible model`);
        assert.ok(geometry.bounds.height > .2 && geometry.bounds.height < 3, `${character}/${outfit}: exploded pose`);
        for (const { object } of geometry.meshes) {
          const normal = object.geometry.getAttribute('normal');
          if (normal) for (const value of normal.array) assert.ok(Number.isFinite(value), `${character}/${outfit}: non-finite vertex normal`);
        }
        for (const [name, landmark] of Object.entries(model.landmarks)) assert.ok([landmark.x, landmark.y, landmark.z].every(Number.isFinite), `${character}/${outfit}: invalid ${name}`);
        checked++;
      }
    } finally { disposeModel(model); }
  }
  assert.equal(checked, 432);
});

test('authored torso armholes and the branching trouser seat remain joined through actual posed mesh vertices', t => {
  let joinedVertices=0,maxGap=0;
  for(const character of Object.keys(CHARACTERS))for(const outfit of Object.keys(OUTFITS)){
    const model=makeModel(character,outfit);
    try{
      for(const pose of poses){
        model.pose(pose);const {meshes}=visibleGeometry(model),byName=name=>meshes.find(m=>m.object.name===name),torso=byName('torso');
        for(const side of ['left','right']){
          const sleeve=byName(side+'-sleeve');
          if(sleeve&&torso){
            const indices=torso.object.userData.armholes[side];
            indices.forEach((index,i)=>{
              const gap=torso.points[index].distanceTo(sleeve.points[i]);maxGap=Math.max(maxGap,gap);joinedVertices++;
              assert.ok(gap<1e-6,`${character}/${outfit} ${side} shoulder opens by ${gap}m`);
            });
          }
          const leg=byName(side+'-trousers')||byName(side+'-shorts'),opposite=byName((side==='left'?'right':'left')+'-trousers')||byName((side==='left'?'right':'left')+'-shorts'),seat=byName('trouser-yoke');
          if(leg&&opposite&&seat){
            // The three inside vertices meet the opposite leg; the remaining
            // vertices meet the seat. Both comparisons use generated meshes.
            const connected=[...opposite.points.slice(0,8),...seat.points];
            for(const point of leg.points.slice(0,8)){
              const gap=Math.min(...connected.map(other=>other.distanceTo(point)));maxGap=Math.max(maxGap,gap);joinedVertices++;
              assert.ok(gap<1e-6,`${character}/${outfit} ${side} trouser crotch opens by ${gap}m`);
            }
          }
        }
      }
    }finally{disposeModel(model);}
  }
  assert.ok(joinedVertices>10000);
  t.diagnostic(`${joinedVertices} actual joined cloth vertices checked; largest world-space seam gap ${(maxGap*1000).toFixed(6)}mm.`);
});

test('baggy reference outfits have hanging sleeves, a roomy torso and closely spaced full trouser legs',t=>{
  const reports=[];
  for(const character of Object.keys(CHARACTERS))for(const outfit of ['yardcrew','suncrew']){
    const model=makeModel(character,outfit),label=`${character}/${outfit}`;
    try{
      model.pose({standing:true,time:0});const geometry=visibleGeometry(model),H=geometry.bounds.height;
      const part=name=>geometry.meshes.filter(m=>m.object.name===name),torso=part('torso'),left=part('left-trousers'),right=part('right-trousers');
      // Slice the complete chest immediately below the armholes. Above this
      // plane the sleeve is physically part of the outside chest boundary.
      const chest=sliceBounds(torso,model.body.localToWorld(new THREE.Vector3(0,.22,0)).y);
      const waist=sliceBounds(torso,model.body.localToWorld(new THREE.Vector3(0,.08,0)).y);
      const sleeveVertices=geometry.meshes.filter(m=>m.object.name.endsWith('-sleeve')).flatMap(m=>m.points),sleeveEnvelope=measurePointBounds(sleeveVertices).width;
      assert.ok(chest.width/H>=CHARACTER_TARGETS.chestWidth.min&&chest.width/H<=CHARACTER_TARGETS.chestWidth.max,`${label}: actual chest width ${chest.width/H}`);
      assert.ok(waist.width/chest.width>=.88,`${label}: sweatshirt is pinched into a narrow waist`);
      assert.ok(chest.depth/H>=.135&&chest.depth/H<=.175,`${label}: torso depth ${chest.depth/H}`);
      assert.ok(sleeveEnvelope/H<.315,`${label}: standing sleeves flare sideways ${sleeveEnvelope/H}`);
      for(const side of ['left','right']){
        const shoulder=model.landmarks[side+'Shoulder'],elbow=model.landmarks[side+'Elbow'];
        assert.ok(Math.abs(elbow.x-shoulder.x)<.04,`${label}: ${side} elbow bows outward like a mannequin`);
      }
      let widestGap=0;
      for(const y of [.25,.35,.45,.55]){
        const l=sliceBounds(left,y),r=sliceBounds(right,y),gap=Math.max(0,r.min.x-l.max.x);widestGap=Math.max(widestGap,gap);
        assert.ok(gap/H<.025,`${label}: trouser gap ${gap.toFixed(3)}m at y=${y}`);
        assert.ok(l.width/H>.095&&r.width/H>.095,`${label}: baggy leg pinches at y=${y}`);
      }
      const cuff=sliceBounds(left,.14),knee=sliceBounds(left,.50);
      assert.ok(cuff.width/knee.width>.85&&cuff.width/knee.width<1.20,`${label}: trouser cuff should hang full over the shoe`);
      reports.push({chest:chest.width/H,depth:chest.depth/H,sleeve:sleeveEnvelope/H,gap:widestGap});
    }finally{disposeModel(model);}
  }
  const range=key=>`${Math.min(...reports.map(r=>r[key])).toFixed(4)}–${Math.max(...reports.map(r=>r[key])).toFixed(4)}`;
  t.diagnostic(`Triangle-derived ratios: torso chest ${range('chest')}, chest depth ${range('depth')}, hanging sleeve envelope ${range('sleeve')}; largest sampled inner-leg gap ${range('gap')}m.`);
});

test('neutral standing has unlocked asymmetric joints without returning to a wide trouser stance', t => {
  const rows = [];
  const angle = (a, b, c) => THREE.MathUtils.radToDeg(a.clone().sub(b).angleTo(c.clone().sub(b)));
  for (const character of Object.keys(CHARACTERS)) {
    const model = makeModel(character, CHARACTERS[character].defaultOutfit);
    try {
      for (const time of [0, 1.5, 3]) {
        model.pose({ standing: true, time });
        const lm = model.landmarks, knees = [];
        for (const side of ['left', 'right']) {
          // These are posed IK joint locations, rather than configured bend
          // constants. 180 degrees means the limb has locked straight.
          const elbow = angle(lm[side + 'Shoulder'], lm[side + 'Elbow'], lm[side + 'Wrist']);
          const knee = angle(lm[side + 'Hip'], lm[side + 'Knee'], lm[side + 'Ankle']);
          assert.ok(elbow > 140 && elbow < 163, `${character}: ${side} elbow lost its relaxed bend (${elbow})`);
          assert.ok(knee > 150 && knee < 174, `${character}: ${side} knee should be subtly flexed (${knee})`);
          knees.push(knee); rows.push({ elbow, knee });
        }
        assert.ok(Math.abs(knees[0] - knees[1]) > 4, `${character}: neutral pose lost its unequal weight-bearing legs`);
        const lateralGap = Math.abs(lm.rightAnkle.x - lm.leftAnkle.x);
        assert.ok(lateralGap > .21 && lateralGap < .26, `${character}: relaxation must not widen the standing legs`);
        assert.ok(Math.abs(lm.rightAnkle.z - lm.leftAnkle.z) > .05, `${character}: feet lost their staggered standing placement`);
      }
    } finally { disposeModel(model); }
  }
  const range = key => `${Math.min(...rows.map(r => r[key])).toFixed(1)}–${Math.max(...rows.map(r => r[key])).toFixed(1)}`;
  t.diagnostic(`Actual standing joint angles over the breathing cycle: elbows ${range('elbow')}°, knees ${range('knee')}°; both sides keep their original physical limb lengths in the separate pose tests.`);
});

test('both comparison builders expose a level, sewn T-pose without changing default poses', t => {
  let inspected=0,seams=0;
  for(const [version,builder]of [['current',createCharacter],['v8',createV8Character]]){
    for(const character of Object.keys(CHARACTERS))for(const outfit of ['riptide','yardcrew','reefskin']){
      const model=makeModel(character,outfit,builder),label=`${version}/${character}/${outfit}`;
      try{
        model.pose({standing:true,mode:'park',time:.4});
        const defaultStanding=visibleGeometry(model).vertices;
        model.pose({standing:true,mode:'park',inspectionPose:'tpose'});
        const geometry=visibleGeometry(model),lm=model.landmarks;
        assert.ok(geometry.vertices.every(p=>[p.x,p.y,p.z].every(Number.isFinite)),`${label}: non-finite inspection geometry`);
        assert.ok(model.body.rotation.toArray().slice(0,3).every(x=>x===0)&&model.head.rotation.toArray().slice(0,3).every(x=>x===0),`${label}: inspection torso/head must face straight ahead`);
        for(const side of ['left','right']){
          for(const point of ['Elbow','Wrist','Fingertip'])assert.ok(Math.abs(lm[side+point].y-lm[side+'Shoulder'].y)<1e-7,`${label}: ${side} inspection arm is not level`);
          for(const [a,b,length]of [['Shoulder','Elbow',.32],['Elbow','Wrist',.29],['Wrist','Fingertip',.15],['Hip','Knee',.478],['Knee','Ankle',.45]]){
            assert.ok(Math.abs(lm[side+a].distanceTo(lm[side+b])-length)<1e-6,`${label}: ${side} inspection ${a}-${b} stretched`);
          }
          const torso=geometry.meshes.find(m=>m.object.name==='torso'),sleeve=geometry.meshes.find(m=>m.object.name===side+'-sleeve');
          if(torso&&sleeve)for(const [i,index]of torso.object.userData.armholes[side].entries()){
            assert.ok(torso.points[index].distanceTo(sleeve.points[i])<1e-6,`${label}: T-pose opens ${side} armhole`);seams++;
          }
          const leg=geometry.meshes.find(m=>m.object.name===side+'-trousers'||m.object.name===side+'-shorts');
          if(leg){
            const connected=geometry.meshes.filter(m=>m.object.name==='trouser-yoke'||m.object.name===(side==='left'?'right':'left')+(outfit==='yardcrew'?'-trousers':'-shorts')).flatMap(m=>m.points);
            for(const vertex of leg.points.slice(0,8)){assert.ok(Math.min(...connected.map(p=>p.distanceTo(vertex)))<1e-6,`${label}: T-pose opens the trouser seat`);seams++;}
          }
        }
        assert.ok(lm.leftFingertip.x<lm.leftShoulder.x-.75&&lm.rightFingertip.x>lm.rightShoulder.x+.75,`${label}: arms did not extend to a real T-pose`);
        assert.ok(Math.abs(lm.leftAnkle.y-lm.rightAnkle.y)<1e-9&&Math.abs(lm.leftAnkle.z-lm.rightAnkle.z)<1e-9,`${label}: inspection feet need the same neutral plane`);
        model.pose({standing:true,mode:'park',time:.4});
        const restored=visibleGeometry(model).vertices;
        assert.equal(restored.length,defaultStanding.length);
        assert.ok(restored.every((p,i)=>p.distanceTo(defaultStanding[i])<1e-7),`${label}: opting out failed to restore the actual ordinary standing triangles`);
        const riding={mode:'park',charge:.4,time:.4};model.pose(riding);
        const defaultRiding=visibleGeometry(model).vertices;
        model.pose({...riding,inspectionPose:'tpose'});
        assert.ok(visibleGeometry(model).vertices.every((p,i)=>p.distanceTo(defaultRiding[i])<1e-7),`${label}: inspection argument changed a gameplay pose`);
        inspected++;
      }finally{disposeModel(model);}
    }
  }
  assert.equal(inspected,24);t.diagnostic(`${inspected} old/new short-sleeve, sweatshirt and wetsuit bodies: level fixed-length arms, ${seams} actual seam vertices, exact ordinary-pose restoration and no gameplay effect.`);
});

test('grounded charging hinges an adult rider forward without collapsing into a seated pose', t => {
  const rows=[];
  for(const character of Object.keys(CHARACTERS))for(const outfit of Object.keys(OUTFITS)){
    const model=makeModel(character,outfit),label=`${character}/${outfit}`;
    try{
      let previousHip=Infinity,previousHinge=-Infinity;
      for(const charge of [0,.25,.5,.75,1]){
        model.pose({mode:'park',charge});model.rider.updateMatrixWorld(true);
        const p=name=>model.rider.worldToLocal(model.landmarks[name].clone());
        const hip=p('leftHip').add(p('rightHip')).multiplyScalar(.5),knee=p('leftKnee').add(p('rightKnee')).multiplyScalar(.5);
        const ankle=p('leftAnkle').add(p('rightAnkle')).multiplyScalar(.5),shoulder=p('leftShoulder').add(p('rightShoulder')).multiplyScalar(.5);
        const hinge=Math.atan2(hip.z-shoulder.z,shoulder.y-hip.y)*180/Math.PI;
        assert.ok(hip.y<previousHip&&hinge>previousHinge,`${label}: charging must progressively lower hips and hinge chest forward`);
        assert.ok(hip.y-knee.y>.12,`${label}: hips collapsed to knee height while grounded`);
        assert.ok(hip.y-ankle.y>.38,`${label}: hips sit too close to the board`);
        assert.ok(hip.z-ankle.z<.16,`${label}: rearward hip shift creates a chair-like seat`);
        assert.ok(shoulder.z<hip.z-.09,`${label}: chest must balance forward over bent legs`);
        if(charge===1)assert.ok(hinge>30&&hinge<45,`${label}: full crouch should have a clear, controlled forward hinge (${hinge} degrees)`);
        assert.ok(Math.abs(p('leftWrist').z-p('rightWrist').z)>.12,`${label}: arms lost their asymmetric forward/trailing balance`);
        previousHip=hip.y;previousHinge=hinge;
        for(const [side,expectedAnkle,expectedToe]of [['left',[-.34,.215,.035],[-.36,.181,-.163]],['right',[.36,.215,.069],[.395,.181,-.128]]]){
          assert.ok(p(side+'Ankle').distanceTo(new THREE.Vector3(...expectedAnkle))<1e-8,`${label}: ${side} planted ankle slid while charging`);
          assert.ok(p(side+'Toe').distanceTo(new THREE.Vector3(...expectedToe))<1e-8,`${label}: ${side} planted toe slid while charging`);
          for(const [a,b,length]of [['Shoulder','Elbow',.32],['Elbow','Wrist',.29],['Hip','Knee',.478],['Knee','Ankle',.45]]){
            assert.ok(Math.abs(p(side+a).distanceTo(p(side+b))-length)<.003,`${label}: ${side} ${a}-${b} changed length`);
          }
        }
        if(charge===1)rows.push({height:hip.y,kneeGap:hip.y-knee.y,hinge});
      }
    }finally{disposeModel(model);}
  }
  t.diagnostic(`48 full-charge bodies: hip height ${Math.min(...rows.map(r=>r.height)).toFixed(3)}m; minimum hip-to-knee rise ${Math.min(...rows.map(r=>r.kneeGap)).toFixed(3)}m; torso hinge ${Math.min(...rows.map(r=>r.hinge)).toFixed(1)}–${Math.max(...rows.map(r=>r.hinge)).toFixed(1)} degrees. All 240 charge poses retain four fixed limb lengths and planted feet.`);
});

test('loose torso meshes retain a shaped waist and uneven open hem rather than a rectangular shell', t => {
  const rows = [];
  for (const character of Object.keys(CHARACTERS)) for (const outfit of ['yardcrew', 'suncrew', 'riptide']) {
    const model = makeModel(character, outfit), label = `${character}/${outfit}`;
    try {
      const torso = model.rider.getObjectByName('torso'), attribute = torso.geometry.attributes.position;
      const points = Array.from({ length: attribute.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(attribute, i));
      // Torso-local triangle slices remove standing tilt from the measurement,
      // so a straight-sided mesh cannot pass merely by leaning the whole body.
      const localMesh = [{ object: torso, points }];
      const chest = sliceBounds(localMesh, .22), waist = sliceBounds(localMesh, .08), ratio = waist.width / chest.width;
      assert.ok(ratio > .88 && ratio < .97, `${label}: actual cloth waist/chest ${ratio} should retain a gentle contour`);
      // Find actual open-boundary edges below the waist. No authored ring or
      // hem marker is read, and sleeve/neck openings cannot affect the result.
      const index = torso.geometry.index, edges = new Map();
      for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
        const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3), key = [a, b].sort((x, y) => x - y).join(':');
        const edge = edges.get(key); if (edge) edge.count++; else edges.set(key, { a, b, count: 1 });
      }
      const hem = [...edges.values()].filter(e => e.count === 1 && points[e.a].y < -.08 && points[e.b].y < -.08).flatMap(e => [points[e.a].y, points[e.b].y]);
      assert.ok(hem.length >= 12, `${label}: missing open lower garment boundary`);
      const drape = Math.max(...hem) - Math.min(...hem);
      assert.ok(drape > .01 && drape < .035, `${label}: cloth hem should drape subtly, measured variation ${drape}m`);
      rows.push({ ratio, drape });
    } finally { disposeModel(model); }
  }
  t.diagnostic(`Actual loose-shirt triangle waist/chest ratio ${Math.min(...rows.map(r => r.ratio)).toFixed(4)}–${Math.max(...rows.map(r => r.ratio)).toFixed(4)}; open-edge hem variation ${(Math.min(...rows.map(r => r.drape)) * 1000).toFixed(1)}mm.`);
});

test('the photographed Reef raglan hip patch resolves to front-facing shorts rather than protruding thigh skin', t => {
  const model = makeModel('reef', 'raglan'), ray = new THREE.Raycaster();
  try {
    model.pose({ mode: 'park', charge: 0 });
    model.rider.updateMatrixWorld(true);
    // Reproduces the supplied cream/burgundy-shirt screenshot's exposed left
    // hip wedge. Use the actual production triangles and default FrontSide
    // materials, so hiding a skin mesh cannot pass if it leaves an empty hole.
    const target = model.body.localToWorld(new THREE.Vector3(-.2291667, -.0523077, 0));
    const outward = new THREE.Vector3(0, .18, 1).normalize().transformDirection(model.body.matrixWorld);
    ray.set(target.clone().addScaledVector(outward, 2), outward.clone().negate());
    const renderedMeshes = () => { const meshes = []; model.rider.traverseVisible(o => { if (o.isMesh) meshes.push(o); }); return meshes; };
    const covered = ray.intersectObjects(renderedMeshes(), false)[0];
    assert.ok(covered, 'the photographed hip patch must retain an opaque surface');
    assert.equal(covered.object.name, 'left-shorts', 'the hip patch must resolve to the actual shorts surface');
    assert.equal(covered.object.material.side, THREE.FrontSide, 'the cloth must not rely on drawing a reversed face');

    // Preserve the photographic reproducer on the saved v8 pose: the current
    // higher riding stance intentionally no longer shares that old hip angle.
    // Restoring its former fully enabled thigh must still expose the defect.
    const previous = makeModel('reef', 'raglan', createV8Character);
    try {
      previous.pose({ mode: 'park', charge: 0 }); previous.rider.updateMatrixWorld(true);
      const oldTarget = previous.body.localToWorld(new THREE.Vector3(-.2291667, -.0523077, 0));
      const oldOutward = new THREE.Vector3(0, .18, 1).normalize().transformDirection(previous.body.matrixWorld);
      ray.set(oldTarget.clone().addScaledVector(oldOutward, 2), oldOutward.clone().negate());
      const oldMeshes = () => { const rows=[]; previous.rider.traverseVisible(o => { if(o.isMesh)rows.push(o); }); return rows; };
      const oldCovered = ray.intersectObjects(oldMeshes(), false)[0];
      previous.rider.getObjectByName('left-thigh').parent.visible = true;
      const exposed = ray.intersectObjects(oldMeshes(), false)[0];
      assert.equal(exposed?.object.name, 'left-thigh', 'negative control did not reproduce the original hip wedge');
      const penetration = oldCovered.distance - exposed.distance;
      assert.ok(penetration > .06, `reproducer should detect substantial skin penetration, measured ${penetration}m`);
      t.diagnostic(`Current hip has real FrontSide shorts; the retained photographic pose reproduces ${(penetration * 1000).toFixed(1)}mm of protrusion when its hidden thigh is restored.`);
    } finally { disposeModel(previous); }
  } finally { disposeModel(model); }
});

test('all outfits keep covered thighs concealed and the intended lower legs visible through normal riding poses', t => {
  const legPoses = [
    { standing: true, mode: 'park' }, { mode: 'surf' },
    { mode: 'park', charge: .3 }, { mode: 'park', charge: .6 }, { mode: 'surf', charge: 1 },
    { mode: 'surf', air: true, grab: 1 },
    { mode: 'surf', cutback: 1, cutbackDirection: -1 }, { mode: 'surf', cutback: 1, cutbackDirection: 1 },
  ];
  const ray = new THREE.Raycaster(); let combinations = 0, calfSurfaces = 0, coveredHipRays = 0;
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    const model = makeModel(character, outfit), settings = OUTFITS[outfit], label = `${character}/${outfit}`;
    const wet = settings.top === 'wetsuit', trousers = settings.bottom === 'trousers';
    try {
      for (const pose of legPoses) {
        model.pose(pose); model.rider.updateMatrixWorld(true);
        const meshes = []; model.rider.traverseVisible(o => { if (o.isMesh) meshes.push(o); });
        for (const side of ['left', 'right']) {
          const thigh = model.rider.getObjectByName(side + '-thigh'), calf = model.rider.getObjectByName(side + '-calf');
          assert.ok(thigh && calf, `${label}: missing leg geometry`);
          assert.equal(meshes.includes(thigh), wet, `${label}: ${side} upper leg is covered by shorts/trousers or rendered as wetsuit cloth`);
          assert.equal(meshes.includes(calf), !trousers, `${label}: ${side} lower leg visibility must match its outfit`);
          if (wet) assert.ok(thigh.material.map, `${label}: the visible wetsuit thigh needs its cloth material`);
          if (!trousers) {
            // A real point on the exposed calf, below the shorts hem. At least
            // one surrounding view must see this actual surface: retaining a
            // visible flag alone would not catch accidentally enclosing it.
            const target = calf.localToWorld(new THREE.Vector3(0, .67, 0)); let seen = false;
            for (let a = 0; a < 8; a++) {
              const outward = new THREE.Vector3(Math.cos(a * Math.PI / 4), 0, Math.sin(a * Math.PI / 4)).transformDirection(calf.matrixWorld);
              ray.set(target.clone().addScaledVector(outward, 1), outward.clone().negate());
              if (ray.intersectObjects(meshes, false)[0]?.object === calf) seen = true;
            }
            assert.ok(seen, `${label}: ${side} below-knee surface disappeared in ${JSON.stringify(pose)}`);
            calfSurfaces++;
          }
        }
        if (!wet && !trousers) for (let a = 0; a < 8; a++) for (const x of [-.22, .22]) for (const y of [-.05, -.11, -.17]) {
          const target = model.body.localToWorld(new THREE.Vector3(x, y, 0));
          const outward = new THREE.Vector3(Math.sin(a * Math.PI / 4), .18, Math.cos(a * Math.PI / 4)).normalize().transformDirection(model.body.matrixWorld);
          ray.set(target.clone().addScaledVector(outward, 2), outward.clone().negate());
          const hit = ray.intersectObjects(meshes, false)[0];
          assert.ok(!hit || !hit.object.name.endsWith('-thigh'), `${label}: upper-thigh skin is foremost at the covered hip in ${JSON.stringify(pose)}`);
          coveredHipRays++;
        }
        combinations++;
      }
    } finally { disposeModel(model); }
  }
  assert.equal(combinations, 384);
  t.diagnostic(`${combinations} character/outfit/pose combinations: ${calfSurfaces} actual exposed calf surfaces and ${coveredHipRays} surrounding covered-hip rays checked.`);
});

test('grabs put actual hand geometry at the exposed board-rail target', () => {
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    const model = makeModel(character, outfit);
    try {
      for (const pose of [{ grab: 1, air: true }, { lipGrab: 1, mode: 'park' }, { grab: 1, charge: 1, lean: -1, air: true }]) {
        model.pose(pose);
        const { rightFingertip, boardGrabTarget } = model.landmarks;
        assert.ok(rightFingertip && boardGrabTarget, `${character}/${outfit}: missing contact evidence`);
        assert.ok(rightFingertip.distanceTo(boardGrabTarget) < .003, `${character}/${outfit}: missed grab target`);
        let nearest = Infinity;
        model.rightArm.traverseVisible(object => {
          if (!object.isMesh) return;
          const position = object.geometry.getAttribute('position');
          for (let i = 0; i < position.count; i++) nearest = Math.min(nearest, object.localToWorld(new THREE.Vector3().fromBufferAttribute(position, i)).distanceTo(boardGrabTarget));
        });
        assert.ok(nearest < .003, `${character}/${outfit}: landmark touches rail but actual hand mesh is ${nearest}m away`);
      }
    } finally { disposeModel(model); }
  }
});

test('limb lengths remain anatomical when a standing rider crouches and grabs', () => {
  const bones = [['Shoulder', 'Elbow'], ['Elbow', 'Wrist'], ['Hip', 'Knee'], ['Knee', 'Ankle']];
  for (const character of Object.keys(CHARACTERS)) {
    const model = makeModel(character, CHARACTERS[character].defaultOutfit);
    try {
      model.pose({ standing: true });
      const lengths = side => bones.map(([a, b]) => model.landmarks[side + a].distanceTo(model.landmarks[side + b]));
      const rest = { left: lengths('left'), right: lengths('right') };
      for (const pose of poses.filter(value => !value.standing)) {
        model.pose(pose);
        for (const side of ['left', 'right']) for (const [i, length] of lengths(side).entries()) {
          const ratio = length / rest[side][i];
          // Small tolerance accommodates a nearly straight standing knee;
          // changing pose must not telescope an anatomical limb.
          assert.ok(ratio > .97 && ratio < 1.03, `${character} ${side}${bones[i].join('–')}: pose/rest length=${ratio.toFixed(3)} for ${JSON.stringify(pose)}`);
        }
      }
    } finally { disposeModel(model); }
  }
});

function actualDeckDistance(surfer, point) {
  surfer.rig.updateWorldMatrix(true, true);
  const geometry = surfer.board.geometry, position = geometry.getAttribute('position'), index = geometry.index;
  const count = index ? index.count : position.count;
  const triangle = new THREE.Triangle(), closest = new THREE.Vector3();
  let distance = Infinity;
  for (let i = 0; i < count; i += 3) {
    for (const [offset, vertex] of [[0, triangle.a], [1, triangle.b], [2, triangle.c]]) {
      vertex.fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset).applyMatrix4(surfer.board.matrixWorld);
    }
    triangle.closestPointToPoint(point, closest);
    distance = Math.min(distance, closest.distanceTo(point));
  }
  return distance;
}

function verifyActualHeldDeck(surfer, label) {
  const fingertip = surfer.landmarks.rightFingertip;
  assert.ok(actualDeckDistance(surfer, fingertip) < .003, `${label}: visible fingertip misses the actual transformed deck`);
  // Check a visible mesh vertex as well as the animated landmark. This would
  // fail the former rig-local marker test even if its reported target was zero.
  let nearest = Infinity;
  surfer.rightArm.traverseVisible(object => {
    if (!object.isMesh) return;
    const position = object.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) nearest = Math.min(nearest, object.localToWorld(new THREE.Vector3().fromBufferAttribute(position, i)).distanceTo(fingertip));
  });
  assert.ok(nearest < .003, `${label}: contact marker has no hand geometry`);
  for (const side of ['left', 'right']) {
    const lm = surfer.landmarks;
    assert.ok(Math.abs(lm[side + 'Shoulder'].distanceTo(lm[side + 'Elbow']) - .32) < .003, `${label}: stretched upper arm`);
    assert.ok(Math.abs(lm[side + 'Elbow'].distanceTo(lm[side + 'Wrist']) - .29) < .003, `${label}: stretched forearm`);
    assert.ok(Math.abs(lm[side + 'Wrist'].distanceTo(lm[side + 'Fingertip']) - .15) < .003, `${label}: stretched hand`);
  }
}

test('production grab timing holds the deck for a readable interval rather than an instantaneous sine peak', () => {
  assert.equal(grabEnvelope(0), 0);
  assert.equal(grabEnvelope(1), 0);
  for (const progress of [GRAB_HOLD_START, .3, .5, .7, GRAB_HOLD_END]) assert.equal(grabEnvelope(progress), 1);
  for (const type of ['grab', 'method', 'tweak']) {
    let heldFrames = 0;
    for (let age = 0; age < TRICKS[type].duration; age += 1 / 60) {
      const pose = sampleRiderTrick({ airborne: true, trick: { ...TRICKS[type], age } });
      if (pose.holdingGrab) heldFrames++;
    }
    assert.ok(heldFrames >= 20, `${type}: only ${heldFrames} frames of full contact at 60Hz`);
  }
  const special = sampleRiderTrick({ airborne: true, trick: { ...TRICKS.special, age: TRICKS.special.duration * .5 } });
  assert.equal(special.grab, 1, 'a fractional grab style parameter must still produce full contact');
  assert.ok(Math.abs(special.flip - TRICKS.special.flip) < 1e-10, 'combined board flip finishes before the hold');
  const tweak = sampleRiderTrick({ airborne: true, trick: { ...TRICKS.tweak, age: TRICKS.tweak.duration * .5 } });
  assert.equal(tweak.tweak,1);assert.equal(tweak.grab,1);
  assert.ok(tweak.boardLift>=.2&&Math.abs(tweak.boardBank)>.4&&Math.abs(tweak.boardSide)>.2,'tweaked grab visibly lifts and banks the board beside the rider');
  assert.equal('roll' in tweak,false,'B no longer drives a whole-rider barrel roll');
});

test('production surfer hierarchy keeps actual hand-to-deck contact throughout air and lip grab holds for all48 models', t => {
  let contacts = 0;
  const progressFrames = [0, .1, .22, .3, .5, .7, .8, .9, 1];
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    const surfer = makeSurfer(character, outfit), sceneParent = new THREE.Group();
    sceneParent.position.set(13, 3, -27); sceneParent.rotation.set(.18, .71, -.11); sceneParent.add(surfer.rig);
    try {
      for (const type of ['grab', 'method', 'tweak', 'special', 'lip']) for (const progress of progressFrames) {
        const air = type !== 'lip';
        const state = { airborne: air, rotation: Math.PI, flipRotation: Math.PI * 2, boardRotation: -Math.PI * 2,
          trick: air ? { ...TRICKS[type], age: TRICKS[type].duration * progress } : null,
          lipMove: air ? null : { progress }, lipGrab: 0 };
        const sampled = sampleRiderTrick(state);
        // Same hierarchy/order as production: world heading/roll, whole-rider
        // yaw, independently transformed deck, then the production pose wrapper.
        surfer.rig.position.set(-4, 2.2, 8); surfer.rig.rotation.order = 'YXZ';
        surfer.rig.rotation.set(-.12, .63 + (air ? 0 : Math.PI * progress), .24);
        surfer.yaw.rotation.y = sampled.spin;
        surfer.boardPivot.rotation.order='YXZ';surfer.boardPivot.rotation.set(sampled.boardPitch,sampled.boardSpin,sampled.flip+sampled.boardBank);
        surfer.boardPivot.position.set(sampled.boardSide,(air?.12:0)+sampled.boardLift,sampled.boardBack);
        surfer.pose({ air, grab: sampled.grab, tweak:sampled.tweak, lipGrab: sampled.lipGrab, mode: 'park', time: progress, lean: .12 });
        if (sampled.holdingGrab) { verifyActualHeldDeck(surfer, `${character}/${outfit} ${type} ${progress}`); contacts++; }
      }
      // A non-integral deck flip/yaw independently exercises the matrix path;
      // the production hold choreography normally returns it flat first.
      surfer.boardPivot.rotation.set(.09, -.36, .31);
      surfer.pose({ air: true, grab: 1, mode: 'surf' });
      verifyActualHeldDeck(surfer, `${character}/${outfit}: independently rotated deck`); contacts++;
    } finally { disposeSurfer(surfer); }
  }
  assert.equal(contacts, 1248);
  t.diagnostic(`${contacts} held frames measured against actual transformed deck triangles; each hand/arm retains its physical length.`);
});

test('tweaked grabs keep both visible feet on the banked deck with fixed tucked legs and a high free arm',t=>{
  let checked=0;
  const bindings=[{side:'left',ankle:[-.035,.215,-.34],toe:[.163,.181,-.36]},{side:'right',ankle:[-.069,.215,.36],toe:[.128,.181,.395]}];
  for(const character of Object.keys(CHARACTERS))for(const outfit of Object.keys(OUTFITS)){
    const surfer=makeSurfer(character,outfit),parent=new THREE.Group();parent.position.set(9,3,-11);parent.rotation.set(.17,-.45,.11);parent.add(surfer.rig);
    try{
      surfer.rig.rotation.set(-.08,.22,.18);
      for(const progress of [.06,.18,.22,.5,.8,.91,.98]){
        const sample=sampleRiderTrick({airborne:true,trick:{...TRICKS.tweak,age:TRICKS.tweak.duration*progress}});
        surfer.boardPivot.rotation.order='YXZ';surfer.boardPivot.rotation.set(sample.boardPitch,sample.boardSpin,sample.flip+sample.boardBank);
        surfer.boardPivot.position.set(sample.boardSide,.12+sample.boardLift,sample.boardBack);
        surfer.pose({air:true,grab:sample.grab,tweak:sample.tweak,mode:'surf'});
        const meshes=visibleGeometry(surfer).meshes;
        for(const {side,ankle,toe}of bindings){
          const expectedAnkle=surfer.board.localToWorld(new THREE.Vector3(...ankle)),expectedToe=surfer.board.localToWorld(new THREE.Vector3(...toe)),lm=surfer.landmarks;
          assert.ok(lm[side+'Ankle'].distanceTo(expectedAnkle)<1e-7,`${character}/${outfit} ${progress}: ${side} ankle left banked board`);
          assert.ok(lm[side+'Toe'].distanceTo(expectedToe)<1e-7,`${character}/${outfit} ${progress}: ${side} toe left banked board`);
          const foot=meshes.find(m=>m.object.name===side+'-foot');
          assert.ok(foot&&Math.min(...foot.points.map(v=>v.distanceTo(expectedToe)))<1e-7,`${side}: planted toe has no actual foot geometry`);
          assert.ok(Math.abs(lm[side+'Hip'].distanceTo(lm[side+'Knee'])-.478)<.003,`${side}: tweaked thigh stretched`);
          assert.ok(Math.abs(lm[side+'Knee'].distanceTo(lm[side+'Ankle'])-.45)<.003,`${side}: tweaked shin stretched`);
          if(sample.holdingGrab)assert.ok(lm[side+'Hip'].distanceTo(lm[side+'Ankle'])<.60,`${side}: tweak did not tuck the knee`);
        }
        for(const {object,points}of meshes){assert.ok(points.every(p=>[p.x,p.y,p.z].every(Number.isFinite)));assert.ok([...object.geometry.attributes.normal.array].every(Number.isFinite));}
        checked++;
      }
      parent.position.set(0,0,0);parent.rotation.set(0,0,0);surfer.rig.rotation.set(0,0,0);
      const sample=sampleRiderTrick({airborne:true,trick:{...TRICKS.tweak,age:TRICKS.tweak.duration*.5}});
      surfer.boardPivot.rotation.set(sample.boardPitch,0,sample.boardBank);surfer.boardPivot.position.set(sample.boardSide,.12+sample.boardLift,sample.boardBack);
      surfer.pose({air:true,grab:1,tweak:1,mode:'park'});
      assert.ok(surfer.landmarks.leftFingertip.y>surfer.landmarks.crown.y+.25,`${character}/${outfit}: free hand is not visibly above head`);
      verifyActualHeldDeck(surfer,`${character}/${outfit}: held tweaked pose`);
    }finally{disposeSurfer(surfer);}
  }
  assert.equal(checked,336);t.diagnostic(`${checked} entry/hold/release poses keep actual foot geometry on both transformed bindings without stretching legs.`);
});

test('ground cutbacks visibly lower and turn the rider while preserving planted feet and limb lengths', () => {
  for (const character of Object.keys(CHARACTERS)) {
    const model = makeModel(character, CHARACTERS[character].defaultOutfit);
    try {
      model.pose({ mode: 'surf' });
      const planted = ['leftAnkle', 'rightAnkle'].map(key => model.landmarks[key].clone());
      const ordinaryHeight = model.landmarks.crown.y;
      for (const direction of [-1, 1]) {
        model.pose({ mode: 'surf', cutback: 1, cutbackDirection: direction });
        assert.ok(model.landmarks.crown.y < ordinaryHeight - .08, `${character}: cutback has no visible crouch`);
        for (const [index, side] of ['left', 'right'].entries()) {
          assert.ok(model.landmarks[side + 'Ankle'].distanceTo(planted[index]) < 1e-8, `${character}: cutback moved a planted foot`);
          const lm = model.landmarks;
          for (const [a, b, length] of [['Shoulder', 'Elbow', .32], ['Elbow', 'Wrist', .29], ['Hip', 'Knee', .478], ['Knee', 'Ankle', .45]]) {
            assert.ok(Math.abs(lm[side + a].distanceTo(lm[side + b]) - length) < .003, `${character}: cutback stretched ${a}-${b}`);
          }
        }
        assert.ok(visibleGeometry(model).vertices.length > 200);
      }
    } finally { disposeModel(model); }
  }
});
