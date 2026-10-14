import * as THREE from 'three';
import { sewerPoint,sewerWaterHeight } from './sewer-course.js';

const clamp01=value=>Math.max(0,Math.min(1,value));
const smooth=(value,start=0,end=1)=>{const t=clamp01((value-start)/(end-start));return t*t*(3-2*t);};
const colour=hex=>new THREE.Color().setHex(hex,THREE.LinearSRGBColorSpace);
const VERTEX_SHADER=`
  attribute float foamWeight;
  varying vec3 world;
  varying vec3 waterNormal;
  varying float breakingFoam;
  void main(){
    world=(modelMatrix*vec4(position,1.)).xyz;
    waterNormal=normalize(mat3(modelMatrix)*normal);
    breakingFoam=foamWeight;
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
  }`;
const FRAGMENT_SHADER=`
  uniform float time;
  uniform vec3 base,foam,fog,lamp;
  uniform int holeCount,cutCount;
  uniform vec4 holes[8],cuts[32];
  uniform float holeAngles[8],cutWidth;
  uniform vec2 cutEnds[32];
  varying vec3 world,waterNormal;
  varying float breakingFoam;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 cell=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
    return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.,1.)),f.x),f.y);
  }
  void main(){
    for(int i=0;i<32;i++){
      if(i>=cutCount)break;
      vec2 a=cuts[i].xy,b=cuts[i].zw,delta=b-a;
      float length2=dot(delta,delta);if(length2<.000001)continue;
      float t=dot(world.xz-a,delta)/length2;
      if((t<0.&&cutEnds[i].x>.5)||(t>1.&&cutEnds[i].y>.5))continue;
      if(distance(world.xz,a+delta*clamp(t,0.,1.))<cutWidth)discard;
    }
    for(int i=0;i<8;i++){
      if(i>=holeCount)break;
      vec2 d=world.xz-holes[i].xy;
      float c=cos(holeAngles[i]),s=sin(holeAngles[i]);
      vec2 local=vec2(c*d.x-s*d.y,s*d.x+c*d.y);
      if(length(local/max(abs(holes[i].zw),vec2(.001)))<.93)discard;
    }
    // World coordinates make adjoining canal sheets and a rising curl one
    // continuous liquid. Several warped scales avoid straight stripe grids.
    vec2 drift=(world.xz+vec2(.47,.81)*world.y)*.34+vec2(.13,.82)*time;
    float broad=noise(drift*.29+vec2(.2,-.1)*time*.13);
    vec2 warped=drift+vec2(broad,-broad)*1.7;
    float detail=noise(warped*1.7+vec2(13.4,4.8));
    float fine=noise(mat2(.8,-.6,.6,.8)*warped*3.1+vec2(-.2,.12)*time);
    float a=dot(warped,vec2(1.1,.57))+broad*3.4;
    float b=dot(warped,vec2(-.45,1.74))+detail*2.1;
    vec3 ripple=vec3(cos(a)*.055-cos(b)*.035,0.,cos(a)*.03+cos(b)*.075);
    vec3 normal=normalize(waterNormal+ripple);
    vec3 view=normalize(cameraPosition-world);
    if(dot(normal,view)<0.)normal=-normal;
    float fresnel=pow(1.-max(0.,dot(normal,view)),3.);
    float highlight=pow(max(0.,dot(normal,normalize(view+vec3(-.3,.83,.42)))),38.);
    float current=.86+broad*.15+detail*.07+fine*.035;
    vec3 color=base*current;
    color=mix(color,lamp,fresnel*.105+highlight*(.045+detail*.05));
    float lace=smoothstep(.74,.94,detail*.63+fine*.37)*.12;
    float lip=breakingFoam*(.42+.32*detail+.16*fine);
    color=mix(color,foam,clamp(lace+lip,0.,.82));
    color=mix(color,fog,smoothstep(90.,265.,length(world-cameraPosition)));
    gl_FragColor=vec4(color,1.);
  }`;

