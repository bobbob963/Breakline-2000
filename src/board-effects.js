import * as THREE from 'three';
import { getRewardBoard, ALL_REWARD_BOARD_ORDER } from './board-rewards.js';
import { GRAFFITI_WORDS, createGraffitiTexture } from './graffiti-art.js';

export const BOARD_EFFECT_POOL_SIZE=3;
export const BOARD_EFFECT_LIFETIME=.66;
export const GRAFFITI_EFFECT_LIFETIME=1.15;
export const CLOCK_EFFECT_LIFETIME=1.18;
const TAU=Math.PI*2;
const EFFECT_IDS=ALL_REWARD_BOARD_ORDER;

function iconTexture(id) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d');c.fillStyle='#ffffff';c.strokeStyle='#ffffff';c.lineWidth=5;c.lineJoin='miter';
  const shape=points=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
  if(id==='guitar') {
    c.fillRect(23,12,5,37);c.fillRect(48,7,5,36);shape([[24,12],[53,6],[53,15],[24,21]]);
    for(const [x,y]of [[17,49],[42,43]]){c.beginPath();c.ellipse(x,y,11,7,-.4,0,TAU);c.fill();}
  } else if(id==='lightning')shape([[37,2],[11,36],[29,32],[18,62],[54,22],[34,27],[48,2]]);
  else if(id==='vortex') {
    for(let i=0;i<3;i++){c.save();c.translate(32,32);c.rotate(i*TAU/3);shape([[0,-6],[12,-13],[27,-6],[28,8],[16,25],[19,9],[14,1],[5,0]]);c.restore();}
  } else if(id==='solar') {
    c.save();c.translate(32,32);for(let i=0;i<8;i++){c.rotate(TAU/8);shape([[-3,-17],[0,-31],[4,-17]]);}c.beginPath();c.arc(0,0,11,0,TAU);c.fill();c.restore();
  } else if(id==='afterburner') {
    shape([[13,57],[11,42],[26,17],[28,31],[41,4],[50,34],[54,47],[43,59],[26,63]]);
    c.globalCompositeOperation='destination-out';shape([[24,54],[30,43],[31,51],[41,34],[43,52],[36,59]]);c.globalCompositeOperation='source-over';
  } else if(id==='sky') {
    shape([[8,58],[21,13],[40,3],[53,5],[54,22],[40,37],[31,36],[33,46],[21,49]]);
    c.globalCompositeOperation='destination-out';c.lineWidth=3;c.beginPath();c.moveTo(12,56);c.lineTo(43,16);c.stroke();
    for(let i=0;i<3;i++){c.beginPath();c.moveTo(21+i*6,44-i*8);c.lineTo(41+i*4,44-i*10);c.stroke();}
    c.globalCompositeOperation='source-over';
  }
  const texture=new THREE.CanvasTexture(canvas);texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;texture.name='reward-icon-'+id;return texture;
}

