import * as THREE from 'three';
import { clothTexture, printedClothTexture } from './character-textures.js';
import { headModel } from './character-head.js';

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

// Body cloth has broad front/back planes. These helpers are intentionally
// independent of the restored face builder and its original cross sections.
const CLOTH_RING=[[1,0],[.80,.84],[0,1],[-.80,.84],[-1,0],[-.80,-.84],[0,-1],[.80,-.84],[1,0]];
function clothGeometry(rings,{capEnd=false,invertV=false}={}){
  const p=[],uv=[],ix=[],maxY=rings.at(-1)[0],minY=rings[0][0],maxW=Math.max(...rings.map(r=>r[1]));
  rings.forEach(([t,rx,rz,ox=0,oz=0])=>CLOTH_RING.forEach(([x,z],j)=>{
    p.push(x*rx+ox,t,z*rz+oz);const front=j>=4;
    const v=(t-minY)/(maxY-minY);uv.push((front?.5:0)+(.5+(front?x:-x)*rx/(maxW*2))*.5,invertV?1-v:v);
  }));
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<8;j++){const a=r*9+j,b=a+9;ix.push(a,b,a+1,b,b+1,a+1);}
  if(capEnd){const c=p.length/3;p.push(0,rings.at(-1)[0],0);uv.push(.25,0);for(let j=0;j<8;j++)ix.push(c,(rings.length-1)*9+j+1,(rings.length-1)*9+j);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function clothChain(parent,rings,material,name){
  const model=mesh(parent,clothGeometry(rings,{capEnd:true,invertV:true}),material),g=model.geometry,p=g.attributes.position,q=new THREE.Quaternion(),basis=new THREE.Matrix4();model.name=name;model.userData.rootIndices=Array.from({length:8},(_,i)=>i);
  return{model,set(a,b,c,root=null){
    const va=V(a),vb=V(b),vc=V(c),ab=vb.clone().sub(va).normalize(),bc=vc.clone().sub(vb).normalize();
    rings.forEach(([t,rx,rz,ox=0,oz=0],i)=>{
      if(i===0&&root){root.forEach((v,j)=>p.setXYZ(j,...v));p.setXYZ(8,...root[0]);return;}
      const centre=(t<=1?va:vb).clone().lerp(t<=1?vb:vc,t<=1?t:t-1);
      const dir=ab.clone().lerp(bc,THREE.MathUtils.smoothstep(t,.70,1.32)).normalize();
      // Keep cloth's front/back aligned through the bend. UP-to-direction is
      // underdetermined near a downward limb and caused a 180-degree spiral
      // between the authored armhole/crotch and the first dynamic ring.
      let back=new THREE.Vector3(0,0,1).addScaledVector(dir,-dir.z);
      if(back.lengthSq()<.01)back=new THREE.Vector3(0,1,0).addScaledVector(dir,-dir.y);
      back.normalize();const right=dir.clone().cross(back).normalize();back=right.clone().cross(dir).normalize();q.setFromRotationMatrix(basis.makeBasis(right,dir,back));
      CLOTH_RING.forEach(([x,z],j)=>{const v=new THREE.Vector3(x*rx+ox,0,z*rz+oz).applyQuaternion(q).add(centre);p.setXYZ(i*9+j,v.x,v.y,v.z);});
    });
    const last=rings.at(-1)[0],end=(last<=1?va:vb).clone().lerp(last<=1?vb:vc,last<=1?last:last-1);p.setXYZ(rings.length*9,end.x,end.y,end.z);p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  }};
}
function shirtShell(body,rings,material,{sleeves=false,open=false}={}){
  const g=clothGeometry(rings),kept=[];
  // The outer acromion sits below the shoulder crest; a constant-height ring
  // gave each sleeve a little square epaulet at the top of its silhouette.
  for(const j of [0,4,8])g.attributes.position.setY(4*9+j,rings[4][0]-.017);
  // An actual armhole replaces the old intersecting narrow sleeve plugs. Both
  // pieces use the same boundary vertices, in every animated pose.
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<8;j++){
    if(sleeves&&r>=2&&r<4&&[0,3,4,7].includes(j))continue;
    if(open&&[5,6].includes(j))continue;
    const a=r*9+j,b=a+9;kept.push(a,b,a+1,b,b+1,a+1);
  }
  g.setIndex(kept);g.computeVertexNormals();const model=mesh(body,g,material);model.name='torso';
  const restingNormals=g.attributes.normal.array.slice();
  const seam={left:[[4,4],[4,3],[3,3],[2,3],[2,4],[2,5],[3,5],[4,5]],right:[[2,0],[2,1],[3,1],[4,1],[4,0],[4,7],[3,7],[2,7]]};
  model.userData.armholes=Object.fromEntries(Object.entries(seam).map(([name,ids])=>[name,ids.map(([r,j])=>r*9+j)]));
  return{model,resetNormals(){g.attributes.normal.array.set(restingNormals);g.attributes.normal.needsUpdate=true;},boundary(side){return model.userData.armholes[side<0?'left':'right'].map(i=>new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).toArray());},joinNormals(other,side){
    const a=g.attributes.normal,b=other.geometry.attributes.normal,pa=g.attributes.position,pb=other.geometry.attributes.position;
    model.userData.armholes[side<0?'left':'right'].forEach((index,i)=>{
      const normal=new THREE.Vector3().fromBufferAttribute(a,index).add(new THREE.Vector3().fromBufferAttribute(b,i)).normalize();
      for(const [positions,normals,k]of[[pa,a,index],[pb,b,i]])for(let j=0;j<positions.count;j++)if(Math.abs(positions.getX(j)-positions.getX(k))+Math.abs(positions.getY(j)-positions.getY(k))+Math.abs(positions.getZ(j)-positions.getZ(k))<1e-7)normals.setXYZ(j,normal.x,normal.y,normal.z);
    });a.needsUpdate=b.needsUpdate=true;
  }};
}

