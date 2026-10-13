import * as THREE from 'three';
import { createSurfer,disposeSurfer,validateProfile } from './appearance.js';
import { sanitizeRiderName } from './rider-identity.js';

export function arrangeMenuSurfer(surfer) {
  surfer.rider.position.x=-.16;
  const board=surfer.boardPivot;board.scale.setScalar(.69);board.rotation.order='ZYX';board.rotation.set(Math.PI/2,Math.PI,.19);board.position.set(.63,0,.045);
  board.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(board);board.position.y=.013-bounds.min.y;
}

export function poseMenuSurfer(surfer,time=0) {
  surfer.rig.updateWorldMatrix(true,true);
  const rail=surfer.board.userData.grabRailLocal.clone();rail.x=-.248;rail.z=-.62;rail.y=.157;
  const contactWorld=surfer.board.localToWorld(rail);
  const elbowWorld=surfer.board.localToWorld(new THREE.Vector3(0,.153,-1.11));elbowWorld.y+=.024;elbowWorld.z-=.013;
  surfer.pose({standing:true,time,menuLean:{contactWorld,elbowWorld}});
  return contactWorld;
}

/** Anchor the label to the posed crown, including lean, breathing and build. */
export function projectMenuNameTag(surfer,camera,width,height) {
  if(!surfer?.landmarks?.crown||width<1||height<1)return {x:0,y:0,visible:false};
  camera.updateMatrixWorld();
  const point=surfer.landmarks.crown.clone();point.y+=.075;point.project(camera);
  return {x:(point.x+1)*width*.5,y:(1-point.y)*height*.5-7,visible:Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.z>=-1&&point.z<=1&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1};
}

/** Main-menu portrait: the actual selected rider and equipped surfboard. */
export class MenuSurferPreview {
  constructor(container,profile) {
    this.container=container;this.time=0;this.disposed=false;this.name='';this.viewport={width:0,height:0};
    this.motionQuery=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(32,1,.05,20);
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:'low-power'});
    this.renderer.setClearColor(0x000000,0);this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.07;
    this.renderer.domElement.style.cssText='display:block;width:100%;height:100%;image-rendering:pixelated;pointer-events:none';
    this.renderer.domElement.setAttribute('aria-hidden','true');container.append(this.renderer.domElement);
    this.nameTag=document.createElement('div');this.nameTag.className='home-rider-nametag';this.nameTag.hidden=true;container.append(this.nameTag);
    this.scene.add(new THREE.HemisphereLight('#d4e0e8','#594b47',1.25));
    const key=new THREE.DirectionalLight('#fff0d7',1.7);key.position.set(-3,5,-4);this.scene.add(key);
    const rim=new THREE.DirectionalLight('#8ed5d0',.95);rim.position.set(2.4,3,1.8);this.scene.add(rim);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const ctx=shadowCanvas.getContext('2d');
    const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(0,0,0,.60)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const texture=new THREE.CanvasTexture(shadowCanvas);texture.colorSpace=THREE.SRGBColorSpace;
    this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.7,.95),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.7}));
    this.shadow.rotation.x=-Math.PI/2;this.shadow.position.set(.05,.001,.035);this.scene.add(this.shadow);
    this.setProfile(profile);this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.update(0);
  }
  setProfile(profile) {
    if(this.disposed)return;
    this.profile=validateProfile(profile);
    if(this.surfer){this.surfer.rig.removeFromParent();disposeSurfer(this.surfer);}
    this.surfer=createSurfer(this.profile);this.scene.add(this.surfer.rig);
    // Set the authored tail on the ground instead of estimating board height.
    arrangeMenuSurfer(this.surfer);
    this.pose();
    this.updateNameTag();
  }
  setName(name) {
    if(this.disposed)return;
    this.name=sanitizeRiderName(name);this.nameTag.textContent=this.name;
    this.updateNameTag();
  }
  updateNameTag() {
    if(!this.nameTag)return;
    const point=projectMenuNameTag(this.surfer,this.camera,this.viewport.width,this.viewport.height);
    this.nameTag.hidden=!this.name||!point.visible;
    if(!this.nameTag.hidden){this.nameTag.style.left=`${point.x}px`;this.nameTag.style.top=`${point.y}px`;}
  }
  pose() {
    const surfer=this.surfer;if(!surfer)return;
    // The forearm rests on the real nose while the relaxed hand meets its
    // upper outer rail. World-space contacts preserve support across builds.
    poseMenuSurfer(surfer,this.motionQuery?.matches?0:this.time);
  }
  resize() {
    if(this.disposed)return;const {width,height}=this.container.getBoundingClientRect();if(width<1||height<1)return;
    this.viewport={width,height};
    // A clear portrait preserves painted faces without smoothing the low-poly
    // art. Framing includes the board tip, both feet and the full silhouette.
    const scale=Math.min(1.5,Math.max(1,(globalThis.devicePixelRatio||1)));
    this.renderer.setSize(Math.round(width*scale),Math.round(height*scale),false);this.camera.aspect=width/height;
    const targetHeight=2.16,verticalDistance=targetHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov*.5))),horizontalDistance=1.65/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov*.5))*this.camera.aspect);
    const distance=Math.max(verticalDistance,horizontalDistance);
    this.camera.position.set(-.02,1.06,-distance);this.camera.lookAt(.22,.98,0);this.camera.updateProjectionMatrix();
    this.updateNameTag();
  }
  update(dt=0) {
    if(this.disposed)return;
    if(!this.motionQuery?.matches)this.time+=Math.max(0,Math.min(.05,dt));
    this.pose();this.updateNameTag();this.renderer.render(this.scene,this.camera);
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;this.resizeObserver?.disconnect();
    if(this.surfer){this.surfer.rig.removeFromParent();disposeSurfer(this.surfer);}
    this.shadow.geometry.dispose();this.shadow.material.map.dispose();this.shadow.material.dispose();
    this.scene.clear();this.renderer.dispose();this.renderer.domElement.remove();this.nameTag.remove();
  }
}
