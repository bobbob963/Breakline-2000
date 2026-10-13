// Signature moves share a score and completion window. The silhouette and
// rotation change with the surfer without making one rider easier to score with.
const signature=(characterId,specialId,name,description,motion)=>Object.freeze({
  characterId,specialId,name,description,points:1200,duration:.82,...motion,
});

export const SURFER_SPECIALS=Object.freeze({
  kai:signature('kai','tidal-rodeo','TIDAL RODEO',
    'Tuck into a corked full-body rodeo with the board held close.',
    {spin:Math.PI*2,flip:0,grab:.45}),
  nova:signature('nova','orbital-720','ORBITAL 720',
    'Pull a cross-body grab through two tight aerial rotations.',
    {spin:Math.PI*4,grab:1}),
  reef:signature('reef','reef-kickout','REEF KICKOUT',
    'Lay back into a kicked-out Method while spinning frontside.',
    {spin:-Math.PI*2,grab:1.2,tweak:1}),
  jax:signature('jax','dockside-flip','DOCKSIDE FLIP',
    'Snap a reverse flip and deck shove, then catch the rail in a hard tuck.',
    {flip:-Math.PI*2,boardSpin:Math.PI*2,grab:.7}),
});

export function getSurferSpecial(characterId){
  return typeof characterId==='string'&&Object.hasOwn(SURFER_SPECIALS,characterId)
    ?SURFER_SPECIALS[characterId]:SURFER_SPECIALS.kai;
}
