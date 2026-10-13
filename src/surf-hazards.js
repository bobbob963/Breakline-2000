// One deterministic source for the obstacle meshes and swept collisions.
// Driftwood sits just above the water; whirlpools occupy the gaps between curls.
import { waveHeight,stormDifficulty } from './storm-waves.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function surfHazardsNear(distance,rulesId='surf',elapsed=0,behind=20,ahead=220) {
  if(rulesId!=='surf'&&rulesId!=='storm')return [];
  // Storm wood alternates 45m before a curl and 18m beyond its exit. Keeping
  // branches out of the collapsing sheet makes the low-hop clearance readable.
  const storm=rulesId==='storm',first=storm?135:72,spacing=storm?115:132;
  const result=[],lanes=storm?[3,8,-1,6,-8,2]:[1,-5,7,-2,10,-7];
  for(let i=Math.max(0,Math.ceil((distance-behind-first)/spacing));i<=Math.floor((distance+ahead-first)/spacing);i++) {
    const at=first+i*spacing;
    result.push({id:`driftwood-${i}`,type:'driftwood',index:i,distance:at,z:-at,x:lanes[i%lanes.length],
      radiusX:2.5+(i%3)*.35,radiusZ:.42,height:.18,rotation:0});
  }
  if(storm)for(let i=Math.max(0,Math.ceil((distance-behind-300)/230));i<=Math.floor((distance+ahead-300)/230);i++) {
    const at=300+i*230,difficulty=stormDifficulty(elapsed);
    result.push({id:`whirlpool-${i}`,type:'whirlpool',index:i,distance:at,z:-at,x:[-2,6,-7,3][i%4],
      radiusX:1.65,radiusZ:1.65,height:.62,rotation:0,pullRadius:7,pullStrength:4.5+difficulty*2});
  }
  return result.sort((a,b)=>a.distance-b.distance);
}

export function whirlpoolPull(hazards,x,distance,airborne=false) {
  if(airborne)return 0;
  let pull=0;
  for(const item of hazards)if(item.type==='whirlpool') {
    const dx=item.x-x,dz=item.distance-distance,r=Math.hypot(dx,dz);
    if(r<item.pullRadius&&r>.01)pull+=dx/r*item.pullStrength*(1-r/item.pullRadius);
  }
  return clamp(pull,-6.5,6.5);
}

export function sweepSurfHazard(item,from,to,startTime,endTime) {
  // Test the whole travelled board segment, including a fast boosted crossing.
  // Y clearance is measured against the same moving water as the obstacle.
  const ax=(from.x-item.x)/item.radiusX,az=(from.distance-item.distance)/item.radiusZ;
  const dx=(to.x-from.x)/item.radiusX,dz=(to.distance-from.distance)/item.radiusZ;
  const nearest=clamp(-(ax*dx+az*dz)/(dx*dx+dz*dz||1),0,1);
  const samples=new Set([0,nearest,1]);
  const travel=Math.hypot(to.x-from.x,to.distance-from.distance),steps=Math.ceil(travel/.1);
  for(let i=1;i<steps;i++)samples.add(i/steps);
  for(const f of samples) {
    if((ax+dx*f)**2+(az+dz*f)**2>1)continue;
    const x=from.x+(to.x-from.x)*f,distance=from.distance+(to.distance-from.distance)*f,time=startTime+(endTime-startTime)*f;
    const y=from.y+(to.y-from.y)*f,clearance=y-waveHeight(x,-distance,time);
    if(clearance<item.height+.015)return {item,fraction:f,clearance};
  }
  return null;
}
