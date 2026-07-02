"use server";

export async function runGeneration(params: {
  prompt: string;
  model: string;
  outputType: string;
  imageUrl?: string;
  duration?: string;
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
          params.duration && params.outputType === "video"
            ? `Target duration: ${params.duration} seconds.`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  };
  if (params.imageUrl && isSupportedImageInput(params.imageUrl)) {
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
    const foundUrl = findMediaUrl(json);
    if (foundUrl) return { url: foundUrl };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      console.error("OpenCreative generation response missing content", {
        model: params.model,
        outputType: params.outputType,
        response: json,
      });
      return { error: "No content in response" };
    }

    const urlMatch = stringifyContent(content).match(MEDIA_URL_RE);
    if (urlMatch) return { url: urlMatch[0] };

    console.error("OpenCreative generation response did not include a media URL", {
      model: params.model,
      outputType: params.outputType,
      response: json,
    });
    return { error: "No media URL found in model response" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    console.error("OpenCreative generation request failed", {
      model: params.model,
      outputType: params.outputType,
      error: message,
    });
    return { error: message };
  }
}

function isSupportedImageInput(url: string) {
  return /^https?:\/\//.test(url) || /^data:image\//.test(url);
}

function stringifyContent(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

const MEDIA_URL_RE = /(https?:\/\/[^\s<>"]+|data:(?:image|video)\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)/;

function findMediaUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.match(MEDIA_URL_RE)?.[0];
  }
  if (!value || typeof value !== "object") return undefined;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMediaUrl(item);
      if (found) return found;
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["url", "image_url", "video_url", "output_url", "asset_url", "images", "videos"]) {
    const found = findMediaUrl(record[key]);
    if (found) return found;
  }
  for (const child of Object.values(record)) {
    const found = findMediaUrl(child);
    if (found) return found;
  }
  return undefined;
}
