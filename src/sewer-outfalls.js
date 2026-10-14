import * as THREE from 'three';
import { sewerPoint, sewerWaterHeight, sewerTunnelProfile } from './sewer-course.js';

const TAU=Math.PI*2;
const colour=hex=>new THREE.Color().setHex(hex,THREE.LinearSRGBColorSpace);

// Side outlets are scenery: their solid hardware stays well above the riding
// line, while the falling water and foam meet the actual animated canal.
export function sewerOutfallSites(course){
  const sites=[];
  for(let distance=120,index=0;distance<course.length-55;distance+=137,index++){
    if(course.hazards.some(item=>item.type==='barrel'&&Math.abs(item.distance-distance)<55))continue;
    if(course.shortcuts.some(path=>Math.min(Math.abs(path.start-distance),Math.abs(path.end-distance))<26))continue;
    sites.push({distance,side:index%2?1:-1,height:10.2+(index%3)*.45,width:course.halfWidth});
  }
  return sites;
}

function pourGeometry(){
  const rows=28,sides=12,positions=new Float32Array((rows+1)*(sides+1)*3),uv=[],indices=[];
  for(let row=0;row<=rows;row++)for(let side=0;side<=sides;side++){
    uv.push(side/sides,row/rows);
    if(row<rows&&side<sides){const a=row*(sides+1)+side,b=a+sides+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.userData={rows,sides};return geometry;
}

function pourMaterial(style){
  return new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{time:{value:0},water:{value:colour(style.water)},foam:{value:colour(style.foam)},fog:{value:colour(style.fog)},lamp:{value:colour(style.light)}},
    vertexShader:'varying vec2 flow;varying vec3 world;void main(){flow=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader:`uniform float time;uniform vec3 water,foam,fog,lamp;varying vec2 flow;varying vec3 world;
      void main(){float u=flow.x*6.283185,v=flow.y;
        float falling=sin(v*34.-time*10.+sin(u*3.+v*9.)*.8);
        float threads=pow(max(0.,sin(u*9.+sin(v*6.-time*1.8)*.8)),12.);
        float froth=smoothstep(.76,1.,v)*(.25+.15*falling);
        vec3 c=mix(water*1.08,foam,threads*.19+froth);c=mix(c,lamp,pow(max(0.,sin(u+.7)),12.)*.12);
        c=mix(c,fog,smoothstep(90.,265.,length(world-cameraPosition)));
        gl_FragColor=vec4(c,.84-smoothstep(.90,1.,v)*.47);}`});
}
function splashMaterial(style){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0},foam:{value:colour(style.foam)},water:{value:colour(style.water)}},
    vertexShader:'varying vec2 coords;void main(){coords=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float time;uniform vec3 foam,water;varying vec2 coords;void main(){float r=length(coords),a=atan(coords.y,coords.x);float ripple=.5+.5*sin(r*28.-time*6.+sin(a*5.)*.55);float edge=1.-smoothstep(.55,1.,r);float centre=1.-smoothstep(.03,.4,r);float alpha=(centre*.52+pow(ripple,7.)*.26)*edge;gl_FragColor=vec4(mix(water,foam,.62+centre*.28),alpha);}`});
}
function sprayMaterial(style){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{foam:{value:colour(style.foam)}},
    vertexShader:'attribute float fade;varying float alpha;void main(){alpha=fade;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(75./max(1.,-p.z),1.5,7.);}',
    fragmentShader:'uniform vec3 foam;varying float alpha;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(foam,alpha*(1.-smoothstep(.2,1.,r))*.65);}' });
}

