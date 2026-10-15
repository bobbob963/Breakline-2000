// Shared by collision, construction meshes and camera containment. The passage
// physically joins the east wall; crossing it never teleports the board.
export const PARK_MAINTENANCE=Object.freeze({
  id:'maintenance',name:'UNFINISHED WORKS',floorY:0,ceilingY:12,bayCeilingY:22,
  entrance:Object.freeze({x:120,z:-10,halfWidth:7,minY:.5,maxY:6.2}),
  tunnel:Object.freeze({minX:119,maxX:168,minZ:-18,maxZ:-2}),
  bay:Object.freeze({minX:166,maxX:262,minZ:-70,maxZ:66}),
});

export const MAINTENANCE_RAMPS=[
  {id:'maintenance-kicker',name:'SERVICE CHUTE',type:'kicker',x:188,z:-38,width:18,length:18,height:3.4,rotation:-Math.PI/2,color:0x8b886a},
  {id:'maintenance-spine',name:'UNFINISHED TRANSFER',type:'spine',x:220,z:10,width:46,length:24,height:4.2,rotation:0,color:0x8d8c79},
  {id:'maintenance-north',name:'NORTH FORMWORK',type:'quarter',x:218,z:-54,width:60,length:22,height:7,rotation:0,color:0x92866a},
  {id:'maintenance-south',name:'SOUTH FORMWORK',type:'quarter',x:220,z:50,width:60,length:22,height:7,rotation:Math.PI,color:0x92866a},
  {id:'maintenance-east',name:'UNFINISHED SPILLWAY',type:'quarter',x:249,z:0,width:70,length:22,height:7,rotation:-Math.PI/2,color:0x8a856b},
].map(ramp=>Object.freeze({...ramp,area:'maintenance'}));
export const MAINTENANCE_RAILS=[
  {id:'maintenance-service-rail',name:'SERVICE GANTRY RAIL',x:190,z:8,length:38,height:1.25,rotation:0},
  {id:'maintenance-cross-rail',name:'REBAR TRANSFER',x:180,z:25,length:18,height:1.35,rotation:Math.PI/2},
].map(rail=>Object.freeze({...rail,area:'maintenance'}));
export const MAINTENANCE_SOLIDS=[-50,-28,30,50].map(z=>Object.freeze({
  id:`maintenance-scaffold-${z}`,type:'cylinder',area:'maintenance',x:174,z,radius:.32,height:8,baseY:0,
}));

export function rectangleContains(rect,x,z,margin=0) {
  return x>=rect.minX-margin&&x<=rect.maxX+margin&&z>=rect.minZ-margin&&z<=rect.maxZ+margin;
}
export function maintenanceContains(x,z,margin=0) {
  return rectangleContains(PARK_MAINTENANCE.tunnel,x,z,margin)||rectangleContains(PARK_MAINTENANCE.bay,x,z,margin);
}
export function maintenanceCeilingAt(x,z) {
  if(rectangleContains(PARK_MAINTENANCE.bay,x,z))return PARK_MAINTENANCE.bayCeilingY;
  return rectangleContains(PARK_MAINTENANCE.tunnel,x,z)&&x>PARK_MAINTENANCE.entrance.x?PARK_MAINTENANCE.ceilingY:Infinity;
}
export function crossesMaintenanceEntrance(from,to,airborne) {
  const entry=PARK_MAINTENANCE.entrance;
  if(!airborne||from.x>entry.x||to.x<=entry.x||to.x<=from.x)return false;
  const t=(entry.x-from.x)/(to.x-from.x),z=from.z+(to.z-from.z)*t,y=from.y+(to.y-from.y)*t;
  return Math.abs(z-entry.z)<=entry.halfWidth&&y>=entry.minY&&y<=entry.maxY;
}

// Sweep the union rather than its bounding box: a diagonal must not cut through
// a tunnel wall simply because its endpoint happens to be inside the bay.
export function sweepMaintenanceBounds(from,to,mainBounds) {
  const inside=(x,z)=>rectangleContains(mainBounds,x,z)||maintenanceContains(x,z);
  const dx=to.x-from.x,dz=to.z-from.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));
  let lastT=0;
  for(let i=1;i<=steps;i++) {
    const t=i/steps,x=from.x+dx*t,z=from.z+dz*t;
    if(inside(x,z)){lastT=t;continue;}
    let low=lastT,high=t;
    for(let pass=0;pass<16;pass++) {
      const middle=(low+high)/2;
      if(inside(from.x+dx*middle,from.z+dz*middle))low=middle;else high=middle;
    }
    const point={x:from.x+dx*low,y:from.y+(to.y-from.y)*low,z:from.z+dz*low};
    const nx=!inside(point.x+Math.sign(dx)*.001,point.z)?-Math.sign(dx):0;
    const nz=!inside(point.x,point.z+Math.sign(dz)*.001)?-Math.sign(dz):0;
    return {point,normal:{x:nx,z:nz},fraction:low};
  }
  return null;
}
