import { SurfGame, RUN_SECONDS, POP_COOLDOWN, clamp } from './game.js';

const CUTBACK_SECONDS=.72;
const CUTBACK_TURN=145*Math.PI/180;

// Ramp coordinates: u is across the ramp and v runs from its foot to its lip.
// Rotation zero points towards -Z, matching the rider's heading.
export const PARK_RAMPS = [
  { id:'spine',name:'MAIN DRAIN SPINE',type:'spine',x:0,z:30,width:30,length:26,height:5,rotation:0,color:0x5a9991 },
  { id:'north',name:'NORTH SPILLWAY',type:'quarter',x:0,z:-161,width:52,length:26,height:10,rotation:0,color:0x507f7f },
  { id:'south',name:'SOUTH OVERFLOW',type:'quarter',x:0,z:161,width:52,length:26,height:10,rotation:Math.PI,color:0x4c8e87 },
  { id:'west',name:'WEST RUNOFF',type:'quarter',x:-103,z:50,width:48,length:26,height:10,rotation:Math.PI/2,color:0x5c9387 },
  { id:'east',name:'EAST RUNOFF',type:'quarter',x:103,z:50,width:48,length:26,height:10,rotation:-Math.PI/2,color:0x649689 },
  { id:'west-pipe-north',name:'FILTER HALFPIPE A / NORTH',type:'quarter',zone:'west-halfpipe',x:-66,z:-109,width:44,length:26,height:10,rotation:0,color:0x5e8b83 },
  { id:'west-pipe-south',name:'FILTER HALFPIPE A / SOUTH',type:'quarter',zone:'west-halfpipe',x:-66,z:-61,width:44,length:26,height:10,rotation:Math.PI,color:0x5e8b83 },
  { id:'east-pipe-north',name:'FILTER HALFPIPE B / NORTH',type:'quarter',zone:'east-halfpipe',x:66,z:-109,width:44,length:26,height:10,rotation:0,color:0x548583 },
  { id:'east-pipe-south',name:'FILTER HALFPIPE B / SOUTH',type:'quarter',zone:'east-halfpipe',x:66,z:-61,width:44,length:26,height:10,rotation:Math.PI,color:0x548583 },
  { id:'left-kicker',name:'PUMP HOUSE KICKER',type:'kicker',x:-30,z:98,width:16,length:18,height:4,rotation:.2,color:0x64a69c },
  { id:'right-kicker',name:'VALVE KICKER',type:'kicker',x:30,z:98,width:16,length:18,height:4.4,rotation:-.2,color:0x619f96 },
  { id:'drain-kicker',name:'STORM DRAIN LAUNCH',type:'kicker',x:0,z:-35,width:22,length:22,height:5.5,rotation:0,color:0x689f98 },
  { id:'west-deck',name:'WEST GLIDE DECK',type:'bank',x:-67,z:78,width:20,length:58,height:4,rotation:0,color:0x63867f },
  { id:'east-deck',name:'EAST GLIDE DECK',type:'bank',x:67,z:78,width:20,length:58,height:4,rotation:0,color:0x63867f },
  { id:'west-access',name:'WEST PIPE ROOF ACCESS',type:'access',x:-73.5,z:12,width:10,length:32,height:11,baseY:-1.6,rotation:-Math.PI/2,color:0x7f8270 },
  { id:'east-access',name:'EAST PIPE ROOF ACCESS',type:'access',x:74,z:17,width:10,length:32,height:12,baseY:-1.6,rotation:Math.PI/2,color:0x7f8270 },
  { id:'west-transfer',name:'WEST TREATMENT SPINE',type:'spine',x:-65,z:-138,width:28,length:30,height:6,rotation:Math.PI/2,color:0x599080 },
  { id:'east-transfer',name:'EAST TREATMENT SPINE',type:'spine',x:65,z:-138,width:28,length:30,height:6,rotation:Math.PI/2,color:0x599080 },
];

export const PARK_TERRAIN = [
  {id:'main-channel',type:'channel',x:0,z:0,width:48,length:340,depth:2.4,rotation:0},
  {id:'west-channel',type:'channel',x:-52,z:0,width:36,length:280,depth:1.6,rotation:0},
  {id:'east-channel',type:'channel',x:52,z:0,width:36,length:280,depth:1.6,rotation:0},
  {id:'collection-bowl',type:'bowl',x:0,z:-125,radius:58,depth:3.8},
];
export const PARK_PIPES = [
  {id:'west-outfall',name:'WEST OUTFALL',x:-52,z:12,length:60,radius:5.5,thickness:.45,centerY:3.9,rotation:0},
  {id:'east-outfall',name:'EAST OUTFALL',x:52,z:17,length:50,radius:6,thickness:.45,centerY:4.4,rotation:0},
];
export const PARK_COPINGS=PARK_RAMPS.filter(ramp=>ramp.type==='quarter').map(ramp=>{
  const v=ramp.length*.485,x=ramp.x-Math.sin(ramp.rotation)*v,z=ramp.z-Math.cos(ramp.rotation)*v;
  return {id:ramp.id+'-coping',name:ramp.name+' COPING',kind:'coping',rampId:ramp.id,x,z,length:ramp.width-4,height:parkHeight(x,z)+.16,rotation:ramp.rotation-Math.PI/2,radius:.12,supportRadius:.07,supportCount:4};
});

export const PARK_RAILS = [
  {id:'left-rail',name:'WEST FLOW RAIL',x:-20,z:-2,length:28,height:1.05,rotation:0},
  {id:'right-rail',name:'EAST FLOW RAIL',x:20,z:-2,length:28,height:1.05,rotation:0},
  {id:'west-deck-rail',name:'WEST GLIDE PIPE',x:-67,z:78,length:23,height:5.2,rotation:0},
  {id:'east-deck-rail',name:'EAST GLIDE PIPE',x:67,z:78,length:23,height:5.2,rotation:0},
  {id:'west-channel',name:'WEST CHANNEL RAIL',x:-94,z:-61,length:42,height:1.4,rotation:0},
  {id:'east-channel',name:'EAST CHANNEL RAIL',x:94,z:-61,length:42,height:1.4,rotation:0},
  {id:'south-crossing',name:'SOUTH PIPELINE',x:0,z:124,length:36,height:.4,rotation:Math.PI/2},
  {id:'north-crossing',name:'NORTH PIPELINE',x:0,z:-105,length:34,height:.2,rotation:Math.PI/2},
  ...PARK_PIPES.map(pipe=>({id:pipe.id+'-crest',name:pipe.name+' CREST',x:pipe.x,z:pipe.z,length:pipe.length-2,height:pipe.centerY+pipe.radius+.22,rotation:pipe.rotation,pipeId:pipe.id})),
  ...PARK_COPINGS,
].map(rail=>({radius:.18,supportRadius:.13,supportCount:4,...rail}));

