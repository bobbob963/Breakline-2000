import * as THREE from 'three';
import { RIDER_ATLAS } from './rider-atlas.js';

let atlas;
export async function loadCharacterTextures() {
  if (atlas || typeof Image === 'undefined') return;
  atlas = new Image(); atlas.src = RIDER_ATLAS;
  await atlas.decode();
}
function canvas(w=128,h=128) { const c=document.createElement('canvas');c.width=w;c.height=h;return c; }
function texture(c) { const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;return t; }
function patch(ctx,col,row,x,y,w,h,crop=[0,0,1,1]) {
  if(!atlas?.complete) return;
  const tw=atlas.width/4,th=atlas.height/2;
  ctx.drawImage(atlas,(col+crop[0])*tw,(row+crop[1])*th,crop[2]*tw,crop[3]*th,x,y,w,h);
}
export function portraitTexture(id) {
  const c=canvas(128,128),ctx=c.getContext('2d');ctx.fillStyle='#9b755e';ctx.fillRect(0,0,128,128);
  patch(ctx,['kai','nova','reef','jax'].indexOf(id),0,0,0,128,128);
  return texture(c);
}
export function clothTexture(color,kind='torso',graphic=null) {
  const c=canvas(256,128),ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,256,128);ctx.globalCompositeOperation='soft-light';
  if(kind==='torso') {patch(ctx,2,1,0,0,128,128,[.12,0,.76,1]);patch(ctx,0,1,128,0,128,128,[.12,0,.76,1]);}
  else if(kind==='leg') {for(let i=0;i<2;i++)patch(ctx,1,1,i*128,0,128,128,[.23,0,.59,1]);}
  else if(kind==='hip') {for(let i=0;i<2;i++)patch(ctx,1,1,i*128,0,128,128,[.23,0,.59,.23]);}
  else {for(let i=0;i<2;i++)patch(ctx,3,1,i*128,0,128,128,[.28,.04,.40,.92]);}
  // Soft-light dyes the photographic folds without multiplying every outfit dark.
  ctx.globalCompositeOperation='source-over';
  if(graphic){ctx.globalAlpha=.80;graphic(ctx,192,34);ctx.globalAlpha=1;}
  return texture(c);
}
export function printedClothTexture(baseTexture) {
  const c=canvas(256,128),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(baseTexture.image,0,0,256,128);
  ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=.7;
  for(let i=0;i<2;i++)patch(ctx,1,1,i*128,0,128,128,[.23,0,.59,.6]);
  baseTexture.dispose();return texture(c);
}
