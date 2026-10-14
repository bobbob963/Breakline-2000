import * as THREE from 'three';
import { sewerPoint, sewerPathScale, sewerTunnelProfile } from './sewer-course.js';
import { viewCameraTarget, viewFieldOfView } from './camera-settings.js';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const alpha = (rate, dt) => 1 - Math.exp(-rate * dt);
const vector = point => new THREE.Vector3(point.x, point.y, point.z);

export function createSewerCameraState() {
  return { initialized:false, position:new THREE.Vector3(), look:new THREE.Vector3(),
    anchor:new THREE.Vector3(), offset:new THREE.Vector3(), focusOffset:new THREE.Vector3(), heading:0, fov:57 };
}

// Find the local bore at the camera's longitudinal position. A world-axis box
// does not stay inside a curved tunnel, especially at side-pipe entrances.
export function sewerCameraSection(position, distance, trackId, shortcut = null) {
  let sampleDistance = distance;
  for (let i = 0; i < 4; i++) {
    const profile = sewerTunnelProfile(sampleDistance, trackId, shortcut);
    const centre = sewerPoint(sampleDistance, profile.centreX, profile.centerY, trackId, shortcut);
    const forward = {x:-Math.sin(centre.heading), z:-Math.cos(centre.heading)};
    const along = (position.x-centre.x)*forward.x+(position.z-centre.z)*forward.z;
    sampleDistance += clamp(along / Math.max(.5, sewerPathScale(sampleDistance,trackId,shortcut)), -16, 16);
  }
  const profile = sewerTunnelProfile(sampleDistance, trackId, shortcut);
  const centre = sewerPoint(sampleDistance, profile.centreX, profile.centerY, trackId, shortcut);
  const right = {x:Math.cos(centre.heading), z:-Math.sin(centre.heading)};
  const lane = (position.x-centre.x)*right.x+(position.z-centre.z)*right.z;
  return {distance:sampleDistance, profile, centre, right, lane, height:position.y-profile.centerY};
}

export function resolveSewerCamera(position, distance, trackId, shortcut = null) {
  const result = vector(position);
  const section = sewerCameraSection(result,distance,trackId,shortcut);
  const radius = section.profile.radius - .8;
  // The near plane also needs clearance, not only the lens position.
  const length = Math.hypot(section.lane,section.height);
  if (length > radius) {
    const safeLane = section.lane*radius/length, safeHeight=section.height*radius/length;
    result.x += (safeLane-section.lane)*section.right.x;
    result.z += (safeLane-section.lane)*section.right.z;
    result.y = section.profile.centerY+safeHeight;
  }
  result.y = Math.max(.85,result.y);
  return result;
}

// Follow the CURRENT rider position and damp only the boom and aim offsets.
// This gives the same readable framing at cruise, trick boost and Sludge Surge;
// world-position damping would trail further behind as the speed increased.
export function stepSewerCamera(state,input,seconds) {
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05);
  const {trackId,shortcut=null,distance=0}=input;
  const anchor=vector(input),attract=!!input.attract;
  const reset=!state.initialized||input.reset||state.trackId!==trackId||distance<(state.distance??0)-6||anchor.distanceTo(state.anchor)>18;
  const scale=sewerPathScale(distance,trackId,shortcut);
  const next=sewerPoint(distance+5/scale,input.lane??0,input.y,trackId,shortcut);
  // A little look-ahead shows the bend before the rider reaches it.
  const requested=Math.atan2(-(next.x-anchor.x),-(next.z-anchor.z));
  if(reset)state.heading=requested;
  else state.heading+=Math.atan2(Math.sin(requested-state.heading),Math.cos(requested-state.heading))*alpha(7.5,dt);
  const branch=!!shortcut;
  const boom=attract?8.2:branch?6.2:7.3;
  const desired=anchor.clone().add(new THREE.Vector3(Math.sin(state.heading)*boom+Math.cos(state.heading)*.32,attract?3.8:2.9,Math.cos(state.heading)*boom-Math.sin(state.heading)*.32));
  const focus=anchor.clone().add(new THREE.Vector3(-Math.sin(state.heading)*2.2,1.25,-Math.cos(state.heading)*2.2));
  const preferred=viewCameraTarget(input.settings,{anchor,target:desired,focus,active:!attract,firstPerson:!!input.firstPerson});
  const safe=resolveSewerCamera(preferred,distance,trackId,shortcut);
  const offset=safe.clone().sub(anchor),focusOffset=focus.clone().sub(anchor);
  if(reset){state.offset.copy(offset);state.focusOffset.copy(focusOffset);}
  else{state.offset.lerp(offset,alpha(10,dt));state.focusOffset.lerp(focusOffset,alpha(12,dt));}
  state.position.copy(resolveSewerCamera(anchor.clone().add(state.offset),distance,trackId,shortcut));
  state.offset.copy(state.position).sub(anchor);
  state.look.copy(anchor).add(state.focusOffset);
  const fov=viewFieldOfView(input.boosting&&input.motion?60:57,input.settings,{active:!attract,firstPerson:!!input.firstPerson});
  state.fov=reset?fov:THREE.MathUtils.lerp(state.fov,fov,alpha(3.8,dt));
  state.up=UP;state.anchor.copy(anchor);state.trackId=trackId;state.distance=distance;state.initialized=true;
  return state;
}
