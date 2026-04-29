import { NextResponse } from "next/server";
import { z } from "zod";
import { runDebate } from "@/lib/debate-orchestrator";
import { getDebates, saveDebate } from "@/lib/memory-store";

const requestSchema = z
  .object({
    idea: z.string().min(3).optional(),
    title: z.string().min(3).optional(),
    description: z.string().min(10).optional(),
    context: z.string().optional(),
    previousRound: z
      .object({
        userResponse: z.string().min(3)
      })
      .optional()
  })
  .refine((v) => Boolean(v.idea || (v.title && v.description)), {
    message: "Provide either `idea`, or both `title` and `description`."
  });

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = requestSchema.parse(json);
    const normalized = {
      title: input.title ?? input.idea ?? "",
      description: input.description ?? input.idea ?? "",
      context: input.context,
      previousRound: input.previousRound
    };
    const result = await runDebate(normalized);
    saveDebate(result);

    return NextResponse.json({
      optimist: result.optimist.refined,
      skeptic: result.skeptic.refined,
      risk: result.risk.refined,
      moderator: result.moderator,
      verdict: result.verdict,
      full: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Debate failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ debates: getDebates(20) });
}
