import * as THREE from 'three';
import { surfHazardsNear,REEF_BANK_SIDES,reefBankHeight } from './surf-hazards.js';
import { renderedWaveHeight } from './ocean-surface.js';

export const SURF_HAZARD_POOL_PER_TYPE=4;
export const REEF_BANK_POOL_SIZE=24;
const RINGS=12,SECTORS=48;
function whirlpoolGeometry(){
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array((RINGS+1)*(SECTORS+1)*3),uv=new Float32Array((RINGS+1)*(SECTORS+1)*2),indices=[];
  for(let ring=0;ring<=RINGS;ring++)for(let angle=0;angle<=SECTORS;angle++){
    const i=ring*(SECTORS+1)+angle;uv[i*2]=angle/SECTORS;uv[i*2+1]=ring/RINGS;
    if(ring<RINGS&&angle<SECTORS){const j=i+SECTORS+1;indices.push(i,j,i+1,j,j+1,i+1);}
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);return geometry;
}
function woodGeometry(){
  const positions=[],indices=[];
  // Three low sticks form one obstacle; every endpoint stays inside the same
  // broad ellipse used by swept physics. The long trunk rides the water face.
  for(let branch=0;branch<3;branch++)for(let ring=0;ring<=8;ring++)for(let side=0;side<6;side++){
    positions.push(0,0,0);if(ring<8){const i=branch*9*6+ring*6+side,j=branch*9*6+ring*6+(side+1)%6;indices.push(i,i+6,j,j,i+6,j+6);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);return geometry;
}
function updateWood(geometry,item,time,oceanZ){
  const p=geometry.attributes.position;
  for(let branch=0;branch<3;branch++)for(let ring=0;ring<=8;ring++)for(let side=0;side<6;side++){
    const u=ring/8,a=side/6*Math.PI*2;
    let x=(u*2-1)*item.radiusX,z=Math.sin(u*Math.PI*2)*.06;
    if(branch){x=(-.55+u*.85)*(branch===1?1:-1);z=(u-.2)*.34*(branch===1?1:-1);}
    const radius=branch?.052:.08,zSide=z+Math.cos(a)*radius;
    const y=renderedWaveHeight(item.x+x,item.z+zSide,time,oceanZ)+.09+Math.sin(a)*radius;
    p.setXYZ(branch*9*6+ring*6+side,x,y,zSide);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}
function updateWhirlpool(geometry,item,time,oceanZ){
  const p=geometry.attributes.position;
  for(let ring=0;ring<=RINGS;ring++)for(let sector=0;sector<=SECTORS;sector++){
    const radius=ring/RINGS*item.pullRadius,angle=sector/SECTORS*Math.PI*2,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const core=Math.max(0,1-radius/item.radiusX),dip=core*core*1.1;
    p.setXYZ(ring*(SECTORS+1)+sector,x,renderedWaveHeight(item.x+x,item.z+z,time,oceanZ)+.045-dip,z);
  }
  p.needsUpdate=true;geometry.computeBoundingSphere();
}

function reefBankGeometry(){
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(7*(REEF_BANK_SIDES+1)*3),colors=new Float32Array(positions.length),indices=[];
  for(let ring=0;ring<=6;ring++)for(let side=0;side<=REEF_BANK_SIDES;side++){
    const i=ring*(REEF_BANK_SIDES+1)+side,foam=ring===0?.64:ring<3?.43:.3;
    colors.set([foam*.94,foam,foam*.91],i*3);
    if(ring<6&&side<REEF_BANK_SIDES){const j=i+REEF_BANK_SIDES+1;indices.push(i,j,i+1,j,j+1,i+1);}
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);return geometry;
}
function updateReefBank(geometry,item,time,oceanZ){
  const p=geometry.attributes.position;
  for(let ring=0;ring<=6;ring++)for(let side=0;side<=REEF_BANK_SIDES;side++){
    const angle=side/REEF_BANK_SIDES*Math.PI*2,x=Math.cos(angle)*item.radiusX*ring/6,z=Math.sin(angle)*item.radiusZ*ring/6;
    const y=renderedWaveHeight(item.x+x,item.z+z,time,oceanZ)+reefBankHeight(item,item.x+x,item.distance-z);
    p.setXYZ(ring*(REEF_BANK_SIDES+1)+side,x,y,z);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

export function createSurfHazardRenderer({reducedMotion=false}={}){
  const group=new THREE.Group();group.name='surf-hazards';
  const wood=new THREE.MeshLambertMaterial({color:0x86694e,flatShading:true,side:THREE.DoubleSide});
  const stone=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide});
  const whirl=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0}},vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}',
    fragmentShader:`uniform float uTime;varying vec2 vUv;varying vec3 vWorld;void main(){
      float r=vUv.y,angle=vUv.x*6.2831853;
      float spiral=sin(angle*4.+r*27.+uTime*2.5);
      float foam=smoothstep(.62,.92,spiral)*smoothstep(.08,.30,r)*(1.-smoothstep(.74,1.,r));
      float core=1.-smoothstep(.16,.25,r);
      vec3 water=mix(vec3(.055,.105,.13),vec3(.19,.35,.38),smoothstep(.07,.43,r));
      vec3 col=mix(water,vec3(.68,.82,.79),foam*.72);
      float alpha=max(core,.25+foam*.6)*(1.-smoothstep(.83,1.,r));
      col=mix(col,vec3(.34,.42,.47),smoothstep(75.,215.,length(vWorld-cameraPosition)));
      gl_FragColor=vec4(floor(col*32.)/32.,alpha);
    }`});
  const pools={driftwood:[],whirlpool:[],reefbank:[]};
  for(let i=0;i<SURF_HAZARD_POOL_PER_TYPE;i++)for(const type of ['driftwood','whirlpool']){
    const mesh=new THREE.Mesh(type==='driftwood'?woodGeometry():whirlpoolGeometry(),type==='driftwood'?wood:whirl);
    mesh.name=`surf-${type}-${i}`;mesh.visible=false;mesh.frustumCulled=false;group.add(mesh);pools[type].push(mesh);
  }
  for(let i=0;i<REEF_BANK_POOL_SIZE;i++){
    const mesh=new THREE.Mesh(reefBankGeometry(),stone);mesh.name=`surf-reefbank-${i}`;
    mesh.visible=false;mesh.frustumCulled=false;group.add(mesh);pools.reefbank.push(mesh);
  }
  const masks=Array.from({length:SURF_HAZARD_POOL_PER_TYPE},()=>new THREE.Vector3());
  let disposed=false,maskCount=0;
  function update(game,time,oceanZ,{attract=false}={}){
    if(disposed)return;
    const enabled=!attract&&game.mode==='surf'&&game.rulesId==='storm'&&!game.isRace&&game.surfAdventureEnabled;
    group.visible=!!enabled;maskCount=0;if(!enabled)return;
    whirl.uniforms.uTime.value=reducedMotion?0:time;
    const counts={driftwood:0,whirlpool:0,reefbank:0};
    for(const item of surfHazardsNear(game.distance,game.rulesId,time,28,240)){
      const slot=pools[item.type]?.[counts[item.type]++];if(!slot)continue;
      slot.visible=true;slot.userData={hazardId:item.id,type:item.type,radiusX:item.radiusX,radiusZ:item.radiusZ,pullRadius:item.pullRadius??0};slot.position.set(item.x,0,item.z);
      if(item.type==='driftwood')updateWood(slot.geometry,item,time,oceanZ);
      else if(item.type==='reefbank')updateReefBank(slot.geometry,item,time,oceanZ);
      else{updateWhirlpool(slot.geometry,item,time,oceanZ);masks[maskCount++].set(item.x,item.z,item.radiusX);}
    }
    for(const type of Object.keys(pools))for(let i=counts[type];i<pools[type].length;i++)pools[type][i].visible=false;
  }
  function dispose(){if(disposed)return;disposed=true;for(const slots of Object.values(pools))for(const slot of slots)slot.geometry.dispose();wood.dispose();whirl.dispose();stone.dispose();group.clear();maskCount=0;}
  return {group,update,dispose,masks,get maskCount(){return maskCount;},get activeCount(){return group.visible?group.children.filter(o=>o.visible).length:0;}};
}
