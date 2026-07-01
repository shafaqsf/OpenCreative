import { NextRequest, NextResponse } from "next/server";
import { generateWorkflowFromPrompt } from "@/lib/ai/agents";

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
    return NextResponse.json(await generateWorkflowFromPrompt(prompt));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
