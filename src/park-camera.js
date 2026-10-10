import { PARK_BOUNDS, PARK_PIPES, parkHeight, parkPointBlocked, parkLocal } from './park.js';

const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

function clearView(head,camera) {
  const distance = Math.hypot(camera.x-head.x,camera.y-head.y,camera.z-head.z);
  const samples = Math.max(1,Math.ceil(distance/.05));
  for(let i=0;i<=samples;i++) {
    const fraction=i/samples;
    const x=head.x+(camera.x-head.x)*fraction;
    const z=head.z+(camera.z-head.z)*fraction;
    const y=head.y+(camera.y-head.y)*fraction;
    if(y < parkHeight(x,z)+.30||parkPointBlocked(x,y,z,.12)) return false;
  }
  return true;
}

function longestClearBoom(candidateAt,head,focus=null,endpointClearance=1.5) {
  const clear=camera=> (endpointClearance===0||camera.y>=parkHeight(camera.x,camera.z)+endpointClearance) &&
    clearView(head,camera) && (!focus||clearView(focus,camera));
  let rejected=1;
  for(let step=0;step<=10;step++) {
    const fraction=1-step/10,candidate=candidateAt(fraction);
    if(clear(candidate)) {
      if(step===0)return candidate;
      // Continuous contact distance prevents the old .675m camera jumps as
      // the desired boom crosses one of eight coarse collision fractions.
      let accepted=fraction;
      for(let i=0;i<9;i++) {
        const mid=(accepted+rejected)/2;
        if(clear(candidateAt(mid)))accepted=mid;else rejected=mid;
      }
      return candidateAt(accepted);
    }
    rejected=fraction;
  }
  return null;
}

// Keep the entire camera-to-rider ray clear, including abrupt solid ramp backs.
// The function accepts any desired position with x/y/z fields, without a DOM or
// renderer dependency. Callers must not interpolate Y below this result.
export function resolveParkCamera(x,y,z,desired,rideUp=null,options={}) {
  if(rideUp) {
    // In a full pipe loop, the surfer's up vector points into the bore. Place
    // the head and camera on that same side even while completely inverted.
    const head={x:x+rideUp.x*1.3,y:y+rideUp.y*1.3,z:z+rideUp.z*1.3};
    const anchor={x:x+rideUp.x*2.6,y:y+rideUp.y*2.6,z:z+rideUp.z*2.6};
    const candidateAt=fraction=>({x:clamp(anchor.x+(desired.x-anchor.x)*fraction,PARK_BOUNDS.minX+.8,PARK_BOUNDS.maxX-.8),
        y:anchor.y+(desired.y-anchor.y)*fraction,z:clamp(anchor.z+(desired.z-anchor.z)*fraction,PARK_BOUNDS.minZ+.8,PARK_BOUNDS.maxZ-.8)});
    return longestClearBoom(candidateAt,head,options.focus,0)||anchor;
  }
  const requested = {
    x:clamp(desired.x,PARK_BOUNDS.minX+.8,PARK_BOUNDS.maxX-.8),
    z:clamp(desired.z,PARK_BOUNDS.minZ+.8,PARK_BOUNDS.maxZ-.8),
  };
  const baseHeight = Math.max(y+2.6,parkHeight(x,z)+2.6);
  const extraHeight = Math.max(0,desired.y-baseHeight);
  const head = {x,y:y+1.3,z};
  const inside=PARK_PIPES.find(pipe=>{
    const local=parkLocal(pipe,x,z);
    return Math.abs(local.v)<=pipe.length/2&&Math.hypot(local.u,head.y-pipe.centerY)<pipe.radius-pipe.thickness;
  });
  const candidateAt=fraction=> {
    const candidate = {
      x:x+(requested.x-x)*fraction,
      z:z+(requested.z-z)*fraction,
    };
    candidate.y = options.terrainLift===true?Math.max(baseHeight+extraHeight*fraction,parkHeight(candidate.x,candidate.z)+1.5):baseHeight+extraHeight*fraction;
    if(inside) {
      const local=parkLocal(inside,candidate.x,candidate.z),radius=inside.radius-inside.thickness-.18;
      if(Math.abs(local.v)<=inside.length/2) {
        if(Math.abs(local.u)>=radius)return {...candidate,y:-Infinity};
        const ceiling=inside.centerY+Math.sqrt(radius*radius-local.u*local.u);
        candidate.y=Math.min(candidate.y,ceiling);
        if(candidate.y<head.y+.2)return {...candidate,y:-Infinity};
      }
    }
    return candidate;
  };
  const resolved=longestClearBoom(candidateAt,head,options.focus,options.terrainLift===false?.55:1.5);
  if(resolved)return resolved;
  // Valid rider positions always make the zero-length horizontal boom clear.
  // Keep an above-rider fallback for transient recovery/custom debug states.
  return {x,y:inside?Math.min(baseHeight,inside.centerY+Math.sqrt(Math.max(0,(inside.radius-inside.thickness-.18)**2-parkLocal(inside,x,z).u**2))):baseHeight,z};
}
