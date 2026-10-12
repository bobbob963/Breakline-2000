import { PARK_BOUNDS, PARK_RAILS, PARK_PIPES, parkHeight } from './park.js';

// A fixed plant plan makes the larger basin navigable without interrupting a run.
export class ParkMap {
  constructor(canvas) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.width=PARK_BOUNDS.maxX-PARK_BOUNDS.minX;
    this.length=PARK_BOUNDS.maxZ-PARK_BOUNDS.minZ;
    this.plan=document.createElement('canvas'); this.plan.width=128; this.plan.height=184;
    const c=this.plan.getContext('2d');
    c.fillStyle='#141e1b';c.fillRect(0,0,128,184);
    for(let px=4;px<124;px+=2)for(let pz=4;pz<180;pz+=2){
      const x=PARK_BOUNDS.minX+(px-4)/120*this.width,z=PARK_BOUNDS.minZ+(pz-4)/176*this.length;
      const h=parkHeight(x,z),shade=Math.round(50+Math.max(-2,Math.min(10,h))*6);
      c.fillStyle=`rgb(${shade-10},${shade+8},${shade})`;c.fillRect(px,pz,2,2);
    }
    c.strokeStyle='#a2a68c';c.lineWidth=1;c.strokeRect(3.5,3.5,121,177);
    for(const pipe of PARK_PIPES){
      c.save();const p=this.point(pipe.x,pipe.z);c.translate(p.x,p.z);c.rotate(-pipe.rotation);
      c.fillStyle='#6d4231';c.strokeStyle='#da9e58';
      const w=pipe.radius*2/this.width*120,h=pipe.length/this.length*176;
      c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);c.restore();
    }
    c.strokeStyle='#e4dcaa';c.lineWidth=1;
    for(const rail of PARK_RAILS){
      const sx=Math.sin(rail.rotation)*rail.length/2,sz=Math.cos(rail.rotation)*rail.length/2;
      const a=this.point(rail.x-sx,rail.z-sz),b=this.point(rail.x+sx,rail.z+sz);
      c.beginPath();c.moveTo(a.x,a.z);c.lineTo(b.x,b.z);c.stroke();
    }
    c.fillStyle='#e7dfb0';c.font='bold 8px monospace';c.fillText('N',8,14);
  }
  point(x,z){return{x:4+(x-PARK_BOUNDS.minX)/this.width*120,z:4+(z-PARK_BOUNDS.minZ)/this.length*176};}
  update(game){
    const c=this.ctx,p=this.point(game.x,game.z);c.clearRect(0,0,128,184);c.drawImage(this.plan,0,0);
    if(game.isRace&&game.course){
      const allCheckpoints=game.course.checkpoints,laps=game.course.laps||1;
      const perLap=Math.ceil(allCheckpoints.length/laps);
      const lap=Math.min(laps-1,Math.floor(game.nextCheckpoint/perLap));
      const checkpoints=allCheckpoints.slice(lap*perLap,(lap+1)*perLap),start=game.course.start||game;
      c.save();c.lineWidth=1.3;c.strokeStyle='#e4be6875';c.setLineDash([2,2]);
      const first=this.point(start.x,start.z);c.beginPath();c.moveTo(first.x,first.z);
      for(const checkpoint of checkpoints){const ring=this.point(checkpoint.x,checkpoint.z);c.lineTo(ring.x,ring.z);}
      c.stroke();c.setLineDash([]);
      // Draw each physical marker once for this lap. The next ring goes last,
      // so repeated coordinates on a later lap cannot cover the gold target.
      const markers=new Map(checkpoints.map(checkpoint=>[`${checkpoint.x},${checkpoint.z}`,checkpoint]));
      for(const checkpoint of markers.values()){
        const ring=this.point(checkpoint.x,checkpoint.z),collected=checkpoint.index<game.nextCheckpoint;
        c.strokeStyle=collected?'#4f7771':'#baa877';c.lineWidth=1;
        c.beginPath();c.arc(ring.x,ring.z,2.7,0,Math.PI*2);c.stroke();
      }
      const next=allCheckpoints[game.nextCheckpoint];
      if(next){
        const ring=this.point(next.x,next.z);c.strokeStyle='#ffe14c';c.lineWidth=2;
        c.beginPath();c.arc(ring.x,ring.z,4,0,Math.PI*2);c.stroke();
        c.font='bold 8px monospace';c.fillStyle='#ffe14c';c.fillText(String(next.index+1),ring.x+5,ring.z+3);
      }
      if(game.opponent){
        const rival=this.point(game.opponent.x,game.opponent.z);c.translate(rival.x,rival.z);c.rotate(-game.opponent.heading);
        c.fillStyle='#f48951';c.strokeStyle='#302019';c.lineWidth=1;
        c.beginPath();c.moveTo(0,-5);c.lineTo(3.5,3);c.lineTo(-3.5,3);c.closePath();c.fill();c.stroke();
      }
      c.restore();
    }
    c.save();c.translate(p.x,p.z);c.rotate(-game.heading);c.fillStyle='#ffe750';c.strokeStyle='#181811';c.lineWidth=1.3;
    c.beginPath();c.moveTo(0,-6);c.lineTo(4.5,4);c.lineTo(0,2);c.lineTo(-4.5,4);c.closePath();c.fill();c.stroke();c.restore();
  }
}
