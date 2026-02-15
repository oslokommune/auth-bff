import {findUp} from 'find-up'
import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

export type BffConfig = {
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
  cookieSecure?: Boolean
  /**
   * Sets the SameSite attribute of the cookie. See https://expressjs.com/en/resources/middleware/session.html
   *
   * Default: `"lax"`
   */
  cookieSameSite: Boolean | string
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
   * Secret used to sign sessions
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
   * List of claims in the access token that are returned by the /user-endpoint. By default all are returned
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
  contentSecurityPolicy?: object
}

const defaultConfig: Partial<BffConfig> = {
  basePath: "",
  cookiePath: '/',
  cookieSecure: true,
  cookieSameSite: 'lax',
  staticRootPath: './dist'
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

export async function loadConfig(configFile: string = 'bff.config.json') {
  if (config) return config

  const userConfigPath = await findUp(configFile)
  if (!userConfigPath) {
    throw Error(`Could not find config file ${configFile}`)
  }
  console.log('Loading config at', userConfigPath)
  const {default: loadedConfig} = await import(userConfigPath, {with: {type: 'json'}});

  for (const [key, value] of Object.entries(loadedConfig)) {
    if (typeof value === "string") {
      const [, varType, varName] = value.match(/\{(\w+):(.*)}/) ?? []
      if (varType === 'env') {
        loadedConfig[key] = getEnv(varName)
      } else if (varType === 'ssm') {
        loadedConfig[key] = await getSsmParameter(varName)
      } else if (varType) {
        throw Error(`unknown varType: ${varType}`)
      }
    }
  }

  config = {...defaultConfig, ...loadedConfig}
  return config
}
