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
      ...(item.paymentMethod ? { PaymentMethod: { select: { name: item.paymentMethod } } } : {}),
      ...(item.costCenter ? { CostCenter: { select: { name: item.costCenter } } } : {}),
      Remark: { rich_text: [{ text: { content: item.remark || "" } }] },
      ...(item.user ? { User: { rich_text: [{ text: { content: item.user } }] } } : {}),
      ...(item.no != null ? { No: { number: item.no } } : {}),
      Status: { select: { name: item.status || "Draft" } },
      ...(item.eur_amount != null ? { EURAmount: { number: item.eur_amount } } : {}),
      ...(item.receiptUrl ? { ReceiptURL: { url: item.receiptUrl } } : {}),
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
    return null;
  }
  const data = await res.json();
  return data.id;
}

// ── Fetch all rows from Notion ──────────────────────────────────────────────
async function fetchFromNotion(notionKey, databaseId, user) {
  const queryBody = {
    sorts: [{ property: "No", direction: "descending" }, { property: "Date", direction: "descending" }],
    page_size: 200,
    ...(user ? { filter: { property: "User", rich_text: { equals: user } } } : {}),
  };
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(queryBody),
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
      paymentMethod: p.PaymentMethod?.select?.name || "",
      costCenter: p.CostCenter?.select?.name || "",
      remark: p.Remark?.rich_text?.[0]?.text?.content || "",
      user: p.User?.rich_text?.[0]?.text?.content || "",
      no: p.No?.number ?? null,
      status: p.Status?.select?.name || "Draft",
      eur_amount: p.EURAmount?.number ?? null,
      receiptUrl: p.ReceiptURL?.url || null,
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

// ── Get current max No for a user from Notion ──────────────────────────────
async function getMaxNo(notionKey, databaseId, user) {
  if (!user) return 0;
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionKey}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: { property: "User", rich_text: { equals: user } },
        sorts: [{ property: "No", direction: "descending" }],
        page_size: 1,
      }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.results[0]?.properties?.No?.number ?? 0;
  } catch {
    return 0;
  }
}

// ── Fetch EUR conversion rates from Frankfurter API ─────────────────────────
async function getEURRates(items) {
  const pairs = [...new Set(
    items
      .filter(item => item.currency && item.currency !== "EUR" && item.date)
      .map(item => `${item.date}|${item.currency}`)
  )];
  const rates = {};
  await Promise.allSettled(pairs.map(async (pair) => {
    const [date, currency] = pair.split("|");
    try {
      const res = await fetch(`https://api.frankfurter.app/${date}?from=${currency}&to=EUR`);
      if (res.ok) {
        const data = await res.json();
        rates[pair] = data.rates?.EUR ?? null;
      }
    } catch {}
  }));
  return rates;
}

// ── Upload receipt to Supabase Storage ─────────────────────────────────────
async function uploadToSupabase(base64Data, mediaType, supabaseUrl, supabaseKey, user) {
  const extMap = { "application/pdf": "pdf", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };
  const ext = extMap[mediaType] || "jpg";
  const safeName = (user || "unknown").replace(/[^a-zA-Z0-9]/g, "_");
  const path = `${safeName}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(base64Data, "base64");

  const res = await fetch(`${supabaseUrl}/storage/v1/object/receipts/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": mediaType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Supabase upload error:", err);
    return null;
  }
  return `${supabaseUrl}/storage/v1/object/public/receipts/${path}`;
}

