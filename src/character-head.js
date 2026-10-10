import * as THREE from 'three';

// Restored directly from the saved v4 head builder and painted face texture.
// Keep these local helpers isolated from later body/cloth geometry changes.
function pixelTexture(base, detail = '#ffffff', size = 64, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  let seed = 731;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < size * size * .6; i++) {
    ctx.globalAlpha = .012 + rand() * .035; ctx.fillStyle = i % 2 ? detail : '#0a1826';
    ctx.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 1 + Math.floor(rand() * 2), 1);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(c);
  texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x,y,z); parent.add(mesh); return mesh;
}
function humanMaterial(color, map = null) {
  // PS1 people used low-vertex silhouettes with interpolated normals and painted
  // lighting. Hard per-triangle lighting makes the same geometry look like a toy.
  return new THREE.MeshLambertMaterial({color, map, flatShading:false});
}
function polygonMesh(parent, vertices, faces, material, uvs = null) {
  const positions=[],texture=[];
  for(const face of faces)for(let j=1;j<face.length-1;j++)for(const i of [face[0],face[j],face[j+1]]){
    positions.push(...vertices[i]);if(uvs)texture.push(...uvs[i]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  if(uvs)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(texture,2));geometry.computeVertexNormals();
  return part(parent,geometry,material);
}
function loftGeometry(rings, sides=10, cap=true) {
  // Each ring is [height, half-width, half-depth, offset-x, offset-z].
  // Shape changes along the length produce clavicles, biceps, calves and fabric folds.
  const positions=[],uv=[],indices=[];
  const low=rings[0][0],span=Math.max(.001,rings.at(-1)[0]-low);
  for(const r of rings)for(let s=0;s<=sides;s++){
    const a=s/sides*Math.PI*2;positions.push((r[3]||0)+Math.cos(a)*r[1],r[0],(r[4]||0)+Math.sin(a)*r[2]);uv.push(s/sides,(r[0]-low)/span);
  }
  for(let r=0;r<rings.length-1;r++)for(let s=0;s<sides;s++){
    const a=r*(sides+1)+s,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  if(cap)for(const [row,invert] of [[0,true],[rings.length-1,false]]){
    const r=rings[row],c=positions.length/3;positions.push(r[3]||0,r[0],r[4]||0);uv.push(.5,.5);
    for(let s=0;s<sides;s++){const a=row*(sides+1)+s;indices.push(c,invert?a:a+1,invert?a+1:a);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function loft(parent,rings,material,sides=10){return part(parent,loftGeometry(rings,sides),material);}
function faceTexture(character){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=96;const ctx=canvas.getContext('2d');
  ctx.fillStyle=character.skin;ctx.fillRect(0,0,128,96);
  for(const centre of[32,96]){
    const shade=ctx.createLinearGradient(centre-26,0,centre+26,0);shade.addColorStop(0,'rgba(20,14,13,.25)');shade.addColorStop(.44,'rgba(238,183,135,.10)');shade.addColorStop(.63,'rgba(238,183,135,.08)');shade.addColorStop(1,'rgba(25,15,13,.22)');ctx.fillStyle=shade;ctx.fillRect(centre-26,0,52,96);
  }
  // Features are painted into the actual head UVs, not floating white polygons.
  for(const side of[-1,1]){
    const x=96+side*8;ctx.fillStyle='rgba(37,23,20,.25)';ctx.fillRect(x-4,36,8,5);
    ctx.fillStyle=character.hair;ctx.fillRect(x-4,35,7,2);ctx.fillRect(x-3,34,5,1);
    ctx.fillStyle='#c2b4a0';ctx.fillRect(x-3,40,6,2);ctx.fillStyle='#2c2522';ctx.fillRect(x-1,39,2,3);
    ctx.fillStyle='rgba(232,178,136,.11)';ctx.fillRect(x-5,47,7,4);
  }
  ctx.fillStyle='rgba(50,29,24,.42)';ctx.fillRect(92,58,8,2);ctx.fillRect(94,57,4,2);
  ctx.fillStyle='#765040';ctx.fillRect(90,67,12,2);ctx.fillStyle='rgba(35,24,23,.50)';ctx.fillRect(92,66,8,1);
  ctx.fillStyle='rgba(232,183,150,.15)';ctx.fillRect(92,70,8,1);
  ctx.fillStyle='rgba(36,26,22,.12)';ctx.fillRect(82,80,29,6);
  return canvasTexture(canvas);
}
function createHead(parent,character,outfit,skin,hair,cream,accent){
  const head=new THREE.Group();parent.add(head);head.scale.setScalar(.94);
  const face=humanMaterial(0xffffff,faceTexture(character));
  const headMesh=loft(head,[[0,.034,.037],[.024,.065,.056,0,-.004],[.060,.085,.068],[.105,.094,.078],[.153,.096,.082,0,.004],[.203,.089,.082,0,.009],[.238,.066,.062,0,.01],[.258,.018,.021,0,.010]],face,14);
  for(const side of[-1,1]){
    const ear=loft(head,[[.086,.008,.012],[.10,.013,.016],[.129,.013,.015],[.148,.006,.008]],skin,7);ear.position.set(side*.095,0,.009);
  }
  polygonMesh(head,[[-.009,.164,-.080],[.009,.164,-.080],[-.012,.104,-.086],[.012,.104,-.086],[0,.111,-.108],[0,.096,-.093]],[[0,1,4],[1,3,4],[0,4,2],[2,4,5],[4,3,5]],skin);
  const hairCap=loft(head,[[.179,.096,.087,0,.010],[.219,.086,.081,0,.012],[.256,.052,.055,0,.013],[.272,.007,.01,0,.012]],hair,12);
  const fringe=[[-.086,.20,-.04],[-.057,.22,-.073],[-.021,.23,-.081],[.024,.227,-.080],[.062,.21,-.067],[.087,.194,-.042],[-.080,.165,-.059],[-.051,.182,-.075],[-.024,.178,-.083],[.013,.195,-.085],[.045,.178,-.077],[.078,.164,-.054]];
  if(!character.dreads)polygonMesh(head,fringe,[[0,1,7,6],[1,2,8,7],[2,3,9,8],[3,4,10,9],[4,5,11,10]],hair);
  if(character.dreads){
    const locks=[humanMaterial('#241b16'),humanMaterial('#30241c'),hair];
    for(let i=0;i<11;i++){
      const a=(i/10-.5)*Math.PI*.90,x=Math.sin(a)*.083,z=.056+Math.cos(a)*.063,length=.29+(i%4)*.031;
      loft(head,[[-length,.010,.012,x+(i%2?.015:-.012),.14+(i%3)*.012],[-length*.7,.014,.015,x,.14],[-.02,.017,.017,x*.99,z+.025],[.14,.019,.018,x,z],[.205,.013,.015,x*.76,z*.72]],locks[i%3],7);
    }
  }else if(character.ponytail){
    const pony=loft(head,[[0,.023,.025],[.07,.034,.031],[.17,.026,.027],[.27,.014,.018],[.32,.004,.007]],hair,8);pony.position.set(0,.192,.075);pony.rotation.x=2.05;
    const tie=loft(head,[[0,.027,.028],[.017,.027,.028]],accent,8);tie.position.set(0,.191,.088);tie.rotation.x=2.05;
  }
  if(outfit.hat==='cap'||outfit.hat==='whitecap'){
    const capMaterial=outfit.hat==='whitecap'?humanMaterial(0xffffff,pixelTexture('#d0d2cb','#fffce8',32)):accent;
    loft(head,[[.211,.102,.092],[.242,.103,.093],[.28,.074,.069],[.294,.027,.031]],capMaterial,12);
    const brim=polygonMesh(head,[[-.086,.220,.068],[.086,.220,.068],[.094,.212,.167],[.058,.207,.20],[-.058,.207,.20],[-.094,.212,.167]],[[0,1,2,3,4,5]],capMaterial);brim.material.side=THREE.DoubleSide;
    const opening=part(head,new THREE.PlaneGeometry(.049,.014),hair,0,.227,-.093);opening.rotation.y=Math.PI;
  }else if(outfit.hat==='straw'){
    const straw=humanMaterial(0xffffff,pixelTexture('#c6a76e','#f4d6a2',32));loft(head,[[.203,.20,.168],[.216,.207,.173],[.224,.106,.103],[.276,.094,.090],[.304,.062,.064]],straw,12);loft(head,[[.228,.107,.105],[.244,.103,.10]],hair,12);
  }else if(outfit.hat==='bucket'){
    loft(head,[[.198,.143,.13],[.221,.116,.106],[.270,.101,.092],[.284,.063,.06]],accent,12);
  }
  return{head,headMesh,hairCap};
}

// Keep the current body builder's signature while restoring the original head
// materials too: the body overhaul must not recolour or relight the old faces.
export function headModel(parent, id, character, outfit, skin, hair) {
  const originalSkin = humanMaterial(0xffffff, pixelTexture(character.skin, '#dcb290', 64));
  const originalHair = humanMaterial(character.hair);
  const cream = humanMaterial('#d7d3c6'), accent = humanMaterial(outfit.accent);
  const { head, headMesh, hairCap } = createHead(parent, character, outfit, originalSkin, originalHair, cream, accent);
  headMesh.name = 'face'; hairCap.name = 'scalp';
  return { head, face: headMesh, hairCap };
}