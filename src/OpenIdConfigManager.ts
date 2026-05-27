// @ts-ignore
import forge from 'node-forge'
import * as jose from 'jose'
import * as client from 'openid-client'
import {BffConfig} from "./config/config.js";
import {getSsmParameter} from "./config/variable-loaders.js";

type OkDataKey = {
  keystore: string,
  key_password: string
  key_alias: string
  key_id: string
}

export class OpenIdConfigManager {

  #bffConfig: BffConfig
  #openIdConfig: client.Configuration
  #serverMetadata: client.ServerMetadata

  constructor(config: BffConfig, serverMetadata?: client.ServerMetadata) {
    this.#bffConfig = config
    this.#serverMetadata = serverMetadata
  }

  async init() {
    await this.updateOpenIdConfig()
    if(this.#bffConfig.okDataIdPortenKeyName) {
      setInterval(async () => {
        await this.updateOpenIdConfig()
      }, 5 * 60 * 1000)
    }
  }

  async #p12ToJwk(okdataP12: OkDataKey) {
    //TODO: dette er helt sikkert mulig å gjøre i færre steg...
    const p12Der = forge.util.decode64(okdataP12.keystore)
    const p12Asn1 = forge.asn1.fromDer(p12Der)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, okdataP12.key_password);
    const privateKey = p12.getBags({friendlyName: okdataP12.key_alias}).friendlyName[0].key
    const privateKeyAsn1 = forge.pki.privateKeyToAsn1(privateKey)
    const privateKeyInfo = forge.pki.wrapRsaPrivateKey(privateKeyAsn1)
    const pem = forge.pki.privateKeyInfoToPem(privateKeyInfo);
    const key = await jose.importPKCS8(pem, 'RS256', {extractable: true})
    return {key: key, kid: okdataP12.key_id}
  }

  async #createKeyFromOkData(ssmName: string) {
    const keyString = await getSsmParameter(ssmName)
    const okdataKey = JSON.parse(keyString)
    return await this.#p12ToJwk(okdataKey)
  }

  async updateOpenIdConfig() {
    console.log('Updating OpenId config...')
    let key: client.PrivateKey
    if(this.#bffConfig.okDataIdPortenKeyName) {
      console.log('Fetching okdata key')
      key = await this.#createKeyFromOkData(this.#bffConfig.okDataIdPortenKeyName)
    }

    const clientId = this.#bffConfig.clientId
    const clientMetadata = {client_secret: this.#bffConfig.clientSecret}
    const clientAuth = key ? client.PrivateKeyJwt(key) : undefined

    if(this.#openIdConfig) {
      console.log('Reusing OpenId Config with new key')
      this.#openIdConfig = new client.Configuration(
        this.#openIdConfig.serverMetadata(),
        clientId,
        clientMetadata,
        clientAuth
      )
    } else if(this.#serverMetadata) {
      console.log('Using OpenId Config with provided server metadata')
      this.#openIdConfig = new client.Configuration(
        this.#serverMetadata,
        clientId,
        clientMetadata,
        clientAuth
      )
    } else {
      console.log('Fetching OpenId config')
      this.#openIdConfig = await client.discovery(
        new URL(this.#bffConfig.issuer),
        clientId,
        clientMetadata,
        clientAuth
      )
    }
  }

  get openIdConfig() {
    return this.#openIdConfig
  }

}