export const PARK_BOUNDS = { minX:-120,maxX:120,minZ:-180,maxZ:180 };
export const PARK_SPAWN = {x:0,z:88,heading:0};
export const PARK_STARTS = {
  basin:{...PARK_SPAWN,name:'SOUTH CANAL'},
  west:{x:-52,z:48,heading:0,name:'WEST RUST TUNNEL'},
  east:{x:52,z:48,heading:0,name:'EAST RUST TUNNEL'},
  filters:{x:-66,z:-85,heading:0,name:'FILTER HALFPIPE'},
};
export const PARK_SOLIDS = [-98,98].flatMap(x=>[-128,-38,125].map(z=>({id:`column-${x}-${z}`,type:'cylinder',x,z,radius:1.2,height:28,baseY:0})));

export function parkLocal(object, x, z) {
  const c = Math.cos(object.rotation), s = Math.sin(object.rotation);
  return { u: (x - object.x) * c - (z - object.z) * s, v: -(x - object.x) * s - (z - object.z) * c };
}

// Exported separately so visual meshes can use the exact collision profile.
export function rampHeight(ramp, u, v) {
  if (Math.abs(u) > ramp.width / 2 || Math.abs(v) > ramp.length / 2) return 0;
  const t = clamp(v / ramp.length + 0.5, 0, 1);
  const edge = clamp((ramp.width / 2 - Math.abs(u)) / 1.35, 0, 1);
  const bankT = Math.min(t, 1 - t) / .24;
  const profile = ramp.type === 'bank'
    ? bankT >= 1 ? 1 : (1 - Math.cos(bankT * Math.PI)) / 2
    : ramp.type === 'spine'
    ? Math.sin(t * Math.PI) ** 2
    : ramp.type === 'quarter'
      ? 1 - Math.cos(t * Math.PI / 2)
      : t * t;
  return ramp.height * profile * edge;
}

export function pipeSurfaceHeight(pipe,u,side='inside') {
  const radius=side==='outside'?pipe.radius:pipe.radius-pipe.thickness;
  if(Math.abs(u)>radius) return null;
  const rise=Math.sqrt(Math.max(0,radius*radius-u*u));
  return pipe.centerY+(side==='outside'?rise:-rise);
}

export function parkTerrainHeight(x,z) {
  let height=0;
  for(const terrain of PARK_TERRAIN) {
    if(terrain.type==='bowl') {
      const r=Math.hypot(x-terrain.x,z-terrain.z)/terrain.radius;
      if(r<1) height=Math.min(height,-terrain.depth*(1-r*r)**2);
    } else {
      const {u,v}=parkLocal(terrain,x,z),across=Math.abs(u)/(terrain.width/2);
      const fade=clamp((terrain.length/2-Math.abs(v))/18,0,1);
      if(across<1) height=Math.min(height,-terrain.depth*(1+Math.cos(across*Math.PI))*.5*fade);
    }
  }
  // Short, visible mouth aprons connect the channel to the inner pipe floor.
  for(const pipe of PARK_PIPES) {
    const {u,v}=parkLocal(pipe,x,z),distance=Math.abs(v)-pipe.length/2;
    if(distance>=0&&distance<3&&Math.abs(u)<(pipe.radius-pipe.thickness)*.65) {
      const floor=pipeSurfaceHeight(pipe,u);
      height=Math.max(height,height+(floor-height)*(1-distance/3));
    }
  }
  return height;
}

export function parkHeight(x, z) {
  const terrain=parkTerrainHeight(x,z);
  let height = terrain;
  for (const ramp of PARK_RAMPS) {
    const { u, v } = parkLocal(ramp, x, z);
    const h=rampHeight(ramp,u,v);
    if(h>0) height=Math.max(height,(ramp.baseY??terrain)+h);
  }
  return height;
}

export function parkSurface(x, z) {
  const terrain=parkTerrainHeight(x,z);
  let height = terrain, selected = null, progress = 0, lateral = 0;
  for (const ramp of PARK_RAMPS) {
    const { u, v } = parkLocal(ramp, x, z);
    const relative=rampHeight(ramp,u,v),h=relative>0?(ramp.baseY??terrain)+relative:terrain;
    if (h > height) { height = h; selected = ramp; progress = v / ramp.length + 0.5; lateral = u; }
  }
  const e = 0.07;
  return {
    height, ramp: selected, progress, lateral,
    dx: (parkHeight(x + e, z) - parkHeight(x - e, z)) / (e * 2),
    dz: (parkHeight(x, z + e) - parkHeight(x, z - e)) / (e * 2),
  };
}

function rideHeight(x,z,referenceY) {
  let height=parkHeight(x,z),selected=null,side=null;
  for(const pipe of PARK_PIPES) {
    const {u,v}=parkLocal(pipe,x,z);
    if(Math.abs(v)>pipe.length/2||Math.abs(u)>=pipe.radius) continue;
    const roof=pipeSurfaceHeight(pipe,u,'outside');
    if(referenceY>=roof-.45) {
      if(roof>height) {height=roof;selected=pipe;side='outside';}
    } else {
      const floor=pipeSurfaceHeight(pipe,u);
      if(floor!==null&&referenceY<pipe.centerY+.1&&floor>height) {height=floor;selected=pipe;side='inside';}
    }
  }
  return {height,pipe:selected,pipeSide:side};
}

export function parkRideSurface(x,z,referenceY=parkHeight(x,z)) {
  const surface=parkSurface(x,z),ride=rideHeight(x,z,referenceY),e=.04;
  if(!ride.pipe) return surface;
  return {...surface,...ride,ramp:null,dx:(rideHeight(x+e,z,referenceY).height-rideHeight(x-e,z,referenceY).height)/(2*e),dz:(rideHeight(x,z+e,referenceY).height-rideHeight(x,z-e,referenceY).height)/(2*e)};
}

