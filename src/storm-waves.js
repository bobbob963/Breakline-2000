// Authoritative ocean surface and Storm curl geometry. Rendering and collision
// sample these same cross sections; there are no invisible barrel hit zones.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
export const waveCrest=(z,time)=>-9+Math.sin(z*.026+time*.38)*1.1;
export function waveHeight(x,z,time) {
  return 3.9*Math.exp(-(((x-waveCrest(z,time))/5.4)**2))
    +Math.sin(z*.07+time*1.2)*.32+Math.sin(z*.34+x*.45+time*2)*.1;
}

export const STORM_BARREL_FIRST=180;
export const STORM_BARREL_SPACING=230;
export const STORM_BARREL_LENGTH=52;
export const STORM_BARREL_ARC_SEGMENTS=24;
export const STORM_BARREL_CLOSE_DURATION=1.2;
// Each later stage remains a little harder without exceeding safe speed,
// current or tunnel-width limits. Half strength arrives at two minutes.
export const stormDifficulty=elapsed=>1-120/(Math.max(0,elapsed)+120);

export function stormBarrel(index) {
  index=Math.max(0,Math.floor(index));
  const startDistance=STORM_BARREL_FIRST+index*STORM_BARREL_SPACING;
  return {id:`storm-barrel-${index}`,index,startDistance,endDistance:startDistance+STORM_BARREL_LENGTH,
    centerDistance:startDistance+STORM_BARREL_LENGTH/2,z:-startDistance-STORM_BARREL_LENGTH/2,
    length:STORM_BARREL_LENGTH,approachDistance:startDistance-70};
}

export function stormBarrelsNear(distance,behind=80,ahead=420) {
  const first=Math.max(0,Math.floor((distance-behind-STORM_BARREL_FIRST-STORM_BARREL_LENGTH)/STORM_BARREL_SPACING));
  const last=Math.max(-1,Math.floor((distance+ahead-STORM_BARREL_FIRST)/STORM_BARREL_SPACING));
  const result=[];
  for(let i=first;i<=last;i++) {
    const barrel=stormBarrel(i);
    if(barrel.endDistance>=distance-behind&&barrel.startDistance<=distance+ahead)result.push(barrel);
  }
  return result;
}

function barrelTiming(barrel,time,timings) {
  if(typeof timings==='function')return timings(barrel.index,time);
  if(timings instanceof Map)return timings.get(barrel.index)??timings.get(barrel.id);
  if(Array.isArray(timings))return timings.find(run=>run?.index===barrel.index);
  if(timings?.index===barrel.index)return timings;
  return timings?.[barrel.index]??timings?.[barrel.id]??null;
}

// A deadline starts the visible collapse; it is never itself a collision. A
// surfer outside the falling sheet remains safe, even after the deadline.
export function barrelClosureProgress(barrel,time,timings) {
  const run=barrelTiming(barrel,time,timings);
  if(!run||!Number.isFinite(run.deadline))return 0;
  const duration=Number.isFinite(run.closeDuration)?Math.max(.2,run.closeDuration):STORM_BARREL_CLOSE_DURATION;
  return clamp((time-run.deadline)/duration,0,1);
}

export function barrelCrossSection(barrel,z,time,timings) {
  const distance=-z,progress=clamp((distance-barrel.startDistance)/barrel.length,0,1);
  const active=distance>=barrel.startDistance&&distance<=barrel.endDistance;
  const envelope=active?smooth(Math.min(distance-barrel.startDistance,barrel.endDistance-distance)/8):0;
  const innerRadius=4.6-.4*stormDifficulty(time),endAngle=3.36;
  const centerX=waveCrest(z,time)+4.25,footX=centerX+Math.cos(endAngle)*innerRadius;
  // Position the curl from its foot on the wave, instead of floating a tube at
  // a fixed height. Each skin has its own anchored foot (including the outer).
  const centerY=waveHeight(footX,z,time)-Math.sin(endAngle)*innerRadius;
  const closingProgress=barrelClosureProgress(barrel,time,timings),run=barrelTiming(barrel,time,timings);
  return {active,progress,envelope,centerX,centerY,innerRadius,outerRadius:innerRadius+.38,z,time,
    startAngle:endAngle-(endAngle+.25)*envelope,endAngle,closingProgress,
    timeRemaining:run&&Number.isFinite(run.deadline)?Math.max(0,run.deadline-time):null};
}

