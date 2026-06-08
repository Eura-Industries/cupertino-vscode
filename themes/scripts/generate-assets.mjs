import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.join(process.cwd(), 'images');
fs.mkdirSync(root, { recursive: true });

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, pixels) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function rgba(hex, alpha = 255) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha
  ];
}

function setPixel(buffer, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width) return;
  const index = (y * width + x) * 4;
  buffer[index] = color[0];
  buffer[index + 1] = color[1];
  buffer[index + 2] = color[2];
  buffer[index + 3] = color[3];
}

function fillRect(buffer, width, x, y, rectWidth, rectHeight, color) {
  for (let yy = y; yy < y + rectHeight; yy += 1) {
    for (let xx = x; xx < x + rectWidth; xx += 1) {
      setPixel(buffer, width, xx, yy, color);
    }
  }
}

function verticalGradient(buffer, width, x, y, rectWidth, rectHeight, top, bottom) {
  for (let yy = 0; yy < rectHeight; yy += 1) {
    const t = yy / Math.max(1, rectHeight - 1);
    const color = [0, 1, 2, 3].map((i) => Math.round(top[i] * (1 - t) + bottom[i] * t));
    fillRect(buffer, width, x, y + yy, rectWidth, 1, color);
  }
}

function frame(buffer, width, x, y, rectWidth, rectHeight, color, thickness = 2) {
  fillRect(buffer, width, x, y, rectWidth, thickness, color);
  fillRect(buffer, width, x, y + rectHeight - thickness, rectWidth, thickness, color);
  fillRect(buffer, width, x, y, thickness, rectHeight, color);
  fillRect(buffer, width, x + rectWidth - thickness, y, thickness, rectHeight, color);
}

function writeImage(fileName, width, height, draw) {
  const pixels = Buffer.alloc(width * height * 4);
  draw(pixels, width, height);
  fs.writeFileSync(path.join(root, fileName), encodePng(width, height, pixels));
}

writeImage('cupertino-icon.png', 256, 256, (pixels, width) => {
  fillRect(pixels, width, 0, 0, 256, 256, rgba('#F2F4F8'));
  verticalGradient(pixels, width, 28, 28, 200, 200, rgba('#0088FF'), rgba('#00C0E8'));
  fillRect(pixels, width, 52, 52, 152, 152, rgba('#FFFFFF'));
  fillRect(pixels, width, 70, 76, 116, 12, rgba('#00C0E8'));
  fillRect(pixels, width, 70, 104, 72, 12, rgba('#6155F5'));
  fillRect(pixels, width, 70, 132, 104, 12, rgba('#0088FF'));
  fillRect(pixels, width, 70, 160, 88, 12, rgba('#AC7F5E'));
  frame(pixels, width, 52, 52, 152, 152, rgba('#E4E8F4'), 3);
});

writeImage('cupertino-preview.png', 1400, 820, (pixels, width) => {
  fillRect(pixels, width, 0, 0, 1400, 820, rgba('#E9EEF7'));
  fillRect(pixels, width, 50, 70, 620, 680, rgba('#F7F8FA'));
  fillRect(pixels, width, 730, 70, 620, 680, rgba('#111318'));
  fillRect(pixels, width, 50, 70, 620, 56, rgba('#F2F4F8'));
  fillRect(pixels, width, 730, 70, 620, 56, rgba('#171A21'));
  fillRect(pixels, width, 96, 96, 110, 12, rgba('#0088FF'));
  fillRect(pixels, width, 776, 96, 110, 12, rgba('#00C0E8'));

  const leftLines = ['#6155F5', '#0088FF', '#33C758', '#FF8D28', '#8F8F94', '#0088FF', '#6155F5'];
  const rightLines = ['#6155F5', '#0088FF', '#D9DEE8', '#33C758', '#FF8D28', '#8F8F94', '#00C0E8'];

  leftLines.forEach((color, index) => {
    fillRect(pixels, width, 96, 170 + index * 68, 420 - index * 18, 18, rgba(color));
    fillRect(pixels, width, 540, 170 + index * 68, 70, 18, rgba(index % 2 ? '#AC7F5E' : '#0088FF'));
  });

  rightLines.forEach((color, index) => {
    fillRect(pixels, width, 776, 170 + index * 68, 430 - index * 16, 18, rgba(color));
    fillRect(pixels, width, 1210, 170 + index * 68, 82, 18, rgba(index % 2 ? '#66D98A' : '#FF7A7D'));
  });

  fillRect(pixels, width, 580, 24, 120, 36, rgba('#00C0E8'));
});

console.log('generated assets:', fs.readdirSync(root).join(', '));
