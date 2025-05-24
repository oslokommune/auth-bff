import express from "express";
import {stringReplace} from "string-replace-middleware";
import path from "path";

export function staticRoutes(config) {
  const router = new express.Router()

  router.use(stringReplace({
    '__CSP_NONCE__': (req, res) => res.locals.cspNonce
  }, {
    contentTypeFilterRegexp: /^text\/html/
  }))
  const staticPath = path.resolve(process.cwd(), config.staticRootPath)
  console.log(`Serving static content from '${staticPath}'`)
  router.use(express.static(staticPath, {index: false}))
  router.get('*', function (req, res) {
    res.set('Cache-Control', 'no-store')
    res.sendFile(path.resolve(staticPath, 'index.html'))
  })

  return router
}