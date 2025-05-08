import forge from "node-forge";
import * as jose from 'jose'
import {Issuer} from "openid-client";
import {config} from "./config.mjs";
import {getSsmParameter} from "./config-utils.mjs";
const issuer = await Issuer.discover(config.oidcDiscoveryUri)

/**
 * Takes the JSON object `okdata` produces and converts it to a JWKS
 *
 * @param {Object} okdataP12 - The keys.json created by okdata
 * @param {string} okdataP12.keystore - Base64 encoded p12 keystore
 * @param {string} okdataP12.key_password - P12 password
 * @param {string} okdataP12.key_alias - alias of key to extract
 * @param {string} okdataP12.key_id - id of key to extract
 * @returns {Promise<*>}
 */
export async function p12ToJwks(okdataP12) {
  const p12Der = forge.util.decode64(okdataP12.keystore)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, okdataP12.key_password);
  const privateKey = p12.getBagsByFriendlyName(okdataP12.key_alias)[0].key
  const privateKeyAsn1 = forge.pki.privateKeyToAsn1(privateKey)
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(privateKeyAsn1)
  const pem = forge.pki.privateKeyInfoToPem(privateKeyInfo);
  const k = await jose.importPKCS8(pem, 'RS256', {extractable: true})
  const jwk = await jose.exportJWK(k)
  jwk.kid = okdataP12.key_id
  jwk.use = 'sig'
  jwk.alg = 'RS256'
  return {
    keys: [jwk]
  }
}

async function createKeyStoreFromOkData(ssmName) {
  const keyString = await getSsmParameter(ssmName)
  const okdataP12 = JSON.parse(keyString)
  return await p12ToJwks(okdataP12)
}

async function createClient() {
  let keyStore
  if(config.okDataIdPortenKeyName) {
    keyStore = await createKeyStoreFromOkData(config.okDataIdPortenKeyName)
  } else if(config.keyStore) {
    keyStore = config.keyStore
  }
  return new issuer.Client(
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uris: [config.redirectUri],
      response_types: ["code"],
      token_endpoint_auth_method: config.clientSecret ? "client_secret_post" : "private_key_jwt",
      token_endpoint_auth_signing_alg: "RS256",
      post_logout_redirect_uris: config.postLogoutRedirectUris
    },
    keyStore
  )
}

export let client = await createClient()

if(config.okDataIdPortenKeyName) {
  setInterval(async () => {
    client = await createClient()
  }, 5 * 60 * 1000)
}
