import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an AI workflow assistant for OpenCreative, a canvas-based AI workflow builder.
Given a user request, output a JSON object with this exact shape:
{
  "nodes": [
    { "type": "prompt|source|generate|output", "x": number, "y": number, "properties": {} }
  ],
  "connections": [
    { "from": 0, "to": 1 }
  ]
}

Rules:
- Use 0-based indices in connections that reference the nodes array.
- Node types: "prompt" (text input), "source" (image/video URL), "generate" (AI generation), "output" (result preview).
- For "prompt" properties: { "content": "..." }
- For "source" properties: { "url": "", "fileType": "image" }
- For "generate" properties: { "prompt": "...", "model": "kwaivgi/kling-v3.0-pro", "duration": "5", "count": "1" }
- For "output" properties: { "outputIndex": "0" }
- Available models: "kwaivgi/kling-v3.0-pro", "kwaivgi/kling-v3.0-std", "bytedance/seedance-2.0-fast", "bytedance/seedance-2.0", "minimax/hailuo-2.3"
- Layout nodes left-to-right with roughly 240px horizontal spacing and 80px vertical spacing. Start around x=100, y=100.
- Only output valid JSON. No markdown, no explanation.
`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
  }

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "OpenCreative",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `OpenRouter ${res.status}: ${text.slice(0, 200)}` }, { status: 500 });
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "No content in response" }, { status: 500 });
    }

    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
