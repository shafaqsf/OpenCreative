type ProviderErrorInput = {
  provider: "OpenRouter";
  status?: number;
  body?: string;
  fallback?: string;
};

export function formatProviderErrorForUser(input: ProviderErrorInput) {
  const message = getProviderMessage(input.body);
  const normalized = `${input.status ?? ""} ${message ?? ""} ${input.body ?? ""}`.toLowerCase();

  if (input.status === 402 || normalized.includes("insufficient credits")) {
    return "OpenRouter needs more credits before generation can continue. Add credits in OpenRouter, then retry.";
  }

  if (input.status === 401 || input.status === 403) {
    return "OpenRouter rejected the request. Check the API key and model access, then retry.";
  }

  if (input.status === 429 || normalized.includes("rate limit")) {
    return "OpenRouter is rate limiting requests right now. Wait a moment, then retry.";
  }

  if (input.status && input.status >= 500) {
    return "OpenRouter is having trouble right now. Retry in a moment.";
  }

  if (message && !looksLikeRawPayload(message)) {
    return message;
  }

  return input.fallback ?? "Generation failed. Check the provider settings and retry.";
}

export function formatGenerationFailureForUser(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (!message) return "Generation failed. Retry in a moment.";

  const openRouterMatch = message.match(/^OpenRouter\s+(\d+):\s*([\s\S]*)$/);
  if (openRouterMatch) {
    return formatProviderErrorForUser({
      provider: "OpenRouter",
      status: Number.parseInt(openRouterMatch[1], 10),
      body: openRouterMatch[2],
    });
  }

  if (looksLikeRawPayload(message)) {
    return "Generation failed. Check the provider settings and retry.";
  }

  return message;
}

function getProviderMessage(body: string | undefined) {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
    const message = parsed.error?.message ?? parsed.message;
    return typeof message === "string" ? message : undefined;
  } catch {
    return undefined;
  }
}

function looksLikeRawPayload(message: string) {
  const trimmed = message.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.includes("\"error\"");
}
