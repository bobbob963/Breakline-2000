import * as THREE from 'three';

// Original, fixed low-resolution paint. Large stains and joints carry the
// material at game resolution; the small grain only breaks up close surfaces.
export function waterworksTexture(kind = 'concrete') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  let seed = { concrete: 991, floor: 327, rust: 73, steel: 261, flow: 812 }[kind] || 991;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const fill = (color, alpha, x, y, w, h) => { c.fillStyle = color; c.globalAlpha = alpha; c.fillRect(x, y, w, h); };
  const stroke = (points, color, alpha, width = 1) => {
    c.beginPath(); c.moveTo(...points[0]); for (const point of points.slice(1)) c.lineTo(...point);
    c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = width; c.stroke();
  };
  const patch = (x, y, rx, ry, color, alpha) => {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, radius = .72 + rand() * .28;
      const point = [Math.round(x + Math.cos(a) * rx * radius), Math.round(y + Math.sin(a) * ry * radius)];
      if (i) c.lineTo(...point); else c.moveTo(...point);
    }
    c.closePath(); c.fillStyle = color; c.globalAlpha = alpha; c.fill();
  };

  if (kind === 'flow') {
    fill('#65746c', 1, 0, 0, 128, 128);
    for (let i = 0; i < 24; i++) {
      const x = Math.floor(rand() * 128), width = 2 + Math.floor(rand() * 6);
      fill(i % 3 ? '#aeb5a1' : '#283b36', .09 + rand() * .16, x, 0, width, 128);
      fill('#d1d1b5', .16, x, Math.floor(rand() * 110), 1, 18);
    }
  } else if (kind === 'rust' || kind === 'steel') {
    const rusty = kind === 'rust';
    fill(rusty ? '#8c8778' : '#6e7471', 1, 0, 0, 128, 128);
    fill('#22272a', .26, 0, 0, 128, 17);
    fill('#c4c3b2', .13, 0, 39, 128, 28);
    for (let i = 0; i < (rusty ? 22 : 11); i++) {
      const x = rand() * 128, y = rand() * 128;
      patch(x, y, 9 + rand() * 18, 6 + rand() * 19, i % 3 ? '#785136' : '#313d3c', rusty ? .2 + rand() * .24 : .1);
      if (rusty) patch(x, y, 5 + rand() * 9, 4 + rand() * 11, '#b67a46', .17);
    }
    for (const y of [0, 64, 126]) {
      fill('#282b29', .72, 0, y, 128, 2);
      fill('#c3b89d', .36, 0, y + 2, 128, 1);
      for (const x of [9, 118]) {
        fill('#202626', .85, x, y + 7, 3, 3);
        fill('#c2b9a0', .5, x, y + 7, 2, 1);
      }
    }
    for (let i = 0; i < 19; i++) {
      const x = Math.floor(rand() * 128), y = Math.floor(rand() * 128);
      fill('#342e29', .15, x, y, 1 + Math.floor(rand() * 3), 10 + Math.floor(rand() * 30));
      if (!rusty) fill('#c8ccbf', .23, x, y, 3 + Math.floor(rand() * 13), 1);
    }
  } else {
    const floor = kind === 'floor';
    fill(floor ? '#b9b5a7' : '#a9ada5', 1, 0, 0, 128, 128);
    // Unequal poured slabs, with broad baked shading rather than black outlines.
    fill('#d8d4c1', .13, 2, 2, 74, 62);
    fill('#757970', .13, 77, 2, 51, 63);
    fill('#d2ccbb', .10, 2, 66, 39, 62);
    fill('#666e67', .09, 42, 66, 86, 62);
    for (let i = 0; i < 28; i++) {
      patch(rand() * 128, rand() * 128, 10 + rand() * 28, 5 + rand() * 16,
        i % 3 ? '#5b655b' : '#e4dbc5', .035 + rand() * .08);
    }
    for (const y of [0, 64, 127]) {
      fill('#4e574f', .16, 0, y - 3, 128, 5);
      fill('#333f39', floor ? .46 : .65, 0, y, 128, 1);
      fill('#e2ddc8', .34, 0, y + 1, 128, 1);
    }
    for (const [x, y] of [[0, 0], [76, 0], [0, 65], [41, 65]]) {
      fill('#414b43', .45, x, y, 1, 64);
      fill('#e2dfcb', .21, x + 1, y, 1, 64);
    }
    if (!floor) {
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rand() * 128), y = i % 2 ? 65 : 1, h = 11 + Math.floor(rand() * 35);
        fill('#3d4940', .12, x, y, 3 + Math.floor(rand() * 8), h);
        fill('#49493b', .10, x + 2, y, 2, h + 8);
      }
      // Old damp tide line has irregular breaks and bleached mineral residue.
      for (let x = 0; x < 128; x += 8) {
        const y = 111 + Math.floor(rand() * 7);
        fill('#38493f', .2, x, y, 8, 128 - y);
        fill('#d7d4ba', .13, x, y - 2, 6, 2);
      }
    }
    stroke([[76, 2], [71, 16], [76, 26], [65, 39], [65, 45]], '#3e453f', .45);
    stroke([[65, 39], [54, 35], [47, 39]], '#4b5047', .30);
    stroke([[19, 65], [27, 76], [24, 87], [32, 93]], '#424940', .35);
    if (floor) {
      stroke([[91, 87], [108, 97], [122, 99]], '#6a6b5e', .26, 2);
      stroke([[3, 53], [26, 44], [42, 45]], '#e5deca', .24, 2);
    }
  }
  // Restrained single-pixel chips; never a per-frame noise pass.
  for (let i = 0; i < 530; i++) {
    fill(i % 3 ? '#ddd8c5' : '#202e29', .035 + rand() * .055,
      Math.floor(rand() * 128), Math.floor(rand() * 128), 1 + (i % 7 === 0 ? 1 : 0), 1);
  }
  c.globalAlpha = 1;
  const map = new THREE.CanvasTexture(canvas); map.name = 'waterworks-' + kind + '-128';
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.NearestFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.colorSpace = THREE.SRGBColorSpace;
  map.userData = { originalPaint: true, deterministic: true, resolution: 128, material: kind };
  return map;
}