export function createCharacter({id,character,outfit,fabricTexture}){
  const rider=new THREE.Group(),body=new THREE.Group();rider.add(body);
  const build=character.build||1,skin=mat(character.skin),hair=mat(character.hair),dark=mat('#20282c'),cream=mat('#c5c9c4');
  const bare=outfit.top==='bare',wet=outfit.top==='wetsuit',trousers=outfit.bottom==='trousers',sweat=outfit.top==='sweatshirt';
  const open=['open','layered'].includes(outfit.top),loose=['baggy','oversized','raglan','open','layered','sweatshirt'].includes(outfit.top);
  const shirt=mat(0xffffff,clothTexture(outfit.shirt,'torso',badge(outfit))),sleeve=mat(0xffffff,clothTexture(outfit.top==='raglan'?outfit.accent:outfit.shirt,'sleeve'));
  const shorts=mat(0xffffff,trousers?clothTexture(outfit.shorts,'leg'):printedClothTexture(fabricTexture(outfit,true)));
  const hipMaterial=trousers?mat(0xffffff,clothTexture(outfit.shorts,'hip')):shorts;
  // The chest has a pectoral volume, a narrower abdomen and a sloping shoulder
  // yoke. Loose tops hang almost straight from the chest over the waistband.
  const chestRings=[[-.08,.155*build,.098],[.075,.146*build,.100],[.25,.184*build,.123],[.397,.201*build,.118],[.452,.183*build,.091],[.487,.103,.063],[.503,.063,.051]];
  const garmentRings=[[-.115,.211*build,.141],[.06,.207*build,.137],[.25,.214*build,.139],[.397,.218*build,.134],[.452,.239*build,.102],[.487,.108,.068],[.503,.065,.056]];
  const chest=mesh(body,clothGeometry(chestRings),skin);chest.name='chest';
  let shell=null;
  if(!bare){
    const rings=loose?garmentRings:chestRings.map(([y,x,z])=>[y,x+.006,z+.006]);
    shell=shirtShell(body,rings,shirt,{sleeves:outfit.sleeves!=='none',open});
    if(open){chest.material=outfit.top==='layered'?mat(0xffffff,clothTexture('#c5c9c4','torso')):skin;shell.model.material.side=THREE.DoubleSide;}
    else chest.visible=false;
    solid(body,[[.493,.067,.057],[.506,.064,.054]],sweat?sleeve:dark).name='collar';
  }else if(id==='nova')solid(body,[[.22,.177,.125],[.33,.193,.125],[.39,.204,.121]],mat(outfit.accent));
  const hips=solid(body,[[-.18,.103,.080],[-.125,.164*build,.111],[-.025,.168*build,.113],[.016,.160*build,.104]],shirt);hips.name='hips';hips.visible=wet;
  solid(body,[[.486,.042,.042],[.545,.044,.043]],skin);
  const {head}=headModel(body,id,character,outfit,skin,hair);head.position.set(0,.536,-.006);
  const hangingLocks=[];
  if(character.dreads)head.traverse(object=>{
    if(!object.isMesh)return;object.geometry.computeBoundingBox();
    if(object.geometry.boundingBox.min.y<-.1){object.name='dreadlock';hangingLocks.push({object,rest:object.geometry.attributes.position.array.slice()});}
  });
  function poseHangingHair(){
    if(!hangingLocks.length)return;
    head.updateMatrix();const rows=!bare&&loose?garmentRings:chestRings;
    for(const {object,rest}of hangingLocks){
      object.updateMatrix();const toBody=new THREE.Matrix4().multiplyMatrices(head.matrix,object.matrix),toHair=toBody.clone().invert(),p=object.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const v=new THREE.Vector3(rest[i*3],rest[i*3+1],rest[i*3+2]).applyMatrix4(toBody);
        // A head turn must not drag the old long locks through the torso. The
        // lower locks drape over the back of the actual garment cross-section;
        // their roots, the scalp, face vertices and face texture stay unchanged.
        if(v.y>rows[0][0]&&v.y<rows.at(-1)[0]){
          let r=1;while(r<rows.length-1&&rows[r][0]<v.y)r++;
          const t=(v.y-rows[r-1][0])/(rows[r][0]-rows[r-1][0]),w=THREE.MathUtils.lerp(rows[r-1][1],rows[r][1],t),d=THREE.MathUtils.lerp(rows[r-1][2],rows[r][2],t),x=Math.abs(v.x)/w;
          if(x<1.03){const back=d*(x<=.8?1-.2*x:Math.max(0,.84*(1-(x-.8)/.2)));v.z=Math.max(v.z,back+.017);}
        }
        v.applyMatrix4(toHair);p.setXYZ(i,v.x,v.y,v.z);
      }
      p.needsUpdate=true;object.geometry.computeVertexNormals();object.geometry.computeBoundingSphere();
    }
  }
  if(outfit.necklace){for(let i=0;i<11;i++){const a=i/10*Math.PI;const bead=mesh(body,new THREE.OctahedronGeometry(.006),cream);bead.position.set(Math.cos(a)*.065,.48-Math.sin(a)*.08,-.074-Math.sin(a)*.045);}}
  function arm(side){
    const group=new THREE.Group();body.add(group);const prefix=side<0?'left':'right';group.name=prefix+'-arm';
    const covered=outfit.sleeves!=='none',quarter=outfit.sleeves==='threequarter';
    const upper=segment(group,covered?[[.70,.043,.039],[.84,.039,.035],[1,.033,.032]]:[[0,.055,.046],[.22,.052,.047],[.57,.044,.042],[1,.033,.032]],skin),lower=segment(group,quarter?[[.43,.037,.032],[.67,.033,.028],[1,.024,.020]]:[[0,.034,.032],[.27,.041,.036],[.67,.033,.028],[1,.024,.020]],skin);upper.model.name=prefix+'-upper-arm';lower.model.name=prefix+'-forearm';
    const sleeveR=sweat?.065:loose?.060:.048,long=outfit.sleeves==='long';
    const sleeveRings=long?[[0,sleeveR,.06],[.35,sleeveR,.060],[.78,sleeveR*.96,.056],[1.08,sleeveR*.91,.053],[1.35,sleeveR*.85,.049],[1.72,.044,.040],[1.91,.039,.035],[2,.031,.029]]:outfit.sleeves==='threequarter'?[[0,sleeveR,.056],[.37,sleeveR,.056],[.80,sleeveR*.95,.052],[1.12,.048,.041],[1.53,.041,.036]]:[[0,sleeveR,.056],[.36,sleeveR,.056],[.70,sleeveR*.96,.054],[.84,sleeveR*.95,.053]];
    const cloth=outfit.sleeves!=='none'?clothChain(group,sleeveRings,sleeve,prefix+'-sleeve'):null;
    upper.group.visible=!long&&!quarter;lower.group.visible=!long;
    const hand=segment(group,[[0,.024,.014],[.22,.035,.018],[.54,.035,.017],[.73,.032,.013],[.93,.025,.010],[1,.012,.008]],skin);hand.model.name=prefix+'-hand';
    const thumb=segment(group,[[0,.013,.011],[.47,.012,.01],[1,.007,.007]],skin);thumb.model.name=prefix+'-thumb';
    let points;
    return{group,set(shoulder,elbow,wrist,grip=0,handTarget=null){
      const reach=V(wrist).sub(V(shoulder));
      if(reach.length()<.04)reach.set(0,-.04,0);else reach.clampLength(.04,.6099);
      wrist=V(shoulder).add(reach).toArray();
      const hint=V(elbow).sub(V(shoulder));
      elbow=jointBetween(shoulder,wrist,.32,.29,hint.toArray());
      points={shoulder,elbow,wrist};upper.set(shoulder,elbow);lower.set(elbow,wrist);cloth?.set(shoulder,elbow,wrist,shell?.boundary(side));if(cloth&&shell)shell.joinNormals(cloth.model,side);
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
    const prefix=side<0?'left':'right';
    const skinUpper=segment(rider,[[0,.078,.078],[.28,.088,.08],[.7,.067,.063],[1,.047,.048]],wet?shirt:skin);
    const skinLower=segment(rider,[[0,.049,.047],[.28,.062,.051],[.67,.043,.038],[1,.027,.028]],wet?shirt:skin);
    const cloth=!wet?clothChain(rider,trousers?[[0,.113,.104],[.60,.113,.109],[.83,.110,.102],[1.03,.104,.097],[1.30,.102,.094],[1.60,.106,.098],[1.78,.112,.103],[1.91,.104,.096],[2,.106,.096]]:[[0,.113,.102],[.60,.116,.102],[.83,.118,.104],[.99,.113,.100],[1.12,.114,.096]],shorts,prefix+(trousers?'-trousers':'-shorts')):null;
    skinUpper.group.visible=skinLower.group.visible=!trousers;
    const foot=segment(rider,[[0,.029,.025],[.25,.037,.029],[.55,.047,.025],[.82,.046,.018],[1,.035,.010]],skin);foot.model.name=prefix+'-foot';
    const shoe=segment(rider,[[-.14,.042,.037],[.12,.047,.044],[.38,.054,.044],[.69,.058,.033],[.93,.049,.025],[1.05,.035,.018]],dark);
    const sole=segment(rider,[[-.14,.042,.009],[.3,.055,.01],[.75,.058,.01],[1.05,.040,.009]],cream);shoe.model.name='shoe';sole.model.name='sole';
    const sock=segment(rider,[[.68,.04,.036],[.94,.031,.03],[1,.029,.028]],cream);
    // Thin contrasting lace bands are attached to the foot, not floating cubes.
    for(let i=0;i<3;i++){const lace=mesh(shoe.group,new THREE.BoxGeometry(.07,.015,.004),cream);lace.position.set(0,.25+i*.09,-.041);}
    let points;
    return{cloth,set(hip,knee,ankle,toe,shoes,footUp=null){
      knee=jointBetween(hip,ankle,.478,.45,[0,0,-1]);
      points={hip,knee,ankle,toe};skinUpper.set(hip,knee);skinLower.set(knee,ankle);foot.set(ankle,toe);shoe.set(ankle,toe);sole.set(ankle,toe);sole.group.position.y-=.031;sock.set(knee,ankle);
      if(footUp){
        const along=V(toe).sub(V(ankle)).normalize(),up=V(footUp).addScaledVector(along,-V(footUp).dot(along)).normalize(),right=along.clone().cross(up).normalize(),basis=new THREE.Matrix4().makeBasis(right,along,up);
        for(const item of [foot,shoe,sole])item.group.quaternion.setFromRotationMatrix(basis);
        sole.group.position.copy(V(ankle).addScaledVector(V(footUp),-.031));
      }
      foot.group.visible=!shoes;shoe.group.visible=sole.group.visible=sock.group.visible=shoes;
    },get points(){return points;}};
  }
  const legs=[leg(-1),leg(1)],landmarks={};let activeMode='surf';
  // One tailored seat branches into two leg openings. The openings and leg
  // cloth share their exact 3D boundary, including the shared crotch seam.
  const rootRight=[[0,-.235,0],[0,-.169,.108],[.105*build,-.137,.131],[.196*build,-.144,.104],[.218*build,-.147,0],[.197*build,-.153,-.100],[.105*build,-.162,-.124],[0,-.200,-.106]];
  const rootLeft=[[-.218*build,-.147,0],[-.196*build,-.144,.104],[-.105*build,-.137,.131],[0,-.169,.108],[0,-.235,0],[0,-.200,-.106],[-.105*build,-.162,-.124],[-.197*build,-.153,-.100]];
  const roots=[rootLeft,rootRight],contour=[rootRight[4],rootRight[3],rootRight[2],rootRight[1],rootLeft[2],rootLeft[1],rootLeft[0],rootLeft[7],rootLeft[6],rootLeft[5],rootRight[6],rootRight[5]],waist=[[1,0],[.86,.72],[.50,.95],[0,1],[-.50,.95],[-.86,.72],[-1,0],[-.86,-.72],[-.50,-.95],[0,-1],[.50,-.95],[.86,-.72]];
  const yokeGeometry=new THREE.BufferGeometry(),yp=[],yu=[],yi=[];
  for(let r=0;r<4;r++)for(let j=0;j<=12;j++){
    const k=j%12;yp.push(0,0,0);const front=k>=6,xx=(r===3?contour[k][0]:waist[k][0]*.18*build)/(.44*build);
    yu.push((front?.5:0)+(.5+(front?xx:-xx))*.5,1-r*.19);
    if(r<3&&j<12){const a=r*13+j,b=a+13;yi.push(a,a+1,b,b,a+1,b+1);}
  }
  yokeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(yp,3));yokeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(yu,2));yokeGeometry.setIndex(yi);
  const yoke=mesh(rider,yokeGeometry,hipMaterial);yoke.name='trouser-yoke';yoke.visible=!wet;
  function updateLowerCloth(){
    if(wet)return;
    const toRider=p=>V(p).applyMatrix4(body.matrix).toArray(),p=yokeGeometry.attributes.position;
    for(let r=0;r<4;r++)for(let j=0;j<=12;j++){
      const k=j%12;let point;
      if(r===3)point=contour[k];
      else if(r===2){
        // A hidden ring follows the shirt's eight-sided cross-section just
        // below its hem. Twelve-sided seat corners must not cut through the
        // shirt's narrower diagonal facets above that line.
        const x=waist[k][0],z=waist[k][1],limit=Math.abs(x)<=.8?1-.2*Math.abs(x):.84*(1-(Math.abs(x)-.8)/.2);
        point=[x*.211*build*.965,-.119,Math.sign(z)*Math.min(Math.abs(z),Math.max(0,limit))*.141*.965];
      }else point=[waist[k][0]*(r===0?.169:.187)*build,r===0?.003:-.061,waist[k][1]*(r===0?.111:.119)];
      p.setXYZ(r*13+j,...toRider(point));
    }
    p.needsUpdate=true;yokeGeometry.computeVertexNormals();yokeGeometry.computeBoundingSphere();
    legs.forEach((leg,i)=>leg.cloth?.set(leg.points.hip,leg.points.knee,leg.points.ankle,roots[i].map(toRider)));
  }
  function pose({charge=0,grab=0,tweak=0,air=false,time=0,lean=0,standing=false,mode,lipGrab=0,boardTargetWorld=null,boardFeetWorld=null,cutback=0,cutbackDirection=1}={}){
    shell?.resetNormals();
    if(mode)activeMode=mode;grab=THREE.MathUtils.clamp(Math.max(grab,lipGrab),0,1);
    tweak=air&&!standing?THREE.MathUtils.clamp(tweak,0,1):0;
    cutback=standing||air?0:THREE.MathUtils.clamp(cutback,0,1);
    const shoes=activeMode==='park'||standing,breath=Math.sin(time*1.7)*.002;
    rider.rotation.set(0,standing?0:-Math.PI/2,0);
    rider.position.y=air&&!standing?.12:0;
    if(standing){
      body.position.set(.007,1.01+breath,.012);body.rotation.set(-.023,.035,-.017);head.rotation.set(.022,-.11,.012);
      body.updateMatrix();
      legs[0].set(V([-.095,0,0]).applyMatrix4(body.matrix).toArray(),[-.105,.527,-.018],[-.117,.085,.030],[-.141,.047,-.168],shoes);
      legs[1].set(V([.102,0,0]).applyMatrix4(body.matrix).toArray(),[.115,.531,.019],[.126,.084,.069],[.151,.047,-.128],shoes);
      // Nearly extended, unlocked arms hang beside the garment. The bend hint
      // points forward, preventing the old sideways, mannequin-like elbows.
      arms[0].set([-.194*build,.437,.002],[-.192*build,.135,-.034],[-.218*build,-.167,-.021]);
      arms[1].set([.194*build,.437,.003],[.196*build,.135,-.025],[.221*build,-.169,.012]);
    }else{
      const turn=cutback*Math.sign(cutbackDirection||1),tuck=Math.min(1,charge*.85+grab+cutback*.35),hy=.80-tuck*.37,hz=.04+tuck*.25;
      body.position.set(-lean*.03-turn*.04-.14*tweak,hy+breath+.10*tweak,hz+.13*tweak);
      body.rotation.set(-.16-tuck*.40+turn*.18-.01*tweak,-.07+turn*.20-.48*tweak,-lean*.12-turn*.10+.40*tweak);
      head.rotation.set(.17+tuck*.2-.10*tweak,1.15-turn*.30+.10*tweak,-.025-.055*tweak);
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
      const inverseRider=rider.matrixWorld.clone().invert();
      const feet=boardFeetWorld&&tweak>0?boardFeetWorld.map(foot=>({ankle:rider.worldToLocal(foot.ankle.clone()).toArray(),toe:rider.worldToLocal(foot.toe.clone()).toArray(),up:foot.up?.clone().transformDirection(inverseRider).toArray()})):[{ankle:[-.34,.215,.035],toe:[-.36,.181,-.163]},{ankle:[.36,.215,.069],toe:[.395,.181,-.128]}];
      legs[0].set(V([-.095,0,0]).applyMatrix4(body.matrix).toArray(),[-.236,ky,kz],feet[0].ankle,feet[0].toe,shoes,feet[0].up);
      legs[1].set(V([.102,0,0]).applyMatrix4(body.matrix).toArray(),[.246,ky+.012,kz+.056],feet[1].ankle,feet[1].toe,shoes,feet[1].up);
      const leftRest=mix([-.46,.042,-.186],[-.37,-.16,-.27],cutback);
      // Keep the free arm reaching upward while the torso lays over and twists;
      // raising it only in torso space made it tip sideways with the chest.
      const raisedWrist=V([-.12,.57,-.06]).applyQuaternion(body.quaternion.clone().invert()).add(V([-.194*build,.437,.002])).toArray();
      arms[0].set([-.194*build,.437,.002],mix([-.37,.233,-.055],mix([-.29,.58,.00],[-.42,.69,.11],tweak),grab),mix(leftRest,mix([-.25,.86,-.12],raisedWrist,tweak),grab));
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
    body.updateMatrix();updateLowerCloth();poseHangingHair();rider.updateMatrixWorld(true);
    const bp=a=>body.localToWorld(V(a));
    for(const[i,prefix]of[[0,'left'],[1,'right']]){for(const k of['shoulder','elbow','wrist','fingertip'])landmarks[prefix+k[0].toUpperCase()+k.slice(1)]=bp(arms[i].points[k]);for(const k of['hip','knee','ankle','toe'])landmarks[prefix+k[0].toUpperCase()+k.slice(1)]=rider.localToWorld(V(legs[i].points[k]));landmarks[prefix+'Sole']=rider.localToWorld(V([legs[i].points.ankle[0],.017,legs[i].points.ankle[2]]));}
    landmarks.crown=head.localToWorld(new THREE.Vector3(0,.256,0));landmarks.chin=head.localToWorld(new THREE.Vector3(0,0,0));
    landmarks.shoulderOuterLeft=bp([-.257*build,.437,0]);landmarks.shoulderOuterRight=bp([.257*build,.437,0]);
    landmarks.shirtHem=bp([0,-.115,-.123]);landmarks.crotch=bp([0,-.235,0]);
  }
  pose({standing:true});
  rider.userData.landmarks=landmarks;
  return{rider,body,hips,head,leftArm:arms[0].group,rightArm:arms[1].group,pose,landmarks};
}
