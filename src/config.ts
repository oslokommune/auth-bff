import {findUp} from 'find-up'
import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

export type BffConfig = {
  basePath?: string
  staticRootPath?: string
  issuer: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  resources: Array<string>
  cookiePath?: string
  cookieSecure?: Boolean
  cookieSameSite: Boolean | string
  postLogoutRedirectUri: string
  okDataIdPortenKeyName: string
  sessionSecret: string
  sessionStoreType: 'memory' | 'dynamodb'
  sessionStoreOptions?: object
  proxyTargets: {[path: string]: string}
  userClaims: Array<string>
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

const defaultConfig: Partial<BffConfig> = {
  basePath: "",
  cookiePath: '/',
  cookieSecure: true,
  cookieSameSite: 'lax',
  staticRootPath: './dist'
}

let config: BffConfig
export async function loadConfig(configFile: string = 'bff.config.json') {
  if(config) return config

  const userConfigPath = await findUp(configFile)
  if(!userConfigPath) {
    throw Error(`Could not find config file ${configFile}`)
  }
  console.log('Loading config at', userConfigPath)
  const {default: loadedConfig} = await import(userConfigPath, {with: {type: 'json'}});

  for (const [key, value] of Object.entries(loadedConfig)) {
    if(typeof value === "string") {
      const [, varType, varName]  = value.match(/\{(\w+):(.*)}/) ?? []
      if(varType === 'env') {
        loadedConfig[key] = getEnv(varName)
      } else if (varType === 'ssm') {
        loadedConfig[key] = await getSsmParameter(varName)
      } else if(varType) {
        throw Error(`unknown varType: ${varType}`)
      }
    }
  }

  config = {...defaultConfig, ...loadedConfig}
  return config
}
