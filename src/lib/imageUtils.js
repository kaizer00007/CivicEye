/**
 * Image compression and perceptual hashing utilities.
 * Ensures all photos are compressed to under 900 KB for direct Firestore storage.
 */
import { IMAGE_MAX_WIDTH, IMAGE_JPEG_QUALITY, MAX_DOC_SIZE_BYTES } from '../config';

/**
 * Compresses an image File or Blob to a base64 JPEG data URL.
 * Resizes down to max width (default 800px) maintaining aspect ratio.
 * 
 * @param {File|Blob} file 
 * @param {number} [maxWidth=800]
 * @param {number} [quality=0.7]
 * @returns {Promise<{dataUrl: string, hash: string, width: number, height: number, sizeBytes: number}>}
 */
export async function compressImage(file, maxWidth = IMAGE_MAX_WIDTH, quality = IMAGE_JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeBytes = Math.round((dataUrl.length * 3) / 4);

        if (sizeBytes > MAX_DOC_SIZE_BYTES) {
          reject(new Error(`Compressed image is ${Math.round(sizeBytes / 1024)} KB, exceeds 900 KB limit. Try a smaller image.`));
          return;
        }

        const hash = computeImageHash(canvas);

        resolve({
          dataUrl,
          hash,
          width,
          height,
          sizeBytes,
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Computes an 8x8 average / perceptual hash of the image on canvas.
 * Downscales to 8x8 grayscale, calculates average luminance, produces 64-bit hex hash.
 * 
 * @param {HTMLCanvasElement} sourceCanvas 
 * @returns {string} Hex string representation of the 64-bit hash
 */
export function computeImageHash(sourceCanvas) {
  try {
    const hashCanvas = document.createElement('canvas');
    hashCanvas.width = 8;
    hashCanvas.height = 8;
    const ctx = hashCanvas.getContext('2d');
    if (!ctx) return '0'.repeat(16);

    ctx.drawImage(sourceCanvas, 0, 0, 8, 8);
    const imgData = ctx.getImageData(0, 0, 8, 8).data;

    // Grayscale values
    const grays = new Float32Array(64);
    let sum = 0;
    for (let i = 0; i < 64; i++) {
      const idx = i * 4;
      // Luminance formula
      const gray = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      grays[i] = gray;
      sum += gray;
    }

    const avg = sum / 64;
    let hex = '';
    for (let chunk = 0; chunk < 16; chunk++) {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit++) {
        const i = chunk * 4 + bit;
        if (grays[i] >= avg) {
          nibble |= 1 << (3 - bit);
        }
      }
      hex += nibble.toString(16);
    }
    return hex;
  } catch (err) {
    console.warn('Failed to compute image hash:', err);
    return '0'.repeat(16);
  }
}

/**
 * Computes Hamming distance between two hex hashes (0 = identical, 64 = completely opposite).
 * @param {string} hashA 
 * @param {string} hashB 
 * @returns {number}
 */
export function hashHammingDistance(hashA, hashB) {
  if (!hashA || !hashB || hashA.length !== hashB.length) return 64;
  let dist = 0;
  for (let i = 0; i < hashA.length; i++) {
    const valA = parseInt(hashA[i], 16);
    const valB = parseInt(hashB[i], 16);
    let xor = valA ^ valB;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}
