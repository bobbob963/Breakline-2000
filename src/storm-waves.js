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

export function barrelCrossSection(barrel,z,time) {
  const distance=-z,progress=clamp((distance-barrel.startDistance)/barrel.length,0,1);
  const active=distance>=barrel.startDistance&&distance<=barrel.endDistance;
  const envelope=active?smooth(Math.min(distance-barrel.startDistance,barrel.endDistance-distance)/8):0;
  const innerRadius=4.6-.4*stormDifficulty(time),endAngle=3.36;
  return {active,progress,envelope,centerX:waveCrest(z,time)+4.25,
    centerY:5.05+Math.sin(z*.07+time*1.2)*.32,innerRadius,outerRadius:innerRadius+.38,
    startAngle:endAngle-(endAngle+.25)*envelope,endAngle};
}

// arc=0 is the falling right lip; arc=1 is the left foot on the existing wave.
export function barrelSurfacePoint(barrel,z,arc,time,outer=false) {
  const section=barrelCrossSection(barrel,z,time),angle=section.startAngle+(section.endAngle-section.startAngle)*arc;
  const radius=outer?section.outerRadius:section.innerRadius;
  return {x:section.centerX+Math.cos(angle)*radius,y:section.centerY+Math.sin(angle)*radius,z};
}

// Shortest distance to the visible annular arc in one cross section. Unlike a
// closed cylinder this leaves the lower opening and both axial mouths clear.
export function barrelShellDistance(section,x,y) {
  if(!section.active||section.envelope<.015)return Infinity;
  const dx=x-section.centerX,dy=y-section.centerY,r=Math.hypot(dx,dy);
  let angle=Math.atan2(dy,dx);
  if(angle<section.startAngle)angle+=Math.PI*2;
  if(angle>=section.startAngle&&angle<=section.endAngle)return Math.max(section.innerRadius-r,0,r-section.outerRadius);
  let nearest=Infinity;
  for(const a of [section.startAngle,section.endAngle]) {
    const cos=Math.cos(a),sin=Math.sin(a),radius=clamp(dx*cos+dy*sin,section.innerRadius,section.outerRadius);
    nearest=Math.min(nearest,Math.hypot(dx-cos*radius,dy-sin*radius));
  }
  return nearest;
}

export function sampleStormBarrel(x,y,z,time) {
  const index=Math.floor((-z-STORM_BARREL_FIRST)/STORM_BARREL_SPACING);
  if(index<0)return null;
  const barrel=stormBarrel(index),section=barrelCrossSection(barrel,z,time);
  if(!section.active)return null;
  // An upright rider capsule, sampled along its axis including board and head.
  // Radius is deliberately forgiving; only contact with visible curling water
  // can produce a barrel wipeout, never a broad hidden inside/outside boundary.
  let clearance=Infinity;
  for(const height of [.24,.65,1.05,1.45,1.70])clearance=Math.min(clearance,barrelShellDistance(section,x,y+height)-.22);
  const dx=x-section.centerX;
  const ceiling=section.centerY+Math.sqrt(Math.max(0,section.innerRadius**2-dx**2));
  const inside=section.envelope>.72&&Math.abs(dx)<section.innerRadius-1&&y+1.7<ceiling-.22&&clearance>0;
  return {barrel,section,inside,colliding:clearance<0,clearance};
}

// A swept capsule prevents a fast jump or side crossing from skipping the
// visible shell between simulation steps. Temporal motion of the curl is also
// sampled. Normal 120-Hz motion uses only a few samples.
export function sweepStormBarrel(from,to,startTime,endTime) {
  const travel=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
  const steps=Math.max(1,Math.ceil(travel/.12),Math.ceil((endTime-startTime)*120));
  for(let i=0;i<=steps;i++) {
    const f=i/steps,sample=sampleStormBarrel(from.x+(to.x-from.x)*f,from.y+(to.y-from.y)*f,from.z+(to.z-from.z)*f,startTime+(endTime-startTime)*f);
    if(sample?.colliding)return {...sample,fraction:f};
  }
  return null;
}