export function waterMaterial(style,cuts=[],cutEnds=[]){
  const material=new THREE.ShaderMaterial({
    name:'sewer-shared-flowing-water',side:THREE.DoubleSide,transparent:false,depthWrite:true,toneMapped:false,
    uniforms:{
      time:{value:0},base:{value:colour(style.water)},foam:{value:colour(style.foam)},fog:{value:colour(style.fog)},lamp:{value:colour(style.light)},
      holeCount:{value:0},holes:{value:Array.from({length:8},()=>new THREE.Vector4())},holeAngles:{value:new Float32Array(8)},
      cutCount:{value:Math.min(32,cuts.length)},cuts:{value:Array.from({length:32},(_,i)=>cuts[i]||new THREE.Vector4())},
      cutEnds:{value:Array.from({length:32},(_,i)=>cutEnds[i]||new THREE.Vector2())},cutWidth:{value:3.80}
    },vertexShader:VERTEX_SHADER,fragmentShader:FRAGMENT_SHADER
  });
  // Canal meshes have no breaking lip; their absent attribute must be a
  // defined zero rather than inheriting the previous wave's vertex buffer.
  material.defaultAttributeValues={...material.defaultAttributeValues,foamWeight:[0]};
  material.userData.waterCoordinates='world';
  return material;
}

export function waveMaterial(style){return waterMaterial(style);}

function bezier(a,b,c,d,t){const s=1-t;return s*s*s*a+3*s*s*t*b+3*s*t*t*c+t*t*t*d;}

// The first segment leaves the canal horizontally. Its shoulder rises at the
// bank before the second segment rolls over the racing line, so an untriggered
// hazard is a low moving swell rather than an upright curtain of water.
export function sampleSewerCurl(along,across,closure){
  const phase=clamp01(closure),u=clamp01(along),v=clamp01(across);
  const extent=smooth(u,0,.22)*(1-smooth(u,.78,1));
  const rise=.65+6.9*smooth(phase,0,.26),roll=.12+2.8*smooth(phase,.08,.55)+.46*smooth(phase,.55,.94);
  const collapse=smooth(phase,.94,1);
  let lane,lift;
  if(v<=.5){
    const t=v*2;lane=bezier(1,.88,.92,.92,t);lift=bezier(0,0,.14,.35,t);
  }else{
    // The round crown continues past its leftmost point, making a real curled
    // lip rather than a sloping sheet. At each longitudinal end the angle
    // unwinds toward the bank before the height falls to the canal.
    const angle=(v-.5)*2*roll*extent;
    lane=.28+.64*Math.cos(angle);lift=.35+.63*Math.sin(angle);
  }
  const height=rise*(1-collapse*.975)*extent;
  return {lane:1+(lane-1)*extent,lift:Math.max(0,lift*height),foam:extent*smooth(v,.76,1)*smooth(phase,.18,.55)*(1-collapse*.5)};
}

