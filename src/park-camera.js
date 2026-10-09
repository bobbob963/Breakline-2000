import { PARK_BOUNDS, PARK_PIPES, parkHeight, parkPointBlocked, parkLocal } from './park.js';

const BOOM_FRACTIONS = [1,.85,.7,.55,.4,.25,.1,0];
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

function clearView(head,camera) {
  const distance = Math.hypot(camera.x-head.x,camera.z-head.z);
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

// Keep the entire camera-to-rider ray clear, including abrupt solid ramp backs.
// The function accepts any desired position with x/y/z fields, without a DOM or
// renderer dependency. Callers must not interpolate Y below this result.
export function resolveParkCamera(x,y,z,desired) {
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
  for(const fraction of BOOM_FRACTIONS) {
    const candidate = {
      x:x+(requested.x-x)*fraction,
      z:z+(requested.z-z)*fraction,
    };
    candidate.y = Math.max(baseHeight+extraHeight*fraction,parkHeight(candidate.x,candidate.z)+1.5);
    if(inside) {
      const local=parkLocal(inside,candidate.x,candidate.z),radius=inside.radius-inside.thickness-.18;
      if(Math.abs(local.v)<=inside.length/2) {
        if(Math.abs(local.u)>=radius) continue;
        const ceiling=inside.centerY+Math.sqrt(radius*radius-local.u*local.u);
        candidate.y=Math.min(candidate.y,ceiling);
        if(candidate.y<head.y+.2) continue;
      }
    }
    if(clearView(head,candidate)) return candidate;
  }
  // Valid rider positions always make the zero-length horizontal boom clear.
  // Keep an above-rider fallback for transient recovery/custom debug states.
  return {x,y:inside?Math.min(baseHeight,inside.centerY+Math.sqrt(Math.max(0,(inside.radius-inside.thickness-.18)**2-parkLocal(inside,x,z).u**2))):baseHeight,z};
}