function sectionVertex(section,arc,outer=false) {
  const angle=section.startAngle+(section.endAngle-section.startAngle)*arc;
  const radius=outer?section.outerRadius:section.innerRadius;
  const x=section.centerX+Math.cos(angle)*radius;
  const footX=section.centerX+Math.cos(section.endAngle)*radius;
  const footOffset=waveHeight(footX,section.z,section.time)-(section.centerY+Math.sin(section.endAngle)*radius);
  const rise=section.centerY+Math.sin(angle)*radius+footOffset*smooth((angle-2.86)/.5);
  const floor=waveHeight(x,section.z,section.time);
  // The roof and lip fold down onto the existing face. Anchored feet do not
  // move, and the tube keeps open axial ends throughout the collapse.
  const y=rise+(floor-rise)*smooth(section.closingProgress)*.985;
  return {x,y,z:section.z};
}

export function barrelSectionPoint(section,arc,outer=false) {
  const position=clamp(arc,0,1)*STORM_BARREL_ARC_SEGMENTS;
  const index=Math.min(STORM_BARREL_ARC_SEGMENTS-1,Math.floor(position)),mix=position-index;
  const a=sectionVertex(section,index/STORM_BARREL_ARC_SEGMENTS,outer);
  const b=sectionVertex(section,(index+1)/STORM_BARREL_ARC_SEGMENTS,outer);
  return {x:a.x+(b.x-a.x)*mix,y:a.y+(b.y-a.y)*mix,z:section.z};
}

// arc=0 is the falling right lip; arc=1 is the left foot on the existing wave.
// Interpolate exactly the visible low-poly sections, including their facets.
export function barrelSurfacePoint(barrel,z,arc,time,outer=false,timings) {
  return barrelSectionPoint(barrelCrossSection(barrel,z,time,timings),arc,outer);
}

function shellPolygon(section) {
  if(section.shell)return section.shell;
  const polygon=[];
  for(let i=0;i<=STORM_BARREL_ARC_SEGMENTS;i++)polygon.push(sectionVertex(section,i/STORM_BARREL_ARC_SEGMENTS));
  for(let i=STORM_BARREL_ARC_SEGMENTS;i>=0;i--)polygon.push(sectionVertex(section,i/STORM_BARREL_ARC_SEGMENTS,true));
  return section.shell=polygon;
}

// Distance to the actual faceted sheet. No lower semicircle or axial caps are
// invented by collision, and closure uses the very same falling vertices.
export function barrelShellDistance(section,x,y) {
  if(!section.active||section.envelope<.015)return Infinity;
  const polygon=shellPolygon(section);let nearest=Infinity,inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[j],b=polygon[i],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const f=length?clamp(((x-a.x)*dx+(y-a.y)*dy)/length,0,1):0;
    nearest=Math.min(nearest,Math.hypot(x-a.x-dx*f,y-a.y-dy*f));
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside?0:nearest;
}

export function sampleStormBarrel(x,y,z,time,timings) {
  const index=Math.floor((-z-STORM_BARREL_FIRST)/STORM_BARREL_SPACING);
  if(index<0)return null;
  const barrel=stormBarrel(index),section=barrelCrossSection(barrel,z,time,timings);
  if(!section.active)return null;
  // An upright rider capsule, sampled along its axis including board and head.
  // Radius is deliberately forgiving; only contact with visible curling water
  // can produce a barrel wipeout, never a broad hidden inside/outside boundary.
  let clearance=Infinity;
  for(const height of [.24,.65,1.05,1.45,1.70])clearance=Math.min(clearance,barrelShellDistance(section,x,y+height)-.22);
  const dx=x-section.centerX;
  const openCeiling=section.centerY+Math.sqrt(Math.max(0,section.innerRadius**2-dx**2));
  const ceiling=openCeiling+(waveHeight(x,z,time)-openCeiling)*smooth(section.closingProgress)*.985;
  const inside=section.envelope>.72&&Math.abs(dx)<section.innerRadius-1&&y+1.7<ceiling-.22&&clearance>0;
  return {barrel,section,inside,colliding:clearance<0,clearance};
}

// A swept capsule prevents a fast jump or side crossing from skipping the
// visible shell between simulation steps. Temporal motion of the curl is also
// sampled. Normal 120-Hz motion uses only a few samples.
export function sweepStormBarrel(from,to,startTime,endTime,timings) {
  const travel=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
  const steps=Math.max(1,Math.ceil(travel/.12),Math.ceil((endTime-startTime)*120));
  for(let i=0;i<=steps;i++) {
    const f=i/steps,sample=sampleStormBarrel(from.x+(to.x-from.x)*f,from.y+(to.y-from.y)*f,from.z+(to.z-from.z)*f,startTime+(endTime-startTime)*f,timings);
    if(sample?.colliding)return {...sample,fraction:f};
  }
  return null;
}
