// MTL+QC Trip Concierge — tiny proxy so the Anthropic key never touches the client.
// Env: ANTHROPIC_API_KEY (required), MODEL (optional), TRIP_KEY (optional shared secret)
const http = require('http');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.MODEL || 'claude-sonnet-4-6';
const TRIP_KEY = process.env.TRIP_KEY || 'mtlqc';

const SYSTEM = `You are the trip concierge for Mike & Yulia's Montréal + Québec City trip, living inside their trip app. Be warm, brief, and concrete. Prefer short paragraphs. Use local knowledge; when unsure about current hours/availability, say so and suggest checking the venue link in the app.

TRIP FACTS (confirmed):
- Sun Jul 19 2026: AA 4550 LGA 8:19a → YUL 9:54a (conf NGQLCZ, seats 2F/2D). Airbnb check-in 4pm: "Authentic Vintage Apartment", 5579 Av du Parc, Mile End (host Sam; lockbox right of door below 5577 mailbox, code 4896; quiet after 11pm). Morning: stash bags (Bounce/LuggageHero). 3pm World Cup Final — Bruno Sport Bar (Little Italy, arrive ~1:30) or Café Club Social (5-min walk). Dinner options: Damas (upscale Syrian, Van Horne) or Le Majestique (oysters/natural wine, the Main). Nightcap: Le Rouge Gorge.
- Mon Jul 20: Mont Royal (Kondiaronk lookout), Jean-Talon Market lunch, Mauve (wine+flowers, Laurier E). Dinner options: Le Violon (#15 NA's 50 Best, Plateau), Leméac (French brasserie, Outremont), Le Plongeoir (natural-wine bar, Mile End), Joséphine (oysters, St-Denis). Jazz: Dièse Onze.
- Tue Jul 21: Old Montréal (Notre-Dame Basilica, Vieux-Port), MMFA or Atwater Market. Big dinner: Joe Beef (Little Burgundy — reserve!) or Lux La Lumière. Nightcap: Terrasse Nelligan or Upstairs Jazz; Atwater Cocktail Club is 5 min from Joe Beef.
- Wed Jul 22: checkout by 8am → VIA #22 8:36a Gare Centrale → Québec Gare du Palais 11:47a (Car 4, 3A/3B). Hotel: Le Manoir d'Auteuil, 49 Rue d'Auteuil, 2 nights (desk closes 10pm; itin 72076835922132). Afternoon: Château Frontenac/Terrasse Dufferin, Petit-Champlain. Dinner: Savini or Steak Avenue. Bars: Le Bijou, Vieux Carré.
- Thu Jul 23: full QC day — ramparts early, Plains of Abraham/Citadelle or Montmorency Falls (Île d'Orléans if car). Big dinner: Tanière³ (#9 NA's 50 Best — reserve!) or Chez Boulay.
- Fri Jul 24: Paillard breakfast, checkout 11a, VIA #37 12:32p → MTL 3:54p (Car 5, 6C/6D), taxi to YUL by ~5p, DL 5449 7:44p → LGA 9:20p (conf GXHKSM, 13C/13D). US pre-clearance at YUL.

Context: Mike loves wine, food, analytics; Yulia is a Russian citizen/US green-card holder (carries green card + passport). They're staying in Mile End. Currency CAD; tip 15–20%. If asked to replan (weather etc.), propose specific swaps from the lists above first, then fresh ideas. Today's date comes from the user message metadata.`;

function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Trip-Key',
    ...headers,
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, model: MODEL });

  if (req.method === 'POST' && req.url === '/chat') {
    if ((req.headers['x-trip-key'] || '') !== TRIP_KEY) return send(res, 401, { error: 'bad trip key' });
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 200000) req.destroy(); });
    req.on('end', async () => {
      try {
        const { messages = [], today = '' } = JSON.parse(raw || '{}');
        const clean = messages
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
        if (!clean.length || clean[clean.length - 1].role !== 'user') return send(res, 400, { error: 'need a user message' });

        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 700,
            system: SYSTEM + (today ? `\n\nRight now for the travelers it is: ${today}.` : ''),
            messages: clean,
          }),
        });
        const data = await r.json();
        if (!r.ok) return send(res, 502, { error: data?.error?.message || 'upstream error' });
        const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        send(res, 200, { reply: text });
      } catch (e) {
        send(res, 500, { error: 'server error' });
      }
    });
    return;
  }
  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log('concierge on :' + PORT));