function jaggedHalo() {
  const positions=[];
  for(let i=0;i<20;i++) {
    const a=i*TAU/20,b=(i+1)*TAU/20,outerA=i%2?1:1.18,outerB=(i+1)%2?1:1.18;
    const p=[[Math.cos(a)*.92,Math.sin(a)*.92],[Math.cos(a)*outerA,Math.sin(a)*outerA],[Math.cos(b)*outerB,Math.sin(b)*outerB],[Math.cos(b)*.92,Math.sin(b)*.92]];
    for(const j of [0,1,2,0,2,3])positions.push(...p[j],0);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}

// Faceted ribbons and feathers keep the effects in the same low-poly language
// as the rider. All of these meshes are built once, never during a trick.
function ribbonGeometry(kind) {
  const positions=[],segments=40;
  const point=(t,side)=>{
    const angle=t*TAU*(kind==='vortex'?.84:.91);
    const radius=kind==='vortex'?.45+t*.82:1.05+Math.sin(t*TAU*9)*.045;
    const width=(kind==='vortex'?.105:.05)*Math.sin(Math.PI*t)**.6;
    return [Math.cos(angle)*(radius+side*width),Math.sin(angle)*(radius+side*width),Math.sin(t*Math.PI)*.035];
  };
  for(let i=0;i<segments;i++){
    const a=point(i/segments,-1),b=point(i/segments,1),c=point((i+1)/segments,1),d=point((i+1)/segments,-1);
    for(const p of [a,b,c,a,c,d])positions.push(...p);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

function flameGeometry() {
  const points=[[-.13,0,0],[.14,0,0],[.18,.18,0],[.04,.47,0],[.10,.76,0],[-.09,.58,0],[-.18,.30,0]],positions=[];
  for(let i=1;i<points.length-1;i++)for(const point of [points[0],points[i],points[i+1]])positions.push(...point);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

function angelWingGeometry() {
  const positions=[],colors=[],white=new THREE.Color('#f5ffff'),shade=new THREE.Color('#bfd7ef'),edge=new THREE.Color('#e9e2c7');
  const triangle=(a,b,c,color)=>{for(const point of [a,b,c]){positions.push(...point);colors.push(color.r,color.g,color.b);}};
  // Full arched shoulder, lifted above the deck so the feather fan remains
  // readable from a low chase camera instead of becoming a flat, needle edge.
  const shoulder=[[0,0,-.13],[.30,.16,-.31],[.65,.39,-.40],[.93,.54,-.33],[1.05,.52,-.09],[.87,.40,.23],[.58,.22,.47],[.18,.04,.40]],centre=[.47,.24,.04];
  for(let i=0;i<shoulder.length;i++)triangle(centre,shoulder[i],shoulder[(i+1)%shoulder.length],i%3===0?shade:white);
  const feather=(start,tip,width,covert=false)=>{
    const direction=tip.clone().sub(start),normal=new THREE.Vector3(-direction.z,0,direction.x).normalize();
    const middle=start.clone().lerp(tip,.48),end=start.clone().lerp(tip,.80);
    middle.y+=covert?.045:.075;end.y+=covert?.025:.055;
    const a=start.toArray(),b=middle.clone().addScaledVector(normal,width).toArray(),c=end.clone().addScaledVector(normal,width*.66).toArray(),d=tip.toArray(),e=end.clone().addScaledVector(normal,-width*.53).toArray(),f=middle.clone().addScaledVector(normal,-width*.83).toArray(),ridge=middle.clone();ridge.y+=.045;
    const q=ridge.toArray();
    triangle(a,b,q,edge);triangle(b,c,q,white);triangle(c,d,q,white);triangle(d,e,q,white);triangle(e,f,q,shade);triangle(f,a,q,shade);
    triangle(a,f,b,shade);triangle(b,f,c,shade);triangle(c,f,e,shade);triangle(c,e,d,shade);
  };
  // Broad overlapping primaries have rounded angular shoulders before their
  // curved tips; the stepped trailing edge reads as feathers at game scale.
  for(let i=0;i<8;i++)feather(
    new THREE.Vector3(.20+i*.067,.105+i*.014,-.17+i*.077),
    new THREE.Vector3(1.40-i*.095,.61-i*.026,-.31+i*.217),.135-i*.006);
  // Shorter coverts break up the shoulder into a second feather layer.
  for(let i=0;i<5;i++)feather(
    new THREE.Vector3(.12+i*.058,.10+i*.024,-.17+i*.086),
    new THREE.Vector3(.83-i*.07,.48-i*.044,-.11+i*.154),.097-i*.006,true);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}

function effectMaterial(color){return new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,opacity:0});}

function clockHandGeometry() {
  const outline=[[-.026,-.09],[.026,-.09],[.032,.34],[0,.50],[-.032,.34]],positions=[];
  for(let i=1;i<outline.length-1;i++)for(const index of [0,i,i+1])positions.push(...outline[index],0);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

/** Local, depth-tested reward accents. Three fixed slots reuse all GPU assets. */
export function createBoardEffects({reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}={}) {
  const group=new THREE.Group();group.name='reward-board-effects';
  const textures=new Map(EFFECT_IDS.map(id=>[id,iconTexture(id)]));
  const graffitiTextures=GRAFFITI_WORDS.map(createGraffitiTexture);
  const haloGeometry=jaggedHalo(),rayGeometry=new THREE.PlaneGeometry(.045,.56),handGeometry=clockHandGeometry(),handHubGeometry=new THREE.CircleGeometry(.045,6),pulseGeometry=new THREE.RingGeometry(.94,1,40);
  const waterGeometry=ribbonGeometry('vortex'),coronaGeometry=ribbonGeometry('solar'),flareGeometry=flameGeometry(),particleGeometry=new THREE.OctahedronGeometry(.065,0),wingGeometry=angelWingGeometry();
  let equipped=null,next=0,disposed=false,sequence=0;
  const slots=Array.from({length:BOARD_EFFECT_POOL_SIZE},(_,index)=>{
    const root=new THREE.Group();root.name='reward-burst-'+index;root.visible=false;group.add(root);
    const iconMaterial=new THREE.SpriteMaterial({transparent:true,depthWrite:false,depthTest:true,opacity:0});
    const icons=Array.from({length:8},()=>{const icon=new THREE.Sprite(iconMaterial);root.add(icon);return icon;});
    const graffiti=new THREE.Group();graffiti.name='lightning-graffiti';graffiti.visible=false;root.add(graffiti);
    const wordMaterial=new THREE.SpriteMaterial({transparent:true,depthWrite:false,depthTest:true,opacity:0});
    const word=new THREE.Sprite(wordMaterial);word.name='graffiti-word';graffiti.add(word);
    const rayMaterial=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,opacity:0});
    const halo=new THREE.Mesh(haloGeometry,rayMaterial);halo.name='local-impact-frame';root.add(halo);
    const rays=Array.from({length:12},()=>{const ray=new THREE.Mesh(rayGeometry,rayMaterial);root.add(ray);return ray;});
    const sculpted=new THREE.Group();sculpted.name='sculpted-reward-burst';sculpted.visible=false;root.add(sculpted);
    const coreMaterial=effectMaterial('#ffffff'),edgeMaterial=effectMaterial('#ffffff'),particleMaterial=effectMaterial('#ffffff');
    const ribbons=Array.from({length:3},(_,i)=>{const mesh=new THREE.Mesh(waterGeometry,i===1?edgeMaterial:coreMaterial);mesh.name='water-ribbon-'+i;sculpted.add(mesh);return mesh;});
    const coronas=Array.from({length:2},(_,i)=>{const mesh=new THREE.Mesh(coronaGeometry,i?edgeMaterial:coreMaterial);mesh.name='solar-corona-'+i;sculpted.add(mesh);return mesh;});
    const flames=Array.from({length:10},(_,i)=>{const mesh=new THREE.Mesh(flareGeometry,i%2?coreMaterial:edgeMaterial);mesh.name='solar-flame-'+i;sculpted.add(mesh);return mesh;});
    const particles=Array.from({length:14},(_,i)=>{const mesh=new THREE.Mesh(particleGeometry,particleMaterial);mesh.name='reward-droplet-or-ember-'+i;sculpted.add(mesh);return mesh;});
    const clocks=new THREE.Group();clocks.name='spiralling-clock-hands';clocks.visible=false;root.add(clocks);
    const hands=Array.from({length:8},(_,i)=>{
      const pivot=new THREE.Group();pivot.name='clock-hands-'+i;clocks.add(pivot);
      const minute=new THREE.Mesh(handGeometry,edgeMaterial);minute.name='minute-hand';
      const hour=new THREE.Mesh(handGeometry,coreMaterial);hour.name='hour-hand';hour.scale.y=.63;hour.position.z=.01;
      const hub=new THREE.Mesh(handHubGeometry,particleMaterial);hub.name='clock-pivot';hub.position.z=.02;
      pivot.add(minute,hour,hub);return {pivot,minute,hour};
    });
    return {root,icons,halo,rays,graffiti,word,wordMaterial,sculpted,ribbons,coronas,flames,particles,clocks,hands,coreMaterial,edgeMaterial,particleMaterial,iconMaterial,rayMaterial,age:0,duration:BOARD_EFFECT_LIFETIME,id:null,seed:0,small:false};
  });
  const pulse=new THREE.Group();pulse.name='deadtime-board-pulse';pulse.visible=false;group.add(pulse);
  const pulseMaterial=effectMaterial('#75ffb5'),pulseRing=new THREE.Mesh(pulseGeometry,pulseMaterial);pulseRing.rotation.x=-Math.PI/2;pulseRing.position.y=.04;pulse.add(pulseRing);
  const wings=new THREE.Group();wings.name='skybound-angel-wings';wings.visible=false;group.add(wings);
  const wingMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,opacity:0});
  const wingPair=[-1,1].map(side=>{
    const pivot=new THREE.Group();pivot.name=side<0?'angel-wing-left':'angel-wing-right';pivot.position.set(side*.245,.165,-.03);wings.add(pivot);
    const mesh=new THREE.Mesh(wingGeometry,wingMaterial);mesh.scale.x=side;pivot.add(mesh);return {pivot,side};
  });
  const wingMatrix=new THREE.Matrix4(),parentInverse=new THREE.Matrix4();
  let wingAmount=0,wingLife=0,wingTime=0,pulseAge=1;
  function reset(){for(const slot of slots){slot.root.visible=false;slot.age=slot.duration;}next=0;wingAmount=wingLife=wingTime=0;wings.visible=false;wingMaterial.opacity=0;wings.userData.gliding=false;pulseAge=1;pulse.visible=false;pulseMaterial.opacity=0;}
  function setProfile(profile){equipped=getRewardBoard(profile?.rewardBoard)?.id??null;reset();}
  function trigger(event) {
    if(!disposed&&equipped==='deadtime'&&event?.type==='timePower'&&!event.opponent){
      pulseAge=event.active?0:1;pulse.visible=!!event.active&&!reducedMotion;return !!event.active;
    }
    if(disposed||!equipped||event?.opponent||!['trick','airJump'].includes(event?.type))return false;
    if(event.type==='airJump'&&equipped!=='sky')return false;
    const reward=getRewardBoard(equipped),slot=slots[next++%slots.length];
    slot.id=equipped;slot.small=event.type==='airJump';slot.age=0;slot.duration=equipped==='deadtime'?CLOCK_EFFECT_LIFETIME:equipped==='lightning'?GRAFFITI_EFFECT_LIFETIME:slot.small?.46:BOARD_EFFECT_LIFETIME;slot.seed=(sequence%5)*.27;
    slot.graffiti.visible=equipped==='lightning';
    if(slot.graffiti.visible){
      const wordIndex=sequence%GRAFFITI_WORDS.length;
      slot.graffiti.userData.word=GRAFFITI_WORDS[wordIndex];slot.graffiti.userData.side=sequence%2?-1:1;
      slot.wordMaterial.map=graffitiTextures[wordIndex];slot.wordMaterial.needsUpdate=true;
    }
    sequence++;
    slot.iconMaterial.map=textures.get(equipped);slot.iconMaterial.needsUpdate=true;slot.iconMaterial.color.set(reward.colors.accent);
    slot.rayMaterial.color.set(reward.colors.secondary);slot.root.visible=true;slot.root.userData.effect=reward.vfx;slot.root.userData.completedTrick=event.type==='trick';
    slot.sculpted.visible=equipped==='vortex'||equipped==='solar'||equipped==='afterburner';
    slot.clocks.visible=equipped==='deadtime';
    slot.sculpted.position.y=equipped==='afterburner'?-.50:0;
    slot.coreMaterial.color.set(equipped==='vortex'?'#26c9be':'#ff982f');slot.edgeMaterial.color.set(equipped==='vortex'?'#bdfff3':'#fff0a0');slot.particleMaterial.color.set(equipped==='vortex'?'#8aeade':'#ffc64c');
    if(equipped==='afterburner'){slot.coreMaterial.color.set('#ff792f');slot.edgeMaterial.color.set('#ffecad');slot.particleMaterial.color.set('#ce8dee');}
    if(equipped==='deadtime'){slot.coreMaterial.color.set('#d9d6a9');slot.edgeMaterial.color.set('#b7ffd0');slot.particleMaterial.color.set('#5cd890');}
    if(equipped==='sky')wingLife=slot.small?.65:.52;
    return true;
  }
  function updateWings(dt,surfer,{paused,gliding}) {
    if(!paused){
      wingLife=Math.max(0,wingLife-dt);wingTime+=dt;
      const target=equipped==='sky'&&(gliding||wingLife>0)?1:0;
      wingAmount=reducedMotion?target:THREE.MathUtils.damp(wingAmount,target,target?13:10,dt);
      wings.userData.gliding=equipped==='sky'&&!!gliding;
    }
    wings.visible=equipped==='sky'&&wingAmount>.015;
    if(!wings.visible)return;
    // Follow the actual animated deck, including its yaw/roll, not the camera
    // or just the rider origin. Convert to effect-group space for transformed scenes.
    const board=surfer.board??surfer.boardPivot??surfer.rig;
    board.updateWorldMatrix(true,false);group.updateWorldMatrix(true,false);
    parentInverse.copy(group.matrixWorld).invert();wingMatrix.multiplyMatrices(parentInverse,board.matrixWorld);wingMatrix.decompose(wings.position,wings.quaternion,wings.scale);
    const spread=reducedMotion?.86:wingAmount,flutter=reducedMotion?0:Math.sin(wingTime*3.1)*.025*spread;
    for(const {pivot,side}of wingPair){pivot.rotation.z=side*((1-spread)*1.16+.10+flutter);pivot.rotation.y=side*(.08+(1-spread)*.25);pivot.scale.setScalar(.62+spread*.38);}
    wingMaterial.opacity=(reducedMotion?.72:.94)*wingAmount;
  }
  function updateSculpted(slot,p,fade,size) {
    const water=slot.id==='vortex',motion=reducedMotion?0:p,impact=p<.1;
    slot.coreMaterial.opacity=(reducedMotion?.48:.77)*fade;slot.edgeMaterial.opacity=(reducedMotion?.56:.94)*fade;slot.particleMaterial.opacity=(reducedMotion?.48:.92)*fade;
    if(slot.id==='afterburner') {
      // Two compact exhaust fans lift off the deck rails. Reuse the existing
      // flame/ember pool, with no bright full-screen flash or per-trick assets.
      for(const mesh of [...slot.ribbons,...slot.coronas])mesh.visible=false;
      for(let i=0;i<slot.flames.length;i++){
        const flame=slot.flames[i],side=i%2?-1:1,j=Math.floor(i/2);
        flame.visible=i<(reducedMotion?2:6);
        flame.position.set(side*(.38+j*.12+motion*.44),-.18+j*.06+motion*.08,.04);
        flame.rotation.z=side*(-1.12+j*.12);
        flame.scale.set(.64*size,(.48-j*.07)*(1-motion*.6)*size,1);
      }
      for(let i=0;i<slot.particles.length;i++){
        const particle=slot.particles[i],side=i%2?-1:1,j=Math.floor(i/2);
        particle.visible=i<(reducedMotion?4:10);
        particle.position.set(side*(.58+j*.09+motion*.62),-.22+j*.085+motion*.08-motion*motion*.16,.08);
        particle.rotation.z=side*(.6+motion);particle.scale.set(.45,(.75-j*.04)*(1-motion*.5),.45);
      }
      return;
    }
    for(let i=0;i<slot.ribbons.length;i++){
      const ribbon=slot.ribbons[i];ribbon.visible=water&&(!reducedMotion||i<2);
      ribbon.rotation.z=i*TAU/3+slot.seed+motion*(i===1?-2.1:1.55);
      ribbon.scale.setScalar((.83+i*.14+motion*.28)*size);ribbon.position.set(0,0,.07+i*.035);
    }
    for(let i=0;i<slot.coronas.length;i++){
      const corona=slot.coronas[i];corona.visible=!water;
      corona.rotation.z=i*1.7+slot.seed+motion*(i?-.35:.4);corona.scale.setScalar((.83+i*.17+motion*.18)*size);corona.position.z=.07+i*.035;
    }
    for(let i=0;i<slot.flames.length;i++){
      const flame=slot.flames[i];flame.visible=!water&&(!reducedMotion||i%2===0);
      const angle=i*TAU/slot.flames.length+slot.seed,radius=(.85+motion*.22)*size;
      flame.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,.025);flame.rotation.z=angle-Math.PI/2+motion*.18;
      flame.scale.set((.5+(i%3)*.13)*size,(.40+(i%3)*.16+(impact&&!reducedMotion?.18:0))*(1-motion*.35)*size,1);
    }
    for(let i=0;i<slot.particles.length;i++){
      const particle=slot.particles[i];particle.visible=!reducedMotion||i%3===0;
      const angle=i*TAU/slot.particles.length+slot.seed+motion*(water?.55:.09),radius=(1.02+(i%3)*.11+motion*(water?.65:.50))*size;
      particle.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius*(water?.84:1)+(water?-1:1)*motion*motion*.22,.13+(i%3)*.04);
      particle.scale.set(water?.60:.44,(water?1.8:1)*(1-motion*.4),.65);particle.rotation.z=angle-Math.PI/2+motion;
    }
  }
  function update(dt,surfer,camera,{paused=false,finished=false,gliding=false}={}) {
    if(disposed)return;
    if(finished){reset();return;}
    const elapsed=Math.max(0,Math.min(.1,dt||0));updateWings(elapsed,surfer,{paused,gliding});
    const board=surfer.board??surfer.boardPivot??surfer.rig;
    board.updateWorldMatrix(true,false);group.updateWorldMatrix(true,false);parentInverse.copy(group.matrixWorld).invert();wingMatrix.multiplyMatrices(parentInverse,board.matrixWorld);
    if(pulse.visible){
      if(!paused)pulseAge+=elapsed;
      pulse.visible=equipped==='deadtime'&&pulseAge<.72&&!reducedMotion;
      if(pulse.visible){
        wingMatrix.decompose(pulse.position,pulse.quaternion,pulse.scale);
        const p=pulseAge/.72;pulseRing.scale.setScalar(.18+3.9*(1-Math.pow(1-p,2)));pulseMaterial.opacity=.68*(1-p);
      }
    }
    for(const slot of slots) {
      if(!slot.root.visible)continue;
      if(!paused)slot.age+=Math.max(0,Math.min(.1,dt||0));
      if(slot.age>=slot.duration){slot.root.visible=false;continue;}
      // Fixed to the real rendered rider, including ocean-mesh alignment and
      // pipe rolls. This never changes the camera, simulation, or board pose.
      slot.root.position.copy(surfer.rig.position);slot.root.position.y+=.75;
      if(slot.id==='deadtime')slot.root.position.setFromMatrixPosition(wingMatrix);
      slot.root.quaternion.copy(camera.quaternion);
      const age=slot.age,p=age/slot.duration,impact=age<.055,fade=Math.pow(1-p,.6),expansion=reducedMotion?0:Math.max(0,p-.085);
      const size=slot.small?.78:1;
      const clock=slot.id==='deadtime',sculpted=slot.id==='vortex'||slot.id==='solar'||slot.id==='afterburner';
      const graffiti=slot.id==='lightning';
      if(graffiti){
        // An opaque painted tag, not additive glow: readable against both ocean
        // and concrete. Rise off the rail beside the rider, leaving the face clear.
        const side=slot.graffiti.userData.side,motion=reducedMotion?0:p;
        const pop=reducedMotion?1:1-Math.pow(1-Math.min(1,age/.12),3);
        slot.graffiti.position.set(side*(1.02+motion*.42),.55+motion*.62,.28);
        slot.word.scale.set(2.45*(.74+pop*.26),1.225*(.74+pop*.26),1);
        slot.wordMaterial.rotation=side*(reducedMotion?.08:.12-motion*.08);
        slot.wordMaterial.opacity=(reducedMotion?.86:1)*(1-THREE.MathUtils.smoothstep(p,.57,1));
      }
      slot.iconMaterial.opacity=(graffiti?.46:reducedMotion?.58:.96)*fade;
      slot.rayMaterial.opacity=reducedMotion?0:(impact?.72:.34)*fade;
      slot.halo.visible=!clock&&!sculpted&&!graffiti&&slot.id!=='sky'&&!reducedMotion&&age<.2;
      slot.halo.scale.set(1.1*size+expansion*.65,1.06*size+expansion*.65,1);
      for(let i=0;i<slot.icons.length;i++) {
        const icon=slot.icons[i];icon.visible=!clock&&!sculpted&&(graffiti?i<(reducedMotion?2:4):!reducedMotion||i<4);
        const angle=i*TAU/(reducedMotion?4:8)+slot.seed+(slot.id==='vortex'&&!reducedMotion?p*.7:0);
        const radius=(reducedMotion?1.13:1.02+expansion*.9)*size;
        icon.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius*.85,.12+(i%2)*.08);
        const iconSize=(slot.id==='guitar'?.40:graffiti?.22:.38)*size;
        icon.scale.setScalar(iconSize*(reducedMotion?1:1+Math.sin(p*Math.PI)*.12));
        icon.material.rotation=slot.id==='lightning'?.1:slot.id==='sky'?-.25:0;
      }
      for(let i=0;i<slot.rays.length;i++) {
        const ray=slot.rays[i],angle=i*TAU/slot.rays.length+slot.seed;
        ray.visible=!clock&&!sculpted&&slot.id!=='sky'&&!reducedMotion&&age<(graffiti?.11:.28);ray.rotation.z=angle-Math.PI/2;
        const radius=(.92+expansion*.8)*size;ray.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,.02);
        ray.scale.set(graffiti?.7:1,(impact?1.2:.7)*size*(graffiti?.6:1),1);
      }
      if(sculpted)updateSculpted(slot,p,fade,size);
      if(clock){
        const motion=reducedMotion?0:p;
        slot.coreMaterial.opacity=slot.edgeMaterial.opacity=slot.particleMaterial.opacity=(reducedMotion?.65:.92)*fade;
        for(let i=0;i<slot.hands.length;i++){
          const {pivot,minute,hour}=slot.hands[i],angle=i*TAU/8+slot.seed+motion*TAU*1.15;
          pivot.visible=!reducedMotion||i<3;
          const radius=reducedMotion?.9:.12+motion*(.95+(i%3)*.14);
          pivot.position.set(Math.cos(angle)*radius,.15+motion*1.45+Math.sin(angle)*radius*.45,.08+(i%3)*.07);
          pivot.scale.setScalar(reducedMotion?.70:.5+Math.sin(p*Math.PI)*.30);
          minute.rotation.z=-(i*.7+motion*TAU*1.5);hour.rotation.z=minute.rotation.z*.27+1.4;
        }
      }
    }
  }
  function dispose(){if(disposed)return;disposed=true;reset();for(const s of slots){s.iconMaterial.dispose();s.wordMaterial.dispose();s.rayMaterial.dispose();s.coreMaterial.dispose();s.edgeMaterial.dispose();s.particleMaterial.dispose();}wingMaterial.dispose();pulseMaterial.dispose();for(const geometry of [haloGeometry,rayGeometry,waterGeometry,coronaGeometry,flareGeometry,particleGeometry,wingGeometry,handGeometry,handHubGeometry,pulseGeometry])geometry.dispose();for(const texture of [...textures.values(),...graffitiTextures])texture.dispose();group.removeFromParent();group.clear();}
  return {group,setProfile,trigger,update,reset,dispose,get activeCount(){return slots.filter(s=>s.root.visible).length;},get reducedMotion(){return reducedMotion;}};
}