// ── Vercel handler ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const body = req.body;
  if (!body) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { action } = body;

  // ── Action: fetch saved rows from Notion ──
  if (action === "fetch") {
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
      return res.status(200).json([]);
    }
    try {
      const { user } = body;
      const rows = await fetchFromNotion(NOTION_API_KEY, NOTION_DATABASE_ID, user || null);
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Action: update No of rows in Notion ──
  if (action === "updateNo") {
    const { updates } = body; // [{ notion_id, no }, ...]
    if (!NOTION_API_KEY || !Array.isArray(updates)) {
      return res.status(200).json({ ok: true });
    }
    await Promise.allSettled(
      updates.map(({ notion_id, no }) =>
        fetch(`https://api.notion.com/v1/pages/${notion_id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${NOTION_API_KEY}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({ properties: { No: { number: no } } }),
        })
      )
    );
    return res.status(200).json({ ok: true });
  }

  // ── Action: update status of rows in Notion ──
  if (action === "updateStatus") {
    const { updates } = body; // [{ notion_id, status }, ...]
    if (!NOTION_API_KEY || !Array.isArray(updates)) {
      return res.status(200).json({ ok: true });
    }
    await Promise.allSettled(
      updates.map(({ notion_id, status }) =>
        fetch(`https://api.notion.com/v1/pages/${notion_id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${NOTION_API_KEY}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({ properties: { Status: { select: { name: status } } } }),
        })
      )
    );
    return res.status(200).json({ ok: true });
  }

  // ── Action: update all editable fields of a Notion row ──
  if (action === "updateRow") {
    const { notion_id, item } = body;
    if (!NOTION_API_KEY || !notion_id || !item) {
      return res.status(200).json({ ok: true });
    }
    const properties = {
      Name: { title: [{ text: { content: item.store || "Unknown" } }] },
      Date: { date: { start: item.date } },
      Store: { rich_text: [{ text: { content: item.store || "" } }] },
      Category: { select: { name: item.category_en || "Other" } },
      Amount: { number: parseFloat(item.amount) || 0 },
      Currency: { select: { name: item.currency || "JPY" } },
      Note: { rich_text: [{ text: { content: item.note_en || "" } }] },
      PaymentMethod: item.paymentMethod ? { select: { name: item.paymentMethod } } : { select: null },
      CostCenter: item.costCenter ? { select: { name: item.costCenter } } : { select: null },
      Remark: { rich_text: [{ text: { content: item.remark || "" } }] },
    };
    const patchRes = await fetch(`https://api.notion.com/v1/pages/${notion_id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ properties }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error("Notion updateRow error:", err);
      return res.status(500).json({ error: err });
    }
    return res.status(200).json({ ok: true });
  }

  // ── Action: fix empty Status → Draft (all users) ──
  if (action === "fixDraft") {
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
      return res.status(200).json({ fixed: 0 });
    }
    const pageIds = [];
    let cursor;
    do {
      const queryBody = {
        filter: { property: "Status", select: { is_empty: true } },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      };
      const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_API_KEY}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify(queryBody),
      });
      if (!r.ok) break;
      const data = await r.json();
      data.results.forEach(p => pageIds.push(p.id));
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    await Promise.allSettled(
      pageIds.map(id =>
        fetch(`https://api.notion.com/v1/pages/${id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${NOTION_API_KEY}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({ properties: { Status: { select: { name: "Draft" } } } }),
        })
      )
    );
    return res.status(200).json({ fixed: pageIds.length });
  }

  // ── Action: delete a row from Notion ──
  if (action === "delete") {
    const { notion_id } = body;
    if (!NOTION_API_KEY || !notion_id) {
      return res.status(200).json({ ok: true });
    }
    await deleteFromNotion(notion_id, NOTION_API_KEY);
    return res.status(200).json({ ok: true });
  }

  // ── Action: save a manually entered row to Notion ──
  if (action === "save") {
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
      return res.status(200).json({ notion_id: null, eur_amount: null });
    }
    const { item } = body;
    if (!item) return res.status(400).json({ error: "item is required" });

    let eur_amount = null;
    if (item.currency === "EUR") {
      eur_amount = Math.round((parseFloat(item.amount) || 0) * 100) / 100;
    } else if (item.date && item.currency) {
      try {
        const r = await fetch(`https://api.frankfurter.app/${item.date}?from=${item.currency}&to=EUR`);
        if (r.ok) {
          const d = await r.json();
          if (d.rates?.EUR != null) {
            eur_amount = Math.round(((parseFloat(item.amount) || 0) * d.rates.EUR) * 100) / 100;
          }
        }
      } catch {}
    }
    const notion_id = await saveToNotion({ ...item, eur_amount, receiptUrl: item.receiptUrl || null }, NOTION_API_KEY, NOTION_DATABASE_ID);
    return res.status(200).json({ notion_id, eur_amount });
  }

  // ── Action: analyze receipt image (default) ──
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  }

  const { imageBase64, mediaType, paymentMethod, costCenter, remark, user, noStart } = body;
  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 is required" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `You are an expert at reading receipts and invoices from any country and language.

