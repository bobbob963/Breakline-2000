import { resolveParkCamera } from './park-camera.js';

const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
export const DEFAULT_VIEW_SETTINGS = Object.freeze({ quality:'retro', camera:'classic', cameraHeight:0, cameraFov:64, cameraShake:true });
const PRESETS = Object.freeze({classic:{distance:1,height:0},close:{distance:.76,height:-.15},wide:{distance:1.4,height:.6}});

export function normalizeViewSettings(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    quality:value.quality === 'clean' ? 'clean' : 'retro',
    camera:Object.hasOwn(PRESETS,value.camera) ? value.camera : 'classic',
    cameraHeight:Number.isFinite(value.cameraHeight) ? clamp(value.cameraHeight,-1,3) : 0,
    cameraFov:Number.isFinite(value.cameraFov) ? clamp(value.cameraFov,50,90) : 64,
    cameraShake:typeof value.cameraShake === 'boolean' ? value.cameraShake : true,
  };
}

// The saved FOV is a preference relative to the existing 64 setting, not an
// absolute replacement for each scene's deliberately different chase lens.
export function viewFieldOfView(base,settings,{active=true,firstPerson=false} = {}) {
  if (!active || firstPerson) return base;
  return clamp(base + normalizeViewSettings(settings).cameraFov - 64,32,100);
}

export function viewCameraTarget(settings,{anchor,target,focus,rideUp=null,park=false,active=true,firstPerson=false}) {
  const result = {x:target.x,y:target.y,z:target.z};
  if (!active || firstPerson) return result;
  const view = normalizeViewSettings(settings),preset = PRESETS[view.camera];
  if (preset.distance === 1 && view.cameraHeight === 0) return result;
  const up = rideUp || {x:0,y:1,z:0};
  const vertical = (target.x-anchor.x)*up.x+(target.y-anchor.y)*up.y+(target.z-anchor.z)*up.z;
  const lift = preset.height + view.cameraHeight;
  for (const axis of ['x','y','z']) {
    // Zoom the horizontal boom without scaling vertical pipe clearance.
    result[axis] = anchor[axis]+(target[axis]-anchor[axis]-up[axis]*vertical)*preset.distance+up[axis]*(vertical+lift);
  }
  if (park) return resolveParkCamera(anchor.x,anchor.y,anchor.z,result,rideUp,{terrainLift:false,focus});
  result.y = Math.max(anchor.y+.95,result.y);
  return result;
}

export function viewRenderSize(width,height,{quality='retro',oceanRaceView=false,pixelRatio=1} = {}) {
  const scale = quality === 'clean' ? clamp(Number.isFinite(pixelRatio)?pixelRatio:1,1,1.5) : Math.min(1,(oceanRaceView?960:640)/width);
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