const supportCache=new Map();
export function railTopHeight(rail,local=0) {
  if(rail.kind!=='coping')return rail.height;
  const x=rail.x-Math.sin(rail.rotation)*local,z=rail.z-Math.cos(rail.rotation)*local;
  return parkHeight(x,z)+.16;
}
export function railSupports(rail) {
  if(supportCache.has(rail.id)) return supportCache.get(rail.id);
  const pipe=PARK_PIPES.find(item=>item.id===rail.pipeId);
  const supports=Array.from({length:rail.supportCount+1},(_,i)=>{
    const local=(i/rail.supportCount-.5)*rail.length;
    const x=rail.x-Math.sin(rail.rotation)*local,z=rail.z-Math.cos(rail.rotation)*local;
    return {x,z,bottom:pipe?pipe.centerY+pipe.radius:parkHeight(x,z),top:railTopHeight(rail,local)-rail.radius,radius:rail.supportRadius};
  });
  supportCache.set(rail.id,supports);return supports;
}

function pointContact(x,y,z,radius=0,includeRails=true) {
  for(const pipe of PARK_PIPES) {
    const {u,v}=parkLocal(pipe,x,z);
    if(Math.abs(v)>pipe.length/2+radius) continue;
    const dy=y-pipe.centerY,distance=Math.hypot(u,dy),inner=pipe.radius-pipe.thickness;
    if(distance<inner-radius||distance>pipe.radius+radius) continue;
    const sign=distance<(inner+pipe.radius)/2?-1:1,scale=sign/Math.max(.001,distance);
    return {type:'pipe',pipe,normal:{x:Math.cos(pipe.rotation)*u*scale,y:dy*scale,z:-Math.sin(pipe.rotation)*u*scale}};
  }
  for(const solid of PARK_SOLIDS) {
    if(y<solid.baseY-radius||y>solid.baseY+solid.height+radius) continue;
    const dx=x-solid.x,dz=z-solid.z,distance=Math.hypot(dx,dz);
    if(distance<solid.radius+radius) return {type:'column',solid,normal:{x:dx/(distance||1),y:0,z:dz/(distance||1)}};
  }
  if(includeRails) for(const rail of PARK_RAILS) {
    const {u,v}=parkLocal(rail,x,z),end=v-clamp(v,-rail.length/2,rail.length/2);
    if(Math.abs(u)>Math.max(rail.radius,rail.supportRadius)+radius||Math.abs(end)>rail.radius+radius) continue;
    const dy=y-(railTopHeight(rail,clamp(v,-rail.length/2,rail.length/2))-rail.radius);
    const distance=Math.hypot(u,end,dy);
    if(distance<rail.radius+radius) return {type:'rail',rail,normal:{x:Math.cos(rail.rotation)*u-Math.sin(rail.rotation)*end,y:dy,z:-Math.sin(rail.rotation)*u-Math.cos(rail.rotation)*end}};
    for(const support of railSupports(rail)) {
      const dx=x-support.x,dz=z-support.z,distance=Math.hypot(dx,dz);
      if(y>=support.bottom-radius&&y<=support.top+radius&&distance<support.radius+radius) return {type:'support',rail,normal:{x:dx/(distance||1),y:0,z:dz/(distance||1)}};
    }
  }
  return null;
}

export function parkPointBlocked(x,y,z,radius=.08) {return !!pointContact(x,y,z,radius);}

export function pipeRideFrame(pipe,angle,local,dir=1) {
  const radius=pipe.radius-pipe.thickness-.12,u=Math.sin(angle)*radius,c=Math.cos(pipe.rotation),s=Math.sin(pipe.rotation);
  return {x:pipe.x+c*u-s*local,y:pipe.centerY-Math.cos(angle)*radius,z:pipe.z-s*u-c*local,
    up:{x:-Math.sin(angle)*c,y:Math.cos(angle),z:Math.sin(angle)*s},roll:angle*dir};
}

function sweptObstacles(from,to,game) {
  const distance=Math.max(Math.hypot(to.x-from.x,to.z-from.z),Math.abs(to.y-from.y));
  const samples=Math.max(1,Math.ceil(distance/.06));
  let previous={...from};
  for(let i=1;i<=samples;i++) {
    const fraction=i/samples,point=interpolate(from,to,fraction);
    if(game.airborne&&game.railCooldown===0&&!game.trick&&game.vy<=2.5&&game.airtime>.12) {
      for(const rail of PARK_RAILS) {
        const {u,v}=parkLocal(rail,point.x,point.z);
        const along=-(game.vx*Math.sin(rail.rotation)+game.vz*Math.cos(rail.rotation));
        const alignment=Math.abs(along)/Math.max(1,Math.hypot(game.vx,game.vz));
        if(Math.abs(u)>=.55||Math.abs(v)>=rail.length/2-.1||alignment<=.7)continue;
        const top=railTopHeight(rail,v);
        if(point.y>=top-.06&&point.y<=top+.24) {
          return {type:'grind',rail,point:{...point,y:top},fraction,along,local:v};
        }
      }
    }
    for(const bodyHeight of [.35,.85,1.35,1.9]) {
      const hit=pointContact(point.x,point.y+bodyHeight,point.z,.22);
      if(hit) return {...hit,point:previous,fraction:(i-1)/samples};
    }
    previous=point;
  }
  return null;
}

const WALKABLE_SLOPE = 1.5;
const SWEEP_SPACING = .08;
const interpolate = (a, b, t) => ({ x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t, z: a.z + (b.z-a.z)*t });

function collisionNormal(ramp, from, to) {
  if(!ramp) {
    const surface=parkRideSurface(to.x,to.z,from.y),length=Math.hypot(surface.dx,surface.dz)||1;
    return {x:-surface.dx/length,z:-surface.dz/length};
  }
  const c = Math.cos(ramp.rotation), s = Math.sin(ramp.rotation);
  const a = parkLocal(ramp, from.x, from.z), b = parkLocal(ramp, to.x, to.z);
  if (a.v > ramp.length / 2 && b.v <= ramp.length / 2) return { x: -s, z: -c };
  if (a.v < -ramp.length / 2 && b.v >= -ramp.length / 2) return { x: s, z: c };
  if (a.u > ramp.width / 2 && b.u <= ramp.width / 2) return { x: c, z: -s };
  if (a.u < -ramp.width / 2 && b.u >= -ramp.width / 2) return { x: -c, z: s };
  const surface = parkSurface(to.x, to.z), magnitude = Math.hypot(surface.dx, surface.dz);
  if (magnitude > .001) return { x: -surface.dx/magnitude, z: -surface.dz/magnitude };
  const length = Math.hypot(to.x-from.x,to.z-from.z) || 1;
  return { x: (from.x-to.x)/length, z: (from.z-to.z)/length };
}

