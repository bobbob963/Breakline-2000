import * as THREE from 'three';

export const GRAFFITI_WORDS=Object.freeze(['NICE!','WOW!','SICK!','RAD!','FRESH!','STYLE!']);

// Original cut-letter alphabet: broad uneven stems, pointed terminals and
// overshooting joins retain a hand-painted silhouette at a small game scale.
// Each glyph has an outer contour and optional counters (the holes in letters).
const GLYPHS={
  N:[[[0,109],[4,3],[27,0],[50,60],[50,5],[76,0],[69,111],[47,108],[24,52],[23,105]]],
  I:[[[1,5],[63,0],[61,23],[43,27],[39,83],[61,82],[56,108],[0,111],[3,87],[17,85],[22,27],[0,28]]],
  C:[[[73,5],[65,34],[48,24],[30,27],[23,75],[38,88],[67,74],[64,104],[35,114],[6,99],[0,64],[10,19],[36,0]]],
  E:[[[3,5],[72,0],[68,27],[30,29],[28,44],[60,40],[57,64],[25,67],[24,85],[70,77],[64,108],[0,112]]],
  W:[[[0,6],[25,0],[31,63],[48,22],[66,19],[75,65],[83,0],[106,7],[87,110],[66,106],[54,68],[37,111],[14,106]]],
  O:[[[22,3],[57,0],[75,20],[72,87],[51,110],[18,108],[0,87],[2,24]],[[28,28],[25,77],[42,84],[49,71],[51,29]]],
  S:[[[17,8],[68,0],[66,29],[31,27],[26,41],[58,48],[70,67],[60,98],[14,113],[0,88],[43,84],[46,73],[12,66],[2,47],[6,25]]],
  K:[[[3,6],[31,0],[26,43],[58,3],[84,9],[48,56],[78,104],[47,113],[25,69],[23,105],[0,110]]],
  R:[[[3,7],[53,0],[75,17],[73,48],[54,64],[78,105],[49,112],[26,75],[23,106],[0,111]],[[29,27],[27,50],[48,46],[50,27]]],
  A:[[[28,4],[57,0],[83,107],[53,111],[48,85],[27,86],[19,111],[0,104]],[[35,35],[30,65],[45,63]]],
  D:[[[5,7],[42,0],[70,18],[78,50],[66,95],[40,112],[0,108]],[[30,29],[26,82],[42,82],[50,65],[49,40]]],
  F:[[[4,5],[75,0],[68,30],[31,27],[30,47],[63,42],[56,69],[26,72],[24,107],[0,113]]],
  H:[[[3,3],[30,0],[27,42],[51,38],[54,4],[81,1],[72,108],[46,113],[48,68],[24,71],[21,105],[0,110]]],
  T:[[[0,8],[88,0],[82,31],[53,29],[45,110],[19,113],[24,31],[1,35]]],
  Y:[[[0,7],[28,0],[44,40],[61,0],[87,8],[55,69],[48,110],[21,111],[28,67]]],
  L:[[[4,5],[32,0],[25,84],[68,78],[60,109],[0,112]]],
  '!':[[[7,2],[33,0],[22,73],[7,77]],[[7,88],[25,84],[26,106],[1,111]]],
};
const PALETTES=[
  ['#eeff54','#78fae6','#15bac7','#ed4ebe'],
  ['#fff270','#ff9373','#f048bf','#54e8fa'],
  ['#b3ff60','#59e2ee','#299bd7','#ff68ce'],
  ['#ff93d0','#ff5ca1','#cc31a3','#bcff57'],
  ['#fbff84','#c4f857','#55cbbc','#f44ab2'],
  ['#acf8ff','#55d9f4','#628eff','#ffb944'],
];
const DARK='#151423',CREAM='#fff2c6';

