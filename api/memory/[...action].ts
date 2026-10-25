import type http from 'node:http'
import { handleHindsightApi } from '../../server/hindsightHandler.ts'

export default async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const handled = await handleHindsightApi(req, res, url.pathname)
  if (!handled && !res.writableEnded) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Endpoint not found', path: url.pathname }))
  }
}
