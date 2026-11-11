'use strict';
const L = require('./_lib');

/* Public, read-only site settings: taglines, copy overrides, links, banner. No secrets in here. */
module.exports = async (req, res) => {
  if (req.method !== 'GET') return L.send(res, 405, { error: 'method_not_allowed' });
  if (!L.storeKind()) return L.send(res, 200, {}, { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=30' });
  try {
    const pub = await L.getPublic();
    return L.send(res, 200, pub, { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=15, stale-while-revalidate=60' });
  } catch (e) { return L.send(res, 200, {}, { 'Cache-Control': 'no-store' }); }
};
