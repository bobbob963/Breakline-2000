const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// A full five-minute survival reaches the hardest curl. The minimum window is
// measured at the mouth, so an early warning never steals the approach time.
export function stormProgression(elapsed=0) {
  const intensity=clamp((Number.isFinite(elapsed)?elapsed:0)/300,0,1);
  return {intensity,escapeWindow:3.25-1.95*intensity,
    curlDelay:.65-.6*intensity,collapseDuration:1.2-1.13*intensity};
}

// Sidebanks are fixed course features. Density advances along the route,
// avoiding a boulder appearing beneath the rider when a timer changes stage.
export function stormFunnelRows(barrelIndex) {
  return barrelIndex<7?0:barrelIndex<19?1:barrelIndex<39?2:3;
}

export function createStormTiming(tube,triggerTime,pumpSpeed) {
  const profile=stormProgression(triggerTime),approach=(tube.startDistance-tube.approachDistance)/Math.max(8,pumpSpeed);
  return {index:tube.index,triggerTime,closeStart:triggerTime+profile.curlDelay,
    deadline:triggerTime+approach+profile.escapeWindow,collapseDuration:profile.collapseDuration,
    escapeWindow:profile.escapeWindow,waitingForEntry:true,enteredAt:null};
}
