import {DeleteItemCommand, DynamoDBClient, QueryCommand} from "@aws-sdk/client-dynamodb";
import dynamoDbStore, {DynamoDBStoreOptions} from "connect-dynamodb";
import session from "express-session";
import {redact} from "../../utils.js";
import {BffConfig} from "../../config.js";

const destroyByIdpSid = (config: BffConfig['sessionStoreOptions'], client: DynamoDBClient) => {
  return async (idpSid: string) => {
    console.log(`Front channel logout: deleting session(s) with idp-sid=${redact(idpSid)}`)
    const query = new QueryCommand({
      TableName: config['table'],
      IndexName: "idp-sid-index",
      ExpressionAttributeValues: {":sid": {S: idpSid}},
      ExpressionAttributeNames: {"#k": "idp-sid"},
      KeyConditionExpression: "#k = :sid",
      ProjectionExpression: "id"
    })
    const res = await client.send(query)
    await Promise.all(res.Items.map((item) => {
      console.log(`Front channel logout: deleting session ${redact(item.id?.S, 10)}`)
      return client.send(new DeleteItemCommand({
        TableName: config['table'],
        Key: {id: item.id}
      }))
    }))
    console.log(`Front channel logout: completed. ${res.Count} session(s) deleted`)
  }

}

export function dynamoDbSessionStore(config = {}) {
  const client = new DynamoDBClient({})
  const DynamoDbStore = dynamoDbStore(session)
  const sessionStoreConfig: DynamoDBStoreOptions = {
    ...config,
    client,
    specialKeys: [
      {name: "idp-sid", type: "S"}
    ],
    skipThrowMissingSpecialKeys: true
  }
  const sessionStore = new DynamoDbStore(sessionStoreConfig)
  sessionStore.destroyByIdpSid = destroyByIdpSid(config, client)
  return sessionStore
}