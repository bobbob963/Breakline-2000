// One route description drives the playable lanes, collision tests and pipe mesh.
// Distance is course progress. Path derivatives turn real board speed into that
// progress, so a straight bypass saves actual travel rather than granting speed.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const SEWER_TRACKS=Object.freeze([
  Object.freeze({id:'sewer-run',name:'RUNOFF RUN',subtitle:'The interceptor sewer',length:1360,amplitude:80,wavelength:440,phase:0,halfWidth:10.8,normalSpeed:23,pumpSpeed:31,barrelSeconds:2.7}),
  Object.freeze({id:'sewer-depths',name:'THE DEEP WORKS',subtitle:'Flooded storm drains',length:1740,amplitude:104,wavelength:500,phase:-1,halfWidth:10.2,normalSpeed:24,pumpSpeed:32,barrelSeconds:2.35}),
]);
export function getSewerTrack(id='sewer-run'){return SEWER_TRACKS.find(track=>track.id===id)||SEWER_TRACKS[0];}

function mainPoint(distance,x,y,track){
  const phase=distance*Math.PI*2/track.wavelength+track.phase;
  const center=track.amplitude*(Math.sin(phase)-Math.sin(track.phase));
  const slope=track.amplitude*Math.PI*2/track.wavelength*Math.cos(phase);
  const heading=-Math.atan(slope),length=Math.hypot(1,slope);
  return {x:center+x/length,y,z:-distance+x*slope/length,heading};
}
function shortcutDefinition(shortcut,trackId){
  return typeof shortcut==='object'?shortcut:shortcut?createSewerCourse(trackId).shortcuts.find(item=>item.id===shortcut):null;
}
export function sewerPoint(distance,x=0,y=0,trackId='sewer-run',shortcut=null){
  const track=getSewerTrack(trackId),branch=shortcutDefinition(shortcut,track.id);
  if(!branch)return mainPoint(distance,x,y,track);
  const start=mainPoint(branch.start,branch.entryX,0,track),end=mainPoint(branch.end,branch.entryX,0,track);
  const fraction=clamp((distance-branch.start)/(branch.end-branch.start),0,1);
  const dx=end.x-start.x,dz=end.z-start.z,length=Math.hypot(dx,dz),lane=x-branch.entryX;
  return {x:start.x+dx*fraction+lane*(-dz/length),y,z:start.z+dz*fraction+lane*dx/length,heading:Math.atan2(-dx,-dz)};
}
export function sewerPathScale(distance,trackId='sewer-run',shortcut=null){
  const branch=shortcutDefinition(shortcut,trackId),x=branch?.entryX||0;
  const a=sewerPoint(branch?branch.start:distance-.05,x,0,trackId,branch);
  const b=sewerPoint(branch?branch.end:distance+.05,x,0,trackId,branch);
  return Math.hypot(b.x-a.x,b.z-a.z)/(branch?branch.end-branch.start:.1);
}
export function sewerWaterHeight(x,distance,time=0,trackId='sewer-run',shortcut=null){
  const branch=shortcutDefinition(shortcut,trackId),lane=x-(branch?.entryX||0),bank=Math.max(0,Math.abs(lane)-(branch?2.5:7));
  return .1*Math.sin(distance*.12+time*2)+.06*Math.sin(lane*.65+time)+bank*bank*.065;
}

const cache=new Map();
export function createSewerCourse(id='sewer-run'){
  const track=getSewerTrack(id);if(cache.has(track.id))return cache.get(track.id);
  const deep=track.id==='sewer-depths';
  const shortcuts=(deep?[[90,320,-8.2],[590,825,-8.2],[1090,1320,-8.2]]:[[30,200,-8.2],[470,640,-8.2],[910,1080,-8.2]])
    .map(([start,end,entryX],index)=>Object.freeze({id:`${track.id}-bypass-${index+1}`,name:`BYPASS ${index+1}`,start,end,entryX,width:6.5}));
  const distances=deep?[55,375,540,885,1040,1380,1575]:[240,420,685,860,1120,1280];
  const checkpoints=distances.map((distance,index)=>Object.freeze({index,distance,x:[0,4,-3,3,-4,0,2][index],radius:4.8}));
  const hazards=[];
  const add=(type,distance,x,path='main',extra={})=>hazards.push(Object.freeze({id:`${track.id}-${type}-${hazards.length}`,type,distance,x,path,
    radius:type==='whirlpool'?2.2:2.8,radiusX:type==='whirlpool'?2.2:2.8,radiusZ:type==='whirlpool'?4.5:1.7,width:type==='whirlpool'?4.4:5.6,height:type==='whirlpool'?.5:.72,...extra}));
  for(const [distance,x] of (deep?[[180,0],[460,-5],[725,4],[975,-3],[1235,0],[1495,4]]:[[115,0],[330,-4],[560,4],[780,0],[1000,-3],[1200,4]]))add('whirlpool',distance,x);
  for(const [distance,x] of (deep?[[250,5],[495,0],[800,-5],[1010,5],[1300,3],[1540,-4]]:[[160,5],[360,3],[600,-4],[815,-5],[1050,4],[1230,-3]]))add('driftwood',distance,x);
  for(const [index,distance] of (deep?[425,935,1440]:[285,730,1160]).entries())add('barrel',distance,0,'main',{
    startDistance:distance-22,endDistance:distance+22,approachDistance:distance-60,
    closeDuration:Math.max(1.8,track.barrelSeconds-index*.12),width:track.halfWidth*2,radius:8.8});
  for(const shortcut of shortcuts){
    add('driftwood',shortcut.start+(shortcut.end-shortcut.start)*.48,shortcut.entryX,shortcut.id,{radiusX:3.2,width:6.4,height:.66});
    add('whirlpool',shortcut.start+(shortcut.end-shortcut.start)*.76,shortcut.entryX+2,shortcut.id,{radius:1.15,radiusX:1.15,width:2.3,radiusZ:3});
  }
  hazards.sort((a,b)=>a.distance-b.distance);
  const course=Object.freeze({...track,checkpoints:Object.freeze(checkpoints),shortcuts:Object.freeze(shortcuts),hazards:Object.freeze(hazards)});
  cache.set(track.id,course);return course;
}

export function sewerBarrelState(hazard,time,timing){
  if(!timing)return {closure:0,closingProgress:0,opening:1,timeLeft:hazard.closeDuration,active:false};
  const entered=Number.isFinite(timing.enteredAt),start=entered?timing.enteredAt:timing.approachedAt;
  const closure=timing.cleared?0:entered?clamp((time-start)/hazard.closeDuration,0,1):Math.min(.16,Math.max(0,time-start)*.07);
  return {closure,closingProgress:closure,opening:1-closure,timeLeft:entered?Math.max(0,timing.deadline-time):hazard.closeDuration,active:!timing.cleared};
}
