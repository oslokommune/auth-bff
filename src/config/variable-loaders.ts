import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

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
