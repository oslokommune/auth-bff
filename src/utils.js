export function redact(string, length = 5) {
  return string?.substring(0, length) + '***'
}