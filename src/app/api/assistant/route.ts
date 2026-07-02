import { NextRequest, NextResponse } from "next/server";
import { generateWorkflowFromPrompt, runOpenCreativeAgent } from "@/lib/ai/agents";
import type { AgentAppState } from "@/types/agent";

function isAgentAppState(value: unknown): value is AgentAppState {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.projectName === "string" &&
    typeof obj.workflow === "object" &&
    obj.workflow !== null &&
    Array.isArray((obj.workflow as Record<string, unknown>).elements) &&
    Array.isArray((obj.workflow as Record<string, unknown>).connections) &&
    Array.isArray(obj.selectedIds) &&
    typeof obj.activeTool === "string"
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, messages, appState } = body;
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  try {
    if (isAgentAppState(appState)) {
      return NextResponse.json(
        await runOpenCreativeAgent({
          input: prompt,
          messages: Array.isArray(messages) ? messages : [],
          appState,
        })
      );
    }
    return NextResponse.json(await generateWorkflowFromPrompt(prompt));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
