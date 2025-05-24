import forge from "node-forge";
import * as jose from 'jose'
import {Issuer} from "openid-client";
import {getSsmParameter} from "./config.mjs";

export class OidcClientManager {

  #issuer
  #config
  #client

  constructor(config) {
    this.#config = config
  }

  async init() {
    this.#issuer = await Issuer.discover(this.#config.oidcDiscoveryUri)
    this.#client = await this.#createClient()
    if(this.#config.okDataIdPortenKeyName) {
      setInterval(async () => {
        this.#client = await this.#createClient()
      }, 5 * 60 * 1000)
    }

  }

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
  async #p12ToJwks(okdataP12) {
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

  async #createKeyStoreFromOkData(ssmName) {
    const keyString = await getSsmParameter(ssmName)
    const okdataP12 = JSON.parse(keyString)
    return await this.#p12ToJwks(okdataP12)
  }

  async #createClient() {
    let keyStore
    if(this.#config.okDataIdPortenKeyName) {
      keyStore = await this.#createKeyStoreFromOkData(this.#config.okDataIdPortenKeyName)
    } else if(this.#config.keyStore) {
      keyStore = this.#config.keyStore
    }
    return new this.#issuer.Client(
      {
        client_id: this.#config.clientId,
        client_secret: this.#config.clientSecret,
        redirect_uris: [this.#config.redirectUri],
        response_types: ["code"],
        token_endpoint_auth_method: this.#config.clientSecret ? "client_secret_post" : "private_key_jwt",
        token_endpoint_auth_signing_alg: "RS256",
        post_logout_redirect_uris: this.#config.postLogoutRedirectUris
      },
      keyStore
    )
  }

  get client() {
    return this.#client
  }

}
