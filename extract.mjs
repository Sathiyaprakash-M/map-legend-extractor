// Netlify Function: netlify/functions/extract.mjs  (served at /api/extract)
// Set ANTHROPIC_API_KEY in Netlify > Site configuration > Environment variables.
// Optional: CLAUDE_MODEL, HOURLY_LIMIT.
const PROMPT='You read geological map legends. The attached image is a geological map, or part of one, showing a legend ("Reference", "Legend" or "Explanation"). '+
'Extract EVERY legend entry that has a coloured/patterned symbol box, in order top to bottom (and left to right if there are columns). '+
'Return ONLY a JSON array: no markdown, no commentary. Each item must be: '+
'{"age":"geologic age or group heading that applies, e.g. PLEISTOCENE? (empty string if none)",'+
'"unit":"formation or unit name beside a bracket, e.g. Wosera Beds (empty string if none)",'+
'"symbol":"map symbol written inside the box, e.g. Qa",'+
'"description":"the full description text exactly as printed, line breaks as spaces",'+
'"pattern":"two or three words on the fill, e.g. pale green, dots",'+
'"parent":"symbol of the larger unit whose box this one is drawn inside or stacked on, e.g. Tpn; empty string if it stands alone",'+
'"box":[x,y,w,h]}. '+
'"box" frames ONLY this unit’s own visible area: its own fill, its own symbol label and its border. Legends often nest or stack boxes (a big box with smaller boxes drawn inside or on top of it). For the big unit, frame only the part of its box that is not covered by the smaller boxes, and never include another unit’s symbol or label in any box. Use fractions between 0 and 1 of the full image width and height (x,y = top-left corner, w,h = size). '+
'Copy text exactly. Do not invent entries. Use "?" for unreadable text.';

const hits = new Map(); // best-effort per-IP limit (resets when the function restarts)
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const ip = (context && context.ip) || "unknown";
  const limit = Number(process.env.HOURLY_LIMIT || 20);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (recent.length >= limit) return json({ error: "Hourly limit reached. Try again later." }, 429);
  recent.push(now);
  hits.set(ip, recent);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const image = body && body.image;
  if (typeof image !== "string" || image.length < 100) return json({ error: "No image received." }, 400);
  if (image.length > 4.2e6) return json({ error: "Image too large. Select a smaller area." }, 413);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "Server is missing ANTHROPIC_API_KEY." }, 500);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
        max_tokens: 6000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: (j.error && j.error.message) || "Claude API error." }, 502);
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return json({ text });
  } catch (e) {
    return json({ error: "Could not reach Claude: " + e.message }, 502);
  }
};

export const config = { path: "/api/extract" };
