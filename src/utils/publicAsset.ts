export function publicAsset(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}
