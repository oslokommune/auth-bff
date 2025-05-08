import express from "express";
import {stringReplace} from "string-replace-middleware";
import path from "path";
import {config} from "../config.mjs";

export function staticRoutes() {
  const router = new express.Router()

  router.use(stringReplace({
    '__CSP_NONCE__': (req, res) => res.locals.cspNonce
  }, {
    contentTypeFilterRegexp: /^text\/html/
  }))
  const staticPath = path.resolve(import.meta.dirname, config.staticRootPath)
  router.use(express.static(staticPath, {index: false}))
  router.get('*', function (req, res) {
    res.set('Cache-Control', 'no-store')
    res.sendFile(path.resolve(import.meta.dirname, config.staticRootPath, 'index.html'))
  })

  return router
}