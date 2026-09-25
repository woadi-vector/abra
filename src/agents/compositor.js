// Abra — compositor (true character lock)
// ----------------------------------------------------------------------------
// Guarantees a character looks IDENTICAL on every page by reusing the exact same
// rendered pixels: the character's reference image is matted into a transparent
// cut-out once, then composited onto a per-page, character-free background.
//
// The matte is a flood fill from the image borders that removes the near-white
// background but STOPS at the character's dark ink outline — so interior near-white
// areas (e.g. a cream-white spacesuit) are preserved. This relies on the style
// bible's "confident ink outline around every shape", which gives a closed boundary.
// Pure JS (pngjs), no native deps.
// ----------------------------------------------------------------------------

import pngjs from 'pngjs';
const { PNG } = pngjs;

export const readPNG = (buf) => PNG.sync.read(buf); // → { width, height, data:RGBA }
export const writePNG = (img) => PNG.sync.write(img);
export const fromBase64 = (b64) => readPNG(Buffer.from(b64, 'base64'));
export const toBase64 = (img) => PNG.sync.write(img).toString('base64');

// Cut the character out of a plain-background reference: flood fill from the four
// borders, clearing every connected near-white pixel to transparent, stopping at
// the ink outline. `threshold` is how close to white counts as background.
export function cutout(img, { threshold = 232, feather = true } = {}) {
  const { width: w, height: h, data } = img;
  const out = Buffer.from(data); // copy RGBA
  const isBg = (i) => data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold;
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isBg(p * 4)) stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    out[p * 4 + 3] = 0; // transparent
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // Feather: soften a 1px fringe of leftover white on the outline edge by lowering
  // alpha where a still-opaque near-white pixel neighbours a transparent one.
  if (feather) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = (y * w + x) * 4;
        if (out[p + 3] === 0) continue;
        if (!isBg(p)) continue;
        const near =
          out[((y * w + x + 1) * 4) + 3] === 0 || out[((y * w + x - 1) * 4) + 3] === 0 ||
          out[(((y + 1) * w + x) * 4) + 3] === 0 || out[(((y - 1) * w + x) * 4) + 3] === 0;
        if (near) out[p + 3] = 90;
      }
    }
  }
  return { width: w, height: h, data: out };
}

// Chroma-key matte: remove a solid green-screen background and keep the subject.
// Robust to interior near-white areas (a cream suit) and to faint paper-frame edges
// that defeat white flood-fill. Includes green despill + a 1px alpha feather.
export function chromaKey(img, { feather = true } = {}) {
  const { width: w, height: h, data } = img;
  const out = Buffer.from(data);
  const isGreen = (r, g, b) => g > 120 && r < 150 && b < 150 && g - Math.max(r, b) > 25;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    if (isGreen(r, g, b)) { out[i * 4 + 3] = 0; continue; }
    // despill: pull down a green fringe on kept pixels
    if (g > r && g > b) out[i * 4 + 1] = Math.round((r + b) / 2 + (g - (r + b) / 2) * 0.4);
  }
  if (feather) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = (y * w + x) * 4;
        if (out[p + 3] === 0) continue;
        const near =
          out[((y * w + x + 1) * 4) + 3] === 0 || out[((y * w + x - 1) * 4) + 3] === 0 ||
          out[(((y + 1) * w + x) * 4) + 3] === 0 || out[(((y - 1) * w + x) * 4) + 3] === 0;
        if (near && out[p + 3] > 140) out[p + 3] = 140;
      }
    }
  }
  return { width: w, height: h, data: out };
}

