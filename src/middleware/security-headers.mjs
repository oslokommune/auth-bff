import crypto from "crypto";

export function securityHeaders() {
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
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": [
          "'self'",
          "https://*.oslo.kommune.no",
          "https://*.oslo.systems",
        ],
        "script-src": ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        "style-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "img-src": ["'self'"],
        "font-src": ["'self'"],
      },
    },
  })

  return [
    generateCspNonceMiddleware,
    helmetMiddleware
  ]
}