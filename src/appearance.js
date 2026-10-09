import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const CHARACTERS = {
  kai: { name: 'KAI', subtitle: 'THE LOCAL', skin: '#b9805c', shirt: '#ded6be', shorts: '#343d67', hair: '#392c24', accent: '#e76030', build: 1, defaultOutfit: 'riptide', stance: 'REGULAR', bio: 'Raised on dawn patrol and scratched surf videos. Kai knows every reef, every shortcut, and exactly when the next set is coming.', stats: [8,7,8,8,7,9,6,7,9,9] },
  nova: { name: 'NOVA', subtitle: 'THE FREESTYLER', skin: '#905938', shirt: '#8249aa', shorts: '#24a8b0', hair: '#211c20', accent: '#e4d246', build: .94, ponytail: true, defaultOutfit: 'midnight', stance: 'GOOFY', bio: 'A road-trip regular with a notebook full of impossible lines. Nova turns a little speed and a steep lip into something nobody saw coming.', stats: [10,9,9,7,10,7,9,6,7,8] },
  reef: { name: 'REEF', subtitle: 'THE WAVE RAT', skin: '#d39b75', shirt: '#222c38', shorts: '#353841', hair: '#af955d', accent: '#bedb36', build: 1.04, defaultOutfit: 'raglan', stance: 'REGULAR', bio: 'First through the gate, last out of the water. Reef grew up linking concrete bowls and point breaks, and treats every wave like a new skate spot.', stats: [7,8,7,9,8,8,8,10,10,8] },
  jax: { name: 'JAX', subtitle: 'THE YARD CREW', skin: '#68432f', shirt: '#aeb1af', shorts: '#777d7c', hair: '#211a17', accent: '#e3c04a', build: 1.03, dreads: true, defaultOutfit: 'yardcrew', stance: 'GOOFY', bio: 'Long afternoons at the loading dock, dawn sessions at the point. Jax brings loose style, deep landings, and a whole crew cheering from the wall.', stats: [8,8,9,8,8,9,9,10,8,9] },
};
export const OUTFITS = {
  riptide: { name: "RIPTIDE '99", description: 'Oversized surf tee, long panel shorts and a backwards cap.', top: 'baggy', shirt: '#d7d0b8', shorts: '#344c67', accent: '#e07338', pattern: 'sunburst', shortPattern: 'panel', hat: 'cap', sleeves: 'short' },
  blackout: { name: 'BLACKOUT TRIBE', description: 'Loose black tee and monochrome tribal boardshorts.', top: 'baggy', shirt: '#252930', shorts: '#171f27', accent: '#e1deca', pattern: 'tribal', shortPattern: 'tribal', necklace: true, sleeves: 'short' },
  aloha: { name: 'ALOHA STATIC', description: 'Open tropical shirt, bright long shorts and a bucket hat.', top: 'open', shirt: '#1c727b', shorts: '#db765a', accent: '#e7cf77', pattern: 'tropical', shortPattern: 'stripe', hat: 'bucket', sleeves: 'short' },
  castaway: { name: 'CASTAWAY', description: 'Beachwear, a straw hat, shell beads and sunburst shorts.', top: 'bare', shirt: '#c9664b', shorts: '#2c6671', accent: '#efe0ad', pattern: 'none', shortPattern: 'sunburst', hat: 'straw', necklace: true, sleeves: 'none' },
  reefskin: { name: 'REEF SKIN', description: 'Full black wetsuit with purple panels and lime seams.', top: 'wetsuit', shirt: '#202935', shorts: '#202935', accent: '#9970ad', pattern: 'wetsuit', shortPattern: 'none', sleeves: 'long' },
  raglan: { name: 'SIDEWALK SURF', description: 'Cream baseball tee, burgundy three-quarter sleeves, checked shorts.', top: 'raglan', shirt: '#dcd5be', shorts: '#68766f', accent: '#784653', pattern: 'badge', shortPattern: 'checker', sleeves: 'threequarter' },
  static: { name: 'CHANNEL STATIC', description: 'Huge white graphic tee, violet shorts and a turquoise cap.', top: 'oversized', shirt: '#e4e0d0', shorts: '#644779', accent: '#44b5ad', pattern: 'static', shortPattern: 'panel', hat: 'cap', sleeves: 'short' },
  sunset: { name: 'SUNSET STRIP', description: 'Faded tank, burnt-orange shorts and a shell necklace.', top: 'tank', shirt: '#d4af56', shorts: '#b9563c', accent: '#443654', pattern: 'stripe', shortPattern: 'tribal', necklace: true, sleeves: 'none' },
  midnight: { name: 'MIDNIGHT LUAU', description: 'Open hibiscus shirt over a pale tee and dark boardshorts.', top: 'layered', shirt: '#252c39', shorts: '#354352', accent: '#cf688b', pattern: 'tropical', shortPattern: 'stripe', sleeves: 'short' },
  neon: { name: 'HIGH TIDE', description: 'Long-sleeve blue rashguard and fluorescent panel shorts.', top: 'rashguard', shirt: '#234c75', shorts: '#303940', accent: '#b0cf52', pattern: 'rashguard', shortPattern: 'panel', sleeves: 'long' },
  yardcrew: { name: 'YARD CREW', description: 'Loose grey sweatshirt, full-length baggy cargo trousers, white cap and trainers.', top: 'sweatshirt', bottom: 'trousers', shirt: '#aeb1af', shorts: '#757b7a', accent: '#d5b448', pattern: 'yardbadge', shortPattern: 'cargo', sleeves: 'long', hat: 'whitecap', footwear: 'trainers' },
  suncrew: { name: 'SUN CREW', description: 'Faded yellow sweatshirt, wide navy trousers, white cap and trainers.', top: 'sweatshirt', bottom: 'trousers', shirt: '#c0b252', shorts: '#34445d', accent: '#456874', pattern: 'crewbolt', shortPattern: 'cargo', sleeves: 'long', hat: 'whitecap', footwear: 'trainers' },
};
export const BOARD_DESIGNS = {
  bolt: { name: 'LIGHTNING' }, checker: { name: 'CHECKER RIP' }, flames: { name: 'HOT ROD' },
  tribal: { name: 'BLACK TIDE' }, hibiscus: { name: 'HIBISCUS' }, skull: { name: 'SKULL REEF' },
  sunburst: { name: 'SOLAR FLARE' }, pinstripe: { name: 'PINSTRIPE' },
};
export const DEFAULT_PROFILE = { character: 'kai', outfit: 'riptide', boardColor: '#f5d329', boardDesign: 'bolt' };
const colors = ['#f5d329', '#e95b39', '#24c5ba', '#8755bb', '#f5ede0'];
export function validateProfile(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return { character: Object.hasOwn(CHARACTERS, value.character) ? value.character : 'kai', outfit: Object.hasOwn(OUTFITS, value.outfit) ? value.outfit : 'riptide', boardColor: colors.includes(value.boardColor) ? value.boardColor : colors[0], boardDesign: Object.hasOwn(BOARD_DESIGNS, value.boardDesign) ? value.boardDesign : 'bolt' };
}
export function pixelTexture(base, detail = '#ffffff', size = 64, repeat = 1) {
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
export function retroMaterial(color, map = null) {
  const m = new THREE.MeshLambertMaterial({ color, map, flatShading: true });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec2 pixelGrid=vec2(256.0,192.0);
      gl_Position.xy=floor(gl_Position.xy/gl_Position.w*pixelGrid+.5)/pixelGrid*gl_Position.w;`);
  };
  return m;
}
function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function flower(ctx, x, y, radius, color, center = '#e8d478', rotation = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    ctx.rotate(Math.PI * 2 / 5); ctx.beginPath();
    ctx.ellipse(0, -radius * .55, radius * .4, radius * .69, .15, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = center; ctx.fillRect(-2, -2, 4, 4); ctx.restore();
}
function sun(ctx, x, y, r, color, count = 12) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.rotate(Math.PI * 2 / count); ctx.beginPath();
    ctx.moveTo(-r * .14, -r * .35); ctx.lineTo(-r * .12, -r * .67);
    ctx.lineTo(r * .04, -r); ctx.lineTo(r * .16, -r * .41); ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * .32, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function tribal(ctx, x, y, width, height, color) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side * width / 30, height / 80);
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(8, -16); ctx.lineTo(5, -18);
    ctx.lineTo(14, 2); ctx.lineTo(9, 0); ctx.lineTo(12, 19); ctx.lineTo(5, 11);
    ctx.lineTo(3, 34); ctx.lineTo(0, 40); ctx.lineTo(-2, 1); ctx.lineTo(4, 3);
    ctx.lineTo(0, -13); ctx.lineTo(3, -11); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(14, -28); ctx.lineTo(11, -6);
    ctx.lineTo(18, 9); ctx.lineTo(14, 22); ctx.lineTo(13, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function fabricTexture(outfit, shorts = false) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d'), base = shorts ? outfit.shorts : outfit.shirt;
  const pattern = shorts ? outfit.shortPattern : outfit.pattern;
  ctx.fillStyle = base; ctx.fillRect(0, 0, 64, 64);
  if (pattern === 'tropical') {
    for (let i = 0; i < 8; i++) {
      const x = (i * 23 + 6) % 64, y = (i * 37 + 5) % 64;
      ctx.strokeStyle = '#80a77c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 7, y + 7); ctx.lineTo(x + 7, y - 7); ctx.stroke();
      flower(ctx, x, y, 7, outfit.accent, '#eadbb5', i);
    }
  } else if (pattern === 'tribal') {
    if (shorts) { tribal(ctx, 16, 34, 23, 55, outfit.accent); tribal(ctx, 48, 34, 23, 55, outfit.accent); }
    else { tribal(ctx, 17, 33, 17, 49, outfit.accent); tribal(ctx, 48, 33, 17, 49, outfit.accent); }
  } else if (pattern === 'sunburst') {
    sun(ctx, 17, 29, 18, outfit.accent); sun(ctx, 48, 29, 18, outfit.accent);
    ctx.fillStyle = '#293741'; ctx.fillRect(7, 43, 48, 5);
  } else if (pattern === 'panel') {
    ctx.fillStyle = outfit.accent; ctx.fillRect(0, 0, 11, 64); ctx.fillRect(37, 0, 9, 64);
    ctx.fillStyle = '#ddd8be'; ctx.fillRect(12, 0, 2, 64); ctx.fillRect(48, 0, 2, 64);
    ctx.fillStyle = '#17232d'; ctx.fillRect(20, 39, 12, 15); ctx.fillRect(54, 39, 10, 15);
  } else if (pattern === 'checker') {
    for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) if ((x / 8 + y / 8) % 2) { ctx.fillStyle = '#252d32'; ctx.fillRect(x, y, 8, 8); }
  } else if (pattern === 'stripe') {
    ctx.fillStyle = outfit.accent;
    for (const y of [12, 16, 37, 45]) ctx.fillRect(0, y, 64, y === 37 ? 6 : 2);
    ctx.fillStyle = '#e7ddbb'; ctx.fillRect(0, 43, 64, 2);
  } else if (pattern === 'static') {
    ctx.fillStyle = '#2c3d4e'; ctx.fillRect(6, 18, 23, 29); ctx.fillRect(37, 18, 23, 29);
    ctx.fillStyle = '#bc4d70'; ctx.fillRect(10, 22, 16, 11); ctx.fillRect(41, 22, 16, 11);
    ctx.fillStyle = outfit.accent; ctx.beginPath(); ctx.moveTo(8, 41); ctx.lineTo(25, 23); ctx.lineTo(21, 40); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(39, 41); ctx.lineTo(56, 23); ctx.lineTo(52, 40); ctx.closePath(); ctx.fill();
  } else if (pattern === 'badge') {
    ctx.fillStyle = outfit.accent; ctx.fillRect(7, 22, 21, 19); ctx.fillRect(38, 22, 21, 19);
    ctx.fillStyle = '#e2d9b9'; ctx.font = 'bold 12px monospace'; ctx.fillText('99', 10, 36); ctx.fillText('99', 41, 36);
  } else if (pattern === 'wetsuit' || pattern === 'rashguard') {
    ctx.fillStyle = outfit.accent; ctx.fillRect(6, 0, 12, 64); ctx.fillRect(45, 0, 12, 64);
    ctx.fillStyle = '#c0d86a'; ctx.fillRect(4, 0, 2, 64); ctx.fillRect(58, 0, 2, 64);
    ctx.fillStyle = '#19232d'; ctx.fillRect(30, 0, 2, 50);
  } else if (pattern === 'yardbadge') {
    ctx.fillStyle = '#363c3b'; ctx.beginPath();ctx.moveTo(48,15);ctx.lineTo(37,38);ctx.lineTo(59,38);ctx.closePath();ctx.fill();
    ctx.strokeStyle = outfit.accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(48,19);ctx.lineTo(41,34);ctx.lineTo(55,34);ctx.closePath();ctx.stroke();
    ctx.fillStyle = '#d9d3b6';ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillText('99',48,33);ctx.textAlign='start';
  } else if (pattern === 'crewbolt') {
    ctx.fillStyle = '#305663';ctx.beginPath();ctx.moveTo(45,17);ctx.lineTo(39,28);ctx.lineTo(47,27);ctx.lineTo(45,40);ctx.lineTo(55,24);ctx.lineTo(50,25);ctx.lineTo(54,17);ctx.closePath();ctx.fill();
    ctx.fillStyle = '#c5cab7';ctx.fillRect(37,22,21,3);
  } else if (pattern === 'cargo') {
    ctx.fillStyle = '#172027';ctx.globalAlpha=.18;ctx.fillRect(0,0,2,64);ctx.fillRect(30,0,2,64);ctx.globalAlpha=1;
  }
  // Hand-painted broad folds and edge shading give a textured PS1 silhouette,
  // instead of making every triangle a differently coloured flat plastic panel.
  for(const centre of [16,48]){
    const shade=ctx.createLinearGradient(centre-16,0,centre+16,0);
    shade.addColorStop(0,'rgba(10,15,20,.28)');shade.addColorStop(.30,'rgba(245,240,216,.045)');shade.addColorStop(.64,'rgba(245,240,216,.07)');shade.addColorStop(1,'rgba(12,16,20,.25)');
    ctx.fillStyle=shade;ctx.fillRect(centre-16,0,32,64);
    for(const [x,y,dx,len] of [[-8,38,3,19],[5,45,-3,16],[-2,7,3,12]]){
      ctx.strokeStyle='rgba(20,25,28,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(centre+x,y);ctx.lineTo(centre+x+dx,y+len);ctx.stroke();
      ctx.strokeStyle='rgba(255,245,220,.12)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(centre+x+2,y);ctx.lineTo(centre+x+dx+2,y+len);ctx.stroke();
    }
  }
  ctx.fillStyle='rgba(18,23,28,.18)';ctx.fillRect(0,61,64,3);
  ctx.globalAlpha = .035;
  for (let i = 0; i < 600; i++) { ctx.fillStyle = i % 2 ? '#e8e3cd' : '#141c26'; ctx.fillRect((i * 31) % 64, (i * 47 + Math.floor(i / 64)) % 64, 1, 1); }
  ctx.globalAlpha = 1;
  return canvasTexture(c);
}
function boardTexture(profile) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = profile.boardColor; ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = '#182637';
  if (profile.boardDesign === 'checker') {
    for (let y = 16; y < 230; y += 12) for (let x = 3; x < 64; x += 12) if ((x + y - 19) / 12 % 2 === 0) ctx.fillRect(x, y, 12, 12);
    ctx.fillStyle = profile.boardColor; ctx.fillRect(20, 20, 25, 176);
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(26, 20, 4, 176);
  } else if (profile.boardDesign === 'flames') {
    ctx.fillStyle = '#f54c2b'; ctx.beginPath(); ctx.moveTo(3, 256); ctx.lineTo(0, 140); ctx.lineTo(15, 183); ctx.lineTo(13, 86); ctx.lineTo(34, 147); ctx.lineTo(48, 48); ctx.lineTo(53, 171); ctx.lineTo(64, 111); ctx.lineTo(64, 256); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe05c'; ctx.beginPath(); ctx.moveTo(12, 256); ctx.lineTo(17, 180); ctx.lineTo(31, 218); ctx.lineTo(43, 128); ctx.lineTo(46, 225); ctx.lineTo(57, 193); ctx.lineTo(59, 256); ctx.closePath(); ctx.fill();
  } else if (profile.boardDesign === 'tribal') {
    tribal(ctx, 32, 107, 47, 193, '#172637');
    ctx.strokeStyle = '#f1e7c9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, 8); ctx.lineTo(32, 205); ctx.stroke();
  } else if (profile.boardDesign === 'hibiscus') {
    ctx.fillStyle = '#204858'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 0); ctx.lineTo(55, 256); ctx.lineTo(32, 256); ctx.closePath(); ctx.fill();
    flower(ctx, 23, 45, 21, '#f8dfb1', '#e1684f', .3);
    flower(ctx, 43, 114, 24, '#e66b72', '#fff0b7', -.2);
    flower(ctx, 20, 181, 18, '#efe3b7', '#d85746', .7);
  } else if (profile.boardDesign === 'skull') {
    ctx.fillStyle = '#202a36'; ctx.fillRect(26, 8, 12, 206);
    ctx.save(); ctx.translate(32, 108); ctx.strokeStyle = '#eae1c7'; ctx.lineWidth = 7;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * -22, -10); ctx.lineTo(side * 22, 42); ctx.stroke(); }
    ctx.fillStyle = '#eee4c9'; ctx.beginPath(); ctx.moveTo(-18, -30); ctx.lineTo(0, -42); ctx.lineTo(18, -30); ctx.lineTo(20, -6); ctx.lineTo(12, 10); ctx.lineTo(10, 25); ctx.lineTo(-10, 25); ctx.lineTo(-12, 10); ctx.lineTo(-20, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#162633'; ctx.fillRect(-14, -13, 10, 11); ctx.fillRect(4, -13, 10, 11);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, 9); ctx.lineTo(5, 9); ctx.closePath(); ctx.fill();
    ctx.fillRect(-8, 14, 2, 11); ctx.fillRect(-1, 14, 2, 11); ctx.fillRect(6, 14, 2, 11); ctx.restore();
    tribal(ctx, 32, 183, 35, 44, '#202a36');
  } else if (profile.boardDesign === 'sunburst') {
    ctx.save(); ctx.translate(32, 103); ctx.scale(1, 2.3); sun(ctx, 0, 0, 40, '#203142', 16); ctx.restore();
    sun(ctx, 32, 103, 19, '#ef7445', 12); ctx.fillStyle = '#f7e5b6'; ctx.beginPath(); ctx.arc(32, 103, 6, 0, Math.PI * 2); ctx.fill();
  } else if (profile.boardDesign === 'pinstripe') {
    ctx.fillStyle = '#1c3144'; ctx.fillRect(20, 0, 24, 256);
    ctx.fillStyle = '#eee4c6'; for (const x of [13, 18, 45, 50]) ctx.fillRect(x, 0, 2, 256);
    ctx.fillStyle = '#e97752'; ctx.fillRect(29, 0, 6, 256);
    tribal(ctx, 32, 70, 22, 74, '#f3e7c7');
  } else {
    ctx.beginPath(); ctx.moveTo(34, 8); ctx.lineTo(9, 118); ctx.lineTo(29, 111); ctx.lineTo(12, 219); ctx.lineTo(54, 84); ctx.lineTo(33, 93); ctx.lineTo(52, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.fillStyle = '#efe7d1'; ctx.fillRect(17, 217, 30, 17); ctx.fillStyle = '#1a2734'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('B/99', 32, 230);
  ctx.globalAlpha = .06;
  for (let i = 0; i < 340; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#071322'; ctx.fillRect((i * 37) % 64, (i * 71) % 256, 1, i % 7 === 0 ? 4 : 1); }
  return canvasTexture(c);
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
const UP=new THREE.Vector3(0,1,0);
function bone(parent,rings,material,sides=9) {
  const group=new THREE.Group();parent.add(group);loft(group,rings,material,sides);
  return {group,set(a,b){const start=new THREE.Vector3(...a),delta=new THREE.Vector3(...b).sub(start);group.position.copy(start);group.quaternion.setFromUnitVectors(UP,delta.clone().normalize());group.scale.set(1,Math.max(.001,delta.length()),1);}};
}
function clothChain(parent,rings,material,sides=10){
  // One connected mesh bends through a knee or elbow, with one continuous UV strip.
  // There are no interior end caps or separately shaded cuffs at the joint.
  const geometry=loftGeometry(rings,sides),mesh=part(parent,geometry,material),positions=geometry.attributes.position;
  const start=new THREE.Vector3(),joint=new THREE.Vector3(),end=new THREE.Vector3(),first=new THREE.Vector3(),second=new THREE.Vector3(),centre=new THREE.Vector3(),direction=new THREE.Vector3(),point=new THREE.Vector3(),rotation=new THREE.Quaternion();
  return{mesh,set(a,b,c){
    start.set(...a);joint.set(...b);end.set(...c);first.copy(joint).sub(start).normalize();second.copy(end).sub(joint).normalize();
    for(let r=0;r<rings.length;r++){
      const[t,rx,rz,ox=0,oz=0]=rings[r];centre.copy(t<=1?start:joint).lerp(t<=1?joint:end,t<=1?t:t-1);
      const blend=THREE.MathUtils.smoothstep(t,.64,1.36);direction.copy(first).lerp(second,blend).normalize();rotation.setFromUnitVectors(UP,direction);
      for(let s=0;s<=sides;s++){const angle=s/sides*Math.PI*2;point.set(Math.cos(angle)*rx+ox,0,Math.sin(angle)*rz+oz).applyQuaternion(rotation).add(centre);positions.setXYZ(r*(sides+1)+s,...point.toArray());}
    }
    positions.setXYZ(rings.length*(sides+1),...start.toArray());positions.setXYZ(rings.length*(sides+1)+1,...end.toArray());positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }};
}
function detailLine(parent,points,color,width=1){
  const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
  const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,linewidth:width}));parent.add(line);return line;
}
function createBoard(parent,profile){
  const outline=[[0,-1.11],[.13,-1.01],[.235,-.73],[.286,-.3],[.286,.22],[.244,.73],[.13,.99],[0,.91],[-.13,.99],[-.244,.73],[-.286,.22],[-.286,-.3],[-.235,-.73],[-.13,-1.01]];
  const vertices=[[0,.153,0]],uv=[[.5,.5]];
  for(const [x,z]of outline){vertices.push([x,.145+Math.max(0,-z-.72)*.12,z]);uv.push([x/.59+.5,(z+1.12)/2.13]);}
  const faces=[];for(let i=0;i<outline.length;i++)faces.push([0,(i+1)%outline.length+1,i+1]);
  const deckMaterial=humanMaterial(0xffffff,boardTexture(profile));deckMaterial.side=THREE.DoubleSide;
  const deck=polygonMesh(parent,vertices,faces,deckMaterial,uv);
  const shellVertices=[],shellFaces=[];
  for(const[x,z]of outline){const rocker=Math.max(0,-z-.72)*.12;shellVertices.push([x,.14+rocker,z],[x*.91,.079+rocker,z]);}
  for(let i=0;i<outline.length;i++){const n=(i+1)%outline.length;shellFaces.push([i*2,n*2,n*2+1,i*2+1]);}
  shellVertices.push([0,.077,0]);for(let i=0;i<outline.length;i++)shellFaces.push([shellVertices.length-1,i*2+1,((i+1)%outline.length)*2+1]);
  polygonMesh(parent,shellVertices,shellFaces,humanMaterial(profile.boardColor));
  const finMaterial=humanMaterial('#1a2730');finMaterial.side=THREE.DoubleSide;
  for(const[x,z,scale]of [[0,.7,1],[-.14,.48,.72],[.14,.48,.72]])polygonMesh(parent,[[x,.082,z-.12],[x,.082,z+.18],[x,-.11*scale,z+.15],[x,-.07*scale,z-.015]],[[0,1,2,3]],finMaterial);
  return deck;
}
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
}export function createSurfer(settings=DEFAULT_PROFILE){
  const profile=validateProfile(settings),character=CHARACTERS[profile.character],outfit=OUTFITS[profile.outfit];
  const rig=new THREE.Group(),yaw=new THREE.Group(),rider=new THREE.Group(),boardPivot=new THREE.Group();rig.add(yaw);yaw.add(rider,boardPivot);
  const board=createBoard(boardPivot,profile);
  const skin=humanMaterial(0xffffff,pixelTexture(character.skin,'#dcb290',64)),hair=humanMaterial(character.hair);
  const shirt=humanMaterial(0xffffff,fabricTexture(outfit)),shorts=humanMaterial(0xffffff,fabricTexture(outfit,true));
  const plainShirt=humanMaterial(0xffffff,fabricTexture({...outfit,pattern:'none'}));
  const accent=humanMaterial(outfit.accent),cream=humanMaterial('#d7d3c6'),dark=humanMaterial('#252c30');
  const build=character.build||1,bare=outfit.top==='bare',wet=outfit.top==='wetsuit',open=['open','layered'].includes(outfit.top),trousers=outfit.bottom==='trousers';
  const loose=['baggy','oversized','raglan','open','layered','sweatshirt'].includes(outfit.top),extra=outfit.top==='sweatshirt'?.029:outfit.top==='oversized'?.025:loose?.014:0;
  const upperBody=new THREE.Group();rider.add(upperBody);
  const bodyRings=[[-.052,.163*build,.096],[.045,.149*build,.096],[.163,.158*build,.109],[.30,.185*build,.119],[.403,.210*build,.115],[.466,.222*build,.095],[.496,.174*build,.079],[.538,.060,.055]];
  const chest=loft(upperBody,bodyRings,skin,12);
  if(!bare){
    const clothRings=[[-.111,.181*build+extra,.116+extra,0,.003],[-.087,.189*build+extra,.123+extra],[.04,.181*build+extra,.118+extra,-.004,0],[.176,.175*build+extra,.126+extra],[.323,.198*build+extra,.139+extra,.002,0],[.419,.218*build+extra,.12+extra],[.476,.227*build+extra*.5,.097+extra*.7],[.503,.174*build,.078+extra*.3],[.532,.068,.060]];
    const clothGeometry=loftGeometry(clothRings,12),positions=clothGeometry.attributes.position;
    for(let i=0;i<positions.count;i++)if(positions.getY(i)<.05){const x=positions.getX(i),z=positions.getZ(i),weight=(.05-positions.getY(i))/.16;positions.setY(i,positions.getY(i)+Math.sin(x*31+z*19)*.009*weight);}
    clothGeometry.computeVertexNormals();
    if(open){
      chest.material=outfit.top==='layered'?cream:skin;
      const idx=Array.from(clothGeometry.index.array),kept=[];
      for(let i=0;i<idx.length;i+=3){const ids=idx.slice(i,i+3),z=ids.reduce((n,k)=>n+positions.getZ(k),0)/3,x=ids.reduce((n,k)=>n+Math.abs(positions.getX(k)),0)/3;if(!(z<-.067&&x<.075))kept.push(...ids);}
      clothGeometry.setIndex(kept);part(upperBody,clothGeometry,shirt);
      for(const side of[-1,1])polygonMesh(upperBody,[[side*.061,.525,-.061],[side*.157,.477,-.096],[side*.093,.353,-.150],[side*.045,.477,-.11]],[side<0?[3,2,1,0]:[0,1,2,3]],shirt);
    }else{
      const garment=part(upperBody,clothGeometry,shirt);if(outfit.top==='tank')garment.scale.x=.88;
      // Separate ribbed collar and sweatshirt hem follow the body, not rectangular blocks.
      const collar=loft(upperBody,[[.518,.071,.063],[.535,.064,.057]],outfit.top==='sweatshirt'?shirt:dark,12);
      if(outfit.top==='sweatshirt')loft(upperBody,[[-.113,.180*build+extra,.119+extra],[-.084,.183*build+extra,.121+extra]],shirt,12);
    }
  }else if(profile.character==='nova'){
    loft(upperBody,[[.267,.174*build,.119],[.331,.187*build,.124],[.382,.200*build,.121]],accent,12);
    for(const side of[-1,1])polygonMesh(upperBody,[[side*.14,.37,-.095],[side*.176,.37,-.079],[side*.174,.491,-.079],[side*.148,.497,-.084]],[side<0?[0,1,2,3]:[3,2,1,0]],accent);
  }
  const hips=loft(upperBody,[[-.150,.170*build,.112],[-.077,.184*build,.128],[.012,.177*build,.117],[.048,.157*build,.103]],wet?shirt:shorts,12);
  if(!wet){
    loft(upperBody,[[.028,.175*build,.119],[.048,.162*build,.108]],dark,12);
    detailLine(upperBody,[[-.015,.042,-.123],[-.029,-.035,-.13],[-.043,-.049,-.131]],'#d9d1b9');
    detailLine(upperBody,[[.015,.042,-.123],[.027,-.034,-.13],[.041,-.045,-.132]],'#d9d1b9');
  }
  loft(upperBody,[[.516,.051,.050],[.542,.047,.046],[.570,.050,.047]],skin,10);
  const {head}=createHead(upperBody,character,outfit,skin,hair,cream,accent);head.position.set(0,.562,-.006);
  if(outfit.necklace)for(let i=0;i<13;i++){
    const a=i/12*Math.PI;part(upperBody,new THREE.OctahedronGeometry(.007),i%4?cream:dark,Math.cos(a)*.083,.524-Math.sin(a)*.102,-.057-Math.sin(a)*.073);
  }
  const upperArmShape=[[0,.047,.042],[.18,.067,.057],[.41,.070,.057],[.72,.054,.047],[1,.043,.042]];
  const forearmShape=[[0,.044,.043],[.22,.052,.045],[.44,.047,.040],[.79,.031,.028],[1,.025,.025]];
  const leftArm=new THREE.Group(),rightArm=new THREE.Group();upperBody.add(leftArm,rightArm);
  function makeArm(group,side){
    const upper=bone(group,upperArmShape,skin,10),lower=bone(group,forearmShape,skin,10),sleeves=[];
    let fullSleeve=null;
    if(outfit.sleeves!=='none'){
      const long=outfit.sleeves==='long',sweat=outfit.top==='sweatshirt',sleeveMat=outfit.top==='raglan'?accent:plainShirt;
      const radius=sweat?.092:loose?.085:.066,hem=long?1.01:outfit.top==='oversized'?.94:.79;
      if(long){
        const r=sweat?.079:.052;
        fullSleeve=clothChain(group,[[0,radius*.75,radius*.71],[.22,radius,radius*.93],[.60,radius*.95,radius*.91],[.91,radius*.86,radius*.83],[1.13,r*.99,r*.96],[1.48,r*.96,r*.88],[1.83,r*.78,r*.76],[1.94,.039,.032],[2,.034,.030]],sleeveMat,10);
        upper.group.visible=lower.group.visible=false;
      }else sleeves.push({bone:bone(group,[[-.04,radius*.66,radius*.65],[.08,radius*.93,radius*.85],[.32,radius*1.04,radius*.96],[hem-.08,radius*.94,radius*.9],[hem,radius*.99,radius*.94]],sleeveMat,10),which:'upper'});
      if(outfit.sleeves==='threequarter'){
        const length=.54,r=.052;
        sleeves.push({bone:bone(group,[[0,r,r*.92],[length*.26,r*1.11,r*.97],[length*.58,r*.96,r*.87],[length*.86,r*.84,r*.80],[length,.034+(!long?.012:0),.03+(!long?.012:0)]],sleeveMat,10),which:'lower'});
      }
    }
    const hand=bone(group,[[0,.024,.014],[.22,.033,.016],[.47,.034,.016],[.79,.031,.014],[.94,.024,.012],[1,.017,.009]],skin,10);
    const thumb=bone(group,[[0,.012,.010],[.45,.013,.011],[1,.007,.007]],skin,8);
    return{set(shoulder,elbow,wrist){
      group.position.set(...shoulder);group.rotation.set(0,0,0);
      const e=elbow.map((v,i)=>v-shoulder[i]),w=wrist.map((v,i)=>v-shoulder[i]);upper.set([0,0,0],e);lower.set(e,w);
      fullSleeve?.set([0,0,0],e,w);
      for(const sleeve of sleeves)sleeve.bone.set(sleeve.which==='upper'?[0,0,0]:e,sleeve.which==='upper'?e:w);
      const d=new THREE.Vector3(...w).sub(new THREE.Vector3(...e)).normalize(),tip=new THREE.Vector3(...w).addScaledVector(d,.121);tip.z-=.007;hand.set(w,tip.toArray());
      const base=new THREE.Vector3(...w).addScaledVector(d,.038);base.x-=side*.027;const end=base.clone().add(new THREE.Vector3(-side*.025,-.025,-.019));thumb.set(base.toArray(),end.toArray());
    }};
  }
  const arms=[makeArm(leftArm,-1),makeArm(rightArm,1)];
  const shoeMaterial=humanMaterial(0xffffff,pixelTexture('#696d6a','#cecec2',32)),soleMaterial=humanMaterial('#d8d4c7'),sockMaterial=humanMaterial(0xffffff,pixelTexture('#c1c4bc','#ecebde',32));
  function makeLeg(side){
    const thigh=bone(rider,[[0,.080,.079],[.20,.103,.086],[.43,.098,.082],[.77,.074,.067],[1,.056,.055]],wet?shirt:skin,10);
    const calf=bone(rider,[[0,.056,.054],[.25,.069,.060],[.49,.061,.051],[.83,.035,.033],[1,.028,.03]],wet?shirt:skin,10);
    const baggy=wet||trousers?null:bone(rider,[[0,.098,.087],[.14,.119,.104],[.37,.130,.11],[.65,.117,.104],[.92,.119,.107],[1.05,.113,.101]],shorts,12);
    const trouserLeg=trousers?clothChain(rider,[[0,.101,.090],[.22,.124,.107],[.49,.130,.112],[.80,.120,.109],[1.02,.118,.106],[1.27,.120,.105],[1.49,.111,.105],[1.73,.13,.118,.006,0],[1.9,.126,.119,-.004,0],[2,.108,.105]],shorts,12):null;
    if(trousers)thigh.group.visible=calf.group.visible=false;
    if(baggy){
      const x=side*.122;
      polygonMesh(baggy.group,[[x,.39,-.071],[x+side*.009,.42,.060],[x+side*.011,.79,.066],[x+side*.004,.81,-.07]],[side>0?[0,1,2,3]:[3,2,1,0]],shorts,[[.02,.35],[.24,.35],[.24,.7],[.02,.7]]);
      polygonMesh(baggy.group,[[x+side*.012,.4,-.075],[x+side*.015,.42,.063],[x+side*.018,.49,.062],[x+side*.015,.52,-.074]],[side>0?[0,1,2,3]:[3,2,1,0]],shorts,[[.06,.35],[.24,.35],[.24,.42],[.06,.42]]);
    }
    const foot=bone(rider,[[0,.033,.026],[.18,.042,.029],[.43,.048,.027],[.71,.051,.024],[.92,.044,.016],[1,.026,.01]],wet?dark:skin,10);
    const shoe=bone(rider,[[-.16,.041,.029],[0,.048,.041],[.29,.057,.045],[.6,.061,.037],[.84,.057,.029],[1.07,.041,.018]],shoeMaterial,12);
    const sole=bone(rider,[[-.15,.043,.012],[.10,.052,.015],[.44,.060,.014],[.80,.059,.012],[1.07,.044,.011]],soleMaterial,12);
    const socks=bone(rider,[[.54,.044,.04],[.58,.043,.039],[.87,.034,.034],[1.04,.031,.031]],sockMaterial,10);
    return{set(hip,knee,ankle,toe,shoes){
      thigh.set(hip,knee);calf.set(knee,ankle);baggy?.set(hip,knee);trouserLeg?.set(hip,knee,ankle);foot.set(ankle,toe);
      foot.group.visible=!shoes;shoe.group.visible=sole.group.visible=socks.group.visible=shoes;
      if(shoes){shoe.set(ankle,toe);sole.set(ankle,toe);sole.group.position.y-=.026;socks.set(knee,ankle);}
    }};
  }
  const legs=[makeLeg(-1),makeLeg(1)];let activeMode='surf';
  function pose({charge=0,grab=0,air=false,time=0,lean=0,standing=false,mode}={}){
    if(mode)activeMode=mode;
    const shoes=activeMode==='park'||standing&&outfit.footwear==='trainers';
    rider.scale.set(1,1,1);rider.position.set(0,0,0);rider.rotation.set(0,standing?0:-Math.PI/2,0);
    const breathe=Math.sin(time*1.55)*.003;
    if(standing){
      upperBody.position.set(.008,1.012+breathe,.025);upperBody.rotation.set(-.035,0,-.026);head.rotation.set(.022,-.12,.012);
      legs[0].set([-.100,1.024,.025],[-.145,.553,-.006],[-.171,.104,.018],[-.180,.049,-.172],shoes);
      legs[1].set([.106,1.024,.025],[.160,.551,.039],[.202,.102,.079],[.213,.048,-.112],shoes);
      arms[0].set([-.217*build,.470,.004],[-.299,.209,-.038],[-.321,-.061,-.126]);
      arms[1].set([.217*build,.470,.004],[.280,.183,.018],[.277,-.094,-.039]);
    }else{
      const crouch=Math.min(1,charge*.78+grab*.52),hipY=.826-crouch*.16;
      upperBody.position.set(-lean*.034,hipY+breathe,-.024-crouch*.057);upperBody.rotation.set(-.15-crouch*.18,-.045,-lean*.09);head.rotation.set(.14,1.30,-.025);
      const kneeY=.517-crouch*.058,kneeZ=-.239-crouch*.044;
      legs[0].set([-.098,hipY+.012,-.024],[-.248,kneeY,kneeZ],[-.369,.218,.038],[-.383,.180,-.156],shoes);
      legs[1].set([.104,hipY+.012,-.024],[.262,kneeY+.009,kneeZ+.069],[.396,.219,.073],[.410,.181,-.117],shoes);
      const sway=Math.sin(time*1.8)*.015;
      arms[0].set([-.217*build,.470,.005],[-.408,.251,-.07],[-.510,.051+grab*.12,-.228]);
      arms[1].set([.217*build,.470,.005],[.385,.206+sway,.023],[.477,-.033-grab*.27,-.109-grab*.06]);
    }
  }
  pose();rig.userData.profile=profile;rig.userData.proportions={standingHeight:1.83,headHeight:.243,heads:7.5};
  return{rig,yaw,rider,boardPivot,board,leftArm,rightArm,hips,head,pose};
}export function disposeSurfer(surfer){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  surfer.rig.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  for(const g of geometries)g.dispose();for(const m of materials){if(m.map)textures.add(m.map);m.dispose();}for(const t of textures)t.dispose();
}
export class CustomizationPreview{
  constructor(container,profile){
    this.container=container;this.time=0;this.mode='character';this.angle=-.13;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(35,1,.05,30);
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:true});this.renderer.setClearColor(0x000000,0);this.renderer.setPixelRatio(1);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    container.appendChild(this.renderer.domElement);this.renderer.domElement.style.cssText='display:block;width:100%;height:100%;image-rendering:pixelated';
    this.scene.add(new THREE.HemisphereLight('#dce5ed','#544434',1.45));
    const key=new THREE.DirectionalLight('#fff0d6',2.25);key.position.set(-3,5,-4);this.scene.add(key);
    const rim=new THREE.DirectionalLight('#a5cbdc',1.05);rim.position.set(3,2,3);this.scene.add(rim);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const ctx=shadowCanvas.getContext('2d');
    const gradient=ctx.createRadialGradient(32,32,3,32,32,31);gradient.addColorStop(0,'rgba(0,0,0,.52)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const shadowMaterial=new THREE.MeshBasicMaterial({map:canvasTexture(shadowCanvas),transparent:true,depthWrite:false});
    this.shadow=part(this.scene,new THREE.PlaneGeometry(1.7,1),shadowMaterial,-.14,.013,0);this.shadow.rotation.x=-Math.PI/2;
    this.setProfile(profile);this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  }
  setProfile(profile){if(this.surfer){this.scene.remove(this.surfer.rig);disposeSurfer(this.surfer);}this.surfer=createSurfer(profile);this.scene.add(this.surfer.rig);this.surfer.pose({standing:true});}
  rotate(delta){this.angle+=delta;}
  portrait(){
    const target=new THREE.WebGLRenderTarget(160,176,{format:THREE.RGBAFormat});
    const linearTarget=new THREE.WebGLRenderTarget(160,176,{type:THREE.HalfFloatType});
    const output=new OutputPass();
    const camera=new THREE.PerspectiveCamera(29,160/176,.05,10);camera.position.set(.18,1.65,-1.04);camera.lookAt(0,1.535,0);
    const oldTarget=this.renderer.getRenderTarget(),oldYaw=this.surfer.rig.rotation.y,oldVisible=this.surfer.rider.visible;
    try{
      this.surfer.rig.rotation.y=-.10;this.surfer.rider.visible=true;this.surfer.pose({standing:true});
      // Render targets bypass output transforms; apply the same ACES and sRGB as the live preview.
      this.renderer.setRenderTarget(linearTarget);this.renderer.render(this.scene,camera);
      output.render(this.renderer,target,linearTarget);
      const pixels=new Uint8Array(160*176*4);this.renderer.readRenderTargetPixels(target,0,0,160,176,pixels);
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=176;const ctx=canvas.getContext('2d'),image=ctx.createImageData(160,176);
      for(let y=0;y<176;y++)image.data.set(pixels.subarray((175-y)*640,(176-y)*640),y*640);
      ctx.putImageData(image,0,0);return canvas.toDataURL('image/png');
    }finally{this.surfer.rig.rotation.y=oldYaw;this.surfer.rider.visible=oldVisible;this.renderer.setRenderTarget(oldTarget);output.dispose();linearTarget.dispose();target.dispose();}
  }
  resize(){const{width,height}=this.container.getBoundingClientRect();if(!width||!height)return;const w=Math.min(660,Math.max(320,width));this.renderer.setSize(w,Math.round(w*height/width),false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  update(dt,mode='character'){
    this.time+=dt;this.mode=mode;const s=this.surfer;s.pose({standing:true,time:this.time});s.rider.visible=mode==='character';
    s.rig.rotation.y=this.angle+Math.sin(this.time*.45)*.025;
    s.boardPivot.rotation.set(Math.PI/2,0,Math.PI-.045);
    s.boardPivot.position.set(mode==='board'?0:-.493,1.062,mode==='board'?0:-.032);
    // Fixed full-height framing keeps the whole adult figure, hat and board in view.
    const narrow=Math.max(1,.88/Math.max(.3,this.camera.aspect));
    this.camera.position.set(.90*narrow,1.19, -3.75*narrow);this.camera.lookAt(mode==='board'?0:-.13,1.05,0);
    this.shadow.visible=mode==='character';this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.resizeObserver.disconnect();disposeSurfer(this.surfer);this.shadow.geometry.dispose();this.shadow.material.map.dispose();this.shadow.material.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}


