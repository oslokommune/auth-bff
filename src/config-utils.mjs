import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";
import session from "express-session";
import dynamoDbStore from "connect-dynamodb";

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

export function dynamoDbSessionStore(config = {}) {
  const DynamoDbStore = dynamoDbStore({session})
  return new DynamoDbStore(config)
}

export function inMemorySessionStore() {
  return undefined
}

export function bffConfig(config) {
  if(typeof config === 'function') {
    return config
  } else {
    return () => config
  }
}

