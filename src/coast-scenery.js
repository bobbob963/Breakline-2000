// Travel is along negative Z. Keep most of each repeated scenery strip ahead
// of the rider, and recycle only after its objects pass behind the camera.
// The 624m strip reaches 534m ahead: safely beyond every weather fog horizon.
export const COAST_SCENERY_BEHIND = 90;

export function coastSceneryZ(initialZ, distance, repeatLength) {
  const lap = Math.ceil((initialZ + distance - COAST_SCENERY_BEHIND) / repeatLength);
  // Return a fixed world position between wraps, avoiding camera-relative
  // drift or floating-point wobble while an object is passing the rider.
  return initialZ - lap * repeatLength;
}
