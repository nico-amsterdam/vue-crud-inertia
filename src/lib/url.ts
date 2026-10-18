export function getBaseURL(url: string): string {
  const parsedUrl = new URL(url)
  return parsedUrl.protocol + '//' + parsedUrl.host
}
