let blobModule = null;

function getBlob() {
  if (blobModule !== null) return blobModule;
  try {
    blobModule = require('@vercel/blob');
  } catch (e) {
    console.warn('[Storage] @vercel/blob tidak terpasang, gambar akan disimpan sebagai data URL');
    blobModule = false;
  }
  return blobModule;
}

function isBlobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) && Boolean(getBlob());
}

function extensionFor(mimeType) {
  if (!mimeType) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

function slugify(text) {
  return (
    (text || 'gambar')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'gambar'
  );
}

/**
 * Simpan gambar di Vercel Blob dan kembalikan URL publik permanen.
 * Kalau Blob tidak tersedia / gagal, kembalikan data URL agar gambar tetap
 * bisa ditampilkan dan disimpan di localStorage.
 */
async function storeImage(buffer, mimeType, prompt) {
  const ext = extensionFor(mimeType);

  if (isBlobEnabled()) {
    try {
      const { put } = getBlob();
      const pathname = `images/${slugify(prompt)}-${Date.now()}.${ext}`;
      const result = await put(pathname, buffer, {
        access: 'public',
        contentType: mimeType || 'image/jpeg',
        addRandomSuffix: true,
      });
      console.log(`[Storage] Gambar disimpan di Blob: ${pathname}`);
      return { url: result.url, mimeType: mimeType || 'image/jpeg', storage: 'blob' };
    } catch (error) {
      console.error('[Storage] Gagal upload ke Blob:', error.message);
    }
  }

  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
  return { url: dataUrl, mimeType: mimeType || 'image/jpeg', storage: 'dataurl' };
}

/**
 * Hapus gambar dari Blob. Sengaja swallow error: penghapusan riwayat di
 * browser tidak boleh gagal hanya karena file sudah hilang.
 */
async function deleteImage(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http')) return false;
  if (!isBlobEnabled()) return false;

  try {
    const { del } = getBlob();
    await del(url);
    console.log('[Storage] Gambar dihapus dari Blob');
    return true;
  } catch (error) {
    console.error('[Storage] Gagal hapus dari Blob:', error.message);
    return false;
  }
}

module.exports = { storeImage, deleteImage, isBlobEnabled, extensionFor, slugify };
