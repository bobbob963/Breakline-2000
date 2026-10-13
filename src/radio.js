import { RADIO_TRACKS } from './audio.js';

/** A keyboard-safe radio: tuning never sends a pop, trick or restart to the game. */
export function createRadio({element,audio,onSelection=()=>{},onInteract=()=>{},onExit=()=>{},onToggleSound=()=>{}}) {
  const query=selector=>element.querySelector(selector);
  const select=query('#radio-track'),shuffle=query('#radio-shuffle'),auto=query('#radio-auto');
  const title=query('#music-track'),status=query('#radio-status'),sound=query('#sound'),soundLabel=query('#radio-sound-label');
  const document=element.ownerDocument;
  let lastState='',pointerInput=false,disposed=false;
  select.replaceChildren();
  for(const track of [{id:'auto',title:'AUTO · MATCH THE SESSION'},...RADIO_TRACKS]){
    const option=document.createElement('option');option.value=track.id;option.textContent=track.title;select.append(option);
  }
  function sync(){
    if(disposed)return;
    const state=`${audio.selection}/${audio.currentTrackId}/${audio.enabled}`;
    if(state===lastState)return;lastState=state;
    title.textContent=audio.trackName.toUpperCase();
    status.textContent=`${audio.enabled?'FM STEREO':'POWER OFF'} · ${audio.selection==='auto'?'AUTO':'MANUAL'}`;
    soundLabel.textContent=audio.enabled?'ON':'OFF';
    sound.setAttribute('aria-label',audio.enabled?'Mute audio':'Enable audio');
    sound.setAttribute('aria-pressed',String(audio.enabled));
    element.classList.toggle('radio-muted',!audio.enabled);
    select.value=audio.selection;
    auto.setAttribute('aria-pressed',String(audio.selection==='auto'));
  }
  function finishPointerAction(){if(pointerInput){pointerInput=false;onExit();}}
  function tune(id){if(!audio.selectTrack(id))return;onSelection(audio.selection);sync();finishPointerAction();}
  function change(){tune(select.value);}
  function randomSong(){audio.shuffleTrack();onSelection(audio.selection);sync();finishPointerAction();}
  function automatic(){tune('auto');}
  function pointer(){pointerInput=true;onInteract();}
  function focus(event){if(event.target?.matches?.(':focus-visible'))pointerInput=false;onInteract();}
  function leave(){if(pointerInput&&element.contains(document.activeElement))finishPointerAction();}
  function key(event){
    event.stopPropagation();
    if(event.type!=='keydown')return;
    pointerInput=false;
    if(event.key==='Escape'){event.preventDefault();onExit();}
    else if(event.code==='KeyM'&&!event.target?.closest?.('select,input')){
      event.preventDefault();if(!event.repeat)onToggleSound();
    }
    // Native Enter/Space clicks, Tab focus and song-list arrow keys still work.
  }
  select.addEventListener('change',change);shuffle.addEventListener('click',randomSong);auto.addEventListener('click',automatic);
  element.addEventListener('pointerdown',pointer);element.addEventListener('pointerleave',leave);element.addEventListener('focusin',focus);
  element.addEventListener('keydown',key);element.addEventListener('keyup',key);
  sync();
  return {sync,dispose(){
    disposed=true;
    select.removeEventListener('change',change);shuffle.removeEventListener('click',randomSong);auto.removeEventListener('click',automatic);
    element.removeEventListener('pointerdown',pointer);element.removeEventListener('pointerleave',leave);element.removeEventListener('focusin',focus);
    element.removeEventListener('keydown',key);element.removeEventListener('keyup',key);
  }};
}
