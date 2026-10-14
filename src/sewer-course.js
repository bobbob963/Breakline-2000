// One route description drives the playable lanes, collision tests and pipe mesh.
// Distance is course progress. Path derivatives turn real board speed into that
// progress, so the bypasses save actual travel rather than granting speed.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
export const SEWER_TRACKS=Object.freeze([
  Object.freeze({id:'sewer-run',name:'RUNOFF RUN',subtitle:'The interceptor sewer',length:1360,amplitude:80,wavelength:440,phase:0,halfWidth:10.8,normalSpeed:23,pumpSpeed:31,barrelSeconds:2.7}),
  Object.freeze({id:'sewer-depths',name:'THE DEEP WORKS',subtitle:'Flooded storm drains',length:1740,amplitude:104,wavelength:500,phase:-1,halfWidth:10.2,normalSpeed:24,pumpSpeed:32,barrelSeconds:2.35}),
]);
export function getSewerTrack(id='sewer-run'){return SEWER_TRACKS.find(track=>track.id===id)||SEWER_TRACKS[0];}

function mainFrame(distance,track){
  const k=Math.PI*2/track.wavelength,q=.0037,r=.0029;
  const phase=distance*k+track.phase+.12*Math.sin(distance*q),phaseRate=k+.12*q*Math.cos(distance*q);
  const amplitude=track.amplitude*(1+.10*Math.sin(distance*r+track.phase));
  const amplitudeRate=track.amplitude*.10*r*Math.cos(distance*r+track.phase);
  const origin=track.amplitude*(1+.10*Math.sin(track.phase))*Math.sin(track.phase);
  const center=amplitude*Math.sin(phase)-origin+18*Math.sin(distance*.0041);
  const slope=amplitudeRate*Math.sin(phase)+amplitude*Math.cos(phase)*phaseRate+18*.0041*Math.cos(distance*.0041);
  return {center,slope};
}
function mainPoint(distance,x,y,track){
  const {center,slope}=mainFrame(distance,track);
  const heading=-Math.atan(slope),length=Math.hypot(1,slope);
  return {x:center+x/length,y,z:-distance+x*slope/length,heading};
}
function shortcutDefinition(shortcut,trackId){
  return typeof shortcut==='object'?shortcut:shortcut?createSewerCourse(trackId).shortcuts.find(item=>item.id===shortcut):null;
}
export function sewerPoint(distance,x=0,y=0,trackId='sewer-run',shortcut=null){
  const track=getSewerTrack(trackId),branch=shortcutDefinition(shortcut,track.id);
  // Look-ahead cameras and riders on every legal lateral line share a genuine
  // continuation of the main pipe, not a clamped point at either mouth.
  if(!branch||distance<=branch.start||distance>=branch.end)return mainPoint(distance,x,y,track);
  const start=mainPoint(branch.start,branch.entryX,0,track),end=mainPoint(branch.end,branch.entryX,0,track);
  const u=(distance-branch.start)/(branch.end-branch.start),v=1-u;
  const handle=Math.hypot(end.x-start.x,end.z-start.z)*.23;
  const first={x:start.x-Math.sin(start.heading)*handle,z:start.z-Math.cos(start.heading)*handle};
  const last={x:end.x+Math.sin(end.heading)*handle,z:end.z+Math.cos(end.heading)*handle};
  const chordX=end.x-start.x,chordZ=end.z-start.z,chordLength=Math.hypot(chordX,chordZ);
  const inset=(branch.inset||0)*Math.sin(Math.PI*u)**2,insetRate=(branch.inset||0)*Math.PI*Math.sin(Math.PI*2*u);
  const cx=v*v*v*start.x+3*v*v*u*first.x+3*v*u*u*last.x+u*u*u*end.x-inset*chordZ/chordLength;
  const cz=v*v*v*start.z+3*v*v*u*first.z+3*v*u*u*last.z+u*u*u*end.z+inset*chordX/chordLength;
  const dx=3*v*v*(first.x-start.x)+6*v*u*(last.x-first.x)+3*u*u*(end.x-last.x)-insetRate*chordZ/chordLength;
  const dz=3*v*v*(first.z-start.z)+6*v*u*(last.z-first.z)+3*u*u*(end.z-last.z)+insetRate*chordX/chordLength;
  const length=Math.hypot(dx,dz),lane=x-branch.entryX;
  return {x:cx+lane*(-dz/length),y,z:cz+lane*dx/length,heading:Math.atan2(-dx,-dz)};
}
export function sewerPathScale(distance,trackId='sewer-run',shortcut=null,lane=null){
  const branch=shortcutDefinition(shortcut,trackId),x=lane??branch?.entryX??0;
  const a=sewerPoint(distance-.01,x,0,trackId,branch),b=sewerPoint(distance+.01,x,0,trackId,branch);
  return Math.max(.2,Math.hypot(b.x-a.x,b.z-a.z)/.02);
}
export function sewerWaterHeight(x,distance,time=0,trackId='sewer-run',shortcut=null){
  const candidate=shortcutDefinition(shortcut,trackId),branch=candidate&&distance>candidate.start&&distance<candidate.end?candidate:null;
  const lane=x-(branch?.entryX||0),bank=Math.max(0,Math.abs(lane)-(branch?2.5:7));
  const mainRipple=.07*Math.sin(distance*.055+time*1.45)+.025*Math.sin(distance*.16-x*.42+time*2);
  const mainBank=Math.max(0,Math.abs(x)-7)**2*sewerSection(distance,trackId).bankStrength;
  if(!branch)return mainRipple+mainBank;
  const blend=smooth((distance-branch.start)/22)*smooth((branch.end-distance)/22);
  return mainRipple+mainBank*(1-blend)+bank*bank*.055*blend;
}

