import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  idea: z.string(),
  optimist: z.string(),
  skeptic: z.string(),
  risk: z.string(),
  verdict: z.string()
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const text = `Idea: ${input.idea}\n\n🟢 Optimist: ${input.optimist}\n🔴 Skeptic: ${input.skeptic}\n⚠️ Risk: ${input.risk}\n\nVerdict: ${input.verdict}`;
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