// A board's collision point is at its underside. Every movement is sampled in
// space, then surface intersections are refined by bisection. This catches
// rising jumps, thin diagonal entries, and discontinuous quarter-pipe backs.
// Ground travel follows only reachable slopes; it cannot teleport up a wall.
export function sweepParkMotion(from, to, grounded = false) {
  const length = Math.hypot(to.x-from.x,to.z-from.z);
  const samples = Math.max(1, Math.ceil(Math.max(length, Math.abs(to.y-from.y))/SWEEP_SPACING));
  let last = { ...from }, lastHeight = rideHeight(from.x,from.z,from.y).height, lastT = 0;
  if (grounded) last.y = lastHeight;
  for (let i=1; i<=samples; i++) {
    const t = i/samples, point = interpolate(from,to,t), height = rideHeight(point.x,point.z,grounded?last.y:point.y).height;
    const stepLength = Math.hypot(point.x-last.x,point.z-last.z);
    let steepRise = height-lastHeight > stepLength*WALKABLE_SLOPE+.012;
    if (!steepRise && height > lastHeight+.00001 && stepLength > 0) {
      // The first sample may straddle the edge, diluting its measured grade.
      // Use the bevel's analytic cross-slope so a high side cannot be mounted
      // a few centimetres at a time before the collision finally triggers.
      const ramp = parkSurface(point.x,point.z).ramp;
      if (ramp) {
        const a = parkLocal(ramp,last.x,last.z), b = parkLocal(ramp,point.x,point.z);
        const insideEdge = ramp.width/2-Math.abs(b.u);
        if (insideEdge > 0 && insideEdge < 1.35) {
          const sideGrade = rampHeight(ramp,b.u,b.v)/insideEdge * (Math.abs(a.u)-Math.abs(b.u))/stepLength;
          steepRise = sideGrade > WALKABLE_SLOPE;
        }
      }
    }
    if (grounded && steepRise) {
      const surface = parkRideSurface(point.x,point.z,last.y);
      return { point:last, fraction:lastT, type:'wall', normal:collisionNormal(surface.ramp,last,point) };
    }
    if (grounded && lastHeight-height > stepLength*WALKABLE_SLOPE+.012) {
      point.y = lastHeight;
      return { point, fraction:t, type:'edge' };
    }
    if (!grounded && point.y < height-.00001) {
      let low=lastT, high=t;
      for (let pass=0; pass<18; pass++) {
        const mid=(low+high)/2, candidate=interpolate(from,to,mid);
        if (candidate.y < rideHeight(candidate.x,candidate.z,candidate.y).height) high=mid; else low=mid;
      }
      const contact = interpolate(from,to,low), surface = parkSurface(point.x,point.z);
      if (steepRise && surface.ramp) {
        return { point:contact, fraction:low, type:'wall', normal:collisionNormal(surface.ramp,last,point) };
      }
      contact.y = rideHeight(contact.x,contact.z,contact.y).height;
      return { point:contact, fraction:low, type:'land' };
    }
    if (grounded) point.y = height;
    last=point; lastHeight=height; lastT=t;
  }
  return { point:last, fraction:1, type:null };
}

export class WaveParkGame extends SurfGame {
  start(startId='basin') {
    this.startPoint=Object.hasOwn(PARK_STARTS,startId)?PARK_STARTS[startId]:PARK_STARTS.basin;
    super.start();
  }
  reset() {
    super.reset();
    const spawn=this.startPoint||PARK_SPAWN;
    Object.assign(this, {
      mode:'park',x:spawn.x,z:spawn.z,heading:spawn.heading,distance:-spawn.z,
      y:parkHeight(spawn.x,spawn.z),vx:-Math.sin(spawn.heading)*12,vz:-Math.cos(spawn.heading)*12,speed:12,grinding:null,
      rampHits: 0, grindCount: 0, visitedRamps: new Set(),
      railCooldown:0,rampCooldown:0,surface:parkRideSurface(spawn.x,spawn.z,parkHeight(spawn.x,spawn.z)),
      steering:0,pipeRide:null,pipeLoops:0,pipeCooldown:0,rideRoll:0,rideUp:{x:0,y:1,z:0},lipMove:null,lipGrab:0,rampReturn:null,
    });
  }

  bank() { return this.grinding||this.pipeRide||this.lipMove ? false : super.bank(); }

  doCutback(direction=0) {
    if(this.phase!=='running'||this.airborne||this.bailTime>0||this.grinding||this.pipeRide||this.lipMove||this.cutbackActive||this.cutbackCooldown>0||this.speed<8)return false;
    // Match ocean pose/event directions: left is -1, right is +1. Park
    // heading runs the opposite way, so only the physical yaw negates this.
    this.cutbackDirection=Number.isFinite(direction)&&direction!==0?Math.sign(direction):this.steering>0?-1:1;
    this.cutbackActive=true;this.cutbackAge=0;this.cutbackProgress=0;this.cutback=.001;this.cutbackCooldown=1.5;
    this.cutbackLaunchTime=0;this.charge=0;this.carveTime=0;
    this.onEvent({type:'cutbackStart',mode:'park',direction:this.cutbackDirection});return true;
  }

  cancelCutback() {
    this.cutbackActive=false;this.cutback=0;this.cutbackProgress=0;this.cutbackAge=0;this.cutbackLaunchTime=0;
  }

  updateCutback(dt) {
    const before=this.cutbackProgress;
    this.cutbackAge+=dt;this.cutbackProgress=clamp(this.cutbackAge/CUTBACK_SECONDS,0,1);
    const smooth=value=>value*value*(3-2*value);
    this.heading-=this.cutbackDirection*CUTBACK_TURN*(smooth(this.cutbackProgress)-smooth(before));
    this.cutback=Math.sin(this.cutbackProgress*Math.PI);
  }

  approachingCoping(surface) {
    const ramp=surface.ramp;
    return ramp?.type==='quarter'&&surface.progress>=.72&&Math.abs(surface.lateral)<ramp.width/2-1.35&&
      -(this.vx*Math.sin(ramp.rotation)+this.vz*Math.cos(ramp.rotation))>.8;
  }

  bail(reason = 'WIPEOUT') {
    if(this.phase!=='running'||this.bailTime>0)return;
    if(this.pipeRide) {this.pipeRide.angle=0;this.applyPipeRide();this.endPipeRide();}
    if(this.lipMove) {
      const move=this.lipMove;
      this.x=move.x;this.z=move.z;this.y=parkHeight(this.x,this.z);
      this.faceIntoRamp(move.ramp.id);
    } else if(this.grinding?.kind==='coping') {
      this.faceIntoRamp(this.grinding.rampId);
      this.x-=Math.sin(this.heading)*.6;this.z-=Math.cos(this.heading)*.6;
      this.y=parkHeight(this.x,this.z);
    }
    this.lipMove=null;this.lipGrab=0;this.rampReturn=null;
    this.cancelCutback();
    this.grinding = null;
    this.railCooldown = 1.2;
    super.bail(reason);
  }