const SECTION_ROWS={
  'sewer-run':[
    ['interceptor','BRICK INTERCEPTOR',0,205,'masonry',false,.065],
    ['pump-room','PUMP HOUSE',205,405,'pump',true,.035],
    ['service-bend','SERVICE SWEEP',405,660,'vault',false,.075],
    ['sluice-hall','SLUICE HALL',660,900,'steel',true,.04],
    ['old-drain','THE OLD DRAIN',900,1120,'masonry',false,.065],
    ['outfall','DAYLIGHT OUTFALL',1120,1360,'outfall',true,.035],
  ],
  'sewer-depths':[
    ['deep-inlet','DEEP INLET',0,340,'vault',false,.06],
    ['turbine-vault','TURBINE VAULT',340,570,'pump',true,.035],
    ['pressure-main','PRESSURE MAIN',570,850,'steel',false,.075],
    ['valve-chamber','VALVE CHAMBER',850,1070,'pump',true,.04],
    ['gravity-drain','GRAVITY DRAIN',1070,1340,'masonry',false,.065],
    ['spillway','FINAL SPILLWAY',1340,1740,'outfall',true,.035],
  ],
};
const SECTIONS=Object.fromEntries(Object.entries(SECTION_ROWS).map(([id,rows])=>[id,Object.freeze(rows.map(([key,name,start,end,kind,chamber,bankStrength])=>Object.freeze({id:key,name,start,end,kind,chamber,bankStrength})))]));
export function sewerSection(distance,trackId='sewer-run'){
  const track=getSewerTrack(trackId),sections=SECTIONS[track.id],section=sections.find(item=>distance>=item.start&&distance<item.end)||(distance<0?sections[0]:sections.at(-1));
  const fade=smooth((distance-section.start)/30)*smooth((section.end-distance)/30);
  return {...section,bankStrength:.055+(section.bankStrength-.055)*fade};
}
export function sewerTunnelProfile(distance,trackId='sewer-run',shortcut=null){
  const track=getSewerTrack(trackId),branch=shortcutDefinition(shortcut,track.id),section=sewerSection(distance,track.id);
  if(branch&&distance>branch.start&&distance<branch.end)return {radius:5,centerY:3,centreX:branch.entryX,halfWidth:branch.width/2,ceiling:8,section};
  const blend=section.chamber?smooth((distance-section.start)/60)*smooth((section.end-distance)/60):0;
  const radius=14+blend*8;
  return {radius,centerY:7,centreX:0,halfWidth:track.halfWidth,ceiling:7+radius,section};
}

