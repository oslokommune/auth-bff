import {describe, expect, it} from 'vitest'
import {safeRedirectUrl} from "../src/utils.js";

describe("safeRedirectUrl", () => {
  const baseUrl = new URL('https://legit.com');

  it("does not allow changing origin", () => {
    const redirectUrls = [
      ["\\attacker.com", "https://legit.com/attacker.com"],
      ["@attacker.com", "https://legit.com/@attacker.com"],
      ["attacker.com", "https://legit.com/attacker.com"],
      [".attacker.com", "https://legit.com/.attacker.com"],
      [":443@attacker.com", "https://legit.com/:443@attacker.com"],
      ["//attacker.com", "https://legit.com/"],
      ["/\\attacker.com", "https://legit.com/"],
      ["https://attacker.com", "https://legit.com/"],
    ]

    redirectUrls.forEach(([redirectUrl, expectedResult]) => {
      const url = safeRedirectUrl(baseUrl, redirectUrl)
      expect(url.origin).toBe(baseUrl.origin)
      expect(url.toString()).toBe(expectedResult)
    })
  })

  it('allows relative urls and absolute urls of same origin', () => {
    const urls  = [
      ["/legit", "https://legit.com/legit"],
      ["/legit?query=123", "https://legit.com/legit?query=123"],
      ["/legit#hash", "https://legit.com/legit#hash"],
      ["https://legit.com/legit/path", "https://legit.com/legit/path"],
    ]

    urls.forEach(([redirectUrl, expectedResult]) => {
      const url = safeRedirectUrl(baseUrl, redirectUrl)
      expect(url.toString()).toBe(expectedResult)
    })
  })

})


