/** Deriva o caminho dentro do bucket a partir da URL pública do Supabase Storage. */
export function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return url.slice(index + marker.length);
}
