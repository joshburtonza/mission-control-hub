// Vercel serverless function — email open tracking pixel
// GET /api/track-open?id=<outreach_log_id>
// Returns a 1x1 transparent GIF and logs the open to Supabase.

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  // Always return the pixel immediately — don't block on DB write
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(PIXEL);

  const id = req.query?.id;
  if (!id || !SUPABASE_URL || !SERVICE_KEY) return;

  try {
    // Increment open_count and set opened_at on first open
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_email_open`, {
      method: 'POST',
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ log_id: id }),
    });
  } catch (_) {
    // Silently swallow — pixel already sent
  }
}
