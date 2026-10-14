import * as THREE from 'three';
import { CHARACTERS, OUTFITS, createSurfer, disposeSurfer } from './appearance.js';
import { createCharacter as previousCharacter } from './character-model-v9-reference.js';
import { loadCharacterTextures } from './character-textures.js';
import { sampleRiderTrick } from './rider-pose.js';
import { BODY_REFERENCES } from './body-reference-images.js';
import { BODY_ANGLE_IMAGES } from './body-angle-images.js';
import { BODY_REVIEW_PRESETS } from './body-review-presets.js';

const $=id=>document.getElementById(id),panels=[],images={...BODY_REFERENCES,...BODY_ANGLE_IMAGES};
let selected=BODY_REVIEW_PRESETS[0],ready=false;
for(const[id,c]of Object.entries(CHARACTERS))$('character').add(new Option(c.name,id));
for(const[id,o]of Object.entries(OUTFITS))$('outfit').add(new Option(o.name,id));
for(const preset of BODY_REVIEW_PRESETS){
  const button=document.createElement('button');button.className='reference-choice';button.dataset.reference=preset.id;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',preset.title);
  const img=new Image();img.src=images[preset.image];img.alt='';button.append(img,document.createTextNode(preset.title));
  button.addEventListener('click',()=>selectReference(preset));$('reference-strip').append(button);
}
for(const id of ['before','after']){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b9c0bb');
  scene.add(new THREE.HemisphereLight('#f7f3e7','#676f68',1.4));
  const key=new THREE.DirectionalLight('#fff6e6',2);key.position.set(-3,5,-4);scene.add(key);
  const fill=new THREE.DirectionalLight('#e5efff',.55);fill.position.set(3,3,2);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshLambertMaterial({color:'#a4afa4'}));floor.rotation.x=-Math.PI/2;floor.position.y=.005;scene.add(floor);
  const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  $(id).appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label',id==='before'?'Previous body geometry':'Current body geometry');
  panels.push({id,scene,renderer,camera:new THREE.OrthographicCamera(-1,1,1.07,-1.07,.02,20),surfer:null,originals:new Map(),clayMaterials:[]});
}
function selectReference(preset){
  selected=preset;$('character').value=preset.character;$('outfit').value=preset.outfit;$('pose').value=preset.pose;$('board').checked=preset.board;
  $('reference-image').src=images[preset.image];$('reference-image').alt='User supplied reference: '+preset.title;
  $('reference-caption').textContent=preset.title;$('reference-note').textContent=preset.note;
  $('checklist').replaceChildren(...preset.checks.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  for(const button of $('reference-strip').children)button.setAttribute('aria-pressed',String(button.dataset.reference===preset.id));
  resetCamera();if(ready)rebuild();
}
function resetCamera(){
  $('view').value='reference';$('yaw').value=selected.yaw;$('elevation').value=selected.elevation;$('zoom').value=100;render();
}
function rebuild(){
  for(const p of panels){
    if(p.surfer){p.scene.remove(p.surfer.rig);for(const[mesh,m]of p.originals)mesh.material=m;disposeSurfer(p.surfer);for(const m of p.clayMaterials)m.dispose();}
    p.originals.clear();p.clayMaterials=[];
    const profile={character:$('character').value,outfit:$('outfit').value,boardDesign:'tribal',boardColor:'#d5bb69'};
    p.surfer=createSurfer(profile,p.id==='before'?previousCharacter:undefined);p.scene.add(p.surfer.rig);
    p.surfer.rider.traverse(o=>{if(o.isMesh)p.originals.set(o,o.material);});
  }
  render();
}
function stats(p){
  const bounds=new THREE.Box3(),point=new THREE.Vector3();let triangles=0;
  p.surfer.rider.updateWorldMatrix(true,true);
  p.surfer.rider.traverseVisible(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position;triangles+=(o.geometry.index?.count||pos.count)/3;for(let i=0;i<pos.count;i++)bounds.expandByPoint(point.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld));});
  const size=bounds.getSize(point);$(p.id+'-stats').textContent='Body '+size.y.toFixed(2)+' m high / '+size.x.toFixed(2)+' m wide · '+triangles.toLocaleString()+' triangles';
}
function render(){
  const pose=$('pose').value,standing=pose==='standing'||pose==='tpose',tweak=pose==='tweak',grab=pose==='grab'||tweak;
  const yaw=+$('yaw').value,elevation=+$('elevation').value,zoom=+$('zoom').value/100;
  const angle=THREE.MathUtils.degToRad(yaw)+(standing?0:Math.PI/2),pitch=THREE.MathUtils.degToRad(elevation);
  $('yaw-value').value=yaw+'°';$('elevation-value').value=elevation+'°';$('zoom-value').value=Math.round(zoom*100)+'%';
  const modified=$('character').value!==selected.character||$('outfit').value!==selected.outfit||pose!==selected.pose||yaw!==selected.yaw||elevation!==selected.elevation||zoom!==1;
  $('custom-view').textContent=modified?'Custom inspection view':'Approximate reference camera';
  for(const p of panels){
    const s=p.surfer;if(!s)continue;
    s.boardPivot.visible=$('board').checked;s.boardPivot.position.set(0,grab?.12:0,0);s.boardPivot.rotation.set(0,0,0);s.boardPivot.scale.setScalar(1);
    if(standing){s.boardPivot.rotation.order='YXZ';s.boardPivot.rotation.set(Math.PI/2,1.13,Math.PI-.10);s.boardPivot.scale.setScalar(.8);s.boardPivot.position.set(-.34,.89,.10);}
    if(tweak){const t=sampleRiderTrick({airborne:true,trick:{age:.5,duration:1,grab:1,tweak:1}});s.boardPivot.rotation.order='YXZ';s.boardPivot.rotation.set(t.boardPitch,0,t.boardBank);s.boardPivot.position.set(t.boardSide,.12+t.boardLift,t.boardBack);}
    s.pose({standing,inspectionPose:pose==='tpose'?'tpose':undefined,mode:'park',time:0,charge:pose==='crouch'?1:0,balance:pose==='balance'?1:0,grab:grab?1:0,tweak:tweak?1:0,air:grab});
    for(const[mesh,original]of p.originals){
      if($('clay').checked){if(!mesh.userData.reviewClay){const m=new THREE.MeshLambertMaterial({color:'#9aa5a8',side:original.side});mesh.userData.reviewClay=m;p.clayMaterials.push(m);}mesh.material=mesh.userData.reviewClay;}
      else mesh.material=original;
    }
    const rect=$(p.id).getBoundingClientRect(),aspect=rect.width/rect.height;
    // Fit fingertips without scaling the old and new bodies independently.
    const half=(pose==='tpose'?Math.max(1.05,1.13/aspect):standing?1.04:1.10)/zoom,focus=standing?.96:.78;
    p.renderer.setSize(rect.width,rect.height,false);p.camera.left=-half*aspect;p.camera.right=half*aspect;p.camera.top=half;p.camera.bottom=-half;p.camera.updateProjectionMatrix();
    p.camera.position.set(Math.sin(angle)*4*Math.cos(pitch),focus+Math.sin(pitch)*4,-Math.cos(angle)*4*Math.cos(pitch));p.camera.lookAt(0,focus,0);
    stats(p);p.renderer.render(p.scene,p.camera);
  }
  if(ready)$('status').textContent=CHARACTERS[$('character').value].name+' / '+OUTFITS[$('outfit').value].name+' · '+$('pose').selectedOptions[0].text+' · '+($('clay').checked?'Geometry only':'Original textures')+' · Reference '+(BODY_REVIEW_PRESETS.indexOf(selected)+1)+' of '+BODY_REVIEW_PRESETS.length;
}
selectReference(selected);
try{
  await loadCharacterTextures();ready=true;rebuild();
  for(const id of ['character','outfit'])$(id).addEventListener('change',rebuild);
  for(const id of ['pose','clay','board'])$(id).addEventListener('change',render);
  for(const id of ['yaw','elevation','zoom'])$(id).addEventListener('input',()=>{$('view').value='reference';render();});
  $('view').addEventListener('change',()=>{const angle={front:0,quarter:45,side:90,left:-90,'rear-quarter':135,back:180}[$('view').value];$('yaw').value=angle??selected.yaw;$('elevation').value=angle===undefined?selected.elevation:0;render();});
  $('reset-view').addEventListener('click',()=>selectReference(selected));
  new ResizeObserver(render).observe($('after'));
}catch(error){$('status').textContent='Model review failed: '+error.message;console.error(error);}

