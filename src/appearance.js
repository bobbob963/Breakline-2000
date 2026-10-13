import * as THREE from 'three';
import { createCharacter } from './character-model.js';
import { getRewardBoard } from './board-rewards.js';
import { getTrialCosmeticSet } from './trial-cosmetics.js';
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
  afterhours: { name: 'AFTERHOURS', trialReward: 'afterhours', description: 'Ink-black oversized surf tee, violet panel shorts and a backwards cap. Time Trials prize.', top: 'oversized', shirt: '#252634', shorts: '#614966', accent: '#d88fbe', pattern: 'static', shortPattern: 'panel', hat: 'cap', sleeves: 'short' },
  ripcurrent: { name: 'RIP CURRENT', trialReward: 'ripcurrent', description: 'Seafoam long-sleeve rashguard, deep teal striped shorts and pale coral detailing. Time Trials prize.', top: 'rashguard', shirt: '#81b8af', shorts: '#244d59', accent: '#e3b69c', pattern: 'rashguard', shortPattern: 'stripe', sleeves: 'long' },
  furnace: { name: 'FURNACE', trialReward: 'furnace', description: 'Rust-red crew sweatshirt, full-length charcoal cargo trousers, cream cap and trainers. Time Trials prize.', top: 'sweatshirt', bottom: 'trousers', shirt: '#9e4e38', shorts: '#393b3b', accent: '#dab762', pattern: 'crewbolt', shortPattern: 'cargo', hat: 'whitecap', sleeves: 'long', footwear: 'trainers' },
  chronocrew: { name: 'CHRONO CREW', trialReward: 'chronocrew', description: 'Cream racing raglan with forest-green sleeves, checked shorts and a shell necklace. Time Trials champion prize.', top: 'raglan', shirt: '#ded7bf', shorts: '#b4b99e', accent: '#355b50', pattern: 'badge', shortPattern: 'checker', sleeves: 'threequarter', necklace: true },
};
export const BOARD_DESIGNS = {
  bolt: { name: 'LIGHTNING' }, checker: { name: 'CHECKER RIP' }, flames: { name: 'HOT ROD' },
  tribal: { name: 'BLACK TIDE' }, hibiscus: { name: 'HIBISCUS' }, skull: { name: 'SKULL REEF' },
  sunburst: { name: 'SOLAR FLARE' }, pinstripe: { name: 'PINSTRIPE' },
  afterhours: { name: 'AFTERHOURS', trialReward: 'afterhours', description: 'Magenta night-slash graphics, mint orbit and checker tail.' },
  ripcurrent: { name: 'RIP CURRENT', trialReward: 'ripcurrent', description: 'Layered curling surf, contour lines and coral sun.' },
  furnace: { name: 'FURNACE', trialReward: 'furnace', description: 'Industrial pressure dial, copper pipes and hazard stripes.' },
  chronocrew: { name: 'CHRONO CREW', trialReward: 'chronocrew', description: 'Championship stopwatch, racing stripes and finish-line checks.' },
};
export const DEFAULT_PROFILE = { character: 'kai', outfit: 'riptide', boardColor: '#f5d329', boardDesign: 'bolt', rewardBoard: null };
const colors = ['#f5d329', '#e95b39', '#24c5ba', '#8755bb', '#f5ede0'];
export function validateProfile(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return { character: Object.hasOwn(CHARACTERS, value.character) ? value.character : 'kai', outfit: Object.hasOwn(OUTFITS, value.outfit) ? value.outfit : 'riptide', boardColor: colors.includes(value.boardColor) ? value.boardColor : colors[0], boardDesign: Object.hasOwn(BOARD_DESIGNS, value.boardDesign) ? value.boardDesign : 'bolt', rewardBoard: getRewardBoard(value.rewardBoard)?.id ?? null };
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
  if (getRewardBoard(profile.rewardBoard)) return rewardBoardTexture(profile.rewardBoard);
  if (getTrialCosmeticSet(profile.boardDesign)) return trialBoardTexture(profile.boardDesign);
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
// Four screen-printed Time Trials decks with different compositions and motifs,
// not alternate colours of the ladder boards. Keep the same PS1 texture density.
export function trialBoardTexture(id) {
  const set = getTrialCosmeticSet(id);
  if (!set) return null;
  const c=document.createElement('canvas');c.width=64;c.height=256;
  const ctx=c.getContext('2d');
  const palettes={afterhours:['#222637','#cc709c','#9ed3bd'],ripcurrent:['#194956','#95d2c3','#edb893'],furnace:['#333b3a','#c27646','#e5c782'],chronocrew:['#e0d7b8','#2f5d50','#ad4935']};
  const [base,ink,accent]=palettes[id];
  const polygon=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
  const line=(points,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
  ctx.fillStyle=base;ctx.fillRect(0,0,64,256);
  if(id==='afterhours') {
    // A sharp night-surf slash across a long orbit, with an offset checker tail.
    polygon([[0,17],[29,17],[62,70],[42,95],[63,181],[36,181],[13,114],[32,82]],ink);
    ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(31,100,23,74,-.15,0,Math.PI*2);ctx.stroke();
    polygon([[4,156],[21,109],[36,91],[26,131],[54,114],[35,156],[19,181]],'#eee0c5');
    for(let y=182;y<212;y+=6)for(let x=0;x<64;x+=6)if((x/6+y/6)%2<1){ctx.fillStyle=ink;ctx.fillRect(x,y,6,6);}
    line([[8,23],[21,43],[14,49]],accent,2);
    ctx.fillStyle=accent;ctx.fillRect(47,163,3,29);ctx.fillRect(42,173,13,3);
  } else if(id==='ripcurrent') {
    // Stacked hooked wave crests flow down the full length of the deck.
    ctx.fillStyle=accent;ctx.beginPath();ctx.arc(37,48,17,0,Math.PI*2);ctx.fill();
    for(let i=0;i<3;i++){
      const y=40+i*54;
      ctx.fillStyle=i%2?'#468e99':ink;ctx.beginPath();ctx.moveTo(0,y+69);ctx.bezierCurveTo(14,y+33,32,y+11,59,y+30);ctx.bezierCurveTo(44,y+19,23,y+46,33,y+57);ctx.bezierCurveTo(47,y+36,63,y+60,64,y+79);ctx.lineTo(64,y+95);ctx.lineTo(0,y+95);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#d8e8ca';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(3,y+66);ctx.bezierCurveTo(17,y+38,35,y+17,54,y+27);ctx.stroke();
    }
    for(let i=0;i<4;i++)line([[9+i*3,10],[9+i*3,24],[4+i*3,35]],'#9abbaa',1);
    ctx.fillStyle='#e9d7b6';for(const [x,y]of [[46,64],[54,71],[22,112],[41,171]])ctx.fillRect(x,y,2,3);
  } else if(id==='furnace') {
    // Copper pipe runs surround a circular industrial pressure dial.
    line([[13,0],[13,67],[5,76],[5,186],[20,202]],'#111f27',10);
    line([[13,0],[13,67],[5,76],[5,186],[20,202]],ink,6);
    line([[51,0],[51,53],[58,61],[58,177],[44,192],[44,209]],ink,7);
    for(const y of [24,46,150,171]){ctx.fillStyle=accent;ctx.fillRect(8,y,10,4);ctx.fillRect(53,y+8,10,4);}
    ctx.fillStyle=ink;ctx.beginPath();ctx.arc(32,114,24,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=accent;ctx.beginPath();ctx.arc(32,114,19,0,Math.PI*2);ctx.fill();
    for(let i=0;i<9;i++){const a=Math.PI*.78+i*Math.PI*1.44/8;line([[32+Math.cos(a)*13,114+Math.sin(a)*13],[32+Math.cos(a)*17,114+Math.sin(a)*17]],'#283431',2);}
    line([[32,119],[39,101]],'#ae4231',3);ctx.fillStyle='#2e3934';ctx.fillRect(28,122,8,4);
    for(const y of [67,182]){ctx.fillStyle=accent;ctx.fillRect(17,y,30,13);for(let x=15;x<47;x+=12)polygon([[x,y],[x+6,y],[x+13,y+13],[x+7,y+13]],'#2a3434');}
  } else {
    // Stopwatch face at the nose, racing stripes and a flowing finish ribbon.
    ctx.fillStyle=ink;ctx.fillRect(10,0,9,256);ctx.fillRect(44,0,3,256);
    ctx.fillStyle=accent;ctx.fillRect(22,0,3,256);
    ctx.fillStyle=ink;ctx.fillRect(28,35,10,7);ctx.fillRect(31,42,4,8);
    ctx.beginPath();ctx.arc(33,74,23,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ece2c5';ctx.beginPath();ctx.arc(33,74,18,0,Math.PI*2);ctx.fill();
    for(let i=0;i<12;i++){const a=i*Math.PI/6;line([[33+Math.cos(a)*13,74+Math.sin(a)*13],[33+Math.cos(a)*16,74+Math.sin(a)*16]],ink,1);}
    line([[25,82],[33,74],[33,60]],accent,2);ctx.fillStyle=ink;ctx.fillRect(31,72,4,4);
    polygon([[0,132],[64,112],[64,167],[0,187]],ink);
    for(let y=0;y<4;y++)for(let x=0;x<9;x++)if((x+y)%2===0)polygon([[x*8,136+y*10-x*2.5],[x*8+8,133.5+y*10-x*2.5],[x*8+8,143.5+y*10-x*2.5],[x*8,146+y*10-x*2.5]],'#e2d9b9');
    ctx.fillStyle=accent;ctx.font='bold italic 24px monospace';ctx.textAlign='center';ctx.fillText('99',35,207);
  }
  ctx.fillStyle='#172b32';ctx.fillRect(7,217,50,20);ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.strokeRect(7,217,50,20);
  ctx.fillStyle='#f2e5c9';ctx.textAlign='center';ctx.font='bold 5px monospace';ctx.fillText(set.name,32,225);ctx.font='bold 5px monospace';ctx.fillText('TIME TRIALS / 99',32,233);
  ctx.globalAlpha=.06;for(let i=0;i<170;i++){ctx.fillStyle=i%2?'#fff4d3':'#111b22';ctx.fillRect((i*37)%64,(i*71)%256,1,i%7?1:3);}ctx.globalAlpha=1;
  const texture=canvasTexture(c);texture.name='trial-deck-'+id;return texture;
}
// Original screen-printed prize decks. Art stays crisp and angular at the same
// texture density as the standard board; reward gear never changes rider shape.
export function rewardBoardTexture(id) {
  const reward=getRewardBoard(id);
  if(!reward)return null;
  const c=document.createElement('canvas');c.width=64;c.height=256;
  const ctx=c.getContext('2d'),{primary,secondary,accent}=reward.colors;
  ctx.fillStyle=primary;ctx.fillRect(0,0,64,256);
  ctx.fillStyle=secondary;ctx.fillRect(5,0,2,256);ctx.fillRect(57,0,2,256);
  const polygon=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
  if(id==='guitar') {
    // Offset electric-guitar silhouette, cream pickguard, frets and strings.
    polygon([[29,11],[42,11],[39,30],[35,35],[35,107],[48,120],[56,111],[56,149],[48,170],[21,174],[9,156],[11,126],[22,111],[27,116],[28,35]],secondary);
    polygon([[30,109],[40,125],[43,151],[32,164],[18,154],[17,135],[25,123]],accent);
    ctx.fillStyle='#172329';ctx.fillRect(27,39,8,80);ctx.fillRect(25,133,17,5);ctx.fillRect(27,148,13,5);
    ctx.strokeStyle='#eedfc1';ctx.lineWidth=.6;
    for(let x=28;x<=34;x+=2){ctx.beginPath();ctx.moveTo(x,24);ctx.lineTo(x,157);ctx.stroke();}
    for(let y=43;y<109;y+=8)ctx.fillRect(27,y,9,1);
    ctx.fillStyle=accent;for(const [x,y]of [[13,61],[46,85],[14,186],[46,191]]){ctx.fillRect(x,y-12,2,14);ctx.beginPath();ctx.ellipse(x-2,y,4,3,-.4,0,Math.PI*2);ctx.fill();ctx.fillRect(x,y-13,6,3);}
  } else if(id==='lightning') {
    polygon([[45,8],[16,95],[29,92],[12,193],[53,79],[36,86],[56,8]],secondary);
    polygon([[38,31],[26,88],[38,81],[23,148],[47,81],[31,89]],accent);
    polygon([[8,48],[19,66],[12,99],[24,80],[18,57]],accent);
    polygon([[52,132],[43,155],[49,181],[38,165],[43,145]],accent);
    ctx.strokeStyle=secondary;ctx.lineWidth=2;for(const y of [199,204]){ctx.beginPath();ctx.moveTo(14,y);ctx.lineTo(49,y-5);ctx.stroke();}
  } else if(id==='vortex') {
    for(let i=0;i<6;i++){ctx.save();ctx.translate(32,114);ctx.scale(.6,1.4);ctx.rotate(i*Math.PI/3);polygon([[0,-9],[18,-17],[29,-7],[22,14],[11,24],[18,4],[10,-4]],i%2?secondary:accent);ctx.restore();}
    ctx.fillStyle='#122f38';ctx.beginPath();ctx.ellipse(32,114,8,16,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<4;i++){ctx.strokeStyle=secondary;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(14,15+i*12);ctx.quadraticCurveTo(28,34+i*12,49,15+i*12);ctx.stroke();}
    polygon([[12,167],[30,176],[51,162],[40,188],[22,199]],accent);
  } else if(id==='solar') {
    ctx.save();ctx.translate(32,108);ctx.scale(1,2.9);sun(ctx,0,0,37,secondary,12);ctx.restore();
    sun(ctx,32,108,26,accent,12);ctx.fillStyle='#f9e7ae';ctx.beginPath();ctx.arc(32,108,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=secondary;for(let i=0;i<5;i++)ctx.fillRect(13+i*2,181+i*5,38-i*4,2);
  } else if(id==='afterburner') {
    // A cream turbine inlet, purple blades and jagged orange exhaust. Broad
    // shapes stay readable on the same 64px deck atlas as the original prizes.
    polygon([[8,0],[19,0],[55,207],[41,207]],secondary);
    polygon([[51,0],[59,0],[23,207],[12,207]],'#aa438c');
    polygon([[25,113],[19,147],[28,141],[17,196],[34,177],[43,205],[42,155],[51,168],[39,114]],secondary);
    polygon([[29,114],[23,142],[31,136],[25,176],[34,158],[39,188],[38,145],[44,154],[36,112]],accent);
    polygon([[32,126],[30,148],[35,140],[35,168],[39,157],[35,126]],primary);
    ctx.fillStyle=secondary;ctx.beginPath();ctx.ellipse(32,83,25,36,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=accent;ctx.beginPath();ctx.ellipse(32,83,21,31,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(32,83);ctx.scale(.68,1);
    for(let i=0;i<7;i++){ctx.save();ctx.rotate(i*Math.PI*2/7);polygon([[2,-7],[5,-28],[16,-22],[18,-13],[8,-3]],i%2?'#704578':secondary);ctx.restore();}
    ctx.restore();ctx.fillStyle=primary;ctx.beginPath();ctx.ellipse(32,83,6,9,0,0,Math.PI*2);ctx.fill();
    for(const side of [-1,1])for(let i=0;i<3;i++)polygon([[32+side*(21-i*2),28+i*11],[32+side*(13-i*2),22+i*11],[32+side*(14-i*2),28+i*11],[32+side*(22-i*2),34+i*11]],accent);
    ctx.fillStyle=secondary;ctx.font='bold italic 12px monospace';ctx.textAlign='center';ctx.fillText('03',32,204);
  } else if(id==='deadtime') {
    // Broken chronometer print: two oversized hands, minute ticks and a split
    // dial. This is original deck artwork, kept at the existing texture scale.
    polygon([[9,13],[19,13],[51,198],[41,198]],secondary);
    polygon([[52,10],[56,10],[22,203],[18,203]],accent);
    ctx.fillStyle=secondary;ctx.beginPath();ctx.ellipse(32,105,25,58,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=accent;ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(32,105,22,53,0,.16,Math.PI*1.40);ctx.stroke();
    ctx.beginPath();ctx.ellipse(32,105,22,53,0,Math.PI*1.53,Math.PI*1.91);ctx.stroke();
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,major=i%3===0;
      ctx.lineWidth=major?2:1;ctx.beginPath();
      ctx.moveTo(32+Math.sin(a)*(major?15:18),105-Math.cos(a)*(major?39:45));
      ctx.lineTo(32+Math.sin(a)*20,105-Math.cos(a)*49);ctx.stroke();
    }
    polygon([[29,114],[28,95],[33,64],[36,97],[34,114]],accent);
    polygon([[28,100],[46,118],[48,130],[37,123]],'#f4eccb');
    ctx.fillStyle=primary;ctx.beginPath();ctx.arc(32,105,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=accent;ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('05:00',32,182);
    for(let i=0;i<3;i++)polygon([[15+i*10,193],[24+i*10,193],[19+i*10,204],[10+i*10,204]],i%2?accent:secondary);
  } else if(id==='sky') {
    for(const side of [-1,1]){ctx.save();ctx.translate(32,108);ctx.scale(side,1);polygon([[0,38],[4,-59],[24,-89],[25,-55],[14,-35],[24,-47],[19,-22],[10,-8],[20,-19],[14,8]],secondary);ctx.restore();}
    polygon([[29,43],[35,29],[34,137],[29,162]],accent);
    for(let i=0;i<4;i++){ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(10,173+i*7);ctx.bezierCurveTo(27,167+i*7,38,190+i*4,53,173+i*7);ctx.stroke();}
  }
  ctx.fillStyle='#14232b';ctx.fillRect(10,214,44,22);ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.strokeRect(10,214,44,22);
  ctx.fillStyle='#f5e9d2';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('B / 99',32,223);ctx.font='bold 5px monospace';ctx.fillText(reward.name,32,231);
  ctx.globalAlpha=.075;for(let i=0;i<160;i++){ctx.fillStyle=i%2?'#ffffff':'#070d18';ctx.fillRect((i*29)%64,(i*71)%256,1,3);}ctx.globalAlpha=1;
  const texture=canvasTexture(c);texture.name='reward-deck-'+id;return texture;
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
function createBoard(parent,profile){
  const outline=[[0,-1.11],[.13,-1.01],[.235,-.73],[.286,-.3],[.286,.22],[.244,.73],[.13,.99],[0,.91],[-.13,.99],[-.244,.73],[-.286,.22],[-.286,-.3],[-.235,-.73],[-.13,-1.01]];
  const vertices=[[0,.153,0]],uv=[[.5,.5]];
  for(const [x,z]of outline){vertices.push([x,.145+Math.max(0,-z-.72)*.12,z]);uv.push([x/.59+.5,(z+1.12)/2.13]);}
  const faces=[];for(let i=0;i<outline.length;i++)faces.push([0,(i+1)%outline.length+1,i+1]);
  const deckMaterial=humanMaterial(0xffffff,boardTexture(profile));deckMaterial.side=THREE.DoubleSide;
  const deck=polygonMesh(parent,vertices,faces,deckMaterial,uv);
  deck.name='surfboard-deck';
  deck.userData.rewardBoard=profile.rewardBoard;
  // Interpolate the real straight right rail between its two authored deck
  // vertices, so contact follows the generated board, including its pivots.
  const railFront=new THREE.Vector3(...vertices[4]),railBack=new THREE.Vector3(...vertices[5]);
  deck.userData.grabRailLocal=railFront.clone().lerp(railBack,-railFront.z/(railBack.z-railFront.z));
  const shellVertices=[],shellFaces=[];
  for(const[x,z]of outline){const rocker=Math.max(0,-z-.72)*.12;shellVertices.push([x,.14+rocker,z],[x*.91,.079+rocker,z]);}
  for(let i=0;i<outline.length;i++){const n=(i+1)%outline.length;shellFaces.push([i*2,n*2,n*2+1,i*2+1]);}
  shellVertices.push([0,.077,0]);for(let i=0;i<outline.length;i++)shellFaces.push([shellVertices.length-1,i*2+1,((i+1)%outline.length)*2+1]);
  polygonMesh(parent,shellVertices,shellFaces,humanMaterial(getRewardBoard(profile.rewardBoard)?.colors.secondary??profile.boardColor));
  const finMaterial=humanMaterial('#1a2730');finMaterial.side=THREE.DoubleSide;
  for(const[x,z,scale]of [[0,.7,1],[-.14,.48,.72],[.14,.48,.72]])polygonMesh(parent,[[x,.082,z-.12],[x,.082,z+.18],[x,-.11*scale,z+.15],[x,-.07*scale,z-.015]],[[0,1,2,3]],finMaterial);
  return deck;
}
export function createSurfer(settings=DEFAULT_PROFILE,characterFactory=createCharacter){
  const profile=validateProfile(settings),character=CHARACTERS[profile.character],outfit=OUTFITS[profile.outfit];
  const rig=new THREE.Group(),yaw=new THREE.Group(),boardPivot=new THREE.Group();rig.add(yaw);yaw.add(boardPivot);
  const board=createBoard(boardPivot,profile);
  const person=characterFactory({id:profile.character,character,outfit,fabricTexture});yaw.add(person.rider);
  rig.userData.profile=profile;rig.userData.landmarks=person.landmarks;
  function pose(options={}){
    // World and preview callers set board transforms before posing. Updating
    // the complete hierarchy here also respects transformed scene ancestors.
    rig.updateWorldMatrix(true,true);
    const boardTargetWorld=board.localToWorld(board.userData.grabRailLocal.clone());
    // Tweak/combo airs move and bank the held board. Foot bindings are authored
    // on that same deck, so leg IK follows its actual final world transform.
    // Independent kickflips retain the existing loose-board choreography.
    const boardFeetWorld=options.tweak>0||options.comboPose?.plantFeet>0?[
      {ankle:new THREE.Vector3(-.035,.215,-.34),toe:new THREE.Vector3(.163,.181,-.36)},
      {ankle:new THREE.Vector3(-.069,.215,.36),toe:new THREE.Vector3(.128,.181,.395)},
    ].map(foot=>({...Object.fromEntries(Object.entries(foot).map(([key,point])=>[key,board.localToWorld(point)])),up:new THREE.Vector3(0,1,0).transformDirection(board.matrixWorld)})):null;
    person.pose({...options,boardTargetWorld,boardFeetWorld});
  }
  return{rig,yaw,boardPivot,board,...person,pose};
}
export function disposeSurfer(surfer){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  surfer.rig.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  for(const g of geometries)g.dispose();for(const m of materials){if(m.map)textures.add(m.map);m.dispose();}for(const t of textures)t.dispose();
}
export class CustomizationPreview{
  constructor(container,profile){
    this.container=container;this.time=0;this.mode='character';this.angle=.08;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(35,1,.05,30);
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:true});this.renderer.setClearColor(0x000000,0);this.renderer.setPixelRatio(1);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    container.appendChild(this.renderer.domElement);this.renderer.domElement.style.cssText='display:block;width:100%;height:100%;image-rendering:pixelated';
    this.scene.add(new THREE.HemisphereLight('#dce5ed','#544434',1.0));
    const key=new THREE.DirectionalLight('#fff0d6',1.65);key.position.set(-3,5,-4);this.scene.add(key);
    const rim=new THREE.DirectionalLight('#a5cbdc',.55);rim.position.set(3,2,3);this.scene.add(rim);
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
    s.boardPivot.rotation.order='YXZ';s.boardPivot.rotation.set(Math.PI/2,mode==='board'?0:1.13,Math.PI-.10);
    s.boardPivot.scale.setScalar(mode==='board'?1:.80);
    s.boardPivot.position.set(mode==='board'?0:-.34,mode==='board'?1.062:.89,mode==='board'?0:.10);
    // Fixed full-height framing keeps the whole adult figure, hat and board in view.
    const narrow=Math.max(1,.88/Math.max(.3,this.camera.aspect));
    this.camera.position.set(.32*narrow,mode==='board'?1.26:1.15,(mode==='board'?-4.1:-3.13)*narrow);this.camera.lookAt(mode==='board'?0:-.04,mode==='board'?1.062:.95,0);
    this.shadow.visible=mode==='character';this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.resizeObserver.disconnect();disposeSurfer(this.surfer);this.shadow.geometry.dispose();this.shadow.material.map.dispose();this.shadow.material.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}


