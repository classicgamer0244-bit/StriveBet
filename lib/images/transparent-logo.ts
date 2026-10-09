import sharp from "sharp";

function isNearWhite(r: number, g: number, b: number, a: number, threshold = 215): boolean {
  if (a < 20) return false;
  return r >= threshold && g >= threshold && b >= threshold;
}

/**
 * Removes white or near-white background from a logo image buffer,
 * preserving internal white elements and returning a clean, transparent PNG.
 */
export async function makeLogoTransparent(inputBuffer: Buffer): Promise<Buffer> {
  try {
    let pipeline = sharp(inputBuffer).rotate();
    const meta = await pipeline.metadata();

    if (meta.format === "svg") {
      return inputBuffer;
    }

    // Limit maximum dimensions for fast processing and crisp rendering
    if ((meta.width && meta.width > 256) || (meta.height && meta.height > 256)) {
      pipeline = pipeline.resize(256, 256, { fit: "inside", withoutEnlargement: true });
    }

    const { data, info } = await pipeline
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = 4; // RGBA

    // Sample corner offsets to determine if image has an outer white/near-white canvas
    const cornerOffsets = [
      [0, 0], [1, 0], [0, 1],
      [width - 1, 0], [width - 2, 0], [width - 1, 1],
      [0, height - 1], [1, height - 1], [0, height - 2],
      [width - 1, height - 1], [width - 2, height - 1], [width - 1, height - 2],
    ];

    let whiteCorners = 0;
    for (const [cx, cy] of cornerOffsets) {
      if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
        const idx = (cy * width + cx) * channels;
        if (isNearWhite(data[idx], data[idx + 1], data[idx + 2], data[idx + 3], 220)) {
          whiteCorners++;
        }
      }
    }

    // If outer corners are predominantly white/near-white, remove the connected outer background
    if (whiteCorners >= 4) {
      const visited = new Uint8Array(width * height);
      const queue: number[] = [];

      // Seed queue from all border pixels
      for (let x = 0; x < width; x++) {
        for (const y of [0, height - 1]) {
          const pIdx = y * width + x;
          const idx = pIdx * channels;
          if (!visited[pIdx] && isNearWhite(data[idx], data[idx + 1], data[idx + 2], data[idx + 3], 215)) {
            visited[pIdx] = 1;
            queue.push(pIdx);
          }
        }
      }
      for (let y = 0; y < height; y++) {
        for (const x of [0, width - 1]) {
          const pIdx = y * width + x;
          const idx = pIdx * channels;
          if (!visited[pIdx] && isNearWhite(data[idx], data[idx + 1], data[idx + 2], data[idx + 3], 215)) {
            visited[pIdx] = 1;
            queue.push(pIdx);
          }
        }
      }

      let head = 0;
      while (head < queue.length) {
        const pIdx = queue[head++];
        const px = pIdx % width;
        const py = Math.floor(pIdx / width);

        const neighbors: [number, number][] = [
          [px + 1, py],
          [px - 1, py],
          [px, py + 1],
          [px, py - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!visited[nIdx]) {
              const idx = nIdx * channels;
              if (isNearWhite(data[idx], data[idx + 1], data[idx + 2], data[idx + 3], 210)) {
                visited[nIdx] = 1;
                queue.push(nIdx);
              }
            }
          }
        }
      }

      // Smooth alpha feathering on boundary pixels
      for (let i = 0; i < visited.length; i++) {
        if (visited[i]) {
          const idx = i * channels;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const minVal = Math.min(r, g, b);
          if (minVal >= 238) {
            data[idx + 3] = 0;
          } else if (minVal >= 210) {
            data[idx + 3] = Math.round(((238 - minVal) / 28) * 255);
          } else {
            data[idx + 3] = 0;
          }
        }
      }
    }

    return await sharp(data, {
      raw: { width, height, channels: 4 },
    })
      .png({ compressionLevel: 8 })
      .toBuffer();
  } catch (err) {
    console.error("[transparent-logo] processing failed, returning original:", err);
    return inputBuffer;
  }
}
