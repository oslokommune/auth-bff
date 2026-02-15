export function redact(string: string, length: number = 5) {
  return string?.substring(0, length) + '***'
}