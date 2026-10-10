import * as THREE from 'three';
import { clothTexture, portraitTexture, printedClothTexture } from './character-textures.js';

const UP=new THREE.Vector3(0,1,0), V=a=>new THREE.Vector3(...a);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function jointBetween(start,end,upper,lower,bend){
  const a=V(start),delta=V(end).sub(a),d=Math.min(upper+lower-.0001,Math.max(.001,delta.length())),axis=delta.normalize();
  const along=(upper*upper-lower*lower+d*d)/(2*d),off=Math.sqrt(Math.max(0,upper*upper-along*along));
  const b=V(bend).addScaledVector(axis,-V(bend).dot(axis)).normalize();
  return a.addScaledVector(axis,along).addScaledVector(b,off).toArray();
}
const mat=(color,map=null)=>new THREE.MeshLambertMaterial({color,map,emissive:map?0xffffff:0x000000,emissiveMap:map,emissiveIntensity:map?.16:0});
function mesh(parent,g,m){const o=new THREE.Mesh(g,m);parent.add(o);return o;}

// Eight authored cross-section points: broad front/back planes and narrow side
// planes. The UVs project the photographed cloth across the front and back.
const RING=[[1,0],[.72,.72],[0,1],[-.72,.72],[-1,0],[-.72,-.72],[0,-1],[.72,-.72],[1,0]];
function shape(rings,{cap=true,invertV=false}={}) {
  const p=[],uv=[],ix=[],w=Math.max(...rings.map(r=>r[1])),h=rings.at(-1)[0]-rings[0][0];
  rings.forEach(([y,x,z,ox=0,oz=0])=>RING.forEach(([cx,cz],j)=>{
    p.push(cx*x+ox,y,cz*z+oz);
    const front=j>=4;
    const v=(y-rings[0][0])/h;
    uv.push((front?.5:0)+(.5+(front?cx:-cx)*x/(w*2))*.5,invertV?1-v:v);
  }));
  for(let k=0;k<rings.length-1;k++)for(let j=0;j<8;j++){const a=k*9+j,b=a+9;ix.push(a,b,a+1,b,b+1,a+1);}
  if(cap)for(const [k,inv]of[[0,true],[rings.length-1,false]]){
    const r=rings[k],center=p.length/3;p.push(r[3]||0,r[0],r[4]||0);uv.push(.25,.5);
    for(let j=0;j<8;j++)ix.push(center,k*9+(inv?j:j+1),k*9+(inv?j+1:j));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function solid(parent,rings,m){return mesh(parent,shape(rings),m);}
function segment(parent,rings,m){
  const group=new THREE.Group();parent.add(group);const model=mesh(group,shape(rings,{invertV:true}),m);
  return{group,model,set(a,b){const d=V(b).sub(V(a));group.position.copy(V(a));group.quaternion.setFromUnitVectors(UP,d.clone().normalize());group.scale.set(1,d.length(),1);}};
}
function chain(parent,rings,m){
  const model=mesh(parent,shape(rings,{invertV:true}),m),g=model.geometry,p=g.attributes.position;
  const q=new THREE.Quaternion();
  return{model,set(a,b,c){
    const va=V(a),vb=V(b),vc=V(c),ab=vb.clone().sub(va).normalize(),bc=vc.clone().sub(vb).normalize();
    rings.forEach(([t,rx,rz,ox=0,oz=0],i)=>{
      const centre=(t<=1?va:vb).clone().lerp(t<=1?vb:vc,t<=1?t:t-1);
      const blend=THREE.MathUtils.smoothstep(t,.76,1.24),dir=ab.clone().lerp(bc,blend).normalize();q.setFromUnitVectors(UP,dir);
      RING.forEach(([x,z],j)=>{const point=new THREE.Vector3(x*rx+ox,0,z*rz+oz).applyQuaternion(q).add(centre);p.setXYZ(i*9+j,point.x,point.y,point.z);});
    });
    p.setXYZ(rings.length*9,...a);p.setXYZ(rings.length*9+1,...c);p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  }};
}
function badge(outfit){return(ctx,x,y)=>{
  const ac=outfit.accent;ctx.save();ctx.translate(x,y);ctx.fillStyle=ac;ctx.strokeStyle=ac;ctx.lineWidth=2;
  if(outfit.pattern==='yardbadge'){ctx.fillStyle='#202727';ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(-15,15);ctx.lineTo(15,15);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-9,10);ctx.lineTo(0,-5);ctx.lineTo(9,10);ctx.stroke();}
  else if(outfit.pattern==='crewbolt'){ctx.beginPath();ctx.moveTo(-5,-11);ctx.lineTo(10,-11);ctx.lineTo(1,1);ctx.lineTo(9,0);ctx.lineTo(-8,18);ctx.lineTo(-2,4);ctx.lineTo(-11,4);ctx.closePath();ctx.fill();}
  else if(outfit.pattern==='badge'||outfit.pattern==='sunburst'){ctx.strokeRect(-17,-9,34,25);ctx.font='bold 19px serif';ctx.textAlign='center';ctx.fillText('99',0,11);}
  else if(outfit.pattern==='tribal'){for(let s of[-1,1]){ctx.beginPath();ctx.moveTo(s*2,-14);ctx.lineTo(s*22,0);ctx.lineTo(s*12,11);ctx.lineTo(s*19,-1);ctx.lineTo(s*4,-6);ctx.fill();}}
  else if(outfit.pattern==='static'){ctx.font='bold italic 17px sans-serif';ctx.textAlign='center';ctx.fillText('BREAK',0,0);ctx.font='bold 10px monospace';ctx.fillText('LINE / 99',0,13);}
  else if(outfit.pattern==='tropical'){for(let i=0;i<15;i++){const x=(i*37)%110-55,y=(i*29)%100-20;ctx.save();ctx.translate(x,y);for(let k=0;k<5;k++){ctx.rotate(1.2566);ctx.beginPath();ctx.ellipse(0,4,2,5,0,0,6.29);ctx.fill();}ctx.restore();}}
  else if(['stripe','rashguard','wetsuit'].includes(outfit.pattern)){ctx.globalAlpha=.55;ctx.fillRect(-52,6,104,6);ctx.fillRect(-52,16,104,3);}
  ctx.restore();
};}
function headModel(parent,id,character,outfit,skin,hair){
  const head=new THREE.Group();head.scale.setScalar(.94);parent.add(head);
  // A frontal vertex grid carries real brow, cheek, nose and jaw landmarks.
  const rows=[[0,.034,.049],[.025,.062,.061],[.062,.077,.069],[.10,.082,.076],[.145,.084,.079],[.187,.082,.078],[.222,.065,.064],[.242,.022,.028]];
  const cols=[-1,-.66,-.30,0,.30,.66,1],p=[],uv=[],ix=[];
  rows.forEach(([y,w,d],r)=>cols.forEach(x=>{
    const nose=r===3?(1-Math.min(1,Math.abs(x)*3))*.026:r===4?(1-Math.min(1,Math.abs(x)*3))*.006:0;
    p.push(x*w,y,-Math.sqrt(Math.max(0,1-x*x))*d-nose);
    uv.push(.5+x*w/.19,y/.242);
  }));
  for(let r=0;r<rows.length-1;r++)for(let j=0;j<6;j++){const a=r*7+j,b=a+7;ix.push(a,a+1,b,b,a+1,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  const face=mesh(head,g,mat(0xffffff,portraitTexture(id)));face.name='face';face.material.side=THREE.DoubleSide;
  // Back hemisphere has no hidden overlapping front faces.
  const back=shape(rows),indices=[];for(let i=0;i<back.index.count;i+=3){const ids=[back.index.getX(i),back.index.getX(i+1),back.index.getX(i+2)];if(ids.every(n=>back.attributes.position.getZ(n)>=-.0001))indices.push(...ids);}back.setIndex(indices);mesh(head,back,skin);
  for(const side of[-1,1]){const ear=solid(head,[[.077,.008,.012],[.09,.011,.015],[.123,.012,.014],[.145,.005,.007]],skin);ear.position.x=side*.084;}
  const hairCap=solid(head,[[.192,.083,.077,0,.008],[.222,.074,.071,0,.008],[.249,.043,.040,0,.008],[.256,.011,.014,0,.007]],hair);hairCap.name='scalp';
  if(character.dreads){
    for(let i=0;i<9;i++){const a=(i/8-.5)*2.7,x=Math.sin(a)*.078,z=.065+Math.cos(a)*.043,l=.255+(i%3)*.023;
      solid(head,[[-l,.010,.011,x+(i%2?.01:-.01),z+.021],[-l*.58,.014,.015,x,z+.02],[.05,.014,.015,x,z],[.195,.011,.014,x*.91,z*.82]],hair);
    }
  }else if(character.ponytail){const pony=solid(head,[[0,.025,.023],[.16,.028,.025],[.29,.009,.013]],hair);pony.position.set(0,.18,.075);pony.rotation.x=2.5;}
  if(outfit.hat==='cap'||outfit.hat==='whitecap'){
    const cap=mat(outfit.hat==='whitecap'?'#c9cac2':outfit.accent);
    solid(head,[[.205,.087,.081],[.23,.087,.081],[.266,.058,.054],[.275,.021,.025]],cap).name='hat';
    const brim=mesh(head,new THREE.BoxGeometry(.132,.009,.08),cap);brim.position.set(0,.210,.107);brim.rotation.x=-.09;
    const strap=mesh(head,new THREE.BoxGeometry(.044,.013,.007),mat('#60645f'));strap.position.set(0,.214,-.081);
  }else if(outfit.hat==='straw')solid(head,[[.206,.17,.14],[.218,.172,.142],[.227,.088,.08],[.29,.062,.06]],mat('#b89b67'));
  else if(outfit.hat==='bucket')solid(head,[[.197,.123,.111],[.22,.095,.09],[.269,.075,.071]],mat(outfit.accent));
  return{head,face,hairCap};
}

export function createCharacter({id,character,outfit,fabricTexture}){
  const rider=new THREE.Group(),body=new THREE.Group();rider.add(body);
  const build=character.build||1,skin=mat(character.skin),hair=mat(character.hair),dark=mat('#20282c'),cream=mat('#c5c9c4');
  const bare=outfit.top==='bare',wet=outfit.top==='wetsuit',trousers=outfit.bottom==='trousers',sweat=outfit.top==='sweatshirt';
  const open=['open','layered'].includes(outfit.top),loose=['baggy','oversized','raglan','open','layered','sweatshirt'].includes(outfit.top);
  const shirt=mat(0xffffff,clothTexture(outfit.shirt,'torso',badge(outfit))),sleeve=mat(0xffffff,clothTexture(outfit.top==='raglan'?outfit.accent:outfit.shirt,'sleeve'));
  const shorts=mat(0xffffff,trousers?clothTexture(outfit.shorts,'leg'):printedClothTexture(fabricTexture(outfit,true)));
  const hipMaterial=trousers?mat(0xffffff,clothTexture(outfit.shorts,'hip')):shorts;
  const chestRings=[[-.063,.17*build,.095],[-.015,.176*build,.103],[.15,.169*build,.111],[.32,.187*build,.115],[.425,.201*build,.101],[.467,.174*build,.077],[.502,.068,.055]];
  const garmentRings=[[-.102,.183*build,.106],[-.068,.192*build,.110],[.115,.177*build,.122],[.298,.195*build,.125],[.408,.210*build,.107],[.447,.199*build,.093],[.491,.087,.060],[.503,.065,.056]];
  const chest=solid(body,chestRings,skin);chest.name='chest';
  if(!bare){
    if(open){
      chest.material=outfit.top==='layered'?mat(0xffffff,clothTexture('#c5c9c4','torso')):skin;chest.scale.set(.94,1,.91);
      const g=shape(garmentRings),a=g.attributes.position,kept=[];
      for(let i=0;i<g.index.count;i+=3){
        const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];
        // Remove both triangles adjoining the centre-front UV seam. Removing
        // only centroid-selected triangles left a zipper of intersecting faces.
        if(!ids.some(j=>Math.abs(a.getX(j))<.001&&a.getZ(j)<-.02))kept.push(...ids);
      }
      g.setIndex(kept);const jacket=mesh(body,g,shirt);jacket.material.side=THREE.DoubleSide;
    }
    else {const m=solid(body,loose?garmentRings:chestRings.map(([y,x,z])=>[y,x+.005,z+.006]),shirt);m.name='torso';chest.visible=false;}
    solid(body,[[.493,.069,.057],[.506,.064,.054]],outfit.top==='sweatshirt'?sleeve:dark);
  }else if(id==='nova')solid(body,[[.22,.179,.119],[.33,.19,.119],[.39,.2,.111]],mat(outfit.accent));
  const hips=solid(body,[[-.182,.103,.080],[-.131,.168*build,.114],[-.025,.174*build,.115],[.016,.166*build,.104]],wet?shirt:hipMaterial);hips.name='hips';hips.visible=wet;
  if(!wet){
    // Flat tailored front/back panels bridge the thigh tubes. A pointed inseam
    // replaces the old rounded pelvis cap, which read as a separate diaper.
    for(const side of[-1,1]){
      const p=[-.17,-.035,side*.108,.17,-.035,side*.108,-.151,-.13,side*.113,.151,-.13,side*.113,-.082,-.19,side*.103,.082,-.19,side*.103,0,-.222,side*.095];
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute([.51,1,.99,1,.54,.55,.96,.55,.64,.18,.86,.18,.75,0],2));g.setIndex([0,2,1,1,2,3,2,4,3,3,4,5,4,6,5]);g.computeVertexNormals();
      const panel=mesh(body,g,hipMaterial);panel.material.side=THREE.DoubleSide;panel.name='trouser-pelvis';
    }
  }
  solid(body,[[.486,.042,.042],[.545,.044,.043]],skin);
  const {head}=headModel(body,id,character,outfit,skin,hair);head.position.set(0,.536,-.006);
  if(outfit.necklace){for(let i=0;i<11;i++){const a=i/10*Math.PI;const bead=mesh(body,new THREE.OctahedronGeometry(.006),cream);bead.position.set(Math.cos(a)*.065,.48-Math.sin(a)*.08,-.074-Math.sin(a)*.045);}}
  function arm(side){
    const group=new THREE.Group();body.add(group);
    const upper=segment(group,[[0,outfit.sleeves==='none'?.05:.028,.028],[.25,.048,.043],[.6,.045,.040],[1,.033,.034]],skin),lower=segment(group,[[0,.034,.033],[.3,.043,.035],[.73,.031,.026],[1,.023,.021]],skin);
    const sleeveR=loose?.063:.052;
    const long=outfit.sleeves==='long';
    const longMesh=long?chain(group,[[0,.036,.035],[.25,sleeveR,.057],[.84,sleeveR*.89,.052],[1.06,.052,.047],[1.47,.049,.043],[1.86,.037,.032],[2,.027,.025]],sleeve):null;
    const shortMesh=outfit.sleeves!=='none'&&!long?segment(group,[[0,.036,.034],[.23,sleeveR,.058],[.70,sleeveR*.98,.057],[.83,sleeveR,.057]],sleeve):null;
    const quarter=outfit.sleeves==='threequarter'?segment(group,[[0,.045,.038],[.50,.042,.035],[.62,.034,.03]],sleeve):null;
    upper.group.visible=!long;lower.group.visible=!long;
    const hand=segment(group,[[0,.023,.014],[.23,.034,.017],[.6,.033,.016],[.89,.029,.012],[1,.019,.009]],skin);
    const thumb=segment(group,[[0,.012,.01],[.55,.012,.01],[1,.007,.007]],skin);
    let points;
    return{group,set(shoulder,elbow,wrist,grip=0,handTarget=null){
      const reach=V(wrist).sub(V(shoulder));
      if(reach.length()<.04)reach.set(0,-.04,0);else reach.clampLength(.04,.6099);
      wrist=V(shoulder).add(reach).toArray();
      const hint=V(elbow).sub(V(shoulder));
      elbow=jointBetween(shoulder,wrist,.32,.29,hint.toArray());
      points={shoulder,elbow,wrist};upper.set(shoulder,elbow);lower.set(elbow,wrist);longMesh?.set(shoulder,elbow,wrist);shortMesh?.set(shoulder,elbow);quarter?.set(elbow,wrist);
      const dir=V(wrist).sub(V(elbow)).normalize();
      // Rotate a fixed-length hand toward the deck during reach/release. Full
      // contact is held by the wrist IK, never by stretching the hand mesh.
      const handDirection=handTarget?dir.clone().lerp(V(handTarget).sub(V(wrist)).normalize(),grip).normalize():dir;
      const tip=V(wrist).addScaledVector(handDirection,.150);hand.set(wrist,tip.toArray());points.fingertip=tip.toArray();
      const base=V(wrist).addScaledVector(dir,.036);base.x-=side*.031;thumb.set(base.toArray(),base.clone().add(new THREE.Vector3(-side*.018,-.050,-.012)).toArray());
    },get points(){return points;}};
  }
  const arms=[arm(-1),arm(1)];
  function leg(side){
    const skinUpper=segment(rider,[[0,.078,.078],[.28,.088,.08],[.7,.067,.063],[1,.047,.048]],wet?shirt:skin);
    const skinLower=segment(rider,[[0,.049,.047],[.28,.062,.051],[.67,.043,.038],[1,.027,.028]],wet?shirt:skin);
    const pants=trousers?chain(rider,[[0,.087,.085],[.28,.106,.095],[.75,.10,.095],[1.03,.096,.091],[1.25,.096,.09],[1.68,.108,.099],[1.87,.105,.097],[2,.091,.091]],shorts):null;
    const shortsMesh=!trousers&&!wet?segment(rider,[[0,.092,.084],[.25,.111,.097],[.65,.109,.093],[.97,.104,.096],[1.08,.103,.094]],shorts):null;
    skinUpper.group.visible=skinLower.group.visible=!trousers;
    const foot=segment(rider,[[0,.028,.023],[.34,.043,.026],[.7,.049,.022],[1,.037,.011]],skin);
    const shoe=segment(rider,[[-.14,.040,.035],[.15,.049,.043],[.53,.057,.038],[.85,.054,.027],[1.05,.038,.018]],dark);
    const sole=segment(rider,[[-.14,.042,.009],[.3,.055,.01],[.75,.058,.01],[1.05,.040,.009]],cream);shoe.model.name='shoe';sole.model.name='sole';
    const sock=segment(rider,[[.68,.04,.036],[.94,.031,.03],[1,.029,.028]],cream);
    // Thin contrasting lace bands are attached to the foot, not floating cubes.
    for(let i=0;i<3;i++){const lace=mesh(shoe.group,new THREE.BoxGeometry(.07,.015,.004),cream);lace.position.set(0,.25+i*.09,-.041);}
    let points;
    return{set(hip,knee,ankle,toe,shoes){
      knee=jointBetween(hip,ankle,.478,.45,[0,0,-1]);
      points={hip,knee,ankle,toe};skinUpper.set(hip,knee);skinLower.set(knee,ankle);pants?.set(hip,knee,ankle);shortsMesh?.set(hip,knee);foot.set(ankle,toe);shoe.set(ankle,toe);sole.set(ankle,toe);sole.group.position.y-=.031;sock.set(knee,ankle);
      foot.group.visible=!shoes;shoe.group.visible=sole.group.visible=sock.group.visible=shoes;
    },get points(){return points;}};
  }
  const legs=[leg(-1),leg(1)],landmarks={};let activeMode='surf';
  function pose({charge=0,grab=0,air=false,time=0,lean=0,standing=false,mode,lipGrab=0,boardTargetWorld=null,cutback=0,cutbackDirection=1}={}){
    if(mode)activeMode=mode;grab=THREE.MathUtils.clamp(Math.max(grab,lipGrab),0,1);
    cutback=standing||air?0:THREE.MathUtils.clamp(cutback,0,1);
    const shoes=activeMode==='park'||standing,breath=Math.sin(time*1.7)*.002;
    rider.rotation.set(0,standing?0:-Math.PI/2,0);
    rider.position.y=air&&!standing?.12:0;
    if(standing){
      body.position.set(.007,1.01+breath,.012);body.rotation.set(-.023,.035,-.017);head.rotation.set(.022,-.11,.012);
      legs[0].set([-.094,1.008,.012],[-.126,.527,-.006],[-.148,.085,.034],[-.173,.047,-.164],shoes);
      legs[1].set([.103,1.008,.012],[.136,.531,.043],[.165,.084,.084],[.199,.047,-.113],shoes);
      arms[0].set([-.194*build,.437,.002],[-.242,.144,-.009],[-.251,-.118,-.071]);
      arms[1].set([.194*build,.437,.003],[.253,.139,.027],[.258,-.129,.014]);
    }else{
      const turn=cutback*Math.sign(cutbackDirection||1),tuck=Math.min(1,charge*.85+grab+cutback*.35),hy=.80-tuck*.37,hz=.04+tuck*.25;
      body.position.set(-lean*.03-turn*.04,hy+breath,hz);
      body.rotation.set(-.16-tuck*.40+turn*.18,-.07+turn*.20,-lean*.12-turn*.10);
      head.rotation.set(.17+tuck*.2,1.15-turn*.30,-.025);
      rider.updateWorldMatrix(true,true);
      // Production supplies a world-space point from the actual generated
      // surfboard after all rig, heading, spin, flip, and board-lift transforms.
      const contactWorld=boardTargetWorld?.clone?boardTargetWorld.clone():rider.localToWorld(V([0,.145,-.286]));
      if(grab>0){
        const target=rider.worldToLocal(contactWorld.clone());
        const shoulderInRider=V([.194*build,.437,.003]).applyMatrix4(body.matrix);
        const reach=target.clone().sub(shoulderInRider),distance=reach.length();
        // A small torso follow keeps an unusually rotated deck reachable while
        // preserving both arm lengths and the foot-anchored leg IK.
        if(distance>.735)body.position.addScaledVector(reach,(distance-.735)/distance*grab);
      }
      body.updateMatrix();
      const ky=.494-tuck*.064,kz=-.254-tuck*.087;
      legs[0].set(V([-.095,0,0]).applyMatrix4(body.matrix).toArray(),[-.236,ky,kz],[-.34,.215,.035],[-.36,.181,-.163],shoes);
      legs[1].set(V([.102,0,0]).applyMatrix4(body.matrix).toArray(),[.246,ky+.012,kz+.056],[.36,.215,.069],[.395,.181,-.128],shoes);
      const leftRest=mix([-.46,.042,-.186],[-.37,-.16,-.27],cutback);
      arms[0].set([-.194*build,.437,.002],mix([-.37,.233,-.055],[-.29,.58,.00],grab),mix(leftRest,[-.25,.86,-.12],grab));
      const shoulder=[.194*build,.437,.003];
      rider.updateWorldMatrix(true,true);
      const contact=body.worldToLocal(contactWorld.clone());
      const direction=contact.clone().sub(V(shoulder)).normalize();
      const targetWrist=contact.clone().addScaledVector(direction,-.15);
      const rightRest=mix([.42,-.018,-.14],[.41,.075,-.30],cutback);
      const wrist=mix(rightRest,targetWrist.toArray(),grab),delta=V(wrist).sub(V(shoulder));
      const d=Math.min(.609,delta.length()),axis=delta.normalize(),upper=.32,lower=.29;
      const along=(upper*upper-lower*lower+d*d)/(2*d),off=Math.sqrt(Math.max(0,upper*upper-along*along));
      const bend=new THREE.Vector3(1,0,.4).addScaledVector(axis,-new THREE.Vector3(1,0,.4).dot(axis)).normalize();
      const elbow=V(shoulder).addScaledVector(axis,along).addScaledVector(bend,off);
      arms[1].set(shoulder,elbow.toArray(),wrist,grab,grab>0?contact.toArray():null);
      landmarks.boardGrabTarget=body.localToWorld(contact.clone());
    }
    rider.updateMatrixWorld(true);
    const bp=a=>body.localToWorld(V(a));
    for(const[i,prefix]of[[0,'left'],[1,'right']]){for(const k of['shoulder','elbow','wrist','fingertip'])landmarks[prefix+k[0].toUpperCase()+k.slice(1)]=bp(arms[i].points[k]);for(const k of['hip','knee','ankle'])landmarks[prefix+k[0].toUpperCase()+k.slice(1)]=rider.localToWorld(V(legs[i].points[k]));landmarks[prefix+'Sole']=rider.localToWorld(V([legs[i].points.ankle[0],.017,legs[i].points.ankle[2]]));}
    landmarks.crown=head.localToWorld(new THREE.Vector3(0,.256,0));landmarks.chin=head.localToWorld(new THREE.Vector3(0,0,0));
    landmarks.shoulderOuterLeft=bp([-.257*build,.437,0]);landmarks.shoulderOuterRight=bp([.257*build,.437,0]);
    landmarks.shirtHem=bp([0,-.102,-.106]);landmarks.crotch=bp([0,-.182,0]);
  }
  pose({standing:true});
  rider.userData.landmarks=landmarks;
  return{rider,body,hips,head,leftArm:arms[0].group,rightArm:arms[1].group,pose,landmarks};
}
