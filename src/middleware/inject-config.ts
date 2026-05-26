import {BffConfig} from "../config.js";
import {Request, Response} from "express";
import {stringReplace} from "string-replace-middleware";

export function injectConfig(config:BffConfig) {
  const injectConfigString = JSON.stringify(config.injectConfig)

  return stringReplace({
    '__CSP_NONCE__': (_: Request, res: Response) => res.locals.cspNonce,
    '__INJECTED_CONFIG__': injectConfigString,
  }, {
    contentTypeFilterRegexp: /^text\/html/
  })
}