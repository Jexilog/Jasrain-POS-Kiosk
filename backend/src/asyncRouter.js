import express from 'express';

// Express 4 does not catch errors thrown inside async routes.
// This Router sends them to the error handler in server.js instead.
export function Router() {
  const router = express.Router();
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) =>
      original(path, ...handlers.map((h) => (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)));
  }
  return router;
}
