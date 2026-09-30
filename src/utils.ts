export function redact(string: string, length: number = 5) {
  return string?.substring(0, length) + '***'
}

export function safeRedirectUrl(baseUrl: URL, redirectUrl: string) {
  const url = URL.parse(redirectUrl, baseUrl)
  if(url?.origin !== baseUrl.origin) {
    return baseUrl
  }
  return url
}