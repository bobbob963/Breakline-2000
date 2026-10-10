import * as THREE from 'three';
import { barrelCrossSection, stormBarrelsNear } from './storm-waves.js';

// A breaking wave is an open sheet: the left foot joins the existing face,
// the crest curls overhead, and the foamy right lip falls into open water.
// Both radii come from the simulation; there are no bottom or end caps.
export const BARREL_ARC_SEGMENTS = 24;
export const BARREL_LENGTH_SEGMENTS = 32;

export function createBarrelGeometry() {
  const rows = BARREL_LENGTH_SEGMENTS + 1, columns = BARREL_ARC_SEGMENTS + 1;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(rows * columns * 2 * 3);
  const uv = new Float32Array(rows * columns * 2 * 2), indices = [];
  for (let layer = 0; layer < 2; layer++) {
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const i = layer * rows * columns + row * columns + column;
      uv[i * 2] = column / BARREL_ARC_SEGMENTS;
      uv[i * 2 + 1] = row / BARREL_LENGTH_SEGMENTS;
      if (row < rows - 1 && column < columns - 1) {
        const a = i, b = i + columns;
        // Inner surface faces the lane; outer surface faces the open ocean.
        if (layer === 0) indices.push(a, a + 1, b, b, a + 1, b + 1);
        else indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  // Just the spilling edge has thickness; open mouths stay visibly open.
  for (let row = 0; row < rows - 1; row++) {
    const a = row * columns, b = a + columns, c = a + rows * columns, d = c + columns;
    indices.push(a, b, c, b, d, c);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return geometry;
}

export function updateBarrelGeometry(geometry, descriptor, time) {
  const p = geometry.attributes.position, columns = BARREL_ARC_SEGMENTS + 1;
  const layerSize = (BARREL_LENGTH_SEGMENTS + 1) * columns;
  for (let row = 0; row <= BARREL_LENGTH_SEGMENTS; row++) {
    const z = -(descriptor.startDistance + descriptor.length * row / BARREL_LENGTH_SEGMENTS);
    const section = barrelCrossSection(descriptor, z, time);
    for (let column = 0; column <= BARREL_ARC_SEGMENTS; column++) {
      const angle = THREE.MathUtils.lerp(section.startAngle, section.endAngle, column / BARREL_ARC_SEGMENTS);
      const cos = Math.cos(angle), sin = Math.sin(angle), index = row * columns + column;
      p.setXYZ(index, section.centerX + cos * section.innerRadius, section.centerY + sin * section.innerRadius, z);
      p.setXYZ(index + layerSize, section.centerX + cos * section.outerRadius, section.centerY + sin * section.outerRadius, z);
    }
  }
  p.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 } },
    side: THREE.DoubleSide,
    vertexShader: `varying vec3 vWorld; varying vec2 vUv;
      void main(){vUv=uv;vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime;uniform float uIntensity;varying vec3 vWorld;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec3 normal=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
        float facet=floor((.5+.5*dot(normal,normalize(vec3(-.3,.9,.4))))*6.)/6.;
        // Backlit turquoise inside, darker blue between broad moving ribbons.
        float ribbon=sin(vUv.x*38.-uTime*2.9+vWorld.z*.33);
        float grain=hash(floor(vec2(vUv.x*80.-uTime*2.8,vWorld.z*.85)));
        vec3 col=mix(vec3(.035,.28,.34),vec3(.18,.66,.65),facet*.65+.2);
        col+=vec3(.04,.10,.09)*step(.55,ribbon);
        col+=vec3(.025,.035,.027)*(grain-.5);
        float sheetLight=pow(max(0.,sin(vUv.x*3.14159)),2.);
        col+=vec3(.035,.12,.11)*sheetLight;
        // The broken crest follows the same falling lip that can hit the rider.
        float lip=1.-smoothstep(.018,.092,vUv.x);
        float froth=lip*(.64+.36*step(.35,grain));
        float lace=step(.985,grain)*smoothstep(.58,.95,vUv.x)*.24;
        col=mix(col,vec3(.78,.9,.82),min(1.,froth+lace));
        col*=1.-uIntensity*.16;
        float fog=smoothstep(90.,235.-uIntensity*45.,length(vWorld-cameraPosition));
        col=mix(col,mix(vec3(.34,.43,.47),vec3(.24,.32,.38),uIntensity),fog);
        gl_FragColor=vec4(floor(col*40.)/40.,1.);
      }`,
  });
}

function createLipGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((BARREL_LENGTH_SEGMENTS + 1) * 2 * 3), uv = [], indices = [];
  for (let i = 0; i <= BARREL_LENGTH_SEGMENTS; i++) {
    uv.push(0, i / BARREL_LENGTH_SEGMENTS, 1, i / BARREL_LENGTH_SEGMENTS);
    if (i < BARREL_LENGTH_SEGMENTS) {const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  return geometry;
}

function updateLip(geometry, descriptor, time) {
  const p = geometry.attributes.position;
  for (let row=0;row<=BARREL_LENGTH_SEGMENTS;row++) {
    const z=-(descriptor.startDistance+descriptor.length*row/BARREL_LENGTH_SEGMENTS);
    const s=barrelCrossSection(descriptor,z,time), a=s.startAngle;
    const x=s.centerX+Math.cos(a)*s.innerRadius,y=s.centerY+Math.sin(a)*s.innerRadius;
    // A ragged, falling fringe, not a sealed side wall. It dissolves below
    // the physical lip and never blocks the view down the hollow barrel.
    const fall=s.envelope*(.48+.36*(.5+.5*Math.sin(z*1.9+time*5.2)));
    p.setXYZ(row*2,x,y,z);p.setXYZ(row*2+1,x+.16*s.envelope,y-fall,z);
  }
  p.needsUpdate=true;geometry.computeBoundingSphere();
}

export function createStormBarrels() {
  const group=new THREE.Group();group.name='storm-barrels';
  const water=waterMaterial();
  const mist=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},side:THREE.DoubleSide,transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float uTime;varying vec2 vUv;varying vec3 vWorld;
      void main(){float thread=sin(vWorld.z*9.+vUv.x*1.3+uTime*5.);if(thread<-.24)discard;
      float alpha=(1.-vUv.x)*.66;alpha*=1.-smoothstep(100.,210.,length(vWorld-cameraPosition));
      gl_FragColor=vec4(.79,.9,.84,alpha);}`,
  });
  const active=new Map();
  function update(distance,time,intensity=0,enabled=true) {
    group.visible=enabled;if(!enabled)return;
    water.uniforms.uTime.value=time;water.uniforms.uIntensity.value=intensity;mist.uniforms.uTime.value=time;
    const nearby=stormBarrelsNear(distance,75,340), ids=new Set(nearby.map(b=>b.id));
    for(const[id,entry]of active)if(!ids.has(id)){
      group.remove(entry.sheet,entry.lip);entry.sheet.geometry.dispose();entry.lip.geometry.dispose();active.delete(id);
    }
    for(const descriptor of nearby){
      let entry=active.get(descriptor.id);
      if(!entry){
        const sheet=new THREE.Mesh(createBarrelGeometry(),water),lip=new THREE.Mesh(createLipGeometry(),mist);
        sheet.name=`barrel-water-${descriptor.index}`;lip.name=`barrel-spindrift-${descriptor.index}`;
        sheet.frustumCulled=lip.frustumCulled=false;group.add(sheet,lip);entry={sheet,lip};active.set(descriptor.id,entry);
      }
      updateBarrelGeometry(entry.sheet.geometry,descriptor,time);updateLip(entry.lip.geometry,descriptor,time);
    }
  }
  return {group,update};
}

// Keep the chase camera in the same clear tube as the surfer, rather than
// allowing a spring arm to pass through the roof and hide the rider in water.
export function resolveBarrelCamera(candidate,distance,time) {
  for(const barrel of stormBarrelsNear(distance,12,12)) {
    const section=barrelCrossSection(barrel,candidate.z,time);
    if(!section.active||section.envelope<.75)continue;
    const dx=candidate.x-section.centerX,dy=candidate.y-section.centerY;
    if(Math.abs(dx)>section.innerRadius+1||dy<-.8*section.innerRadius)continue;
    const radius=Math.hypot(dx,dy),limit=section.innerRadius-.55;
    if(radius>limit){candidate.x=section.centerX+dx/radius*limit;candidate.y=section.centerY+dy/radius*limit;}
  }
  return candidate;
}
