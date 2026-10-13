// One deterministic source for the obstacle meshes and swept collisions.
// Driftwood sits just above the water; whirlpools occupy the gaps between curls.
import { waveHeight,stormDifficulty,stormBarrelsNear } from './storm-waves.js';
import { stormFunnelRows } from './storm-progression.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const REEF_BANK_SIDES=10;

// Exactly the roof of the visible ten-sided low-poly bank, rather than a
// cylinder around its bounding box. The open corridor has no collision shape.
export function reefBankHeight(item,x,distance) {
  const dx=(x-item.x)/item.radiusX,dz=(distance-item.distance)/item.radiusZ;
  let edge=-Infinity;
  for(let side=0;side<REEF_BANK_SIDES;side++){
    const angle=(side+.5)/REEF_BANK_SIDES*Math.PI*2;
    edge=Math.max(edge,(dx*Math.cos(angle)+dz*Math.sin(angle))/Math.cos(Math.PI/REEF_BANK_SIDES));
  }
  return edge>1?0:item.height*(1-Math.max(0,edge));
}

export function surfHazardsNear(distance,rulesId='surf',elapsed=0,behind=20,ahead=220) {
  // Hazards belong to Survival, even when a normal Surf Session rolls stormy weather.
  if(rulesId!=='storm')return [];
  // Storm wood alternates 45m before a curl and 18m beyond its exit. Keeping
  // branches out of the collapsing sheet makes the low-hop clearance readable.
  const first=135,spacing=115;
  const result=[],lanes=[3,8,-1,6,-8,2];
  for(let i=Math.max(0,Math.ceil((distance-behind-first)/spacing));i<=Math.floor((distance+ahead-first)/spacing);i++) {
    const at=first+i*spacing;
    result.push({id:`driftwood-${i}`,type:'driftwood',index:i,distance:at,z:-at,x:lanes[i%lanes.length],
      radiusX:2.5+(i%3)*.35,radiusZ:.42,height:.18,rotation:0});
  }
  for(let i=Math.max(0,Math.ceil((distance-behind-300)/230));i<=Math.floor((distance+ahead-300)/230);i++) {
    const at=300+i*230,difficulty=stormDifficulty(elapsed);
    result.push({id:`whirlpool-${i}`,type:'whirlpool',index:i,distance:at,z:-at,x:[-2,6,-7,3][i%4],
      radiusX:1.65,radiusZ:1.65,height:.62,rotation:0,pullRadius:7,pullStrength:4.5+difficulty*2});
  }
  for(const barrel of stormBarrelsNear(distance,behind+45,ahead+35)) {
    const rows=stormFunnelRows(barrel.index);
    for(let row=0;row<rows;row++){
      const at=barrel.startDistance-18+row*25;
      if(at<distance-behind-5||at>distance+ahead+5)continue;
      // A broad gap from x=-9.8 to x=.8 follows the tube's visible opening.
      // Layered staggered banks constrain the wide bypass without closing it
      // with invisible sidewalls; sufficiently high air can clear the rock.
      for(const [side,x,radiusX] of [['left',-13.5,3.7],['right',4.3,3.5],['outer',10.5,3.7],['edge',16,3.2]]){
        result.push({id:`reefbank-${barrel.index}-${row}-${side}`,type:'reefbank',index:barrel.index,
          distance:at,z:-at,x,radiusX,radiusZ:4,height:3.4,row,barrelIndex:barrel.index});
      }
    }
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
    const height=item.type==='reefbank'?reefBankHeight(item,x,distance):item.height;
    if(height>0&&clearance<height+.015)return {item,fraction:f,clearance};
  }
  return null;
}
