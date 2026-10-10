import * as THREE from 'three';
import { resolveParkCamera } from './park-camera.js';

const WORLD_UP=new THREE.Vector3(0,1,0);
const alpha=(rate,dt)=>1-Math.exp(-rate*dt);
const vector=p=>new THREE.Vector3(p.x,p.y,p.z);

export function createParkCameraState() {
  return {initialized:false,position:new THREE.Vector3(),look:new THREE.Vector3(),up:WORLD_UP.clone(),
    anchor:new THREE.Vector3(),offset:new THREE.Vector3(),focusOffset:new THREE.Vector3(),forward:new THREE.Vector3(0,0,-1),heading:0};
}

// Stateful, renderer-independent follow rig. Camera and aim are both relative
// to the CURRENT rider, so normal travel cannot pull the rider out of frame.
export function stepParkCamera(state,input,seconds) {
  const dt=THREE.MathUtils.clamp(seconds,0,.05),anchor=vector(input),pipe=!!input.rideUp;
  const up=pipe?vector(input.rideUp).normalize():WORLD_UP.clone();
  const focus=input.focus?vector(input.focus):anchor.clone().addScaledVector(up,.9);
  const moved=anchor.distanceTo(state.anchor);
  const reset=!state.initialized||input.reset||moved>12||(state.pipe&&!pipe&&moved>2);
  const requestedHeading=Number.isFinite(input.heading)?input.heading:0;
  if(reset)state.heading=requestedHeading;
  else {
    const difference=Math.atan2(Math.sin(requestedHeading-state.heading),Math.cos(requestedHeading-state.heading));
    // Catch a 90/180 degree physics turn with a continuous orbit, not a cut.
    state.heading+=THREE.MathUtils.clamp(difference*alpha(4.6,dt),-3.4*dt,3.4*dt);
  }
  const angle=state.heading+(pipe?0:.20),boom=pipe?5.3:5.0;
  const desired=anchor.clone().add(new THREE.Vector3(Math.sin(angle)*boom,0,Math.cos(angle)*boom)).addScaledVector(up,pipe?2.4:2.6);
  const options={terrainLift:false,focus};
  const safe=vector(resolveParkCamera(anchor.x,anchor.y,anchor.z,desired,pipe?up:null,options));
  const targetOffset=safe.clone().sub(anchor),targetFocus=focus.clone().sub(anchor);
  if(reset){state.offset.copy(targetOffset);state.focusOffset.copy(targetFocus);state.up.copy(WORLD_UP);}
  else {
    // Retraction is verified after interpolation; gradual extension prevents
    // a snap back to the full boom as the surfer clears a ramp edge or rail.
    state.offset.lerp(targetOffset,alpha(7.5,dt));
    state.focusOffset.lerp(targetFocus,alpha(16,dt));
  }
  const candidate=anchor.clone().add(state.offset);
  state.position.copy(resolveParkCamera(anchor.x,anchor.y,anchor.z,candidate,pipe?up:null,options));
  state.offset.copy(state.position).sub(anchor);
  state.look.copy(anchor).add(state.focusOffset);
  const forward=state.look.clone().sub(state.position).normalize();
  if(!reset)state.up.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(state.forward,forward));
  state.up.addScaledVector(forward,-state.up.dot(forward));
  if(state.up.lengthSq()<.0001){
    state.up.set(0,0,1).addScaledVector(forward,-forward.z);
    if(state.up.lengthSq()<.0001)state.up.set(1,0,0).addScaledVector(forward,-forward.x);
  }
  state.up.normalize();
  const upright=WORLD_UP.clone().addScaledVector(forward,-WORLD_UP.dot(forward));
  if(upright.lengthSq()>.12){
    upright.normalize();
    const correction=Math.atan2(forward.dot(state.up.clone().cross(upright)),state.up.dot(upright));
    // Parallel transport keeps orientation defined near a vertical view.
    // Once clear of that pole, ease back to the horizon without a 180° flip.
    const roll=reset?correction:THREE.MathUtils.clamp(correction*alpha(5,dt),-1.6*dt,1.6*dt);
    state.up.applyAxisAngle(forward,roll).normalize();
  }
  state.forward.copy(forward);state.anchor.copy(anchor);state.pipe=pipe;state.initialized=true;
  return state;
}
