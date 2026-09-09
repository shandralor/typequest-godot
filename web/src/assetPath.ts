// Every runtime asset is fetched by ABSOLUTE path (/assets/..., /audio/...), which is right
// when the game is served from a domain root but wrong on GitHub Pages, where a project site
// lives under /<repo>/. Vite knows the deployment prefix as BASE_URL ("/" in dev), so this is
// the single place that turns an authored path into a fetchable URL. Keep the authored strings
// root-relative -- they are data (and hash-checked content in the music table).

export function assetUrl(path: string): string {
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? "/";
  return base.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);
}
