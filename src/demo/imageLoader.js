/**
 * Demo Image Loader (src/demo/imageLoader.js).
 * Loads images from /demo-images/<filename>, falling back to dynamically
 * generated canvas placeholders if any file is missing, and tracks availability.
 */
import { compressImage } from '../lib/imageUtils';

export const REQUIRED_DEMO_IMAGES = [
  'pothole_before.jpg',
  'pothole_after.jpg',
  'fake_fix_other_place.jpg',
  'garbage_before.jpg',
  'garbage_after_partial.jpg',
  'waterleak_before.jpg',
  'streetlight_before.jpg',
  'drain_before.jpg',
];

// In-memory cache for loaded and compressed demo images
const imageCache = new Map();

/**
 * Generates a high-visibility canvas placeholder for missing demo files.
 * @param {string} filename 
 * @returns {string} Data URL
 */
export function generateMissingPlaceholder(filename) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');

  // Background pattern
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 800, 500);

  // Warning stripe header
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 800, 30);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEMO PLACEHOLDER — FILE MISSING FROM public/demo-images/', 400, 20);

  // Center icon and text
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(400, 180, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📷', 400, 195);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(filename, 400, 280);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText('Place real image in public/demo-images/ for photo demo', 400, 320);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('CivicEye Presenter Engine', 400, 440);

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Checks which demo images exist on the server.
 * @returns {Promise<{ present: string[], missing: string[] }>}
 */
export async function checkDemoImagesStatus() {
  const present = [];
  const missing = [];

  for (const filename of REQUIRED_DEMO_IMAGES) {
    try {
      const res = await fetch(`/demo-images/${filename}`, { method: 'HEAD' });
      if (res.ok && res.headers.get('content-type')?.includes('image')) {
        present.push(filename);
      } else {
        missing.push(filename);
      }
    } catch {
      missing.push(filename);
    }
  }

  return { present, missing };
}

/**
 * Loads a demo image by filename.
 * If present on disk: loads, compresses to JPEG data URL, and returns.
 * If missing: renders a labeled placeholder and returns compressed data URL.
 * 
 * @param {string} filename 
 * @returns {Promise<{ dataUrl: string, hash: string, isPlaceholder: boolean }>}
 */
export async function loadDemoImage(filename) {
  if (imageCache.has(filename)) {
    return imageCache.get(filename);
  }

  try {
    const res = await fetch(`/demo-images/${filename}`);
    if (!res.ok) throw new Error('File not found');

    const blob = await res.blob();
    // Verify it's actually an image
    if (!blob.type.startsWith('image/')) {
      throw new Error('Not an image');
    }

    const compressed = await compressImage(blob);
    const result = {
      dataUrl: compressed.dataUrl,
      hash: compressed.hash,
      isPlaceholder: false,
    };
    imageCache.set(filename, result);
    return result;
  } catch (err) {
    // Generate fallback placeholder
    console.warn(`[Demo] ${filename} not found, using canvas placeholder`);
    const placeholderUrl = generateMissingPlaceholder(filename);

    // Convert dataUrl to blob to pass to compressImage for consistent hash
    const res = await fetch(placeholderUrl);
    const blob = await res.blob();
    const compressed = await compressImage(blob);

    const result = {
      dataUrl: compressed.dataUrl,
      hash: compressed.hash,
      isPlaceholder: true,
    };
    imageCache.set(filename, result);
    return result;
  }
}