  jump() {
    if(this.phase!=='running'||this.bailTime>0)return false;
    if(this.lipMove)return false;
    if(this.pipeRide) {
      const angle=Math.atan2(Math.sin(this.pipeRide.angle),Math.cos(this.pipeRide.angle));
      if(Math.abs(angle)>.12){this.pipeRide.releasePending=true;return false;}
      if(this.popCooldown>0)return false;
      this.endPipeRide();
    }
    if(!this.popReady)return false;
    const fromRail = !!this.grinding;
    if(this.grinding?.kind==='coping')this.faceIntoRamp(this.grinding.rail.rampId);
    this.grinding = null;
    if (fromRail) this.railCooldown = 1;
    const surface=parkRideSurface(this.x,this.z,this.y);
    const uphill=surface.ramp?clamp(surface.dx*this.vx+surface.dz*this.vz,0,16):0;
    // A climbing board already has upward surface velocity. A flat-ground
    // jump discarded that momentum and immediately fell into the rising face.
    if(uphill>.5) {
      const horizontal=Math.hypot(this.vx,this.vz),scale=Math.min(1,16/Math.max(1,horizontal));
      this.vx*=scale;this.vz*=scale;
    }
    this.launch(Math.min(16,6.6 + this.charge * 3 + uphill), fromRail ? 'RAIL POP' : uphill>.5?'RAMP POP':'OLLIE', fromRail ? 180 : 0);
    this.airLaunchSource=fromRail?'rail':uphill>.5?'ramp':'flat';
    return true;
  }

  launch(velocity, name = 'LIP LAUNCH', points = 200) {
    this.cancelCutback();
    this.lastJump = this.elapsed;
    this.rampReturn=null;
    this.popRecovery=POP_COOLDOWN;this.airLaunchSource='ramp';this.launchTricks=0;
    this.airborne = true;
    this.airtime = 0;
    this.trick = null;
    this.vy = velocity;
    this.y += 0.045;
    this.charge = 0;
    this.rotation = 0;
    this.flipRotation = 0;
    this.boardRotation = 0;
    this.rollRotation = 0;
    this.rampCooldown = 0.8;
    if(points>0)this.addCombo(name, points);
    this.onEvent({ type: 'jump' });
  }

  recordRamp(ramp) {
    this.rampHits++;
    const first = !this.visitedRamps.has(ramp.id);
    this.visitedRamps.add(ramp.id);
    if (first) this.addCombo(ramp.name, 250);
    this.onEvent({ type: 'ramp', id: ramp.id, first });
  }

  update(dt, input = {}) {
    if (this.phase !== 'running') return;
    // Fixed-size substeps keep ramp launches and rail catches fair at 30/60/120 Hz.
    dt = clamp(dt, 0, 0.05);
    if(dt===0)return;
    const steps = Math.max(1, Math.ceil(dt * 120 - 1e-8));
    for (let i = 0; i < steps && this.phase === 'running'; i++) this.stepPark(dt / steps, input);
  }

  stepPark(dt, input) {
    this.elapsed += dt;
    this.recoverPop(dt);
    this.time = this.rules.endless?this.elapsed:Math.max(0, RUN_SECONDS - this.elapsed);
    this.railCooldown = Math.max(0, this.railCooldown - dt);
    this.rampCooldown = Math.max(0, this.rampCooldown - dt);
    this.pipeCooldown=Math.max(0,this.pipeCooldown-dt);
    this.cutbackCooldown=Math.max(0,this.cutbackCooldown-dt);
    const steering = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steering = steering;
    const previous = parkRideSurface(this.x,this.z,this.y);

    if(input.action&&!this.pipeRide&&!this.lipMove&&!this.grinding&&!this.airborne&&this.bailTime<=0&&this.pipeCooldown===0)this.tryPipeRide();
    const chord=input.grind?-steering:0;
    if(chord!==this.cutbackChord){this.cutbackChord=chord;this.cutbackChordArmed=true;}
    const copingPriority=input.grind&&this.approachingCoping(previous);
    const reserved=input.action||this.pipeRide||this.lipMove||this.grinding||copingPriority;
    if(reserved) {
      if(this.cutbackActive)this.cancelCutback();
      if(chord)this.cutbackChordArmed=false;
    } else if(chord&&this.cutbackChordArmed&&this.doCutback(chord))this.cutbackChordArmed=false;
    if(this.pipeRide)this.updatePipeRide(dt,input);
    else if(this.lipMove)this.updateLipMove(dt);
    else if (this.grinding) this.updateRail(dt, input);
    else {
      const active = this.bailTime <= 0;
      const pushing=input.pump||(!this.airborne&&!this.cutbackActive&&input.jump);
      const groundTurn=1.65+.55*(1-clamp((this.speed-3.5)/11.5,0,1));
      if(this.cutbackActive)this.updateCutback(dt);
      else if (active&&!this.rampReturn&&!copingPriority) this.heading += steering * (this.airborne ? 0.88 : groundTurn) * dt;
      const targetSpeed = active ? (input.brake ? 3.5 : (pushing ? 23.5 : 15)+this.forwardSpeedBonus)*(this.cutbackActive?.72:1) : 3;
      // Crouching pumps the board toward the same limit as W. Let earned
      // momentum coast through a flight/landing instead of braking toward cruise.
      const coasting=active&&!input.brake&&!this.cutbackActive&&!pushing&&this.speed>15+this.forwardSpeedBonus;
      const acceleration=input.brake?3.6:coasting?(this.airborne?.10:.35):1.5;
      this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt * acceleration));
      const decay = 1 - Math.exp(-dt * (this.airborne ? 3.4 : this.cutbackActive?17:14));
      if(this.rampReturn)this.updateRampReturn(dt,steering);
      else {
        // A ramp pop redirects some speed upward. Keep that short climbing
        // portion controlled instead of accelerating into the face again.
        const risingFace=this.airborne&&this.airLaunchSource==='ramp'&&previous.ramp&&previous.dx*this.vx+previous.dz*this.vz>.05;
        const travelSpeed=risingFace?Math.min(16,this.speed):this.speed;
        this.vx += (-Math.sin(this.heading) * travelSpeed - this.vx) * decay;
        this.vz += (-Math.cos(this.heading) * travelSpeed - this.vz) * decay;
      }
      const wasAirborne = this.airborne;
      const from = { x:this.x, y:this.y, z:this.z };
      if (wasAirborne) this.vy -= 11.2*dt;
      const to = { x:this.x+this.vx*dt, y:this.y+(wasAirborne ? this.vy*dt : 0), z:this.z+this.vz*dt };
      let movement = sweepParkMotion(from,to,!wasAirborne);
      const obstacle=sweptObstacles(from,movement.point,this);
      if(obstacle) movement={...obstacle,fraction:movement.fraction*obstacle.fraction};
      this.x=movement.point.x; this.y=movement.point.y; this.z=movement.point.z;
      if (movement.type === 'wall') this.reflectWall(movement.normal);
      if(obstacle&&obstacle.type!=='grind') {
        const normal=obstacle.normal;
        if(normal.y<-.45&&wasAirborne&&this.vy>0) this.vy=-Math.max(1,this.vy*.3);
        if(Math.hypot(normal.x,normal.z)>.02) this.reflectWall(normal);
        else if(obstacle.type!=='pipe') {
          const speed=Math.hypot(this.vx,this.vz)||1;
          this.reflectWall({x:-this.vx/speed||1,z:-this.vz/speed});
          if(Math.hypot(this.vx,this.vz)<2) this.vx=3;
        }
      }
      if(obstacle?.type==='grind') this.catchRail(obstacle.rail,obstacle.local,obstacle.along);
      this.bounceEdges();
      const surface = parkRideSurface(this.x,this.z,this.y);
      this.surface = surface;

