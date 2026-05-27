import crypto from "crypto";
import helmet from "helmet";
import {Request, Response, NextFunction} from 'express'
import {BffConfig} from "../config/config.js";

export function securityHeaders(config: BffConfig) {
  
  const contentSecurityPolicy = config.contentSecurityPolicy
  if(contentSecurityPolicy?.directives) {
    for (const [_, values] of Object.entries(contentSecurityPolicy.directives)) {
      // @ts-ignore //TODO values her har type Iterable (som ikke har `entries()`), men er egentlig en array. Kan sikkert skrives om litt.
      for (const [i, value] of values.entries()) {
        if(value === '{nonce}') {
          values[i] = (_: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`
        }
      }
    }
  }

  const generateCspNonceMiddleware = (_: Request, res: Response, next: NextFunction) => {
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