import session from "express-session";
import {redact} from "../../utils.js";

const destroyByIdpSid = (idpSid) => {
  // This is not supposed to be used outside localhost, so it is not implemented
  console.log(`Pretending to destroyByIdpSid. idp-sid=${redact(idpSid)}`)
}

export function memorySessionStore(config = {}) {
  const sessionStore = new session.MemoryStore(config)
  sessionStore.destroyByIdpSid = destroyByIdpSid
  return sessionStore
}