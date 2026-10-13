const actions = [
  ['left','Turn left','KeyA','Steer left. Arrow Left also works unless assigned to another action.'],
  ['right','Turn right','KeyD','Steer right. Arrow Right also works unless assigned to another action.'],
  ['pump','Pump / accelerate','KeyW','Build speed. Arrow Up also works unless assigned to another action.'],
  ['brake','Brake / settle','KeyS','Slow down and settle your landing. Arrow Down also works unless assigned to another action.'],
  ['jump','Charge / pop','Space','Hold to charge, then release to jump.'],
  ['action','Ride barrel / pipe','KeyE','Ride a barrel or the wall of a Waterworks pipe.'],
  ['grind','Sharp turn / grind','ShiftLeft','Hold while steering for a sharp turn, or catch a rail or coping.'],
  ['spin','180 spin','KeyJ','Start a 180 spin while airborne.'],
  ['flip','Kickflip','KeyK','Start a kickflip while airborne.'],
  ['grab','Indy grab','KeyL','Grab the board while airborne.'],
  ['shuvit','Shuvit','KeyU','Spin the board while airborne.'],
  ['heelflip','Heelflip','KeyO','Start a heelflip while airborne.'],
  ['method','Method grab','KeyH','Start a Method grab while airborne.'],
  ['spin360','360 spin','KeyF','Start a full rotation while airborne.'],
  ['special','Surfer special','KeyI','Use your surfer’s special with a full meter.'],
  ['tweak','Tweaked grab','KeyB','Tweak your airborne grab.'],
  ['cutback','Cutback','KeyC','Cut back sharply from the wave face.'],
  ['timePower','DEADTIME power','KeyQ','Tap for slow motion; double-tap for 2× fast-forward with DEADTIME equipped.'],
  ['bank','Bank combo','Enter','Bank your current trick combo. Enter still accepts menus.'],
  ['pause','Pause / resume','KeyP','Pause or resume your session. Escape always works too.'],
  ['restart','Restart session','KeyR','Restart the current session.'],
  ['sound','Sound on / off','KeyM','Toggle music and game sound.'],
];

export const KEY_BINDING_ACTIONS = Object.freeze(actions.map(([id,label,defaultCode,description])=>Object.freeze({id,label,defaultCode,description})));
export const KEYBIND_ACTIONS = KEY_BINDING_ACTIONS;
export const DEFAULT_KEYBINDS = Object.freeze(Object.fromEntries(KEY_BINDING_ACTIONS.map(action=>[action.id,action.defaultCode])));
const actionIds = new Set(KEY_BINDING_ACTIONS.map(action=>action.id));
const controlActions = new Set(['left','right','pump','brake','jump','action','grind']);
const trickActions = new Set(['spin','flip','grab','shuvit','heelflip','method','spin360','special','tweak']);
const namedCodes = new Set(['Space','Enter','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Backspace','Delete','Insert','Home','End','PageUp','PageDown','Minus','Equal','BracketLeft','BracketRight','Backslash','Semicolon','Quote','Backquote','Comma','Period','Slash','NumpadAdd','NumpadSubtract','NumpadMultiply','NumpadDivide','NumpadDecimal','NumpadEnter']);

// Keep browser navigation and operating-system modifier shortcuts available.
export function validateBindingCode(code) {
  return typeof code==='string' && (/^Key[A-Z]$/.test(code)||/^Digit[0-9]$/.test(code)||/^Numpad[0-9]$/.test(code)||namedCodes.has(code));
}

function assignBinding(bindings,action,code) {
  if(!actionIds.has(action)||!validateBindingCode(code)||bindings[action]===code)return bindings;
  const old=bindings[action],other=KEY_BINDING_ACTIONS.find(item=>item.id!==action&&bindings[item.id]===code);
  bindings[action]=code;
  if(other)bindings[other.id]=old;
  return bindings;
}

export function sanitizeKeybinds(raw) {
  const result={...DEFAULT_KEYBINDS};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
  for(const {id} of KEY_BINDING_ACTIONS)if(Object.hasOwn(raw,id))assignBinding(result,id,raw[id]);
  return result;
}

export function rebindKey(bindings,action,code) {
  return assignBinding(sanitizeKeybinds(bindings),action,code);
}

export function keybindFor(bindings,action) {
  return sanitizeKeybinds(bindings)[action]??null;
}

export function getControlMap(bindings) {
  const normalized=sanitizeKeybinds(bindings),occupied=new Set(Object.values(normalized));
  const map=Object.fromEntries(Object.entries(normalized).filter(([action])=>controlActions.has(action)).map(([action,code])=>[code,action]));
  for(const [code,action] of Object.entries({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'pump',ArrowDown:'brake'}))if(!occupied.has(code))map[code]=action;
  if(normalized.grind==='ShiftLeft'&&!occupied.has('ShiftRight'))map.ShiftRight='grind';
  return map;
}

export function getTrickMap(bindings) {
  return Object.fromEntries(Object.entries(sanitizeKeybinds(bindings)).filter(([action])=>trickActions.has(action)).map(([action,code])=>[code,action]));
}

const labels={Space:'SPACE',Enter:'ENTER',ShiftLeft:'LEFT SHIFT',ShiftRight:'RIGHT SHIFT',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Backspace:'BACKSPACE',Delete:'DELETE',Insert:'INSERT',Home:'HOME',End:'END',PageUp:'PAGE UP',PageDown:'PAGE DOWN',Minus:'−',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Backquote:'`',Comma:',',Period:'.',Slash:'/',NumpadAdd:'NUM +',NumpadSubtract:'NUM −',NumpadMultiply:'NUM ×',NumpadDivide:'NUM /',NumpadDecimal:'NUM .',NumpadEnter:'NUM ENTER'};
export function keyLabel(code) {
  if(labels[code])return labels[code];
  if(/^Key[A-Z]$/.test(code))return code.slice(3);
  if(/^Digit[0-9]$/.test(code))return code.slice(5);
  if(/^Numpad[0-9]$/.test(code))return `NUM ${code.slice(6)}`;
  return 'UNBOUND';
}
export const formatKey=keyLabel;
