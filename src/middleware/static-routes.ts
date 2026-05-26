import express, {Request, Response} from "express";
import {stringReplace} from "string-replace-middleware";
import path from "path";
import {BffConfig} from "../config.js";
import {injectConfig} from "./inject-config.js";

export function staticRoutes(config: BffConfig) {
  const router = express.Router()
  router.use(injectConfig(config))
  const staticPath = path.resolve(process.cwd(), config.staticRootPath)
  console.log(`Serving static content from '${staticPath}'`)
  router.use(express.static(staticPath, {index: false}))
  router.get('*', function (_: Request, res: Response) {
    res.set('Cache-Control', 'no-store')
    res.sendFile(path.resolve(staticPath, 'index.html'), {etag: false})
  })

  return router
}