// Adaptive matte: sample the actual background colour from the image corners, then
// flood-fill from the borders removing every connected pixel close to that colour,
// stopping at the character's ink outline. Works whatever solid (frameless) colour
// the model produced — vivid green, muted olive, or white — and preserves interior
// areas (cream suit) because they are enclosed by the outline.
export function matteBySampledBg(img, { tol = 74, feather = true } = {}) {
  const { width: w, height: h, data } = img;
  const corners = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
  let sr = 0, sg = 0, sb = 0, nc = 0;
  for (const [cx, cy] of corners) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = Math.min(w - 1, Math.max(0, cx + dx)), y = Math.min(h - 1, Math.max(0, cy + dy));
      const p = (y * w + x) * 4; sr += data[p]; sg += data[p + 1]; sb += data[p + 2]; nc++;
    }
  }
  const br = sr / nc, bg = sg / nc, bb = sb / nc;
  const dist = (p) => Math.hypot(data[p] - br, data[p + 1] - bg, data[p + 2] - bb);
  const out = Buffer.from(data);
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const q = y * w + x;
    if (visited[q]) return;
    visited[q] = 1;
    if (dist(q * 4) < tol) stack.push(q);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const q = stack.pop();
    out[q * 4 + 3] = 0;
    const x = q % w, y = (q / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  if (feather) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = (y * w + x) * 4;
        if (out[p + 3] === 0 || dist(p) > tol * 1.6) continue;
        const near =
          out[((y * w + x + 1) * 4) + 3] === 0 || out[((y * w + x - 1) * 4) + 3] === 0 ||
          out[(((y + 1) * w + x) * 4) + 3] === 0 || out[(((y - 1) * w + x) * 4) + 3] === 0;
        if (near && out[p + 3] > 140) out[p + 3] = 140;
      }
    }
  }
  return { width: w, height: h, data: out };
}

// Trim fully-transparent margins so we know the cut-out's true bounding box.
export function trim(img) {
  const { width: w, height: h, data } = img;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return img;
  const nw = maxX - minX + 1, nh = maxY - minY + 1;
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const s = ((y + minY) * w + (x + minX)) * 4;
      const d = (y * nw + x) * 4;
      out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
    }
  }
  return { width: nw, height: nh, data: out };
}

// Bilinear resize of an RGBA image.
export function resize(img, nw, nh) {
  const { width: w, height: h, data } = img;
  const out = Buffer.alloc(nw * nh * 4);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const fy = Math.min(h - 1, y * sy), y0 = fy | 0, y1 = Math.min(h - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < nw; x++) {
      const fx = Math.min(w - 1, x * sx), x0 = fx | 0, x1 = Math.min(w - 1, x0 + 1), wx = fx - x0;
      const d = (y * nw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = data[(y0 * w + x0) * 4 + c], b = data[(y0 * w + x1) * 4 + c];
        const e = data[(y1 * w + x0) * 4 + c], f = data[(y1 * w + x1) * 4 + c];
        out[d + c] = (a * (1 - wx) + b * wx) * (1 - wy) + (e * (1 - wx) + f * wx) * wy;
      }
    }
  }
  return { width: nw, height: nh, data: out };
}

// Alpha-composite `fg` over `bg` (mutates a copy of bg) at top-left (ox, oy).
export function compositeOver(bg, fg, ox, oy) {
  const out = { width: bg.width, height: bg.height, data: Buffer.from(bg.data) };
  const { width: bw, height: bh, data: bd } = out;
  const { width: fw, height: fh, data: fd } = fg;
  for (let y = 0; y < fh; y++) {
    const by = y + oy;
    if (by < 0 || by >= bh) continue;
    for (let x = 0; x < fw; x++) {
      const bx = x + ox;
      if (bx < 0 || bx >= bw) continue;
      const s = (y * fw + x) * 4, d = (by * bw + bx) * 4;
      const a = fd[s + 3] / 255;
      if (a === 0) continue;
      bd[d] = fd[s] * a + bd[d] * (1 - a);
      bd[d + 1] = fd[s + 1] * a + bd[d + 1] * (1 - a);
      bd[d + 2] = fd[s + 2] * a + bd[d + 2] * (1 - a);
      bd[d + 3] = Math.max(bd[d + 3], fd[s + 3]);
    }
  }
  return out;
}

// Place a matted, trimmed cut-out onto a background. `scale` = cut-out height as a
// fraction of the background height; `anchorX/anchorY` are 0..1 placement of the
// cut-out's center within the background.
export function place(bg, cut, { scale = 0.62, anchorX = 0.5, anchorY = 0.52 } = {}) {
  const targetH = Math.round(bg.height * scale);
  const targetW = Math.round((cut.width / cut.height) * targetH);
  const scaled = resize(cut, Math.max(1, targetW), Math.max(1, targetH));
  const ox = Math.round(bg.width * anchorX - scaled.width / 2);
  const oy = Math.round(bg.height * anchorY - scaled.height / 2);
  return compositeOver(bg, scaled, ox, oy);
}