export function createSewerOutfalls(course,trackId,style){
  const group=new THREE.Group();group.name='sewer-flowing-outfalls';const outlets=[];
  const steel=new THREE.MeshLambertMaterial({color:0x544c2e,side:THREE.DoubleSide,flatShading:true});
  const rim=new THREE.MeshLambertMaterial({color:style.rust,flatShading:true});
  const inner=new THREE.MeshLambertMaterial({color:0x252618,side:THREE.DoubleSide});
  const sprayGeoPositions=24;
  for(const [index,site]of sewerOutfallSites(course).entries()){
    const {distance,side,height,width}=site,unit=new THREE.Group();unit.name=`sewer-outfall-${index}`;unit.userData={distance,side,height};group.add(unit);
    const frame=sewerPoint(distance,0,0,trackId);unit.position.set(frame.x,0,frame.z);unit.rotation.y=frame.heading;
    const profile=sewerTunnelProfile(distance,trackId),wallX=Math.sqrt(profile.radius**2-(height-profile.centerY)**2)+.5;
    const outletX=side*(width-.15),impactX=outletX-side*1.45;
    const points=[new THREE.Vector3(side*wallX,height+.3,0),new THREE.Vector3(side*(width+1.8),height+.3,0),new THREE.Vector3(outletX,height,0)];
    const curve=new THREE.CatmullRomCurve3(points),shell=new THREE.Mesh(new THREE.TubeGeometry(curve,12,1.02,10,false),steel);shell.name='sewer-outfall-solid-pipe';unit.add(shell);
    const lining=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.87,10,false),inner);unit.add(lining);
    const tangent=curve.getTangent(1).normalize(),collar=new THREE.Mesh(new THREE.TorusGeometry(.95,.13,5,12),rim);
    collar.position.copy(points.at(-1));collar.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);unit.add(collar);
    const pour=new THREE.Mesh(pourGeometry(),pourMaterial(style));pour.name='sewer-waterfall-stream';pour.frustumCulled=false;unit.add(pour);
    const splashGeometry=new THREE.PlaneGeometry(5.5,4.8,8,6);splashGeometry.rotateX(-Math.PI/2);splashGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    const splash=new THREE.Mesh(splashGeometry,splashMaterial(style));splash.position.x=impactX;splash.name='sewer-waterfall-impact';unit.add(splash);
    const sprayGeo=new THREE.BufferGeometry();sprayGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(sprayGeoPositions*3),3).setUsage(THREE.DynamicDrawUsage));sprayGeo.setAttribute('fade',new THREE.BufferAttribute(new Float32Array(sprayGeoPositions),1).setUsage(THREE.DynamicDrawUsage));
    const spray=new THREE.Points(sprayGeo,sprayMaterial(style));spray.frustumCulled=false;spray.name='sewer-waterfall-spray';unit.add(spray);
    outlets.push({unit,pour,splash,spray,distance,side,height,outletX,impactX,phase:index*.73});
  }
  function update(time,progress,drawAhead=310){
    for(const item of outlets){
      const {unit,pour,splash,spray,distance,side,height,outletX,impactX,phase}=item;
      unit.visible=distance>progress-48&&distance<progress+drawAhead;if(!unit.visible)continue;
      const surface=sewerWaterHeight(impactX,distance,time,trackId),{rows,sides}=pour.geometry.userData,positions=pour.geometry.attributes.position;
      for(let row=0;row<=rows;row++){
        const u=row/rows,centreX=outletX-side*1.45*u,centreY=height-(height-surface)*u*u;
        const dx=-side*1.45,dy=-2*(height-surface)*u,scale=1/Math.hypot(dx,dy),normalX=-dy*scale,normalY=dx*scale;
        for(let sector=0;sector<=sides;sector++){
          const angle=sector/sides*TAU,edge=Math.sin(angle),across=Math.cos(angle);
          const breakup=Math.sin(u*24-time*8+angle*3)*.025*u;
          const radius=(.82*(1-u*.44)+breakup),endTaper=1-THREE.MathUtils.smoothstep(u,.89,1);
          positions.setXYZ(row*(sides+1)+sector,centreX+normalX*edge*radius,centreY+normalY*edge*radius*endTaper,across*radius*(1+u*.7));
        }
      }
      positions.needsUpdate=true;pour.material.uniforms.time.value=time;
      splash.position.y=surface+.035;splash.material.uniforms.time.value=time+phase;
      const foamSurface=splash.geometry.attributes.position;
      for(let i=0;i<foamSurface.count;i++)foamSurface.setY(i,sewerWaterHeight(impactX+foamSurface.getX(i),distance-foamSurface.getZ(i),time,trackId)-surface);
      foamSurface.needsUpdate=true;
      const particles=spray.geometry.attributes.position,fade=spray.geometry.attributes.fade;
      for(let i=0;i<particles.count;i++){
        const life=(time*.86+i*.618+phase)%1,angle=i*2.399+phase,radius=life*(1.3+(i%5)*.2);
        particles.setXYZ(i,impactX+Math.cos(angle)*radius,surface+.13+Math.sin(life*Math.PI)*(1.0+(i%3)*.23),Math.sin(angle)*radius*.75);
        fade.setX(i,(1-life)*.75);
      }
      particles.needsUpdate=true;fade.needsUpdate=true;
    }
  }
  update(0,0);return {group,update,outlets};
}
