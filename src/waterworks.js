import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { retroMaterial } from './appearance.js';
import { createClassicLogoCanvas } from './classic-logo.js';
import * as PARK from './park.js';

const TAU = Math.PI * 2;
const mesh = (g, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); g.add(m); return m;
};
function worldUV(geometry, scale = 7) {
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  if (!p || !n) return geometry;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    uv[i * 2] = (nx > ny && nx > nz ? p.getZ(i) : p.getX(i)) / scale;
    uv[i * 2 + 1] = (ny > nx && ny > nz ? p.getZ(i) : p.getY(i)) / scale;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
}
const box = (g, material, x, y, z, w, h, d) => mesh(g, worldUV(new THREE.BoxGeometry(w, h, d)), material, x, y, z);
function tube(g, material, a, b, radius = .15, sides = 8) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const m = mesh(g, worldUV(new THREE.CylinderGeometry(radius, radius, delta.length(), sides)), material);
  m.position.copy(start.add(end).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
}
function texture(kind = 'concrete') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  const palette = kind === 'rust' ? ['#926447', '#452f25', '#c98c59']
    : kind === 'flow' ? ['#667965', '#394d40', '#b1b998'] : ['#bfc1ae', '#65705e', '#e0ddc6'];
  c.fillStyle = palette[0]; c.fillRect(0, 0, 128, 128);
  let seed = kind === 'rust' ? 73 : 991;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 950; i++) {
    c.globalAlpha = .05 + random() * .15; c.fillStyle = palette[i % 2 + 1];
    c.fillRect(Math.floor(random() * 128), Math.floor(random() * 128), 1 + Math.floor(random() * 4), 1 + Math.floor(random() * 5));
  }
  c.globalAlpha = .25;
  if (kind === 'rust') {
    for (let i = 0; i < 20; i++) { c.fillStyle = i % 2 ? palette[1] : palette[2]; c.fillRect(i * 7, 0, 1 + i % 3, 28 + (i * 31) % 96); }
    c.fillStyle = '#2d2920'; c.fillRect(0, 0, 128, 2);
  } else if (kind === 'flow') {
    for (let i = 0; i < 20; i++) { c.fillStyle = i % 2 ? palette[1] : palette[2]; c.fillRect((i * 29) % 128, 0, 2 + i % 4, 128); }
  } else {
    c.fillStyle = palette[1]; c.fillRect(0, 0, 128, 2); c.fillRect(0, 63, 128, 1); c.fillRect(0, 0, 1, 128);
    for (let i = 0; i < 12; i++) c.fillRect((i * 19) % 128, 2, 1 + i % 3, 6 + (i * 17) % 51);
  }
  c.globalAlpha = 1;
  const map = new THREE.CanvasTexture(canvas); map.wrapS = map.wrapT = THREE.RepeatWrapping;
  // Pixelated close up, filtered mip levels far away: stable concrete instead of
  // the old animated nearest-filter floor and overlapping coplanar grid decals.
  map.magFilter = THREE.NearestFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.colorSpace = THREE.SRGBColorSpace; return map;
}
function sign(g, text, x, y, z, width = 22, height = 3.4, rotation = 0, color = '#ded5a7') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const c = canvas.getContext('2d'); c.fillStyle = '#263027'; c.fillRect(0, 0, 512, 96);
  c.strokeStyle = '#8e9377'; c.lineWidth = 5; c.strokeRect(4, 4, 504, 88);
  c.fillStyle = color; c.font = 'bold 35px Arial'; c.textAlign = 'center'; c.fillText(text, 256, 61);
  for (let i = 0; i < 55; i++) { c.fillStyle = '#17231955'; c.fillRect((i * 137) % 512, (i * 23) % 96, 4, 2); }
  const map = new THREE.CanvasTexture(canvas); map.magFilter = THREE.NearestFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  const m = mesh(g, new THREE.PlaneGeometry(width, height), new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }), x, y, z);
  m.rotation.y = rotation; return m;
}
function addTerrain(g, material) {
  const { PARK_BOUNDS: b, parkHeight } = PARK;
  const width = b.maxX - b.minX, length = b.maxZ - b.minZ;
  const nx = Math.ceil(width / 1.2), nz = Math.ceil(length / 1.2), dx = width / nx, dz = length / nz;
  const positions = [], uvs = [], colors = [], indices = [];
  const dry = new THREE.Color('#b6b6a0'), wet = new THREE.Color('#92a08c'), water = new THREE.Color('#91afa0'), crest = new THREE.Color('#d3d6b8');
  const vertex = (x, z, biasX = 0, biasZ = 0, overrideY) => {
    if (Math.abs(x) < 1e-7) x = 0;
    if (Math.abs(z) < 1e-7) z = 0;
    const y = overrideY ?? parkHeight(x + biasX, z + biasZ);
    const base = PARK.parkTerrainHeight ? PARK.parkTerrainHeight(x + biasX, z + biasZ) : 0;
    const lift = Math.max(0, y - base), color = dry.clone().lerp(wet, THREE.MathUtils.clamp(-y / 2.2, 0, 1));
    if (lift > .1) color.lerp(water, Math.min(1, lift / .7));
    if (lift > 6) color.lerp(crest, Math.min(.5, (lift - 6) * .1));
    const stain = .94 + Math.sin(x * .057 + z * .037) * .025 + Math.sin(z * .17 - x * .13) * .018;
    color.multiplyScalar(stain * (Math.abs(x) > width * .29 ? .94 : 1));
    const index = positions.length / 3;
    positions.push(x, y, z); uvs.push(x / 12, z / 12); colors.push(color.r, color.g, color.b); return index;
  };
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) vertex(b.minX + ix * dx, b.minZ + iz * dz);

  // Cells crossing a hard ramp lip are split on its exact collision boundary.
  // Both sides share X/Z but sample opposite heights; a vertical face closes
  // the seam. A coarse ordinary heightfield would draw a sloping fake wall one
  // cell beyond the real collision, letting riders disappear into that slope.
  const seams = new Map(), EPS = .00012;
  const queueSeam = (a,d,normalX,normalZ) => {
    const line = { x:a.x,z:a.z,nx:normalX,nz:normalZ };
    const x0 = Math.max(0,Math.floor((Math.min(a.x,d.x)-b.minX)/dx)-1), x1 = Math.min(nx-1,Math.floor((Math.max(a.x,d.x)-b.minX)/dx)+1);
    const z0 = Math.max(0,Math.floor((Math.min(a.z,d.z)-b.minZ)/dz)-1), z1 = Math.min(nz-1,Math.floor((Math.max(a.z,d.z)-b.minZ)/dz)+1);
    for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){
      const key=iz*nx+ix;if(!seams.has(key))seams.set(key,[]);seams.get(key).push(line);
    }
  };
  for (const ramp of PARK.PARK_RAMPS) {
    const c = Math.cos(ramp.rotation), s = Math.sin(ramp.rotation);
    const point = (u,v) => ({ x:ramp.x+u*c-v*s,z:ramp.z-u*s-v*c });
    if (['quarter','kicker','access'].includes(ramp.type)) {
      queueSeam(point(-ramp.width/2,ramp.length/2),point(ramp.width/2,ramp.length/2),-s,-c);
    }
    // The outer edge and the inner end of each 1.35m side bevel are exact
    // break-lines, including on diagonally rotated kickers. Without these cuts,
    // a grid cell can begin climbing before the physical ramp even starts.
    for(const side of [-1,1])for(const inset of [0,1.35]){
      const u=side*(ramp.width/2-inset);
      queueSeam(point(u,-ramp.length/2),point(u,ramp.length/2),c,-s);
    }
  }
  const distance=(p,line)=>(p.x-line.x)*line.nx+(p.z-line.z)*line.nz;
  const clip=(points,line,side)=>{
    const out=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],d=points[(i+1)%points.length],da=distance(a,line)*side,dd=distance(d,line)*side;
      if(da>=-1e-8)out.push(a);
      if((da>1e-8&&dd<-1e-8)||(da<-1e-8&&dd>1e-8)){
        const t=da/(da-dd);out.push({x:a.x+(d.x-a.x)*t,z:a.z+(d.z-a.z)*t});
      }
    }
    return out;
  };
  const terrainTriangle=(points,bx,bz,depth=0)=>{
    const heights=points.map(p=>parkHeight(p.x+bx,p.z+bz));
    const middle=points.map((p,i)=>{const q=points[(i+1)%3];return {x:(p.x+q.x)/2,z:(p.z+q.z)/2};});
    let error=0;
    for(let i=0;i<3;i++)error=Math.max(error,Math.abs(parkHeight(middle[i].x+bx,middle[i].z+bz)-(heights[i]+heights[(i+1)%3])/2));
    const center={x:(points[0].x+points[1].x+points[2].x)/3,z:(points[0].z+points[1].z+points[2].z)/3};
    error=Math.max(error,Math.abs(parkHeight(center.x+bx,center.z+bz)-(heights[0]+heights[1]+heights[2])/3));
    // Fixed-base pipe access ramps blend into a curved channel with max().
    // Refine that extra, implicit join locally instead of smoothing it over.
    if(error>.018&&depth<5){
      terrainTriangle([points[0],middle[0],middle[2]],bx,bz,depth+1);
      terrainTriangle([middle[0],points[1],middle[1]],bx,bz,depth+1);
      terrainTriangle([middle[2],middle[1],points[2]],bx,bz,depth+1);
      terrainTriangle([middle[0],middle[1],middle[2]],bx,bz,depth+1);
    }else indices.push(...points.map((p,i)=>vertex(p.x,p.z,bx,bz,heights[i])));
  };
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const a = iz * (nx + 1) + ix, c = a + nx + 1, lines=seams.get(iz*nx+ix);
    if(!lines){indices.push(a,c,a+1,a+1,c,c+1);continue;}
    const x=b.minX+ix*dx,z=b.minZ+iz*dz;
    let parts=[{points:[{x,z},{x:x+dx,z},{x:x+dx,z:z+dz},{x,z:z+dz}],bx:0,bz:0}];
    for(const line of lines){
      const next=[];
      for(const part of parts){
        const distances=part.points.map(p=>distance(p,line));
        if(Math.min(...distances)>1e-7||Math.max(...distances)<-1e-7){next.push(part);continue;}
        const cut=[];
        for(let i=0;i<part.points.length;i++){
          const p=part.points[i],q=part.points[(i+1)%part.points.length],dp=distance(p,line),dq=distance(q,line);
          if(Math.abs(dp)<1e-7)cut.push(p);
          if(dp*dq<-1e-14){const t=dp/(dp-dq);cut.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}
        }
        const unique=cut.filter((p,i)=>!cut.slice(0,i).some(q=>Math.hypot(p.x-q.x,p.z-q.z)<1e-7));
        if(unique.length>=2&&Math.max(...distances)>1e-7){
          const p=unique[0],q=unique[1];
          const loP=parkHeight(p.x-line.nx*EPS,p.z-line.nz*EPS),hiP=parkHeight(p.x+line.nx*EPS,p.z+line.nz*EPS);
          const loQ=parkHeight(q.x-line.nx*EPS,q.z-line.nz*EPS),hiQ=parkHeight(q.x+line.nx*EPS,q.z+line.nz*EPS);
          if(Math.max(Math.abs(loP-hiP),Math.abs(loQ-hiQ))>.02){
            const ids=[vertex(p.x,p.z,0,0,loP),vertex(q.x,q.z,0,0,loQ),vertex(p.x,p.z,0,0,hiP),vertex(q.x,q.z,0,0,hiQ)];
            indices.push(ids[0],ids[2],ids[1],ids[1],ids[2],ids[3]);
          }
        }
        for(const side of [-1,1]){
          const points=clip(part.points,line,side);
          if(points.length<3)continue;
          const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.z-q.x*p.z;},0);
          if(Math.abs(area)<1e-9)continue;
          next.push({points,bx:part.bx+line.nx*EPS*side,bz:part.bz+line.nz*EPS*side});
        }
      }
      parts=next;
    }
    for(const part of parts)for(let i=1;i<part.points.length-1;i++)terrainTriangle([part.points[0],part.points[i+1],part.points[i]],part.bx,part.bz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  material.vertexColors = true; material.side = THREE.DoubleSide;
  const floor = mesh(g, geo, material); floor.name = 'unified-collision-terrain';
  floor.userData.terrain = true; return floor;
}
function localPoint(object, u, y, v) {
  const c = Math.cos(object.rotation), s = Math.sin(object.rotation);
  return [object.x + u * c - v * s, y, object.z - u * s - v * c];
}
function pipeShell(g, pipe, outer, inner, flange, bolt) {
  // Forty flat faces keep the original faceted appearance while matching the
  // circular wall-ride contact surface to within 2cm throughout a full loop.
  const radius = pipe.radius, inside = radius - pipe.thickness, segments = 40;
  const cylinder = (r, material) => {
    const geo = new THREE.CylinderGeometry(r, r, pipe.length, segments, Math.ceil(pipe.length / 8), true);
    geo.rotateX(Math.PI / 2); geo.rotateY(pipe.rotation);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 5, uv.getY(i) * pipe.length / 9);
    const body = mesh(g, geo, material, pipe.x, pipe.centerY, pipe.z);
    body.userData.pipe = pipe.id; return body;
  };
  cylinder(radius, outer); cylinder(inside, inner);
  // Annular end faces have a real central opening. There are no cylinder caps,
  // hidden discs, support poles in the bore, or floor planes through the pipe.
  for (const end of [-1, 1]) {
    const p = localPoint(pipe, 0, pipe.centerY, end * pipe.length / 2);
    const ring = mesh(g, new THREE.RingGeometry(inside, radius, segments), flange, ...p); ring.rotation.y = pipe.rotation;
    for (let j = 0; j < 12; j++) {
      const theta = j / 12 * TAU, r = radius - pipe.thickness * .42;
      const q = localPoint(pipe, Math.cos(theta) * r, pipe.centerY + Math.sin(theta) * r, end * (pipe.length / 2 + .055));
      mesh(g, new THREE.IcosahedronGeometry(.11, 0), bolt, ...q);
    }
    // A recessed lamp above each mouth helps the hollow opening read in shadow.
    const lamp = localPoint(pipe, 0, pipe.centerY + radius + .7, end * pipe.length / 2);
    box(g, flange, lamp[0], lamp[1], lamp[2], 2.3, .65, .75);
    box(g, bolt, lamp[0], lamp[1] - .35, lamp[2], 1.7, .08, .5);
  }
  // The repeating plate texture supplies body seams without raised collars that
  // would protrude through the otherwise exact, rideable cylindrical surface.
}
function railBody(g, rail, material) {
  const radius = rail.radius || .18, sides = 8;
  const sections = rail.kind === 'coping' ? Math.ceil(rail.length / .75) : 1;
  const positions = [], uvs = [], indices = [];
  const top = local => PARK.railTopHeight ? PARK.railTopHeight(rail, local) : rail.height;
  // Each section stays vertical: physics measures radius in the across/Y
  // plane, not perpendicular to the changing slope of a coping's centreline.
  // The upper vertex therefore follows railTopHeight exactly at every sample.
  for (let i = 0; i <= sections; i++) {
    const local = (i / sections - .5) * rail.length;
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * TAU;
      positions.push(...localPoint(rail, Math.sin(angle) * radius,
        top(local) - radius + Math.cos(angle) * radius, local));
      uvs.push(local / 3, j / sides);
    }
  }
  for (let i = 0; i < sections; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + 1, c = a + sides + 1, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  for (const end of [0, sections]) {
    const local = (end / sections - .5) * rail.length, center = positions.length / 3;
    positions.push(...localPoint(rail, 0, top(local) - radius, local)); uvs.push(.5,.5);
    for (let j = 0; j < sides; j++) {
      const a = end * (sides + 1) + j;
      indices.push(center, end === 0 ? a + 1 : a, end === 0 ? a : a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices); geo.computeVertexNormals();
  const body = mesh(g,geo,material); body.userData.rail = rail.id; return body;
}
function batchStatic(group, animated) {
  const batches = new Map(); group.updateMatrixWorld(true);
  for (const item of [...group.children]) {
    if (!item.isMesh || animated.has(item) || item.userData.terrain) continue;
    // Normalize indexing because primitive cylinders, boxes and rings differ.
    let geo = item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone();
    geo.applyMatrix4(item.matrix);
    const key = item.material.uuid + ':' + Object.keys(geo.attributes).sort().join(',');
    if (!batches.has(key)) batches.set(key, { material: item.material, geometries: [] });
    batches.get(key).geometries.push(geo); item.geometry.dispose(); group.remove(item);
  }
  for (const batch of batches.values()) {
    const merged = mergeGeometries(batch.geometries, false);
    if (merged) mesh(group, merged, batch.material);
    for (const geo of batch.geometries) geo.dispose();
  }
}

export function createWaterworks() {
  const group = new THREE.Group(); group.name = 'the-waterworks-sunken-basin';
  const b = PARK.PARK_BOUNDS, width = b.maxX - b.minX, length = b.maxZ - b.minZ;
  const concreteMap = texture(), floorMap = texture(), rustMap = texture('rust');
  const concrete = retroMaterial('#78806a', concreteMap), paleConcrete = retroMaterial('#a4a68b', concreteMap);
  const damp = retroMaterial('#38493b', concreteMap), dark = retroMaterial('#26372e'), metal = retroMaterial('#606953');
  const rust = retroMaterial(0xffffff, rustMap), darkRust = retroMaterial('#725d46', rustMap);
  const pale = retroMaterial('#c4c2a0'), yellow = retroMaterial('#bca34e');
  const lamp = new THREE.MeshBasicMaterial({ color: '#cfc78f' });
  const logoMap = new THREE.CanvasTexture(createClassicLogoCanvas());
  logoMap.name = 'classic-breakline-factory-banner';
  logoMap.magFilter = THREE.NearestFilter; logoMap.minFilter = THREE.LinearMipmapLinearFilter;
  logoMap.generateMipmaps = true; logoMap.colorSpace = THREE.SRGBColorSpace;
  const logoMaterial = new THREE.MeshLambertMaterial({ map: logoMap, alphaTest: .1, side: THREE.DoubleSide });
  const waterMap = texture('flow'), flowingWater = retroMaterial('#798773', waterMap); flowingWater.side = THREE.DoubleSide;
  // The rideable ground intentionally skips retroMaterial's vertex snapping:
  // snapping a dense, shallow-angle heightfield can invert tiny screen triangles.
  const terrain = addTerrain(group, new THREE.MeshLambertMaterial({ color: 0xffffff, map: floorMap, flatShading: true }));
  const foam = [], flows = [], logoBanners = [];

  // The entire arena sits at the bottom of a treatment basin. Solid retaining
  // walls begin at the exact playable boundary and rise close above the rider.
  for (const side of [-1, 1]) {
    const x = side < 0 ? b.minX - 4 : b.maxX + 4;
    box(group, damp, x, 1, 0, 8, 8, length + 16);
    box(group, concrete, x, 11, 0, 8, 12, length + 16);
    box(group, paleConcrete, x, 21, 0, 8, 8, length + 16);
    box(group, darkRust, x, 25.25, 0, 10, .5, length + 19);
    // Upper factory floors and loading windows overhang the basin edge.
    box(group, concrete, x + side * 8, 32, -8, 24, 14, length + 30);
    box(group, darkRust, x + side * 8, 39.3, -8, 27, .7, length + 34);
    for (let z = b.minZ + 11; z < b.maxZ; z += 22) {
      const face = x - side * 4.06;
      box(group, dark, face, 31.5, z, .15, 6.2, 11.6);
      box(group, metal, face - side * .1, 31.5, z, .2, .23, 11.8);
      for (const dz of [-3.8, 0, 3.8]) box(group, metal, face - side * .12, 31.5, z + dz, .22, 6.3, .16);
    }
    // Maintenance catwalks stay high above the highest normal riding line.
    const walkwayX = side < 0 ? b.minX + 2.4 : b.maxX - 2.4;
    box(group, darkRust, walkwayX, 20.4, 0, 4.6, .42, length - 8);
    for (let z = b.minZ + 6; z <= b.maxZ - 6; z += 12) {
      tube(group, metal, [walkwayX - side * 2.1, 20.6, z], [walkwayX - side * 2.1, 22, z], .085, 5);
      tube(group, metal, [walkwayX - side * 2.1, 22, z], [walkwayX - side * 2.1, 22, Math.min(z + 12, b.maxZ - 6)], .065, 5);
    }
    for (const z of [-132, -20, 112]) {
      // Runoff falls down the wall; this is the only scrolling texture in the park.
      const mouthX = side < 0 ? b.minX + .3 : b.maxX - .3;
      const drain = mesh(group, new THREE.CylinderGeometry(1.55, 1.55, 4, 10, 1, true), darkRust, mouthX + side, 17, z);
      drain.rotation.z = Math.PI / 2;
      const x0 = mouthX - side, x1 = mouthX - side * 5.5, bottom = PARK.parkHeight(x1, z) + .15;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([x0,16.2,z-1.15,x1,bottom,z-1.7,x0,16.2,z+1.15,x0,16.2,z+1.15,x1,bottom,z-1.7,x1,bottom,z+1.7],3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,4,0,0,1,4,1,4,0,0,1,0],2)); geo.computeVertexNormals();
      flows.push(mesh(group, geo, flowingWater));
      for (let j = 0; j < 3; j++) {
        const f = mesh(group, new THREE.IcosahedronGeometry(.6, 0), pale, x1 + side * (j - 1) * .55, bottom + .06, z + (j - 1) * .85);
        f.scale.set(1.2, .19, 1.3); foam.push({ mesh: f, y: bottom + .06, phase: z + j * 2 });
      }
    }
    sign(group, 'LEVEL -03 / EFFLUENT CHANNEL', side < 0 ? b.minX + .22 : b.maxX - .22, 12, 38, 40, 4.2, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    // Broken roof sections leave a central strip of open sky over the basin.
    for (const z of [-135, -45, 45, 135]) {
      box(group, darkRust, side * (width / 2 - 21), 29, z, 43, .7, 72);
      for (let dz = -32; dz <= 32; dz += 8) box(group, metal, side * (width / 2 - 21), 28.3, z + dz, 43, .5, .22);
    }
  }
  for (const side of [-1, 1]) {
    const z = side < 0 ? b.minZ - 4 : b.maxZ + 4;
    box(group, damp, 0, 1, z, width, 8, 8);
    box(group, concrete, 0, 12, z, width, 14, 8);
    box(group, paleConcrete, 0, 22, z, width, 6, 8);
    box(group, darkRust, 0, 25.4, z, width + 4, .7, 10);
    box(group, concrete, 0, 33, z + side * 8.5, width + 14, 16, 25);
    for (let x = -width / 2 + 15; x < width / 2; x += 24) {
      box(group, dark, x, 32, z - side * 4.08, 15, 7, .16);
      box(group, metal, x, 32, z - side * 4.2, 15, .22, .2);
      box(group, metal, x, 32, z - side * 4.22, .2, 7, .24);
    }
    sign(group, side < 0 ? 'THE WATERWORKS / LOWER BASIN' : 'NO. 99 / SOUTH OUTFALL', 0, 18, z - side * 4.3, 69, 6, side > 0 ? Math.PI : 0);
    sign(group, side < 0 ? 'STORM SURGE / KEEP CLEAR' : 'RIDE AT YOUR OWN TIDE', -62, 8, z - side * 4.24, 35, 3, side > 0 ? Math.PI : 0, '#c4ac62');
    // The original oval mark mounts flush with the other wall graphics,
    // with its transparent contour showing the concrete underneath.
    const banner = mesh(group, new THREE.PlaneGeometry(25, 10), logoMaterial, 55, 9, z - side * 4.24);
    banner.name = side < 0 ? 'classic-logo-banner-north' : 'classic-logo-banner-south';
    banner.rotation.y = side > 0 ? Math.PI : 0;
    logoBanners.push(banner);
  }

  // Interior columns use the exact collision descriptors, without oversized
  // decorative bases that would make the player pass through visible concrete.
  for (const solid of PARK.PARK_SOLIDS || []) {
    if (solid.type !== 'cylinder') continue;
    const bottom = solid.baseY || 0, h = solid.height || 28, radius = solid.radius;
    mesh(group, worldUV(new THREE.CylinderGeometry(radius, radius, h, 8)), concrete, solid.x, bottom + h / 2, solid.z);
    mesh(group, new THREE.CylinderGeometry(radius + .025, radius + .025, .32, 8), yellow, solid.x, bottom + 1.2, solid.z);
    box(group, metal, solid.x, bottom + h, solid.z, radius * 2, .5, 5);
  }
  for (const z of [-128, -38, 125]) {
    // Huge overhead trusses/cross-pipes make the factory enclose the riding space.
    box(group, darkRust, 0, 27.6, z, width - 18, .7, 1.5);
    box(group, metal, 0, 30, z, width - 18, .5, 1.2);
    for (let x = -width / 2 + 10; x < width / 2 - 18; x += 14) {
      tube(group, darkRust, [x,27.7,z], [x+14,30,z], .18, 5);
      tube(group, darkRust, [x,30,z], [x+14,27.7,z], .18, 5);
    }
    tube(group, darkRust, [-width/2,25.8,z+5], [width/2,25.8,z+5], .95, 10);
    for (let x = -width / 2 + 12; x < width / 2; x += 24) {
      const collar = mesh(group, new THREE.TorusGeometry(1.03,.12,4,10), metal, x,25.8,z+5); collar.rotation.y = Math.PI/2;
      box(group, dark, x,26.9,z-1,4,.45,1.2); box(group,lamp,x,26.64,z-1,3.2,.07,.75);
    }
  }

  // Contact surfaces skip screen-space vertex snapping, just like the ground:
  // the bore stays steady as the rider circles the walls and ceiling.
  const outerPipe = new THREE.MeshLambertMaterial({color:0xffffff,map:rustMap,flatShading:true});
  const innerPipe = new THREE.MeshLambertMaterial({color:'#77654e',map:rustMap,flatShading:true,side:THREE.BackSide});
  const flange = new THREE.MeshLambertMaterial({color:'#6b6550',map:rustMap,flatShading:true,side:THREE.DoubleSide});
  const copingMetal = new THREE.MeshLambertMaterial({color:'#c5c8b1',map:concreteMap,flatShading:true});
  for (const pipe of PARK.PARK_PIPES || []) {
    pipeShell(group, pipe, outerPipe, innerPipe, flange, pale);
    const mouth = localPoint(pipe, 0, pipe.centerY + pipe.radius + 2.35, -pipe.length/2);
    sign(group, pipe.name || 'OUTFALL / THROUGH LINE', ...mouth, 15, 2.1, pipe.rotation);
  }
  for (const rail of PARK.PARK_RAILS) {
    railBody(group,rail,rail.kind === 'coping' ? copingMetal : rust);
    for (const support of PARK.railSupports(rail)) {
      if (support.top > support.bottom + .001) tube(group, metal,
        [support.x,support.bottom,support.z], [support.x,support.top,support.z], support.radius, 6);
    }
  }
  // Foam belongs to actual discharge, not to the stable floor material.
  batchStatic(group, new Set([...foam.map(f => f.mesh), ...flows, ...logoBanners]));
  group.userData.terrainVertexCount = terrain.geometry.attributes.position.count;
  return { group, waterMap, foam, update: time => { waterMap.offset.y = -time * .16; } };
}
