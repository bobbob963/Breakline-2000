export const TIME_PULSE_SECONDS=.72;
export const TIME_TINT_OPACITY=.16;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Full viewport power tint. Its clock is explicit so pausing freezes the
 * expanding front instead of leaving a CSS animation running behind a menu. */
export class TimePowerScreen {
  constructor({mount=globalThis.document?.body,reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,viewport=()=>({width:globalThis.innerWidth||1,height:globalThis.innerHeight||1})}={}) {
    this.reducedMotion=reducedMotion;this.viewport=viewport;this.active=false;this.age=0;this.amount=0;this.disposed=false;
    const doc=mount?.ownerDocument??globalThis.document;
    this.element=doc.createElement('div');this.element.className='time-power-screen';this.element.setAttribute('aria-hidden','true');
    this.tint=doc.createElement('div');this.tint.className='time-power-tint';
    this.ring=doc.createElement('div');this.ring.className='time-power-pulse';
    this.element.append(this.tint,this.ring);mount.append(this.element);this.reset();
  }
  update(dt,{active=false,mode='slow',paused=false,origin}={}) {
    if(this.disposed)return;
    const viewport=this.viewport(),width=Math.max(1,viewport.width),height=Math.max(1,viewport.height);
    if(!paused){
      const nextMode=mode==='fast'?'fast':'slow';
      if(active&&(!this.active||nextMode!==this.mode)){
        this.origin={x:clamp(Number.isFinite(origin?.x)?origin.x:width*.5,0,width),y:clamp(Number.isFinite(origin?.y)?origin.y:height*.7,0,height)};
        this.age=0;this.amount=0;this.mode=nextMode;
      }
      this.active=!!active;
      const elapsed=clamp(Number.isFinite(dt)?dt:0,0,.1);
      if(this.active)this.age+=elapsed;
      this.amount=clamp(this.amount+(this.active?1:-1)*elapsed/(this.active?.4:.25),0,1);
    }
    this.element.hidden=!this.active&&this.amount===0;
    this.element.dataset.active=String(this.active);
    // Keep the last colour while fading out, even after the simulation has
    // returned to its default mode. A new activation starts at the deck again.
    this.element.dataset.mode=this.mode;
    if(this.element.hidden)return;
    const {x,y}=this.origin??{x:width*.5,y:height*.7};
    const endRadius=Math.hypot(Math.max(x,width-x),Math.max(y,height-y))+4;
    const progress=clamp(this.age/TIME_PULSE_SECONDS,0,1),radius=12+endRadius*(1-Math.pow(1-progress,2));
    const expanding=this.active&&!this.reducedMotion&&progress<1;
    this.tint.style.clipPath=expanding?`circle(${radius.toFixed(2)}px at ${x.toFixed(2)}px ${y.toFixed(2)}px)`:'none';
    this.tint.style.opacity=String(TIME_TINT_OPACITY*this.amount);
    this.ring.hidden=!expanding;
    this.ring.style.left=`${x}px`;this.ring.style.top=`${y}px`;
    this.ring.style.width=this.ring.style.height=`${radius*2}px`;
    this.ring.style.opacity=String(.40*Math.sin(Math.PI*progress));
    this.element.dataset.phase=this.reducedMotion?'tint':expanding?'pulse':'tint';
  }
  reset() {
    this.active=false;this.mode='slow';this.age=0;this.amount=0;this.origin=null;
    this.element.hidden=true;this.ring.hidden=true;this.tint.style.opacity='0';this.tint.style.clipPath='none';this.element.dataset.active='false';this.element.dataset.mode='slow';this.element.dataset.phase='tint';
  }
  dispose() {if(this.disposed)return;this.reset();this.disposed=true;this.element.remove();}
}
