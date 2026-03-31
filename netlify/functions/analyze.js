exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not set in environment variables." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { imageBase64, mediaType, language } = body;

  if (!imageBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: "imageBase64 is required" }) };
  }

  const prompt = `You are an expert at reading receipts and invoices from any country and language.

Analyze this receipt image carefully and extract ALL expense items.

Return a JSON array where each object has:
{
  "date": "YYYY-MM-DD (infer from receipt; use today ${new Date().toISOString().slice(0,10)} if not visible)",
  "store": "Store or vendor name (keep original language if clear)",
  "category_ja": "One of exactly: 交通費 / 宿泊費 / 飲食費 / 接待交際費 / 消耗品費 / 通信費 / 会議費 / 書籍・研修費 / その他",
  "category_en": "One of exactly: Transportation / Accommodation / Meals / Entertainment / Supplies / Communication / Meeting / Training & Books / Other",
  "amount": <number, total amount paid, no currency symbol>,
  "note_ja": "1〜2文で品目・内容を日本語で要約",
  "note_en": "1-2 sentence summary of items in English"
}

Rules:
- If the receipt has multiple distinct purchases, return multiple objects.
- For a single receipt with multiple line items, consolidate into ONE object with a summary note.
- amount must be a plain number (e.g. 1500 not "¥1,500").
- Detect currency from the receipt but store amount as a number only.
- Be precise about store names and dates.
- Return ONLY the raw JSON array. No markdown, no code fences, no explanation.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Anthropic API error: ${errText}` }),
      };
    }

    const data = await response.json();
    const text = data.content.map((c) => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    // Validate it's parseable JSON
    JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: clean,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
