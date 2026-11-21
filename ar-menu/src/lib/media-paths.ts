/**
 * Ürün fotoğrafının küçük kopyasının yolu. Ayrı bir veritabanı alanı tutmamak için
 * büyük fotoğrafın yolundan türetilir: ".../<id>.jpg" → ".../<id>-thumb.jpg".
 * Tarayıcıda ve sunucuda kullanılabilir.
 */
export function thumbPath(imagePath: string): string {
  return imagePath.replace(/\.(jpe?g|png|webp)$/i, "-thumb.jpg");
}

/** Menü listesindeki küçük karenin kenar uzunluğu (px); 76 px kare için retina dahil yeterli. */
export const THUMB_SIZE = 240;