const cache=new Map();
export function createSewerCourse(id='sewer-run'){
  const track=getSewerTrack(id);if(cache.has(track.id))return cache.get(track.id);
  const deep=track.id==='sewer-depths';
  const shortcuts=(deep?[[90,320,-8.2],[905,1020,8.2],[1090,1320,-8.2]]:[[30,200,-8.2],[700,840,8.2],[910,1080,-8.2]])
    .map(([start,end,entryX],index)=>Object.freeze({id:`${track.id}-bypass-${index+1}`,name:`BYPASS ${index+1}`,start,end,entryX,width:6.5,inset:entryX>0?8:0}));
  const distances=deep?[50,375,540,865,1040,1380,1575]:[240,420,665,860,1120,1280];
  const checkpoints=distances.map((distance,index)=>Object.freeze({index,distance,x:[0,2,-2,0,2,-1,1][index],radius:5.2}));
  const hazards=[];
  const add=(type,distance,x,path='main',extra={})=>hazards.push(Object.freeze({id:`${track.id}-${type}-${hazards.length}`,type,distance,x,path,
    radius:type==='whirlpool'?2.2:2.8,radiusX:type==='whirlpool'?2.2:2.8,radiusZ:type==='whirlpool'?4.5:1.7,width:type==='whirlpool'?4.4:5.6,height:type==='whirlpool'?.5:.72,...extra}));
  for(const [distance,x] of (deep?[[180,0],[475,-5],[725,4],[1235,0],[1525,4]]:[[115,0],[355,-4],[565,4],[1000,-3]]))add('whirlpool',distance,x);
  for(const [distance,x] of (deep?[[250,5],[800,-5],[1010,5],[1610,-4]]:[[165,5],[600,-4],[815,-5],[1240,-3]]))add('driftwood',distance,x);
  for(const [index,distance] of (deep?[425,935,1440]:[285,730,1160]).entries())add('barrel',distance,0,'main',{
    startDistance:distance-22,endDistance:distance+22,approachDistance:distance-60,
    closeDuration:Math.max(1.8,track.barrelSeconds-index*.12),width:track.halfWidth*2,radius:8.8});
  for(const shortcut of shortcuts){
    add('driftwood',shortcut.start+(shortcut.end-shortcut.start)*.48,shortcut.entryX,shortcut.id,{radiusX:3.2,width:6.4,height:.66});
    add('whirlpool',shortcut.start+(shortcut.end-shortcut.start)*.76,shortcut.entryX+2,shortcut.id,{radius:1.15,radiusX:1.15,width:2.3,radiusZ:3});
  }
  hazards.sort((a,b)=>a.distance-b.distance);
  const course=Object.freeze({...track,sections:SECTIONS[track.id],checkpoints:Object.freeze(checkpoints),shortcuts:Object.freeze(shortcuts),hazards:Object.freeze(hazards)});
  cache.set(track.id,course);return course;
}

export function sewerBarrelState(hazard,time,timing){
  if(!timing)return {closure:0,closingProgress:0,opening:1,timeLeft:hazard.closeDuration,active:false};
  const entered=Number.isFinite(timing.enteredAt),start=entered?timing.enteredAt:timing.approachedAt;
  const closure=timing.cleared?0:entered?clamp((time-start)/hazard.closeDuration,0,1):Math.min(.16,Math.max(0,time-start)*.07);
  return {closure,closingProgress:closure,opening:1-closure,timeLeft:entered?Math.max(0,timing.deadline-time):hazard.closeDuration,active:!timing.cleared};
}
