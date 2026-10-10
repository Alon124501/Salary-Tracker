// Receipt uploads go through Vercel, which rejects request bodies over ~4.5MB
// before they reach Express. Full-resolution phone photos easily exceed that,
// so images are downscaled to a JPEG before upload. Non-images (PDF) and
// anything the browser can't decode are returned untouched.
export async function compressImage(file, { maxDim = 1600, quality = 0.8 } = {}) {
  if (!file?.type?.startsWith('image/')) return file;
  try {
    const source = await loadImage(file);
    const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
    const width = Math.round(source.width * scale);
    const height = Math.round(source.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black as JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    source.close?.();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]*$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {}
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  img.close = () => URL.revokeObjectURL(url); // released after drawing, like ImageBitmap.close
  return img;
}
