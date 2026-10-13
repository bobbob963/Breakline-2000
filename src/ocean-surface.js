import { waveHeight,STORM_BARREL_MOUTH_LENGTH } from './storm-waves.js';

export const OCEAN_MESH = Object.freeze({ width: 340, length: 450, columns: 68, rows: 100 });

// The low-poly ocean interpolates between sampled vertices. Its drawn face
// can be above the analytic wave used by physics, particularly on a shoulder.
// Grounded race boards and wakes must rest on that visible face rather than
// disappear beneath it; airborne physics continues to use the analytic wave.
export function renderedWaveHeight(x, z, time, oceanZ) {
  const { width, length, columns, rows } = OCEAN_MESH;
  const cellX = width / columns, cellZ = length / rows;
  const gx = (x + width / 2) / cellX, gz = (z - oceanZ + length / 2) / cellZ;
  if (gx < 0 || gx >= columns || gz < 0 || gz >= rows) return waveHeight(x, z, time);
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
  const x0 = ix * cellX - width / 2, z0 = iz * cellZ - length / 2 + oceanZ;
  const a = waveHeight(x0, z0, time), b = waveHeight(x0, z0 + cellZ, time);
  const d = waveHeight(x0 + cellX, z0, time);
  if (u + v <= 1) return a + (d - a) * u + (b - a) * v;
  const c = waveHeight(x0 + cellX, z0 + cellZ, time);
  return c + (b - c) * (1 - u) + (d - c) * (1 - v);
}

export function alignRiderToOcean(x, y, z, time, oceanZ) {
  const ground = waveHeight(x,z,time);
  const height = Math.max(0,Math.min(1,(y-ground)/2));
  // Ease out the contact correction during takeoff, then ease it back in at
  // touchdown. Dropping it on the first airborne frame would make a board pop.
  const contact = 1-height*height*(3-2*height);
  return y+(renderedWaveHeight(x,z,time,oceanZ)-ground)*contact;
}

// Outside a barrel the board follows the actual coarse water triangles, just
// like race riders. Within the solid curl its drawn capsule must keep matching
// the analytic roof/lip collisions. Taper correction over the curl's shared
// open-mouth length, avoiding a snap on entering or leaving it.
export function alignSurfRiderToOcean(x,y,z,time,oceanZ,barrel=null) {
  let strength=1;
  if(Number.isFinite(barrel?.startDistance)&&Number.isFinite(barrel?.endDistance)){
    const distance=-z,edge=Math.min(distance-barrel.startDistance,barrel.endDistance-distance);
    const u=Math.max(0,Math.min(1,edge/STORM_BARREL_MOUTH_LENGTH));strength=1-u*u*(3-2*u);
  }
  return y+(alignRiderToOcean(x,y,z,time,oceanZ)-y)*strength;
}
