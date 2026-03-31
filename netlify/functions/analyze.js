<<<<<<< HEAD
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
=======
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

// ── Save one expense row to Notion ──────────────────────────────────────────
async function saveToNotion(item, notionKey, databaseId) {
  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: item.store || "Unknown" } }] },
      Date: { date: { start: item.date } },
      Store: { rich_text: [{ text: { content: item.store || "" } }] },
      Category: { select: { name: item.category_en || "Other" } },
      Amount: { number: parseFloat(item.amount) || 0 },
      Currency: { select: { name: item.currency || "JPY" } },
      Note: { rich_text: [{ text: { content: item.note_en || "" } }] },
    },
  };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Notion save error:", err);
    // Don't throw — saving to Notion is best-effort
  }
  return res.ok;
}

// ── Fetch all rows from Notion ──────────────────────────────────────────────
async function fetchFromNotion(notionKey, databaseId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ sorts: [{ property: "Date", direction: "descending" }], page_size: 200 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion fetch error: ${err}`);
  }

  const data = await res.json();

  return data.results.map((page) => {
    const p = page.properties;
    return {
      notion_id: page.id,
      date: p.Date?.date?.start || "",
      store: p.Store?.rich_text?.[0]?.text?.content || p.Name?.title?.[0]?.text?.content || "",
      category_en: p.Category?.select?.name || "Other",
      category_ja: categoryEnToJa(p.Category?.select?.name || "Other"),
      amount: p.Amount?.number || 0,
      currency: p.Currency?.select?.name || "JPY",
      note_en: p.Note?.rich_text?.[0]?.text?.content || "",
      note_ja: p.Note?.rich_text?.[0]?.text?.content || "",
    };
  });
}

// ── Delete a row from Notion (archive) ─────────────────────────────────────
async function deleteFromNotion(pageId, notionKey) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ archived: true }),
  });
  return res.ok;
}

const CAT_EN_TO_JA = {
  "Transportation": "交通費",
  "Accommodation": "宿泊費",
  "Meals": "飲食費",
  "Entertainment": "接待交際費",
  "Supplies": "消耗品費",
  "Communication": "通信費",
  "Meeting": "会議費",
  "Training & Books": "書籍・研修費",
  "Other": "その他",
};

function categoryEnToJa(en) {
  return CAT_EN_TO_JA[en] || "その他";
}

// ── Main handler ────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }) };
>>>>>>> 48c4b2b (updated)
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
<<<<<<< HEAD
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { imageBase64, mediaType, language } = body;

  if (!imageBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: "imageBase64 is required" }) };
  }

=======
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { action } = body;

  // ── Action: fetch saved rows from Notion ──
  if (action === "fetch") {
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify([]) };
    }
    try {
      const rows = await fetchFromNotion(NOTION_API_KEY, NOTION_DATABASE_ID);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(rows) };
    } catch (err) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── Action: delete a row from Notion ──
  if (action === "delete") {
    const { notion_id } = body;
    if (!NOTION_API_KEY || !notion_id) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
    }
    await deleteFromNotion(notion_id, NOTION_API_KEY);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  }

  // ── Action: analyze receipt image (default) ──
  const { imageBase64, mediaType } = body;
  if (!imageBase64) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "imageBase64 is required" }) };
  }

  const today = new Date().toISOString().slice(0, 10);
>>>>>>> 48c4b2b (updated)
  const prompt = `You are an expert at reading receipts and invoices from any country and language.

Analyze this receipt image carefully and extract ALL expense items.

Return a JSON array where each object has:
{
<<<<<<< HEAD
  "date": "YYYY-MM-DD (infer from receipt; use today ${new Date().toISOString().slice(0,10)} if not visible)",
  "store": "Store or vendor name (keep original language if clear)",
  "category_ja": "One of exactly: 交通費 / 宿泊費 / 飲食費 / 接待交際費 / 消耗品費 / 通信費 / 会議費 / 書籍・研修費 / その他",
  "category_en": "One of exactly: Transportation / Accommodation / Meals / Entertainment / Supplies / Communication / Meeting / Training & Books / Other",
  "amount": <number, total amount paid, no currency symbol>,
=======
  "date": "YYYY-MM-DD (infer from receipt; use today ${today} if not visible)",
  "store": "Store or vendor name (keep original script/language)",
  "category_ja": "One of exactly: 交通費 / 宿泊費 / 飲食費 / 接待交際費 / 消耗品費 / 通信費 / 会議費 / 書籍・研修費 / その他",
  "category_en": "One of exactly: Transportation / Accommodation / Meals / Entertainment / Supplies / Communication / Meeting / Training & Books / Other",
  "amount": <number, total amount paid, no currency symbol, no commas>,
  "currency": "ISO 4217 code detected from receipt symbol or context (e.g. JPY, USD, EUR, GBP, CNY, KRW, THB, SGD). Default JPY.",
>>>>>>> 48c4b2b (updated)
  "note_ja": "1〜2文で品目・内容を日本語で要約",
  "note_en": "1-2 sentence summary of items in English"
}

Rules:
<<<<<<< HEAD
- If the receipt has multiple distinct purchases, return multiple objects.
- For a single receipt with multiple line items, consolidate into ONE object with a summary note.
- amount must be a plain number (e.g. 1500 not "¥1,500").
- Detect currency from the receipt but store amount as a number only.
- Be precise about store names and dates.
- Return ONLY the raw JSON array. No markdown, no code fences, no explanation.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
=======
- Multiple distinct vendor receipts in one image → multiple objects.
- Single receipt with multiple line items → ONE consolidated object with summary note.
- amount: plain number only (e.g. 1500, not "¥1,500").
- Detect currency symbol (¥ ¥ $ € £ ₩ ฿ etc.) and map to ISO code.
- Return ONLY the raw JSON array. No markdown, no code fences, no extra text.`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
>>>>>>> 48c4b2b (updated)
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
<<<<<<< HEAD
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
=======
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return { statusCode: aiRes.status, headers: CORS_HEADERS, body: JSON.stringify({ error: `Anthropic error: ${errText}` }) };
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content.map((c) => c.text || "").join("");
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Save each row to Notion in parallel (best-effort)
    if (NOTION_API_KEY && NOTION_DATABASE_ID) {
      await Promise.allSettled(parsed.map(item => saveToNotion(item, NOTION_API_KEY, NOTION_DATABASE_ID)));
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(parsed) };

  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
>>>>>>> 48c4b2b (updated)
  }
};
