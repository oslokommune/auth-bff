import {findUp} from 'find-up'
import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";
import {HelmetOptions} from "helmet";
import session from "express-session";

export type BffConfig = {
  /**
   * The port at which the app will be served. Only used in standalone mode, to change the port used during development,
   * set it in your vite config instead.
   */
  port: number
  /**
   * The base root path. Change if app is served from a non-root path.
   *
   * Default: `/`
   */
  basePath?: string
  /**
   * The root path of the static resources to be served
   *
   * Default: `/dist`
   */
  staticRootPath?: string
  /**
   * The issuer
   *
   * Example: `https://test.idporten.no/`
   */
  issuer: string
  /**
   * The ID of the client
   */
  clientId: string
  /**
   * Sets the scope parameter. Values are case-sensitive. Multiple values must be sepratated by space. Default: `openid profile`
   */
  scope: string
  /**
   * The client secret. Not used if `okDataIdPortenKeyName` is set.
   */
  clientSecret?: string
  /**
   * The redirect uri configured for the client
   */
  redirectUri: string
  /**
   * The intended audience for the tokens. Value(s) set here can be used to verify audience on the recipient end.
   * See https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-indicators-05.
   *
   * Example: `["https://example.com/api1", "https://example.com/api2"]`
   */
  resources?: Array<string>
  /**
   * express-session cookie options, note that if this is set, the below cookie*-options will have no effect
   */
  cookie?: session.CookieOptions
  /**
   * Sets the Path attribute of the cookie. Should most likely be the same as basePath. See https://expressjs.com/en/resources/middleware/session.html
   *
   * Default: `/`
   */
  cookiePath?: string
  /**
   * Sets the Secure attribute of the cookie. See https://expressjs.com/en/resources/middleware/session.html
   *
   * Default: `true`
   */
  cookieSecure?: boolean
  /**
   * Sets the SameSite attribute of the cookie. See https://expressjs.com/en/resources/middleware/session.html
   *
   * Default: `"lax"`
   */
  cookieSameSite: boolean | "lax" | "none" | "strict"
  /**
   * The post logout redirect uri configured for the client
   */
  postLogoutRedirectUri: string
  /**
   * The name of the key that okdata stored in parameter store.
   *
   * Example: `/okdata/maskinporten/11111111-2222-3333-4444-555555555555/key.json`
   */
  okDataIdPortenKeyName: string
  /**
   * Secret used to sign sessions. This can be any string, but should have at least 32 bytes of entropy in production.
   */
  sessionSecret: string
  /**
   * The type of session store used. Only `memory` and `dynamodb` currently supported. `memory` is only for dev use
   */
  sessionStoreType: 'memory' | 'dynamodb'
  /**
   * Options that will be passed to the chosen sessionStore. Options depend on the type of store chosen
   *
   * Example: `{"table": "my-custom-dynamodb-table"}`
   */
  sessionStoreOptions?: object
  /**
   * Map of paths and remote targets that will be forwarded by the proxy
   *
   * Example: `{'/api': 'http://example.com/api'}`
   */
  proxyTargets: { [path: string]: string }
  /**
   * Like `proxyTargets`, but requests pass through anonymously — no session lookup, no Authorization
   * header. Registered before `proxyTargets`, so a public path takes precedence over an overlapping
   * protected one.
   *
   * Example: `{'/api/public': 'http://example.com/api/public'}`
   */
  publicProxyTargets?: { [path: string]: string }
  /**
   * List of claims in the id_token that are returned by the /user-endpoint. By default all are returned
   *
   * Example: `["pid"]`
   */
  userClaims?: Array<string>
  /**
   * Content security policy configuration passed to helmet.
   * See https://github.com/helmetjs/helmet for details. Note that since the config in limited to json,
   * some features are not supported. To set a nonce value, use the special value `"{nonce}"` instead.
   *
   *
   * Example:
   * ```json
   *     {
   *       "directives": {
   *         "default-src": ["'self'", "https://*.oslo.kommune.no", "https://*.oslo.systems"],
   *         "script-src": ["'self'", "{nonce}"],
   *       ...
   *       }
   *     }
   * ```
   */
  contentSecurityPolicy?: Exclude<HelmetOptions['contentSecurityPolicy'], Boolean>
  /**
   * These values will be injected into index.html, replacing any `__INJECTED_CONFIG__` if present
   */
  injectConfig?: string | {[k: string]: string}
}

const defaultConfig: Partial<BffConfig> = {
  basePath: "",
  cookiePath: '/',
  cookieSecure: true,
  cookieSameSite: 'lax',
  staticRootPath: './dist',
  scope: 'openid profile'
}

export function getEnv(env: string, defaultVal?: string, parseFn?: (val: string) => string) {
  if (process.env[env]) {
    return parseFn ? parseFn(process.env[env]) : process.env[env]
  } else if (defaultVal !== undefined) {
    return defaultVal
  } else {
    throw Error(`Missing env var: ${env}`)
  }
}

let ssmClient: SSMClient

export async function getSsmParameter(name: string, withDecryption: boolean = true) {
  ssmClient ??= new SSMClient({})
  return ssmClient.send(new GetParameterCommand({
    Name: name,
    WithDecryption: withDecryption
  })).then(p => p.Parameter.Value)
}

let config: BffConfig

export async function replaceConfigValues(value: unknown) {
  if (typeof value === "string") {
    const [, varType, varName] = value.match(/\{(\w+):(.*)}/) ?? []
    if (varType === 'env') {
      return getEnv(varName)
    } else if (varType === 'ssm') {
      return await getSsmParameter(varName)
    } else if (varType) {
      throw Error(`unknown varType: ${varType}`)
    } else {
      return value
    }
  } else if (Array.isArray(value)) {
    return Promise.all(value.map(replaceConfigValues))
  } else if (typeof value === "object" && value != null) {
    const res = {}
    for (const [key, val] of Object.entries(value)) {
      res[key] = await replaceConfigValues(val)
    }
    return res
  } else {
    return value
  }
}

export async function loadConfig(configFile: string | Array<string> = 'bff.config.json') {
  if (config) return config

  const userConfigPath = await findUp(configFile)
  if (!userConfigPath) {
    throw Error(`Could not find config file ${configFile}`)
  }
  console.log('Loading config at', userConfigPath)
  const {default: loadedConfig} = await import(userConfigPath, {with: {type: 'json'}});

  const processedConfig = await replaceConfigValues(loadedConfig)

  config = {...defaultConfig, ...processedConfig}
  return config
}
