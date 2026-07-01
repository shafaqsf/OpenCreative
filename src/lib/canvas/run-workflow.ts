"use server";

export async function runGeneration(params: {
  prompt: string;
  model: string;
  outputType: string;
  imageUrl?: string;
}): Promise<{ url?: string; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { error: "OPENROUTER_API_KEY not configured" };

  const messages: { role: "user"; content: unknown[] } = {
    role: "user",
    content: [
      {
        type: "text",
        text: [
          params.prompt,
          `Create a ${params.outputType} output.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  };
  if (params.imageUrl) {
    messages.content.push({ type: "image_url", image_url: { url: params.imageUrl } });
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
        model: params.model,
        messages: [messages],
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `OpenRouter ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return { error: "No content in response" };

    const urlMatch = content.match(/https?:\/\/[^\s<>"]+/);
    if (urlMatch) return { url: urlMatch[0] };

    return { error: "No URL found in response" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Request failed" };
  }
}
