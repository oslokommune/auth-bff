import session from "express-session";
import {redact} from "../../utils.js";

const destroyByIdpSid = async (idpSid: string) => {
  // This is not supposed to be used outside localhost, so it is not implemented
  console.log(`Pretending to destroyByIdpSid. idp-sid=${redact(idpSid)}`)
}

export function memorySessionStore(config: object = {}) {
  const sessionStore: session.Store = new session.MemoryStore(config)
  sessionStore.destroyByIdpSid = destroyByIdpSid
  return sessionStore
}