export function closingWaveGeometry(){
  const rows=28,sectors=32,count=(rows+1)*(sectors+1),geometry=new THREE.BufferGeometry(),uv=[],indices=[];
  for(let row=0;row<=rows;row++)for(let side=0;side<=sectors;side++)uv.push(side/sectors,row/rows);
  for(let row=0;row<rows;row++)for(let side=0;side<sectors;side++){
    const a=row*(sectors+1)+side,b=a+sectors+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('foamWeight',new THREE.BufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.userData={rows,sectors};return geometry;
}

function canalNormal(distance,lane,time,trackId,path){
  const surface=(d,x)=>sewerPoint(d,x,sewerWaterHeight(x,d,time,trackId,path),trackId,path);
  const left=surface(distance,lane-.1),right=surface(distance,lane+.1),behind=surface(distance-.1,lane),ahead=surface(distance+.1,lane);
  const across=new THREE.Vector3(right.x-left.x,right.y-left.y,right.z-left.z);
  const forward=new THREE.Vector3(ahead.x-behind.x,ahead.y-behind.y,ahead.z-behind.z);
  const normal=across.cross(forward).normalize();if(normal.y<0)normal.negate();return normal;
}

export function updateClosingWave(geometry,item,trackId,time,closure){
  const {rows,sectors}=geometry.userData,positions=geometry.attributes.position,foam=geometry.attributes.foamWeight;
  const path=item.path&&item.path!=='main'?item.path:null;
  for(let row=0;row<=rows;row++)for(let side=0;side<=sectors;side++){
    const u=row/rows,sample=sampleSewerCurl(u,side/sectors,closure);
    const distance=item.startDistance+(item.endDistance-item.startDistance)*u,lane=(item.x||0)+sample.lane*(item.width/2+.6);
    const height=sewerWaterHeight(lane,distance,time,trackId,path)+sample.lift;
    const point=sewerPoint(distance,lane,height,trackId,path),index=row*(sectors+1)+side;
    positions.setXYZ(index,point.x,point.y,point.z);foam.setX(index,sample.foam);
  }
  positions.needsUpdate=true;foam.needsUpdate=true;geometry.computeVertexNormals();
  // The first triangle is a finite chord of the curved shoulder. Matching its
  // boundary normal analytically avoids an artificial dark seam at the water.
  const normals=geometry.attributes.normal;
  for(let row=0;row<=rows;row++)for(let side=0;side<=sectors;side++){
    if(row!==0&&row!==rows&&side!==0)continue;
    const u=row/rows,sample=sampleSewerCurl(u,side/sectors,closure),distance=item.startDistance+(item.endDistance-item.startDistance)*u;
    const lane=(item.x||0)+sample.lane*(item.width/2+.6),normal=canalNormal(distance,lane,time,trackId,path);
    normals.setXYZ(row*(sectors+1)+side,normal.x,normal.y,normal.z);
  }
  normals.needsUpdate=true;geometry.computeBoundingSphere();
}

function whitewaterTexture(){
  const size=32,pixels=new Uint8Array(size*size*4);
  for(let row=0;row<size;row++)for(let column=0;column<size;column++){
    const x=(column+.5)/size*2-1,y=(row+.5)/size*2-1,r=Math.hypot(x,y);
    const soft=Math.pow(Math.max(0,1-r*r),2),swirl=.72+.28*Math.sin(x*8+y*5+Math.sin(y*6));
    const index=(row*size+column)*4;pixels.set([255,255,255,Math.round(255*soft*swirl)],index);
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

export function createSewerWaveCrash(style,item){
  const group=new THREE.Group(),map=whitewaterTexture(),geometry=new THREE.PlaneGeometry(1,1);
  group.name='sewer-pressure-crash';group.visible=false;
  const foam=new THREE.MeshBasicMaterial({color:style.foam,map,side:THREE.DoubleSide,transparent:true,depthWrite:false,opacity:.5});
  const spray=new THREE.SpriteMaterial({color:style.foam,map,transparent:true,depthWrite:false,opacity:.6});
  for(let row=0;row<5;row++)for(let side=0;side<3;side++){
    const patch=new THREE.Mesh(geometry,foam);patch.name='sewer-collapse-whitewater';
    patch.userData={kind:'foam',u:.12+row*.19,lane:(side-1)*item.width*.28,seed:row*3+side};group.add(patch);
  }
  for(let i=0;i<10;i++){
    const drop=new THREE.Sprite(spray);drop.name='sewer-collapse-spray';
    drop.userData={kind:'spray',u:.2+(i%5)*.15,lane:Math.sin(i*2.399)*item.width*.34,seed:i};group.add(drop);
  }
  group.userData={closedAt:null,foamMaterial:foam,sprayMaterial:spray};return group;
}

export function updateSewerWaveCrash(group,item,trackId,time,closure){
  group.visible=closure>=1;
  if(!group.visible){group.userData.closedAt=null;return;}
  if(group.userData.closedAt===null)group.userData.closedAt=time;
  const age=Math.max(0,time-group.userData.closedAt),fade=Math.exp(-age*.85);
  group.position.set(0,0,0);group.rotation.set(0,0,0);
  group.userData.foamMaterial.opacity=.10+.46*fade;group.userData.sprayMaterial.opacity=.60*fade;
  for(const object of group.children){
    const {kind,u,lane,seed}=object.userData;
    const distance=item.startDistance+(item.endDistance-item.startDistance)*u+Math.min(age,3)*2.3;
    const x=lane+Math.sin(time*1.2+seed)*.2,water=sewerWaterHeight(x,distance,time,trackId);
    const point=sewerPoint(distance,x,water+.025,trackId);object.position.set(point.x,point.y,point.z);
    if(kind==='foam'){
      object.rotation.set(-Math.PI/2,0,point.heading+Math.sin(time*.45+seed)*.14);
      const pulse=1+Math.sin(time*2+seed)*.07;object.scale.set(item.width*.33*pulse,4.6*pulse,1);
    }else{
      const localAge=age+seed*.035,height=Math.max(0,2.4*localAge-3.6*localAge*localAge);
      object.position.y+=height;const size=(.13+(seed%3)*.045)*(1+age*.3);object.scale.set(size,size*1.6,1);
    }
  }
}