      if (this.bailTime > 0) {
        this.bailTime = Math.max(0,this.bailTime-dt);
        this.y = surface.height;
        if (this.bailTime === 0) this.onEvent({ type:'recover' });
      } else if (wasAirborne) {
        this.airtime += dt;
        this.updateAirTrick(dt*movement.fraction);
        if (!this.grinding && movement.type === 'land') {
          this.airborne = false; this.vy = 0;this.rampReturn=null;
          const landing=this.resolveLandingTrick();
          if(landing.landed) {
            if(this.airLaunchSource!=='flat'||this.launchTricks>0)this.addCombo('CLEAN LANDING',120);
            this.onEvent({ type:'land', points:this.comboBase*this.multiplier,assisted:landing.assisted });
          }
        }
        // Manual uphill pops can already be airborne at the lip. They use
        // the same gentle bowl return without replacing the active trick.
        if(this.airborne&&!this.grinding&&!this.rampReturn&&surface.ramp?.type==='quarter'&&surface.progress>=.96) {
          const forward=-(this.vx*Math.sin(surface.ramp.rotation)+this.vz*Math.cos(surface.ramp.rotation));
          if(forward>.8&&Math.abs(surface.lateral)<surface.ramp.width/2-1.35) {
            this.recordRamp(surface.ramp);this.beginRampReturn(surface.ramp,input);
          }
        }
      } else {
        if (movement.type === 'edge') {
          this.launch(2.8,'WAVE TRANSFER',140);
          if (previous.ramp) this.recordRamp(previous.ramp);
        }
        if (input.jump) this.charge = clamp(this.charge + dt * 1.3, 0, 1);
        else this.charge = Math.max(0, this.charge - dt * 3);
        if (!this.airborne && movement.type !== 'wall') this.tryRamp(surface,previous,input);
        if (!this.airborne && surface.ramp?.type === 'bank' && surface.progress > .28 && surface.progress < .72 && !this.visitedRamps.has(surface.ramp.id)) this.recordRamp(surface.ramp);
        if(this.cutbackActive&&this.cutbackProgress>=1) {
          this.cutbackActive=false;this.cutback=0;
          this.onEvent({type:'cutback',mode:'park',direction:this.cutbackDirection,launchTime:0});
        }
        if (!this.cutbackActive&&!input.grind&&Math.abs(steering) > 0 && this.speed > 8 && !input.brake) {
          this.carveTime += dt;
          if (this.carveTime > 0.85) { this.score += 30; this.carveTime = 0; }
        } else this.carveTime = 0;
        if (!this.airborne&&!this.grinding&&!this.lipMove&&!this.cutbackActive && this.comboBase) {
          this.comboTime -= dt;
          if (this.comboTime <= 0) this.bank();
        }
      }
    }
    // Rail rides and edge rebounds also keep the underside above the collider.
    // Ordinary terrain intersections are resolved by the sweep before this.
    if(!this.pipeRide){this.y=Math.max(this.y,rideHeight(this.x,this.z,this.y).height);this.surface=parkRideSurface(this.x,this.z,this.y);}
    this.distance = -this.z;
    if (!this.rules.endless&&this.time <= 0) {
      if (this.airborne || this.grinding ||this.pipeRide||this.lipMove||this.cutbackActive) this.clearCombo(); else this.bank();
      this.cancelCutback();
      this.grinding = null;
      this.phase = 'finished';
      this.onEvent({ type: 'finish' });
    }
  }

  tryRamp(surface, previous,input={}) {
    const ramp = surface.ramp;
    if (!ramp || ['bank','access'].includes(ramp.type) || this.speed < (ramp.type==='quarter'?2:7) || Math.abs(surface.lateral) > ramp.width / 2 - 1.35) return;
    const forward = -(this.vx * Math.sin(ramp.rotation) + this.vz * Math.cos(ramp.rotation));
    if(ramp.type==='quarter'&&forward>.8&&(input.grind||input.action)) {
      if(surface.progress<.96)return;
      this.recordRamp(ramp);
      if(input.grind) {
        const coping=PARK_COPINGS.find(item=>item.rampId===ramp.id);
        const direction=input.left?-1:input.right?1:1;
        this.catchRail(coping,clamp(surface.lateral,-coping.length/2+.2,coping.length/2-.2),direction*Math.max(8,this.speed*.6));
        this.heading=coping.rotation+(direction<0?Math.PI:0);
        this.vx=-Math.sin(this.heading)*this.speed;this.vz=-Math.cos(this.heading)*this.speed;
      } else this.startLipMove(ramp);
      return;
    }
    const sameRamp = previous.ramp?.id === ramp.id;
    const crossingCrest = ramp.type === 'spine' && sameRamp &&
      ((forward > 4 && previous.progress < 0.49 && surface.progress >= 0.49) ||
       (forward < -4 && previous.progress > 0.51 && surface.progress <= 0.51));
    const reachingLip = ramp.type !== 'spine' && forward > (ramp.type==='quarter'?.8:4) && surface.progress >= (ramp.type==='quarter'?.96:.97);
    if (!crossingCrest && !reachingLip) return;
    this.recordRamp(ramp);
    const uphill=clamp(surface.dx*this.vx+surface.dz*this.vz,0,16);
    // Quarterpipes turn most approach travel upward, then back toward the
    // basin; straight kickers retain speed and need to outrun their rising lip.
    const launchSpeed=ramp.type==='quarter'?clamp(10+(forward-10)*.18,6,12.5):ramp.type==='spine'?7.6:Math.max(8.5,uphill+4.5);
    this.launch(launchSpeed+this.charge*2,
      ramp.type === 'spine' ? 'SPINE TRANSFER' : 'LIP LAUNCH', 220);
    if (ramp.type === 'quarter') this.beginRampReturn(ramp,input);
  }

  beginRampReturn(ramp,input={}) {
    const s=Math.sin(ramp.rotation),c=Math.cos(ramp.rotation);
    const lateral=clamp(this.vx*c-this.vz*s,-5,5),returnSpeed=Math.max(7,this.speed*.5);
    const endHeading=Math.atan2(-(c*lateral+s*returnSpeed),-(-s*lateral+c*returnSpeed));
    let turn=Math.atan2(Math.sin(endHeading-this.heading),Math.cos(endHeading-this.heading));
    if(Math.abs(Math.abs(turn)-Math.PI)<.001)turn=input.right?-Math.PI:Math.PI;
    this.rampReturn={ramp,age:0,duration:.75,heading:this.heading,turn,lateral,returnSpeed};
    // Convert the fast approach into an upward lip launch before turning.
    // The short outward drift stays over the ramp instead of crossing its back.
    this.vx=c*lateral-s*2.2;this.vz=-s*lateral-c*2.2;
  }

  updateRampReturn(dt,steering=0) {
    const move=this.rampReturn;
    move.age+=dt;
    const progress=clamp(move.age/move.duration,0,1),ease=progress*progress*(3-2*progress);
    const forward=2.2*(1-ease)-move.returnSpeed*ease,s=Math.sin(move.ramp.rotation),c=Math.cos(move.ramp.rotation);
    move.steer=clamp((move.steer||0)-steering*5*dt,-2.2,2.2);
    const lateral=clamp(move.lateral+move.steer,-5,5);
    const aimShift=Math.atan2(lateral,move.returnSpeed)-Math.atan2(move.lateral,move.returnSpeed);
    this.heading=move.heading+(move.turn+aimShift)*ease;
    this.vx=c*lateral-s*forward;this.vz=-s*lateral-c*forward;
    if(progress===1)this.rampReturn=null;
  }

  tryPipeRide() {
    for(const pipe of PARK_PIPES) {
      const local=parkLocal(pipe,this.x,this.z),inner=pipe.radius-pipe.thickness;
      const along=-(this.vx*Math.sin(pipe.rotation)+this.vz*Math.cos(pipe.rotation));
      if(Math.abs(local.v)>pipe.length/2-3||Math.abs(local.u)>inner*.75||this.y>pipe.centerY||Math.abs(along)<Math.max(3,this.speed*.5))continue;
      if(Math.abs(this.y-pipeSurfaceHeight(pipe,local.u))>.3)continue;
      const angle=Math.atan2(local.u,pipe.centerY-this.y);
      this.cancelCutback();
      this.pipeRide={pipe,angle,cycleStart:angle,local:local.v,dir:Math.sign(along)||1,age:0,releasePending:false};
      this.airborne=false;this.trick=null;this.vy=0;this.charge=0;
      this.heading=pipe.rotation+(along<0?Math.PI:0);
      this.addCombo('PIPE WALL RIDE',200);this.applyPipeRide();
      this.onEvent({type:'pipeStart',id:pipe.id});return true;
    }
    return false;
  }

  applyPipeRide() {
    const ride=this.pipeRide,frame=pipeRideFrame(ride.pipe,ride.angle,ride.local,ride.dir);
    this.x=frame.x;this.y=frame.y;this.z=frame.z;
    this.rideRoll=frame.roll;this.rideUp=frame.up;
    this.surface={height:frame.y,dx:0,dz:0,ramp:null,pipe:ride.pipe,pipeSide:'inside',wallRide:true,normal:frame.up};
  }

  updatePipeRide(dt,input) {
    const ride=this.pipeRide,pipe=ride.pipe;
    ride.age+=dt;
    if(!input.action)ride.releasePending=true;
    const endLimit=pipe.length/2-2.1;
    // The entry mouth is behind the surfer. Only the exit ahead needs an
    // automatic return to the floor; otherwise a fresh attachment releases
    // immediately and can award another wall ride after its cooldown.
    if(ride.dir*ride.local>endLimit-1)ride.releasePending=true;
    const normalized=Math.atan2(Math.sin(ride.angle),Math.cos(ride.angle));
    if(ride.releasePending&&Math.abs(normalized)<.035) {
      ride.angle-=normalized;this.applyPipeRide();this.endPipeRide();return;
    }
    const targetSpeed=input.brake?3:input.pump?11:8.5;
    this.speed+=(targetSpeed-this.speed)*(1-Math.exp(-dt*4));
    const angular=ride.releasePending?-Math.sign(normalized)*2.4:((input.right?1:0)-(input.left?1:0))*ride.dir*(input.pump?2.6:2.25);
    const change=ride.releasePending?Math.sign(angular)*Math.min(Math.abs(angular*dt),Math.abs(normalized)):angular*dt;
    ride.angle+=change;
    ride.local=clamp(ride.local+ride.dir*this.speed*dt,-endLimit,endLimit);
    const before={x:this.x,y:this.y,z:this.z};
    this.applyPipeRide();
    this.vx=(this.x-before.x)/dt;this.vy=(this.y-before.y)/dt;this.vz=(this.z-before.z)/dt;
    this.comboTime=3.8;
    if(Math.abs(ride.angle-ride.cycleStart)>=Math.PI*2-1e-8) {
      ride.cycleStart+=Math.sign(ride.angle-ride.cycleStart)*Math.PI*2;
      this.pipeLoops++;this.addCombo('FULL PIPE LOOP',850,true);
      this.onEvent({type:'trick',name:'FULL PIPE LOOP'});
    }
  }

  endPipeRide() {
    const ride=this.pipeRide;if(!ride)return;
    // Return upright only at the floor, with safe clearance from the shell.
    ride.angle=Math.round(ride.angle/(Math.PI*2))*Math.PI*2;
    this.applyPipeRide();this.y=pipeSurfaceHeight(ride.pipe,0);
    this.heading=ride.pipe.rotation+(ride.dir<0?Math.PI:0);
    this.vx=-Math.sin(this.heading)*this.speed;this.vz=-Math.cos(this.heading)*this.speed;this.vy=0;
    this.pipeRide=null;this.pipeCooldown=1.1;this.rideRoll=0;this.rideUp={x:0,y:1,z:0};
    this.surface=parkRideSurface(this.x,this.z,this.y);
    this.onEvent({type:'pipeEnd'});
  }

  startLipMove(ramp) {
    this.cancelCutback();
    this.lipMove={ramp,age:0,duration:.76,progress:0,x:this.x,y:this.y,z:this.z,heading:this.heading,speed:this.speed};
    this.lipGrab=0;this.vx=0;this.vz=0;this.vy=0;this.speed=0;this.charge=0;
    this.onEvent({type:'lipStart',id:ramp.id});
  }

  updateLipMove(dt) {
    const move=this.lipMove;move.age+=dt;move.progress=clamp(move.age/move.duration,0,1);
    const t=move.progress,smooth=t*t*(3-2*t),arc=Math.sin(t*Math.PI);
    this.x=move.x-Math.sin(move.ramp.rotation)*arc*.3;this.z=move.z-Math.cos(move.ramp.rotation)*arc*.3;
    this.y=parkHeight(this.x,this.z)+arc*.7;
    this.heading=move.heading+Math.PI*smooth;this.lipGrab=arc;
    this.comboTime=3.8;
    if(t>=1) {
      this.lipMove=null;this.lipGrab=0;this.rampCooldown=1.1;
      this.speed=Math.max(8,move.speed*.7);this.y=parkHeight(this.x,this.z);
      this.vx=-Math.sin(this.heading)*this.speed;this.vz=-Math.cos(this.heading)*this.speed;
      this.addCombo('LIP GRAB 180',500,true);this.onEvent({type:'trick',name:'LIP GRAB 180'});
    }
  }

  faceIntoRamp(rampId) {
    const ramp=PARK_RAMPS.find(item=>item.id===rampId);if(!ramp)return;
    this.heading=ramp.rotation+Math.PI;
    this.vx=-Math.sin(this.heading)*this.speed;this.vz=-Math.cos(this.heading)*this.speed;
  }

  updateAirTrick(dt) {
    super.updateAirTrick(dt);
  }

  tryRail() {
    if (this.railCooldown > 0 || this.trick || this.vy > 2.5 || this.airtime < 0.15) return false;
    for (const rail of PARK_RAILS) {
      const { u, v } = parkLocal(rail, this.x, this.z);
      const along = -(this.vx * Math.sin(rail.rotation) + this.vz * Math.cos(rail.rotation));
      const alignment = Math.abs(along) / Math.max(1, Math.hypot(this.vx, this.vz));
      if (Math.abs(u) > 0.85 || Math.abs(v) > rail.length / 2 - 0.15 ||
          Math.abs(this.y - railTopHeight(rail,v)) > 0.36 || alignment < 0.65) continue;
      this.catchRail(rail,v,along);
      return true;
    }
    return false;
  }

  catchRail(rail,local,along) {
    this.cancelCutback();
    this.grinding={rail,kind:rail.kind||'rail',rampId:rail.rampId,dir:Math.sign(along)||1,local,age:0,ticks:0};
    this.x=rail.x-Math.sin(rail.rotation)*local;this.z=rail.z-Math.cos(rail.rotation)*local;
    this.airborne=false;this.vy=0;this.y=railTopHeight(rail,local);this.grindCount++;
    this.addCombo(rail.kind==='coping'?'COPING SLIDE':'WATER SLIDE',350,true);this.onEvent({type:'grind',id:rail.id,kind:rail.kind||'rail'});
  }

  updateRail(dt, input) {
    const grind = this.grinding, rail = grind.rail;
    if(grind.kind==='coping'&&!input.grind&&grind.age>.12) {
      this.faceIntoRamp(rail.rampId);this.grinding=null;this.railCooldown=1;
      this.launch(2.6,'COPING DROP-IN',160);return;
    }
    this.speed += ((input.pump ? 17 : 11) - this.speed) * (1 - Math.exp(-dt * 2));
    grind.local += grind.dir * this.speed * dt;
    grind.age += dt;
    this.heading = rail.rotation + (grind.dir < 0 ? Math.PI : 0);
    this.vx = -Math.sin(this.heading) * this.speed;
    this.vz = -Math.cos(this.heading) * this.speed;
    this.x = rail.x - Math.sin(rail.rotation) * grind.local;
    this.z = rail.z - Math.cos(rail.rotation) * grind.local;
    this.y = railTopHeight(rail,grind.local);
    this.comboTime = 3.8;
    if (Math.floor(grind.age / 0.3) > grind.ticks) {
      grind.ticks++;
      this.comboBase += 60;
    }
    if (Math.abs(grind.local) >= rail.length / 2) {
      if(grind.kind==='coping')this.faceIntoRamp(rail.rampId);
      this.grinding = null;
      this.railCooldown = 1;
      this.launch(3.8, 'RAIL TRANSFER', 150);
    }
  }

  bounceEdges() {
    let reflected = false;
    if (this.x < PARK_BOUNDS.minX || this.x > PARK_BOUNDS.maxX) {
      this.x = clamp(this.x, PARK_BOUNDS.minX + 0.05, PARK_BOUNDS.maxX - 0.05);
      this.vx *= -1;
      reflected = true;
    }
    if (this.z < PARK_BOUNDS.minZ || this.z > PARK_BOUNDS.maxZ) {
      this.z = clamp(this.z, PARK_BOUNDS.minZ + 0.05, PARK_BOUNDS.maxZ - 0.05);
      this.vz *= -1;
      reflected = true;
    }
    if (reflected) {
      this.cancelCutback();
      this.heading = Math.atan2(-this.vx, -this.vz);
      this.speed *= 0.78;
      this.onEvent({ type: 'boundary' });
    }
  }

  reflectWall(normal) {
    const size=Math.hypot(normal.x,normal.z);
    if(size<.001) return;
    this.cancelCutback();
    normal={x:normal.x/size,z:normal.z/size};
    const into = this.vx*normal.x+this.vz*normal.z;
    if (into < 0) {
      this.vx -= 1.45*into*normal.x;
      this.vz -= 1.45*into*normal.z;
    }
    this.speed = Math.max(3.5,Math.min(this.speed*.7,Math.hypot(this.vx,this.vz)));
    this.heading = Math.atan2(-this.vx,-this.vz);
    this.onEvent({ type:'wall' });
  }
}
