import {expect, test, vi} from 'vitest'
import request from "supertest"
import {testApp} from "./testApp.js"
import {Store} from "express-session"
import {BffConfig} from "../src/config.js";

let sessionStore: Store

vi.mock(import("../src/middleware/sessions/memorySessionStore.js"), async (importOriginal) => {
  const originalModule = await importOriginal()
  return {
    memorySessionStore: () => sessionStore = originalModule.memorySessionStore()
  }
})

const testConfig: BffConfig = {
  "port": 3000,
  "staticRootPath": "test/static",
  "issuer": "https://test.idporten.no/",
  "clientId": "test-client",
  "clientSecret": "test-secret",
  "resources": ["https://test.resource/api"],
  "redirectUri": "http://localhost:3000/auth/callback",
  "postLogoutRedirectUri": "http://localhost:3000",
  "scope": "openid profile other",
  "cookieSecure": false,
  "cookieSameSite": false,
  "sessionSecret": "example-secret",
  "sessionStoreType": "memory",
  "userClaims": ["pid"],
  "proxyTargets": {
    "/barnehageside/api/barnehageplass": "https://barnehageplass-dev.oslo.systems/api/barnehageplass",
    "/barnehageside/api": "https://barnehageplass-dev.oslo.systems/api"
  },
  "publicProxyTargets": {
    "/barnehageside/public": "http://127.0.0.1:1/public"
  },
  "injectConfig": {
    "key": "value",
    "list": ["many", "items"]
  }
}



function getSessionId(res: any) {
  let cookie = res.get('set-cookie')
  if (!Array.isArray(cookie)) {
    cookie = [cookie]
  }
  const connectCookie = cookie.find((c: string) => c.startsWith('connect.sid'))
  const [, sid] = connectCookie.match(/connect\.sid=s%3A(.+)\./)
  return sid
}

function getSession(res: any) {
  const sid = getSessionId(res)
  return JSON.parse(sessionStore['sessions'][sid])
}

function setSession(id: string, content: object) {
  sessionStore['sesssions'][id] = JSON.stringify(content)
}

test("/login", async () => {
  const app = await testApp(testConfig)
  const response = await request(app)
    .get('/auth/login?redirectUrl=/barnehage')

  expect(response.statusCode).toBe(302)
  expect(response.get('location')).not.toBeNull()

  const location = new URL(response.get('location'))
  const codeChallenge = location.searchParams.get('code_challenge')
  const state = location.searchParams.get('state')

  expect(location.host).toBe('login.test.idporten.no') //fra openid-config
  expect(location.searchParams.get('scope')).toBe('openid profile other')
  expect(location.searchParams.get('response_type')).toBe('code')
  expect(state).not.toBeNull()
  expect(codeChallenge).not.toBeNull()
  expect(location.searchParams.get('code_challenge_method')).toBe('S256')
  expect(location.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/callback') //fra bff-config
  expect(location.searchParams.get('client_id')).toBe('test-client') //fra bff-config
  expect(location.searchParams.get('resource')).toBe('https://test.resource/api') //fra bff-config

  const session = getSession(response)
  expect(session['codeVerifier']).not.toBeNull()
  expect(session['stateKey']).toBe(state)
  expect(session['stateValue']['redirectUrl']).toBe('/barnehage')

})

test.skip('/callback', async () => {
  const app = await testApp(testConfig)
  const response = await request(app)
    .get('/auth/callback?code=test-code&iss=https%3A%2F%2Ftest.idporten.no&state=test-state')

  expect(response.statusCode).toBe(302)
  //TODO: må mocke kallet til auth-server
})

test('protected proxy target returns 401 without session', async () => {
  const app = await testApp(testConfig)
  const response = await request(app).get('/barnehageside/api/anything')
  expect(response.statusCode).toBe(401)
})

test('public proxy target does not require a session', async () => {
  // Target is an unreachable port, so the proxy itself fails with 5xx. Point is: not 401.
  const app = await testApp(testConfig)
  const response = await request(app).get('/barnehageside/public/anything')
  expect(response.statusCode).not.toBe(401)
  expect(response.statusCode).toBeGreaterThanOrEqual(500)
})

test("injected nonce and config", async () => {
  const app = await testApp(testConfig)
  const response = await request(app).get('/')
  expect(response.statusCode).toBe(200)
  expect(response.text).toMatch(
/<script nonce="\w+">\s*const config = {"key":"value","list":\["many","items"]}\s*<\/script>/
  )
})

test("injected config: remove illegal chars", async () => {
  const badConfig = {...testConfig, injectConfig: "<script>alert('boo!')</script>"}
  const app = await testApp(badConfig)
  const response = await request(app).get('/')
  expect(response.statusCode).toBe(200)
  console.log(response.text)
  expect(response.text).not.toContain(badConfig.injectConfig)
})