Analyze this receipt image carefully and extract ALL expense items.

Return a JSON array where each object has:
{
  "date": "YYYY-MM-DD (infer from receipt; use today ${today} if not visible)",
  "store": "Store or vendor name (keep original script/language)",
  "category_ja": "One of exactly: 交通費 / 宿泊費 / 飲食費 / 接待交際費 / 消耗品費 / 通信費 / 会議費 / 書籍・研修費 / その他",
  "category_en": "One of exactly: Transportation / Accommodation / Meals / Entertainment / Supplies / Communication / Meeting / Training & Books / Other",
  "amount": <number, total amount paid, no currency symbol, no commas>,
  "currency": "ISO 4217 code detected from receipt symbol or context (e.g. JPY, USD, EUR, GBP, CNY, KRW, THB, SGD). Default JPY.",
  "note_ja": "1〜2文で品目・内容を日本語で要約",
  "note_en": "1-2 sentence summary of items in English"
}

Rules:
- Multiple distinct vendor receipts in one image → multiple objects.
- Single receipt with multiple line items → ONE consolidated object with summary note.
- amount: plain number only (e.g. 1500, not "¥1,500").
- Detect currency symbol (¥ ¥ $ € £ ₩ ฿ etc.) and map to ISO code.
- Return ONLY the raw JSON array. No markdown, no code fences, no extra text.`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            mediaType === "application/pdf"
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
              : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(aiRes.status).json({ error: `Anthropic error: ${errText}` });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content.map((c) => c.text || "").join("");
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Fetch EUR conversion rates for non-EUR items
    const eurRates = await getEURRates(parsed);
    const parsedWithEUR = parsed.map(item => {
      let eur_amount = null;
      if (item.currency === "EUR") {
        eur_amount = Math.round((parseFloat(item.amount) || 0) * 100) / 100;
      } else if (item.date && item.currency) {
        const rate = eurRates[`${item.date}|${item.currency}`];
        if (rate != null) {
          eur_amount = Math.round(((parseFloat(item.amount) || 0) * rate) * 100) / 100;
        }
      }
      return { ...item, eur_amount };
    });

    // Upload receipt to Supabase (best-effort)
    let receiptUrl = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      receiptUrl = await uploadToSupabase(imageBase64, mediaType || "image/jpeg", SUPABASE_URL, SUPABASE_SERVICE_KEY, user);
    }

    // Determine noStart from Notion (authoritative) to prevent duplicates
    let actualNoStart = null;
    if (NOTION_API_KEY && NOTION_DATABASE_ID && user) {
      const maxNo = await getMaxNo(NOTION_API_KEY, NOTION_DATABASE_ID, user);
      actualNoStart = maxNo + 1;
    }

    // Save each row to Notion in parallel (best-effort)
    if (NOTION_API_KEY && NOTION_DATABASE_ID) {
      await Promise.allSettled(parsedWithEUR.map((item, i) => saveToNotion({ ...item, paymentMethod: paymentMethod || '', costCenter: costCenter || '', remark: remark || '', user: user || '', no: actualNoStart != null ? actualNoStart + i : null, receiptUrl }, NOTION_API_KEY, NOTION_DATABASE_ID)));
    }

    return res.status(200).json(parsedWithEUR.map((item, i) => ({ ...item, paymentMethod: paymentMethod || '', costCenter: costCenter || '', remark: remark || '', user: user || '', no: actualNoStart != null ? actualNoStart + i : null, receiptUrl, noStart: actualNoStart })));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