function polygon(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function glyphPath(c,contours){c.beginPath();for(const points of contours){points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}}
function strokeLine(c,points,color,width){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}

/** Static, original graffiti lettering. Canvas work happens at construction only. */
export function createGraffitiTexture(word,index=0){
  const text=String(word).toUpperCase();
  if(!GRAFFITI_WORDS.includes(text))throw new RangeError('Unknown reward graffiti word: '+word);
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=320;
  const c=canvas.getContext('2d');
  const palette=PALETTES[((index%PALETTES.length)+PALETTES.length)%PALETTES.length];
  let seed=137+index*419+text.length*67;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  c.lineJoin='round';c.lineCap='round';

  // Two broad spray strokes and loose paint spatter frame the text without
  // becoming a rectangular billboard when the texture is used by a sprite.
  c.save();c.translate(320,161);c.rotate(-.09);
  for(let i=0;i<98;i++){
    const angle=random()*Math.PI*2,r=.64+random()*.42;
    c.globalAlpha=.22+random()*.60;c.fillStyle=i%3?palette[3]:palette[1];
    c.beginPath();c.arc(Math.cos(angle)*268*r,Math.sin(angle)*111*r,1.4+random()*5.7,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
  for(const [y,color]of [[66,palette[3]],[-47,palette[2]]]){
    polygon(c,[[-261,y+12],[-247,y-10],[204,y-21],[253,y-3],[196,y+13],[-221,y+28]]);
    c.fillStyle=DARK;c.strokeStyle=CREAM;c.lineWidth=8;c.stroke();c.fill();
    strokeLine(c,[[-239,y+8],[-151,y-1],[194,y-9],[224,y]],color,11);
  }
  c.restore();

  const advances=[...text].map(letter=>Math.max(...GLYPHS[letter][0].map(p=>p[0]))-6);
  const units=advances.reduce((a,b)=>a+b,0)+6,scale=Math.min(1.64,474/units);
  const left=320-units*scale/2;
  let pen=0;
  const letters=[...text].map((letter,i)=>{
    const width=advances[i]+6;
    const item={letter,x:left+(pen+width/2)*scale,y:155+[-4,3,-1,5,-3,1][i%6],width,angle:[-.075,.035,-.035,.055,-.025,.045][i%6]};
    pen+=advances[i];return item;
  });
  const atLetter=(item,draw,dx=0,dy=0)=>{
    c.save();c.translate(item.x+dx,item.y+dy);c.rotate(item.angle-.035);c.scale(scale,scale);c.transform(1,0,-.11,1,0,0);c.translate(-item.width/2,-56);glyphPath(c,GLYPHS[item.letter]);draw(item);c.restore();
  };

  // Outer cream contour and several offset layers make the word read as one
  // interlocking tag. Painting all outlines before fills keeps joins coherent.
  for(const item of letters)atLetter(item,()=>{c.strokeStyle=CREAM;c.lineWidth=15;c.stroke();c.fillStyle=CREAM;c.fill('evenodd');},13,16);
  for(let offset=15;offset>=0;offset-=3)for(const item of letters)atLetter(item,()=>{c.strokeStyle=DARK;c.lineWidth=10;c.stroke();c.fillStyle=offset>8?'#56306c':DARK;c.fill('evenodd');},offset*.8,offset);
  for(const item of letters)atLetter(item,()=>{c.strokeStyle=CREAM;c.lineWidth=15;c.stroke();},-1,-1);
  for(const item of letters)atLetter(item,()=>{c.strokeStyle=DARK;c.lineWidth=8;c.stroke();});
  for(const item of letters)atLetter(item,()=>{
    const fill=c.createLinearGradient(0,0,5,113);fill.addColorStop(0,palette[0]);fill.addColorStop(.48,palette[1]);fill.addColorStop(.52,palette[1]);fill.addColorStop(1,palette[2]);
    c.fillStyle=fill;c.fill('evenodd');c.strokeStyle=DARK;c.lineWidth=2.3;c.stroke();
    c.save();c.clip('evenodd');
    // Thin cut-in highlights and a second sprayed color band look painted onto
    // the letter itself, rather than being a standard computer text shadow.
    strokeLine(c,[[-10,89],[99,71]],palette[3],7);
    strokeLine(c,[[7,16],[item.width-5,9]],CREAM,3);
    for(let j=0;j<9;j++){c.globalAlpha=.20+random()*.20;c.fillStyle=j%2?CREAM:DARK;c.fillRect(random()*item.width,25+random()*79,1+random()*2,1+random()*3);}
    c.restore();
  });

  // Paint runs come from the tag's lower edge. Their narrow necks and rounded
  // beads remain visible without covering the rider beneath the effect.
  for(let i=0;i<3;i++){
    const item=letters[Math.min(i*2,letters.length-2)];
    const x=item.x-11+i*5,y=item.y+53*scale,length=19+i*8;
    strokeLine(c,[[x,y],[x-2,y+length]],DARK,9);
    strokeLine(c,[[x-1,y-3],[x-3,y+length]],i===1?palette[3]:palette[2],4);
    c.fillStyle=palette[2];c.beginPath();c.arc(x-3,y+length+1,3.4,0,Math.PI*2);c.fill();
  }

  // Arrow tails and a crown are familiar graffiti gestures; asymmetric shapes
  // distinguish this from comic-book speech bubbles or clean HUD typography.
  const arrow=[[531,187],[568,162],[552,148],[613,134],[592,193],[579,176],[549,204]];
  polygon(c,arrow);c.fillStyle=palette[3];c.strokeStyle=CREAM;c.lineWidth=10;c.stroke();c.strokeStyle=DARK;c.lineWidth=5;c.stroke();c.fill();
  strokeLine(c,[[565,162],[594,145]],CREAM,3);
  c.save();c.translate(92,57);c.rotate(-.18);
  polygon(c,[[-24,15],[-32,-9],[-12,-1],[1,-24],[13,-3],[37,-16],[25,15]]);c.fillStyle=palette[0];c.strokeStyle=DARK;c.lineWidth=5;c.stroke();c.fill();
  strokeLine(c,[[-20,23],[26,20]],CREAM,4);c.restore();
  for(const [x,y,r]of [[550,64,11],[74,220,8]]){
    strokeLine(c,[[x-r,y],[x+r,y]],DARK,7);strokeLine(c,[[x,y-r],[x,y+r]],DARK,7);
    strokeLine(c,[[x-r,y],[x+r,y]],CREAM,3);strokeLine(c,[[x,y-r],[x,y+r]],CREAM,3);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.name='graffiti-word-'+text.replace(/[^A-Z]/g,'').toLowerCase();
  texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
