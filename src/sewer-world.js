import * as THREE from 'three';
import { createSurfer, disposeSurfer } from './appearance.js';
import { rivalProfile } from './race-world.js';
import { sampleRiderTrick } from './rider-pose.js';
import { sewerPoint, sewerWaterHeight, sewerBarrelState, sewerTunnelProfile, sewerSection } from './sewer-course.js';

const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, value));
export const SEWER_TUNNEL_RADIUS = 14;
export const SEWER_TUNNEL_CENTRE_Y = 7;
export const SEWER_DRAW_AHEAD = 310;
export const SEWER_WATER_CHUNK_LENGTH = 72;
export const SEWER_WHIRLPOOL_MASKS = 8;

export function sewerTrackStyle(trackId) {
  const pressure = trackId === 'sewer-depths';
  return pressure
    ? { pressure, wall: 0x60716a, rust: 0x9a6243, water: 0x22594b, foam: 0xa5c8a2, light: 0x9cd2c6, fog: 0x172c2a, name: 'THE DEEP WORKS' }
    : { pressure, wall: 0x9d7c5a, rust: 0x795340, water: 0x315f45, foam: 0xb6cb91, light: 0xf4c38c, fog: 0x2b372c, name: 'RUNOFF RUN' };
}

function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function positionAlong(object, distance, x, y, trackId, path = null) {
  const point = sewerPoint(distance, x, y, trackId, path);
  object.position.set(point.x, point.y, point.z); object.rotation.y = point.heading; return point;
}
function masonryTexture(pressure) {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 16), brickX=(x+row%2*16)%32, mortar=y%16<1||brickX<1;
    const grain=((x*73+y*131+x*y*7)%17)-8,brickShade=((Math.floor((x+row%2*16)/32)*23+row*13)%23)-11;
    const seam=pressure?x%64<2||y%64<2:mortar,edge=pressure?x%64===3||y%64===3:y%16===2||brickX===2;
    const stain=pressure&&x%47<5&&y%64>19?.84:1;
    const shade=(seam?113:edge?227:200+grain+brickShade)*stain,offset=(y*size+x)*4;
    data.set([shade,shade*.98,shade*.92,255],offset);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; return texture;
}
function renderTunnelProfile(distance,trackId,path=null){
  return sewerTunnelProfile(path?Math.max(path.start+.001,Math.min(path.end-.001,distance)):distance,trackId,path);
}
function tunnelSamples(course,trackId,path=null) {
  const start=path?path.start:-48,end=path?path.end:course.length+85,samples=[];
  for(let distance=start;distance<=end+4;distance+=4){
    const d=Math.min(distance,end),profile=renderTunnelProfile(d,trackId,path),point=sewerPoint(d,profile.centreX||0,profile.centerY,trackId,path);
    samples.push({...point,radius:profile.radius,distance:d});
  }
  return samples;
}
function withinTube(point,samples,padding=.35) {
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],dx=b.x-a.x,dz=b.z-a.z;
    if(point.x<Math.min(a.x,b.x)-b.radius-padding||point.x>Math.max(a.x,b.x)+b.radius+padding||point.z<Math.min(a.z,b.z)-b.radius-padding||point.z>Math.max(a.z,b.z)+b.radius+padding)continue;
    const f=clamp01(((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1));
    const x=a.x+dx*f,z=a.z+dz*f,y=a.y+(b.y-a.y)*f,radius=a.radius+(b.radius-a.radius)*f+padding;
    if((point.x-x)**2+(point.z-z)**2+(point.y-y)**2<radius*radius)return true;
  }
  return false;
}
function tubeDistance(point,samples) {
  let nearest=1e5;
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],dx=b.x-a.x,dz=b.z-a.z;
    const reach=Math.max(a.radius,b.radius)+1;
    if(point.x<Math.min(a.x,b.x)-reach||point.x>Math.max(a.x,b.x)+reach||point.z<Math.min(a.z,b.z)-reach||point.z>Math.max(a.z,b.z)+reach)continue;
    const f=clamp01(((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1));
    nearest=Math.min(nearest,Math.hypot(point.x-a.x-dx*f,point.y-a.y-(b.y-a.y)*f,point.z-a.z-dz*f)-a.radius-(b.radius-a.radius)*f);
  }
  return nearest;
}
function projectToSamples(point,samples) {
  let nearest=null,best=Infinity;
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
    if(length2<1e-8)continue;
    const fraction=clamp01(((point.x-a.x)*dx+(point.z-a.z)*dz)/length2),x=a.x+dx*fraction,z=a.z+dz*fraction,distance2=(point.x-x)**2+(point.z-z)**2;
    if(distance2<best){best=distance2;nearest={distance:a.distance+(b.distance-a.distance)*fraction,x:((point.x-x)*-dz+(point.z-z)*dx)/Math.sqrt(length2)};}
  }
  return nearest;
}
function sectionMaterial(kind,pressure){return kind==='masonry'||kind==='brick'?0:kind==='steel'||kind==='service'?1:kind==='pump'||kind==='vault'||kind==='outfall'||kind==='spillway'?2:pressure?1:0;}
function pipeGeometry(course, start, end, trackId, path = null, junctions = []) {
  const positions = [], uv = [], colors=[], indices = [], groups=[[],[],[]], rows = Math.max(1, Math.ceil((end - start) / 4)), sectors = path ? 20 : 28,inside=[];
  for (let row = 0; row <= rows; row++) {
    const distance = start + (end - start) * row / rows;
    const profile=renderTunnelProfile(distance,trackId,path);
    for (let side = 0; side <= sectors; side++) {
      const angle = side / sectors * TAU;
      const point = sewerPoint(distance,(profile.centreX||0)+Math.cos(angle)*profile.radius,profile.centerY+Math.sin(angle)*profile.radius,trackId,path);
      positions.push(point.x, point.y, point.z); uv.push(side/sectors*(path?4:profile.radius*.60),distance/14);
      const sideLight=.78+.22*Math.pow(Math.abs(Math.cos(angle)),2),lamp=.05*Math.pow(Math.max(0,Math.cos(distance/42*TAU)),4),wet=point.y<3?.65:1;
      colors.push(sideLight*wet+lamp,(sideLight*.98)*wet+lamp,(sideLight*.92)*wet+lamp);
      inside.push(junctions.map(samples=>tubeDistance(point,samples)));
    }
  }
  for(let row=0;row<rows;row++)for(let side=0;side<sectors;side++){
      const a = row * (sectors + 1) + side, b = a + sectors + 1;
      const distance=start+(end-start)*(row+.5)/rows,section=sewerSection(distance,trackId);
      // The final daylight grate opens through the roof rather than sitting
      // behind opaque masonry. Its narrow opening stays above the riding line.
      const angle=(side+.5)/sectors*TAU,profile=renderTunnelProfile(distance,trackId,path);
      if(!path&&section.kind==='outfall'&&Math.abs(distance-(section.start+section.end)/2)<11&&Math.sin(angle)>.9&&Math.abs(Math.cos(angle)*profile.radius)<7.3)continue;
      const material=path?1:sectionMaterial(section.kind,trackId==='sewer-depths');
      for(const triangle of [[a,a+1,b],[a+1,b+1,b]]){
        let polygon=triangle;
        for(let j=0;j<junctions.length&&polygon.length;j++){
          const clipped=[];
          for(let edge=0;edge<polygon.length;edge++){
            const current=polygon[edge],next=polygon[(edge+1)%polygon.length],da=inside[current][j],db=inside[next][j];
            if(da>=0)clipped.push(current);
            if((da<0)===(db<0))continue;
            let low=0,high=1;
            for(let step=0;step<10;step++){
              const f=(low+high)*.5,point={x:positions[current*3]+(positions[next*3]-positions[current*3])*f,y:positions[current*3+1]+(positions[next*3+1]-positions[current*3+1])*f,z:positions[current*3+2]+(positions[next*3+2]-positions[current*3+2])*f};
              if((tubeDistance(point,junctions[j])<0)===(da<0))low=f;else high=f;
            }
            const f=(low+high)*.5,index=positions.length/3,point={};
            for(let axis=0;axis<3;axis++){const value=positions[current*3+axis]+(positions[next*3+axis]-positions[current*3+axis])*f;positions.push(value);colors.push(colors[current*3+axis]+(colors[next*3+axis]-colors[current*3+axis])*f);point[['x','y','z'][axis]]=value;}
            for(let axis=0;axis<2;axis++)uv.push(uv[current*2+axis]+(uv[next*2+axis]-uv[current*2+axis])*f);
            inside.push(junctions.map(samples=>tubeDistance(point,samples)));clipped.push(index);
          }
          polygon=clipped;
        }
        for(let vertex=1;vertex<polygon.length-1;vertex++)groups[material].push(polygon[0],polygon[vertex],polygon[vertex+1]);
      }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  for(let index=0;index<groups.length;index++){geometry.addGroup(indices.length,groups[index].length,index);indices.push(...groups[index]);}
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
function waterGeometry(start, end, trackId, path = null, mainSamples = null) {
  const positions = [], uv = [], flow=[],indices = [], columns = path ? 6 : 14, rows = Math.max(1, Math.ceil((end - start) / 4));
  const width=sewerTunnelProfile((start+end)/2,trackId,path).halfWidth+.68,centreX=path?.entryX||0,samples=[];
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const distance = start + (end - start) * row / rows, x = centreX + (column / columns * 2 - 1) * width;
    const point = sewerPoint(distance, x, sewerWaterHeight(x, distance, 0, trackId, path), trackId, path);
    positions.push(point.x, point.y, point.z);flow.push(Math.sin(point.heading),Math.cos(point.heading));
    const sample={distance,x};
    let u=column/columns,v=distance/10;
    if(path&&mainSamples){
      const main=projectToSamples(point,mainSamples);
      if(main){
        const mainWidth=sewerTunnelProfile(main.distance,trackId).halfWidth+.68;
        // Share the main canal's texture coordinates throughout a junction.
        // This removes the false triangular colour seam between water sheets.
        const join=1-THREE.MathUtils.smoothstep(Math.abs(main.x),mainWidth,mainWidth+5);
        u=THREE.MathUtils.lerp(u,(main.x/mainWidth+1)/2,join);v=THREE.MathUtils.lerp(v,main.distance/10,join);
        if(Math.abs(main.x)<mainWidth+.32){sample.main=main;sample.seamBlend=clamp01((Math.abs(x-centreX)-path.width/2-.03)/.62);}
      }
    }
    uv.push(u,v);
    samples.push(sample);
    if (row < rows && column < columns) {
      const a = row * (columns + 1) + column, b = a + columns + 1; indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));geometry.setAttribute('flow',new THREE.Float32BufferAttribute(flow,2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData = { samples, trackId, path,start,end }; return geometry;
}
function waterMaterial(style,cuts=[],cutEnds=[]) {
  // This authored retro shader outputs display values directly, like the
  // ocean shader. Keep the green palette and fog in the same colour space.
  const colour=hex=>new THREE.Color().setHex(hex,THREE.LinearSRGBColorSpace);
  return new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { time: { value: 0 }, base: { value: colour(style.water) }, foam: { value: colour(style.foam) }, fog: { value: colour(style.fog) },lamp:{value:colour(style.light)},
    holeCount:{value:0},holes:{value:Array.from({length:SEWER_WHIRLPOOL_MASKS},()=>new THREE.Vector4())},holeAngles:{value:new Float32Array(SEWER_WHIRLPOOL_MASKS)},
    cutCount:{value:Math.min(32,cuts.length)},cuts:{value:Array.from({length:32},(_,i)=>cuts[i]||new THREE.Vector4())},cutEnds:{value:Array.from({length:32},(_,i)=>cutEnds[i]||new THREE.Vector2())},cutWidth:{value:3.80} },
    vertexShader: 'attribute vec2 flow;varying vec2 uvWater;varying vec3 world;varying vec2 flowDir;void main(){uvWater=uv;flowDir=flow;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader: `uniform float time;uniform vec3 base;uniform vec3 foam;uniform vec3 fog;uniform vec3 lamp;uniform int holeCount;uniform vec4 holes[8];uniform float holeAngles[8];uniform int cutCount;uniform vec4 cuts[32];uniform vec2 cutEnds[32];uniform float cutWidth;varying vec2 uvWater;varying vec3 world;varying vec2 flowDir;
      void main(){for(int i=0;i<32;i++){if(i>=cutCount)break;vec2 a=cuts[i].xy,b=cuts[i].zw,delta=b-a;float t=dot(world.xz-a,delta)/dot(delta,delta);if((t<0.&&cutEnds[i].x>.5)||(t>1.&&cutEnds[i].y>.5))continue;if(distance(world.xz,a+delta*clamp(t,0.,1.))<cutWidth)discard;}
      for(int i=0;i<8;i++){if(i>=holeCount)break;vec2 d=world.xz-holes[i].xy;float c=cos(holeAngles[i]),s=sin(holeAngles[i]);vec2 local=vec2(c*d.x-s*d.y,s*d.x+c*d.y);if(length(local/holes[i].zw)<.93)discard;}
      float across=uvWater.x,along=uvWater.y*10.,drift=along+time*3.8;
      float longWave=sin(across*29.+sin(along*.19)*.55+time*.4),fine=sin(drift*2.7+sin(across*69.)*.28);
      float channels=.92+.055*sin(across*31.+sin(along*.11))+.045*fine;
      float crests=pow(max(0.,fine),21.)*smoothstep(.45,.8,longWave);
      float edge=smoothstep(.35,.5,abs(across-.5)),foamEdge=edge*pow(max(0.,sin(drift*.8+across*17.)),8.);
      vec3 colour=base*channels;colour=mix(colour,foam,crests*.16+foamEdge*.23);
      float reflection=pow(max(0.,cos(along/42.*6.28318)),30.)*pow(abs(across-.5)*2.,3.);
      float broken=.6+.4*sin(drift*4.+across*27.);colour=mix(colour,lamp,reflection*broken*.22);
      vec3 view=normalize(cameraPosition-world);float sheen=pow(1.-abs(view.y),4.)*.09;colour+=vec3(.12,.24,.19)*sheen;
      colour=mix(colour,fog,smoothstep(90.,265.,length(world-cameraPosition)));gl_FragColor=vec4(floor(colour*64.)/64.,1.);}` });
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
  const geometry=new THREE.BufferGeometry(),rows=18,sectors=24,positions=new Float32Array((rows+1)*(sectors+1)*3),uv=[],indices=[];
  for(let row=0;row<=rows;row++)for(let side=0;side<=sectors;side++)uv.push(side/sectors,row/rows);
  for(let row=0;row<rows;row++)for(let side=0;side<sectors;side++){
    const a=row*(sectors+1)+side,b=a+sectors+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.userData={rows,sectors};return geometry;
}
function updateClosingWave(geometry,item,trackId,time,closure) {
  const {rows,sectors}=geometry.userData,positions=geometry.attributes.position;
  for(let row=0;row<=rows;row++)for(let side=0;side<=sectors;side++){
    const u=row/rows,alongCurl=THREE.MathUtils.smoothstep(u,0,.18)*(1-THREE.MathUtils.smoothstep(u,.82,1));
    const curlSpan=(.42+.58*clamp01(closure*1.45))*alongCurl,angle=side/sectors*Math.PI*curlSpan,distance=item.startDistance+(item.endDistance-item.startDistance)*u;
    const curl=Math.pow(Math.sin(Math.PI*u),.65),crash=clamp01((closure-.96)/.04);
    const height=(7.0+(1-curl)*5.5-closure*1.5)*(1-crash*.98);
    const lane=Math.cos(angle)*(item.width/2+.6),surface=sewerWaterHeight(lane,distance,time,trackId);
    const point=sewerPoint(distance,lane,surface+Math.sin(angle)*height+.12,trackId);
    positions.setXYZ(row*(sectors+1)+side,point.x,point.y,point.z);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}
function waveMaterial(style){
  const color=hex=>new THREE.Color().setHex(hex,THREE.LinearSRGBColorSpace);
  return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{time:{value:0},water:{value:color(style.water)},foam:{value:color(style.foam)},fog:{value:color(style.fog)}},
    vertexShader:'varying vec2 coords;varying vec3 world;void main(){coords=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader:`uniform float time;uniform vec3 water;uniform vec3 foam;uniform vec3 fog;varying vec2 coords;varying vec3 world;void main(){float streak=pow(max(0.,sin(coords.x*94.+coords.y*6.+time*2.5)),22.);float crown=smoothstep(.18,.42,coords.x)*(1.-smoothstep(.58,.82,coords.x));float lip=smoothstep(.94,.995,coords.x)*(.48+.16*sin(coords.y*39.+time*4.));vec3 colour=water*(.85+.15*sin(coords.x*3.14159));colour=mix(colour,foam,streak*(.16+crown*.32)+lip);colour=mix(colour,fog,smoothstep(90.,265.,length(world-cameraPosition)));gl_FragColor=vec4(floor(colour*64.)/64.,1.);}`});
}
function hazardMesh(item, style,trackId) {
  const group = new THREE.Group(); group.name = `sewer-${item.type}-${item.id}`; group.userData = { hazardId: item.id, type: item.type, path: item.path || 'main' };
  const radius = item.radius || item.width / 2 || 2;
  if (item.type === 'whirlpool') {
    const path=item.path==='main'?null:item.path;
    const a=sewerPoint(item.distance-item.radiusZ,item.x,0,trackId,path),b=sewerPoint(item.distance+item.radiusZ,item.x,0,trackId,path);
    const radiusZ=Math.hypot(b.x-a.x,b.z-a.z)/2;group.scale.z=radiusZ/radius;group.userData.radiusX=item.radiusX;group.userData.radiusZ=radiusZ;
    const material = new THREE.MeshBasicMaterial({ color: 0x182c16, side: THREE.DoubleSide });
    const core = addMesh(group, new THREE.ConeGeometry(radius, .9, 20, 1, true), material, 0, -.4, 0); core.rotation.z = Math.PI;
    const foam = new THREE.MeshBasicMaterial({ color: style.foam, side: THREE.DoubleSide, transparent: true, opacity: .7 });
    const swirl=new THREE.Group();swirl.name='whirlpool-inner-swirl';group.add(swirl);group.userData.swirl=swirl;
    for (let i = 0; i < 3; i++) {
      const points = [];
      for (let j = 0; j < 28; j++) { const u = j / 27, angle = u * TAU * 1.35 + i * TAU / 3, r = radius * (.1 + u * .95); points.push(new THREE.Vector3(Math.cos(angle) * r, .045 + u * .06, Math.sin(angle) * r)); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: style.foam })); swirl.add(line);
    }
    const rim = addMesh(group, new THREE.TorusGeometry(radius, .10, 4, 24), foam); rim.rotation.x = Math.PI / 2;
  } else if (item.type === 'driftwood') {
    const wood = new THREE.MeshLambertMaterial({ color: 0x7d6643, flatShading: true });
    const log = addMesh(group, new THREE.CylinderGeometry(.16, .23, item.width || radius * 2, 6), wood, 0, .20, 0); log.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) { const twig = addMesh(group, new THREE.CylinderGeometry(.07, .13, 1.2, 5), wood, side * .6, .27, .25); twig.rotation.set(.3, .1, side * .8); }
  } else if (item.type === 'barrel') {
    const water = waveMaterial(style);
    const roll = addMesh(group,closingWaveGeometry(),water);roll.name='sewer-closing-wave';roll.frustumCulled=false;
    const foam = new THREE.MeshBasicMaterial({ color: style.foam });
    const crash=new THREE.Group();crash.name='sewer-pressure-crash';crash.visible=false;group.add(crash);
    for(let i=0;i<9;i++){const tumble=addMesh(crash,new THREE.IcosahedronGeometry(1,1),i%3===0?foam:new THREE.MeshLambertMaterial({color:style.water,flatShading:true}),(i%3-1)*item.width*.32,Math.floor(i/3)*2.5-3,Math.sin(i*1.7)*1.8);tumble.scale.set(item.width*.22,2.3,2.1);}
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

function deckGeometry(course,trackId,side,branchSamples){
  const positions=[],uv=[],indices=[],rows=Math.ceil((course.length+110)/4),inside=[];
  for(let row=0;row<=rows;row++){
    const distance=-40+(course.length+110)*row/rows,profile=sewerTunnelProfile(distance,trackId);
    const inner=course.halfWidth+.88,outer=Math.max(inner+.28,Math.sqrt(profile.radius**2-(1.85-profile.centerY)**2)-.12);
    for(const [lane,y]of [[inner,.25],[inner,1.85],[outer,1.85]]){
      const point=sewerPoint(distance,side*lane,y,trackId);positions.push(point.x,point.y,point.z);uv.push(lane/3,distance/8);
      inside.push(branchSamples.some(samples=>withinTube(point,samples,.7)));
    }
  }
  for(let row=0;row<rows;row++)for(let column=0;column<2;column++){
    const a=row*3+column,b=a+3;if(inside[a]||inside[a+1]||inside[b]||inside[b+1])continue;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function serviceConduitGeometry(course,trackId,lane,height,radius){
  const positions=[],indices=[],rows=Math.ceil((course.length+100)/5),sides=8;
  for(let row=0;row<=rows;row++){
    const distance=-40+(course.length+100)*row/rows,profile=sewerTunnelProfile(distance,trackId),lift=(profile.radius-14)*.13;
    for(let side=0;side<sides;side++){
      const angle=side/sides*TAU,point=sewerPoint(distance,lane+Math.cos(angle)*radius,height+lift+Math.sin(angle)*radius,trackId);
      positions.push(point.x,point.y,point.z);
      if(row<rows){const a=row*sides+side,b=row*sides+(side+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function connectPipe(parent,start,end,radius,material){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),direction=b.clone().sub(a),pipe=addMesh(parent,new THREE.CylinderGeometry(radius,radius,direction.length(),8),material);
  pipe.position.copy(a.add(b).multiplyScalar(.5));pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return pipe;
}
function lightPoolTexture(){
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const radius=Math.hypot((x-size/2)/(size/2),(y-size/2)/(size/2)),alpha=Math.max(0,1-radius)**2;
    data.set([255,255,255,Math.round(alpha*255)],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.needsUpdate=true;return texture;
}
function makeMachinery(section,course,trackId,materials){
  const {steel,rust,light,concrete,dark}=materials,room=new THREE.Group(),distance=(section.start+section.end)/2,profile=sewerTunnelProfile(distance,trackId);
  room.name=`sewer-landmark-${section.id}`;room.userData.distance=distance;room.userData.section=section.id;room.userData.kind=section.kind;positionAlong(room,distance,0,0,trackId);
  const deckX=course.halfWidth+4.9;
  for(const side of [-1,1]){
    const x=side*deckX;
    addMesh(room,new THREE.BoxGeometry(4.5,1.1,8),concrete,x,2.4,-7);
    if(section.kind==='pump'){
      const pump=addMesh(room,new THREE.CylinderGeometry(1.8,2,6,10),steel,x,5.9,-7);pump.name='sewer-pressure-pump';
      for(const y of [3.2,7.4,8.8])addMesh(room,new THREE.TorusGeometry(1.85,.14,5,10),rust,x,y,-7).rotation.x=Math.PI/2;
      connectPipe(room,[x,8.9,-7],[x,13.2,-7],.76,rust);connectPipe(room,[x,13.2,-7],[side*9,13.2,-7],.76,rust);
      const valve=new THREE.Group();valve.position.set(x-side*1.8,6,-7);valve.rotation.y=side*Math.PI/2;room.add(valve);
      addMesh(valve,new THREE.TorusGeometry(.82,.10,5,10),rust);for(let i=0;i<3;i++){const spoke=addMesh(valve,new THREE.BoxGeometry(.10,1.55,.10),rust);spoke.rotation.z=i*Math.PI/3;}
      const gauge=addMesh(room,new THREE.CylinderGeometry(.36,.36,.12,12),light,x-side*1.87,7.6,-7);gauge.rotation.z=side*Math.PI/2;
    }else{
      for(let index=0;index<3;index++){
        const z=-12+index*4.5;addMesh(room,new THREE.BoxGeometry(2.4,5.2,2.7),steel,x,5,z);
        addMesh(room,new THREE.BoxGeometry(.06,1.6,1.9),dark,x-side*1.23,5.9,z);
        for(let stripe=0;stripe<4;stripe++)addMesh(room,new THREE.BoxGeometry(.08,.12,1.55),rust,x-side*1.28,5.3+stripe*.35,z);
      }
    }
  }
  // The working bridge is deliberately high above the largest normal jump.
  // Nothing decorative crosses the rider lane below this clearance.
  const bridgeY=section.kind==='pump'?11.8:10.8,span=Math.min(profile.radius*2-1,41);
  const bridge=addMesh(room,new THREE.BoxGeometry(span,.45,2.6),steel,0,bridgeY,9);bridge.name='overhead-maintenance-bridge';bridge.userData.clearance=bridgeY-.225;
  for(const z of [7.8,10.2]){
    connectPipe(room,[-span/2,bridgeY+1.65,z],[span/2,bridgeY+1.65,z],.055,rust);
    for(let x=-span/2;x<=span/2;x+=3.5)connectPipe(room,[x,bridgeY,z],[x,bridgeY+1.7,z],.055,steel);
  }
  if(trackId==='sewer-depths'&&section.kind==='pump'){
    const fanHousing=new THREE.Group();fanHousing.position.set(-deckX,10.3,8);fanHousing.rotation.y=Math.PI/2;room.add(fanHousing);
    addMesh(fanHousing,new THREE.CylinderGeometry(3.5,3.5,.9,14),dark).rotation.x=Math.PI/2;
    addMesh(fanHousing,new THREE.TorusGeometry(3.5,.22,5,14),steel,0,0,.5);
    const fan=new THREE.Group();fan.position.z=.56;fanHousing.add(fan);room.userData.fan=fan;
    for(let index=0;index<5;index++){const bladeGroup=new THREE.Group();bladeGroup.rotation.z=index*TAU/5;fan.add(bladeGroup);addMesh(bladeGroup,new THREE.BoxGeometry(.85,2.5,.16),rust,.25,1.5,0).rotation.z=-.55;}
    addMesh(fan,new THREE.SphereGeometry(.5,8,5),steel);
  }
  const sign=makeLabel(section.name,trackId==='sewer-depths'?'#8dc1b5':'#ddbd83');sign.scale.set(8.4,2.1,1);sign.position.set(0,bridgeY-1.45,10.4);room.add(sign);
  return room;
}

function makeOutfall(section,course,trackId,materials){
  const group=new THREE.Group(),distance=(section.start+section.end)/2,profile=sewerTunnelProfile(distance,trackId),height=profile.ceiling-1;
  group.name=`sewer-landmark-${section.id}`;group.userData={distance,section:section.id,kind:section.kind};positionAlong(group,distance,0,0,trackId);
  const sky=addMesh(group,new THREE.PlaneGeometry(15,24),new THREE.MeshBasicMaterial({color:trackId==='sewer-depths'?0x9aafa5:0xe8d3a6,side:THREE.DoubleSide}),0,height+1,0);sky.rotation.x=-Math.PI/2;
  for(let z=-10;z<=10;z+=2)connectPipe(group,[-8,height,z],[8,height,z],.12,materials.steel);
  for(const x of [-8,8])connectPipe(group,[x,height,-12],[x,height,12],.22,materials.rust);
  const shaftMaterial=new THREE.MeshBasicMaterial({color:trackId==='sewer-depths'?0xc2ddd2:0xffdfaa,transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  for(let i=0;i<3;i++){
    const vertices=[-5+i*4,height,-9,-7+i*4,0,5,-4+i*4,0,8,-5+i*4,height,-9,-4+i*4,0,8,-2+i*4,height,-9];
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));addMesh(group,geometry,shaftMaterial);
  }
  const sign=makeLabel(section.name);sign.position.set(0,10,-15);sign.scale.set(8,2,1);group.add(sign);return group;
}

export function createSewerWorld(playerProfile) {
  const group = new THREE.Group(); group.name = 'sewer-tracks'; group.visible = false;
  let course = null, trackId = null, player = playerProfile, opponent = null, opponentLabel = null, disposed = false,rivalKey='';
  let water = [], rings = [], hazards = [], props = [], shortcutSigns = [], materials = [], style = sewerTrackStyle('sewer-run');
  const resources = new Set();
  function clear() {
    if (opponent) { group.remove(opponent.rig); disposeSurfer(opponent); }
    group.traverse(object => { if (object.geometry) resources.add(object.geometry); for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) { resources.add(material); if (material.map) resources.add(material.map); } });
    for (const resource of resources) resource.dispose(); resources.clear(); group.clear();
    water = []; rings = []; hazards = []; props = []; shortcutSigns = []; materials = []; opponent = null; opponentLabel = null; course = null;rivalKey=''; group.visible = false;
  }
  function prepare(game) {
    clear(); course = game.course; trackId = game.trackId || course.trackId || 'sewer-run'; style = sewerTrackStyle(trackId);
    rivalKey=JSON.stringify([game.rival?.id,game.rival?.name,game.rival?.profile,!!game.opponent]);
    const wall = [
      new THREE.MeshLambertMaterial({color:style.pressure?0x887f68:style.wall,map:masonryTexture(false),vertexColors:true,flatShading:true,side:THREE.DoubleSide}),
      new THREE.MeshLambertMaterial({color:style.pressure?0x61716d:0x778074,map:masonryTexture(true),vertexColors:true,flatShading:true,side:THREE.DoubleSide}),
      new THREE.MeshLambertMaterial({color:style.pressure?0x82918b:0xa19e89,map:masonryTexture(false),vertexColors:true,flatShading:true,side:THREE.DoubleSide}),
    ];
    const rust = new THREE.MeshLambertMaterial({ color: style.rust, flatShading: true });
    const steel = new THREE.MeshLambertMaterial({ color: style.pressure ? 0x354b48 : 0x48534a, flatShading: true });
    const concrete=new THREE.MeshLambertMaterial({color:style.pressure?0x737f73:0x8d8e76,map:masonryTexture(true),side:THREE.DoubleSide,flatShading:true});
    const dark=new THREE.MeshLambertMaterial({color:0x20332d,flatShading:true});
    const light = new THREE.MeshBasicMaterial({ color: style.light });
    const mainSamples=tunnelSamples(course,trackId),branchSamples=(course.shortcuts||[]).map(shortcut=>tunnelSamples(course,trackId,shortcut));
    const tunnel = addMesh(group, pipeGeometry(course, -45, course.length + 80, trackId,null,branchSamples), wall); tunnel.name = 'sewer-main-pipe'; tunnel.userData = { radius: SEWER_TUNNEL_RADIUS, centreY: SEWER_TUNNEL_CENTRE_Y };
    const addWater=(start,end,path=null)=>{
      const geometry=waterGeometry(start,end,trackId,path,mainSamples),cuts=[],cutEnds=[];
      if(!path){
        const bounds=geometry.boundingBox;
        for(const samples of branchSamples)for(let i=0;i<samples.length-1;i+=2){
          const a=samples[i],b=samples[Math.min(i+2,samples.length-1)];
          if(Math.hypot(b.x-a.x,b.z-a.z)<.001)continue;
          if(Math.max(a.x,b.x)<bounds.min.x-4||Math.min(a.x,b.x)>bounds.max.x+4||Math.max(a.z,b.z)<bounds.min.z-4||Math.min(a.z,b.z)>bounds.max.z+4)continue;
          cuts.push(new THREE.Vector4(a.x,a.z,b.x,b.z));
          cutEnds.push(new THREE.Vector2(i===0?1:0,i+2>=samples.length-1?1:0));
        }
      }
      const material=waterMaterial(style,cuts,cutEnds),stream=addMesh(group,geometry,material);materials.push(material);water.push(stream);
      stream.name=path?`shortcut-water-${path.id}-${Math.round(start)}`:`sewer-green-water-${Math.round(start)}`;stream.userData={pathId:path?.id||'main',start,end};
      return stream;
    };
    for(let start=-45;start<course.length+80;start+=SEWER_WATER_CHUNK_LENGTH)addWater(start,Math.min(course.length+80,start+SEWER_WATER_CHUNK_LENGTH));
    water[0].name='sewer-green-water';
    for(const side of [-1,1]){
      const deck=addMesh(group,deckGeometry(course,trackId,side,branchSamples),concrete);deck.name=`sewer-maintenance-deck-${side}`;deck.userData.innerBoundary=course.halfWidth+.88;
      for(let conduit=0;conduit<2;conduit++){
        const pipe=addMesh(group,serviceConduitGeometry(course,trackId,side*(8.2+conduit*1.3),13.4-conduit*.9,conduit?.30:.55),conduit?steel:rust);pipe.name=`sewer-continuous-service-pipe-${side}-${conduit}`;
      }
    }
    const ribGeometry = new THREE.TorusGeometry(1,.012,5,28),lampGeometry = new THREE.BoxGeometry(.18,.28,1.5);
    const poolMaterial=new THREE.MeshBasicMaterial({color:style.light,map:lightPoolTexture(),transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    for (let distance = -14, i = 0; distance < course.length + 65; distance += 42, i++) {
      const profile=sewerTunnelProfile(distance,trackId),section=new THREE.Group();section.name=`sewer-service-bay-${i}`;section.userData.distance=distance;group.add(section);
      positionAlong(section, distance, 0, 0, trackId); props.push(section);
      // A full reinforcement rib is omitted throughout an intersecting branch
      // junction. Its interior must remain just as clear as the carved shell.
      const atJunction=(course.shortcuts||[]).some(shortcut=>distance>shortcut.start-24&&distance<shortcut.end+24);
      if(!atJunction){const rib=addMesh(section,ribGeometry,profile.section.kind==='masonry'?concrete:steel,0,profile.centerY,0);rib.name=`sewer-structural-arch-${i}`;rib.scale.set(profile.radius-.2,profile.radius-.2,profile.radius-.2);}
      for (const side of [-1, 1]) {
        const wallX=profile.radius-.4;
        addMesh(section,new THREE.BoxGeometry(.42,.65,2.0),steel,side*wallX,7,0);
        addMesh(section,lampGeometry,light,side*(wallX-.23),7,0);
        const glow=addMesh(section,new THREE.PlaneGeometry(5.2,6.8),poolMaterial,side*(wallX-.26),7,0);glow.rotation.y=side*Math.PI/2;
        const floorGlow=addMesh(section,new THREE.PlaneGeometry(3.5,5.5),poolMaterial,side*(course.halfWidth+1.7),1.875,0);floorGlow.rotation.x=-Math.PI/2;
        if(!atJunction){
          const lane=side*(course.halfWidth+1.12);
          connectPipe(section,[lane,2.0,-8],[lane,3.45,-8],.06,steel);connectPipe(section,[lane,2.0,8],[lane,3.45,8],.06,steel);connectPipe(section,[lane,3.4,-8],[lane,3.4,8],.055,rust);
        }
      }
    }
    for(const [index,section]of (course.sections||[]).entries()){
      if(section.chamber){const landmark=section.kind==='outfall'?makeOutfall(section,course,trackId,{steel,rust,light,concrete,dark}):makeMachinery(section,course,trackId,{steel,rust,light,concrete,dark});group.add(landmark);props.push(landmark);}
      const marker=new THREE.Group(),distance=section.start+24,profile=sewerTunnelProfile(distance,trackId);marker.name=`sewer-sector-sign-${section.id}`;marker.userData.distance=distance;positionAlong(marker,distance,0,0,trackId);
      const sign=makeLabel(`${String(index+1).padStart(2,'0')} / ${section.name}`,style.pressure?'#9bc6ba':'#dab880');sign.position.set(0,10.5,0);sign.scale.set(7.6,1.9,1);marker.add(sign);
      connectPipe(marker,[-Math.min(profile.radius-1,12),11.65,0],[Math.min(profile.radius-1,12),11.65,0],.09,steel);group.add(marker);props.push(marker);
    }
    for (const shortcut of course.shortcuts || []) {
      const branch = addMesh(group, pipeGeometry(course, shortcut.start, shortcut.end, trackId, shortcut,[mainSamples]), wall); branch.name = `shortcut-pipe-${shortcut.id}`; branch.userData = { shortcutId: shortcut.id, start: shortcut.start, end: shortcut.end };
      for(let start=shortcut.start;start<shortcut.end;start+=SEWER_WATER_CHUNK_LENGTH)addWater(start,Math.min(shortcut.end,start+SEWER_WATER_CHUNK_LENGTH),shortcut);
      for(let distance=shortcut.start+20;distance<shortcut.end-16;distance+=28){
        const profile=renderTunnelProfile(distance,trackId,shortcut),centre=sewerPoint(distance,shortcut.entryX,3,trackId,shortcut),main=projectToSamples(centre,mainSamples);
        const mouth=new THREE.Group();positionAlong(mouth,distance,shortcut.entryX,3,trackId,shortcut);mouth.userData.distance=distance;group.add(mouth);props.push(mouth);
        // Only isolated pipe sections get a collar: never put a complete hoop
        // back into the opening that the main/branch union just cleared.
        if(main&&Math.abs(main.x)>sewerTunnelProfile(main.distance,trackId).radius+profile.radius){
          addMesh(mouth,new THREE.TorusGeometry(4.88,.12,5,20),steel);
        }
        for(const side of [-1,1]){
          addMesh(mouth,new THREE.BoxGeometry(.16,.2,2.3),light,side*4.45,1,0);
          const pool=addMesh(mouth,new THREE.PlaneGeometry(2.8,3.8),poolMaterial,side*4.5,1,0);pool.rotation.y=side*Math.PI/2;
        }
      }
      const sign = makeLabel(`${shortcut.entryX < 0 ? '◀ ' : ''}${shortcut.name}${shortcut.entryX > 0 ? ' ▶' : ''}`, '#b6d493');
      positionAlong(sign, shortcut.start - 18, shortcut.entryX * .88, 4.6, trackId);sign.scale.set(4.0,1.0,1);sign.userData.distance = shortcut.start; group.add(sign); shortcutSigns.push(sign);
      for (let arrow = 0; arrow < 3; arrow++) {
        const marker = addMesh(group,new THREE.ConeGeometry(.20,.75,3),light);
        positionAlong(marker,shortcut.start-15+arrow*5,shortcut.entryX,1.3,trackId);marker.rotation.z=shortcut.entryX>0?-Math.PI/2:Math.PI/2;
        marker.userData.distance = shortcut.start; props.push(marker);
      }
    }
    for (const checkpoint of [...(course.checkpoints || []),{index:course.checkpoints.length,distance:course.length,x:0,radius:10.9,finish:true}]) { const ring = makeRing(checkpoint); rings.push(ring); group.add(ring.group); }
    for (const item of course.hazards || []) { const mesh = hazardMesh(item, style,trackId); hazards.push({ mesh, item }); group.add(mesh); }
    if (game.opponent && typeof document !== 'undefined') {
      opponent = createSurfer(rivalProfile(game.rival, player)); opponent.rig.name = 'sewer-rival'; group.add(opponent.rig);
      opponentLabel = makeLabel(game.rival?.name || 'RIVAL', '#efbc63'); opponentLabel.scale.set(1.8, .45, 1); group.add(opponentLabel);
    }
    group.visible = true;
  }
  function update(game, time, dt = 1 / 60) {
    if (disposed) return;
    if (!game.isSewer || !game.course) { group.visible = false; return; }
    if (course !== game.course || trackId !== game.trackId||rivalKey!==JSON.stringify([game.rival?.id,game.rival?.name,game.rival?.profile,!!game.opponent])) prepare(game);
    group.visible = true;
    const whirlpools=hazards.filter(({item})=>item.type==='whirlpool'&&item.distance>game.distance-60&&item.distance<game.distance+SEWER_DRAW_AHEAD).sort((a,b)=>Math.abs(a.item.distance-game.distance)-Math.abs(b.item.distance-game.distance)).slice(0,SEWER_WHIRLPOOL_MASKS);
    for (const material of materials){
      material.uniforms.time.value = time;material.uniforms.holeCount.value=whirlpools.length;
      for(let i=0;i<whirlpools.length;i++){
        const {item,mesh}=whirlpools[i],point=sewerPoint(item.distance,item.x,0,trackId,item.path==='main'?null:item.path);
        material.uniforms.holes.value[i].set(point.x,point.z,mesh.userData.radiusX,mesh.userData.radiusZ);material.uniforms.holeAngles.value[i]=point.heading;
      }
    }
    for (const stream of water) {
      const { samples, path,start,end } = stream.geometry.userData, positions = stream.geometry.attributes.position;
      stream.visible=end>game.distance-75&&start<game.distance+SEWER_DRAW_AHEAD;if(!stream.visible)continue;
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];let height=sewerWaterHeight(sample.x, sample.distance, time, trackId, path);
        if(sample.main&&sample.seamBlend>0)height=THREE.MathUtils.lerp(height,sewerWaterHeight(sample.main.x,sample.main.distance,time,trackId),sample.seamBlend);
        positions.setY(i,height);
      }
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
      if (item.type === 'whirlpool') mesh.userData.swirl.rotation.y=time*-.7;
      if (item.type === 'driftwood') mesh.rotation.z = Math.sin(time * 2 + item.distance) * .035;
      if (item.type === 'barrel') {
        const timing = game.hazardStates?.get?.(item.id), state = sewerBarrelState(item, time, timing);
        const closure = clamp01(state.closure ?? 1 - (state.opening ?? 1));
        if(mesh.visible){updateClosingWave(mesh.userData.roll.geometry,item,trackId,time,closure);mesh.userData.roll.material.uniforms.time.value=time;}
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
