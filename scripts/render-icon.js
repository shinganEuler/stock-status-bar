const { deflateSync } = require('zlib');
const { mkdirSync, writeFileSync } = require('fs');

const SIZE = 128;
const SCALE = 4;
const W = SIZE * SCALE;
const H = SIZE * SCALE;
const pixels = new Uint8ClampedArray(W * H * 4);

function rgba(hex, alpha = 255) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha
  ];
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function setPixel(x, y, color) {
  if (x < 0 || x >= W || y < 0 || y >= H) {
    return;
  }
  const i = (y * W + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3];
}

function fillGradient() {
  const top = rgba('#0c141d');
  const bottom = rgba('#172635');
  for (let y = 0; y < H; y += 1) {
    const t = y / (H - 1);
    const color = [
      mix(top[0], bottom[0], t),
      mix(top[1], bottom[1], t),
      mix(top[2], bottom[2], t),
      255
    ];
    for (let x = 0; x < W; x += 1) {
      setPixel(x, y, color);
    }
  }
}

function fillRect(x, y, width, height, color) {
  const x0 = Math.round(x * SCALE);
  const y0 = Math.round(y * SCALE);
  const x1 = Math.round((x + width) * SCALE);
  const y1 = Math.round((y + height) * SCALE);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      setPixel(xx, yy, color);
    }
  }
}

function fillRoundRect(x, y, width, height, radius, color) {
  const x0 = Math.round(x * SCALE);
  const y0 = Math.round(y * SCALE);
  const x1 = Math.round((x + width) * SCALE);
  const y1 = Math.round((y + height) * SCALE);
  const r = radius * SCALE;

  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      const dx = Math.max(x0 + r - xx, 0, xx - (x1 - r));
      const dy = Math.max(y0 + r - yy, 0, yy - (y1 - r));
      if (dx * dx + dy * dy <= r * r) {
        setPixel(xx, yy, color);
      }
    }
  }
}

function fillCircle(cx, cy, radius, color) {
  const x0 = Math.round((cx - radius) * SCALE);
  const y0 = Math.round((cy - radius) * SCALE);
  const x1 = Math.round((cx + radius) * SCALE);
  const y1 = Math.round((cy + radius) * SCALE);
  const cxs = cx * SCALE;
  const cys = cy * SCALE;
  const rs = radius * SCALE;

  for (let yy = y0; yy <= y1; yy += 1) {
    for (let xx = x0; xx <= x1; xx += 1) {
      const dx = xx - cxs;
      const dy = yy - cys;
      if (dx * dx + dy * dy <= rs * rs) {
        setPixel(xx, yy, color);
      }
    }
  }
}

function fillPolygon(points, color) {
  const scaled = points.map(([x, y]) => [x * SCALE, y * SCALE]);
  const minY = Math.max(0, Math.floor(Math.min(...scaled.map((p) => p[1]))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...scaled.map((p) => p[1]))));

  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let i = 0; i < scaled.length; i += 1) {
      const [x1, y1] = scaled[i];
      const [x2, y2] = scaled[(i + 1) % scaled.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(intersections[i]));
      const x1 = Math.min(W - 1, Math.floor(intersections[i + 1]));
      for (let x = x0; x <= x1; x += 1) {
        setPixel(x, y, color);
      }
    }
  }
}

function drawLine(x1, y1, x2, y2, width, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (!length) {
    fillCircle(x1, y1, width / 2, color);
    return;
  }
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);
  fillPolygon(
    [
      [x1 + nx, y1 + ny],
      [x2 + nx, y2 + ny],
      [x2 - nx, y2 - ny],
      [x1 - nx, y1 - ny]
    ],
    color
  );
  fillCircle(x1, y1, width / 2, color);
  fillCircle(x2, y2, width / 2, color);
}

function drawPolyline(points, width, color) {
  for (let i = 0; i < points.length - 1; i += 1) {
    drawLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], width, color);
  }
}

function drawCandle(x, y, width, height, wickTop, wickBottom, color) {
  drawLine(x + width / 2, wickTop, x + width / 2, wickBottom, 3, color);
  fillRoundRect(x, y, width, height, 3, color);
}

function downsample() {
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < SCALE; sy += 1) {
        for (let sx = 0; sx < SCALE; sx += 1) {
          const i = (((y * SCALE + sy) * W + x * SCALE + sx) * 4);
          sum[0] += pixels[i];
          sum[1] += pixels[i + 1];
          sum[2] += pixels[i + 2];
          sum[3] += pixels[i + 3];
        }
      }
      const o = (y * SIZE + x) * 4;
      out[o] = Math.round(sum[0] / (SCALE * SCALE));
      out[o + 1] = Math.round(sum[1] / (SCALE * SCALE));
      out[o + 2] = Math.round(sum[2] / (SCALE * SCALE));
      out[o + 3] = Math.round(sum[3] / (SCALE * SCALE));
    }
  }
  return out;
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(path, rgbaPixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    const row = y * (SIZE * 4 + 1);
    raw[row] = 0;
    rgbaPixels.copy(raw, row + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }

  writeFileSync(
    path,
    Buffer.concat([
      signature,
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0))
    ])
  );
}

fillGradient();
fillRect(0, 101, 128, 27, rgba('#1d2d3d'));
fillRect(0, 100.5, 128, 1, rgba('#34475a'));
drawCandle(24, 58, 13, 25, 50, 90, rgba('#39d460'));
drawCandle(47, 43, 14, 29, 34, 80, rgba('#39d460'));
drawCandle(70, 35, 13, 24, 27, 66, rgba('#39d460'));
drawCandle(92, 46, 13, 21, 38, 75, rgba('#ffb020'));
drawPolyline(
  [
    [18, 89],
    [33, 78],
    [43, 84],
    [58, 68],
    [68, 75],
    [82, 57],
    [94, 66],
    [111, 48]
  ],
  5,
  rgba('#39d460')
);
fillPolygon(
  [
    [111, 48],
    [105, 50],
    [115, 56]
  ],
  rgba('#39d460')
);
fillCircle(20, 114, 6, rgba('#39d460'));
fillCircle(39, 114, 6, rgba('#78899a'));
fillRoundRect(55, 108, 11, 11, 2, rgba('#78899a'));
fillRect(72, 108, 1.5, 13, rgba('#78899a'));
drawPolyline(
  [
    [84, 117],
    [91, 112],
    [97, 115],
    [104, 109],
    [112, 116]
  ],
  3,
  rgba('#39d460')
);
fillCircle(112, 116, 3, rgba('#ffb020'));

mkdirSync('images', { recursive: true });
writePng('images/icon.png', downsample());
console.log('wrote images/icon.png');
