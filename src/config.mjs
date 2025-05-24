import findup from 'findup-sync'
import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

export function getEnv(env, defaultVal, parseFn) {
  if (process.env[env]) {
    return parseFn ? parseFn(process.env[env]) : process.env[env]
  } else if (defaultVal !== undefined) {
    return defaultVal
  } else {
    throw Error(`Missing env var: ${env}`)
  }
}

let ssmClient
export async function getSsmParameter(name, withDecryption = true) {
  ssmClient ??= new SSMClient({})
  return ssmClient.send(new GetParameterCommand({
    Name: name,
    WithDecryption: withDecryption
  })).then(p => p.Parameter.Value)
}

const defaultConfig = {
  basePath: "",
  cookieSecure: true,
  cookieSameSite: 'lax',
  staticRootPath: './dist'
}

let config
export async function loadConfig() {
  if(config) return config
  const userConfigPath = findup('bff.config.json')
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
