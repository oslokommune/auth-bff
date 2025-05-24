import crypto from "crypto";
import helmet from "helmet";

export function securityHeaders(config) {
  
  const contentSecurityPolicy = config.contentSecurityPolicy
  if(contentSecurityPolicy?.directives) {
    for (const [_, values] of Object.entries(contentSecurityPolicy.directives)) {
      for (const [i, value] of values.entries()) {
        if(value === '{nonce}') {
          values[i] = (req, res) => `'nonce-${res.locals.cspNonce}'`
        }
      }
    }
  }

  const generateCspNonceMiddleware = (req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString("hex");
    next();
  }

  const helmetMiddleware = helmet({
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: false,
      preload: false,
    },
    contentSecurityPolicy: contentSecurityPolicy ?? false,
  })

  return [
    generateCspNonceMiddleware,
    helmetMiddleware
  ]
}