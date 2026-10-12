// Original pose variations for consecutive completed aerial tricks. The
// underlying tricks keep their own names, timing, rotation and score values.
export const COMBO_ANIMATIONS = Object.freeze([
  { id:'crosswind', name:'CROSSWIND GRAB', sequence:['spin','grab'], keys:['J','L'], description:'Carry a spin into a tucked, cross-body rail grab.' },
  { id:'flipcatch', name:'FLIP CATCH', sequence:['flip','grab'], keys:['K','L'], description:'Catch the board after a flip and pull it into a compact grab.' },
  { id:'decksweep', name:'DECK SWEEP', sequence:['shuvit','method'], keys:['U','H'], description:'Follow a board rotation with a swept, laid-over Method.' },
  { id:'coil360', name:'COILED 360', sequence:['grab','spin360'], keys:['L','F'], description:'Release a grab into a tightly coiled full-body spin.' },
  { id:'crosscut', name:'CROSSCUT TWEAK', sequence:['spin','tweak'], keys:['J','B'], description:'Finish a spin, bank the board into a tweaked grab, and reach across the turn.' },
].map(item => Object.freeze({ ...item, sequence:Object.freeze(item.sequence), keys:Object.freeze(item.keys) })));

export function findComboAnimation(previousType, nextType) {
  return COMBO_ANIMATIONS.find(item => item.sequence[0] === previousType && item.sequence[1] === nextType) || null;
}
