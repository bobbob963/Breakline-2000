import * as THREE from 'three';
import { getRewardBoard } from './board-rewards.js';

export const BOARD_EFFECT_POOL_SIZE=3;
export const BOARD_EFFECT_LIFETIME=.66;
const TAU=Math.PI*2;
const EFFECT_IDS=['guitar','lightning','vortex','solar','sky'];

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
  } else {
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

/** Local, depth-tested reward accents. Three fixed slots reuse all GPU assets. */
export function createBoardEffects({reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}={}) {
  const group=new THREE.Group();group.name='reward-board-effects';
  const textures=new Map(EFFECT_IDS.map(id=>[id,iconTexture(id)]));
  const haloGeometry=jaggedHalo(),rayGeometry=new THREE.PlaneGeometry(.045,.56);
  let equipped=null,next=0,disposed=false,sequence=0;
  const slots=Array.from({length:BOARD_EFFECT_POOL_SIZE},(_,index)=>{
    const root=new THREE.Group();root.name='reward-burst-'+index;root.visible=false;group.add(root);
    const iconMaterial=new THREE.SpriteMaterial({transparent:true,depthWrite:false,depthTest:true,opacity:0});
    const icons=Array.from({length:8},()=>{const icon=new THREE.Sprite(iconMaterial);root.add(icon);return icon;});
    const rayMaterial=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,opacity:0});
    const halo=new THREE.Mesh(haloGeometry,rayMaterial);halo.name='local-impact-frame';root.add(halo);
    const rays=Array.from({length:12},()=>{const ray=new THREE.Mesh(rayGeometry,rayMaterial);root.add(ray);return ray;});
    return {root,icons,halo,rays,iconMaterial,rayMaterial,age:0,duration:BOARD_EFFECT_LIFETIME,id:null,seed:0,small:false};
  });
  function reset(){for(const slot of slots){slot.root.visible=false;slot.age=slot.duration;}next=0;}
  function setProfile(profile){equipped=getRewardBoard(profile?.rewardBoard)?.id??null;reset();}
  function trigger(event) {
    if(disposed||!equipped||event?.opponent||!['trick','airJump'].includes(event?.type))return false;
    if(event.type==='airJump'&&equipped!=='sky')return false;
    const reward=getRewardBoard(equipped),slot=slots[next++%slots.length];
    slot.id=equipped;slot.small=event.type==='airJump';slot.age=0;slot.duration=slot.small?.46:BOARD_EFFECT_LIFETIME;slot.seed=(sequence++%5)*.27;
    slot.iconMaterial.map=textures.get(equipped);slot.iconMaterial.needsUpdate=true;slot.iconMaterial.color.set(reward.colors.accent);
    slot.rayMaterial.color.set(reward.colors.secondary);slot.root.visible=true;slot.root.userData.effect=reward.vfx;slot.root.userData.completedTrick=event.type==='trick';
    return true;
  }
  function update(dt,surfer,camera,{paused=false,finished=false}={}) {
    if(disposed)return;
    if(finished){reset();return;}
    for(const slot of slots) {
      if(!slot.root.visible)continue;
      if(!paused)slot.age+=Math.max(0,Math.min(.1,dt||0));
      if(slot.age>=slot.duration){slot.root.visible=false;continue;}
      // Fixed to the real rendered rider, including ocean-mesh alignment and
      // pipe rolls. This never changes the camera, simulation, or board pose.
      slot.root.position.copy(surfer.rig.position);slot.root.position.y+=.75;
      slot.root.quaternion.copy(camera.quaternion);
      const age=slot.age,p=age/slot.duration,impact=age<.055,fade=Math.pow(1-p,.6),expansion=reducedMotion?0:Math.max(0,p-.085);
      const size=slot.small?.78:1;
      slot.iconMaterial.opacity=(reducedMotion?.58:.96)*fade;
      slot.rayMaterial.opacity=reducedMotion?0:(impact?.72:.34)*fade;
      slot.halo.visible=!reducedMotion&&age<.2;
      slot.halo.scale.set(1.1*size+expansion*.65,1.06*size+expansion*.65,1);
      for(let i=0;i<slot.icons.length;i++) {
        const icon=slot.icons[i];icon.visible=!reducedMotion||i<4;
        const angle=i*TAU/(reducedMotion?4:8)+slot.seed+(slot.id==='vortex'&&!reducedMotion?p*.7:0);
        const radius=(reducedMotion?1.13:1.02+expansion*.9)*size;
        icon.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius*.85,.12+(i%2)*.08);
        const iconSize=(slot.id==='guitar'?.40:slot.id==='lightning'?.46:.38)*size;
        icon.scale.setScalar(iconSize*(reducedMotion?1:1+Math.sin(p*Math.PI)*.12));
        icon.material.rotation=slot.id==='lightning'?.1:slot.id==='sky'?-.25:0;
      }
      for(let i=0;i<slot.rays.length;i++) {
        const ray=slot.rays[i],angle=i*TAU/slot.rays.length+slot.seed;
        ray.visible=!reducedMotion&&age<.28;ray.rotation.z=angle-Math.PI/2;
        const radius=(.92+expansion*.8)*size;ray.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,.02);
        ray.scale.set(slot.id==='lightning'?1.4:1,(impact?1.2:.7)*size,1);
      }
    }
  }
  function dispose(){if(disposed)return;disposed=true;reset();for(const s of slots){s.iconMaterial.dispose();s.rayMaterial.dispose();}haloGeometry.dispose();rayGeometry.dispose();for(const texture of textures.values())texture.dispose();group.removeFromParent();group.clear();}
  return {group,setProfile,trigger,update,reset,dispose,get activeCount(){return slots.filter(s=>s.root.visible).length;},get reducedMotion(){return reducedMotion;}};
}
