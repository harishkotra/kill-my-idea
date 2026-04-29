import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { DebateContext, DebateRequest, DebateResult, DebateTurn, Verdict } from "@/types/debate";

const agentLineSchema = z.object({
  text: z
    .string()
    .min(10)
    .max(700)
});

const contextSchema = z.object({
  keywords: z.array(z.string()).min(3).max(8),
  likelyCompetitors: z.array(z.string()).min(2).max(6),
  failurePatterns: z.array(z.string()).min(2).max(6),
  marketSignals: z.array(z.string()).min(2).max(6)
});

const moderatorSchema = z.object({
  summary: z.string().min(20).max(900),
  verdict: z.enum(["Likely to Fail", "Needs Pivot", "Promising with Conditions"]),
  optimistScore: z.number().int().min(1).max(10),
  skepticScore: z.number().int().min(1).max(10),
  riskLevel: z.enum(["Low", "Medium", "High"]),
  actions: z.array(z.string().min(5).max(140)).min(1).max(2)
});

type AgentName = "Optimist" | "Skeptic" | "Risk Analyst";

type AgentState = Record<"optimist" | "skeptic" | "risk", DebateTurn>;

function llm() {
  const model = process.env.OPENAI_MODEL ?? process.env.GAIA_MODEL ?? "gpt-4o-mini";
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.GAIA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY or GAIA_API_KEY environment variable");
  }

  const baseURL = process.env.OPENAI_BASE_URL ?? process.env.GAIA_BASE_URL;

  return new ChatOpenAI({
    model,
    apiKey,
    configuration: baseURL ? { baseURL } : undefined,
    temperature: 0.4,
    timeout: 7500
  });
}

async function runJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const model = llm();
  const res = await model.invoke([
    {
      role: "system",
      content:
        "You are a precision debate engine. Return valid JSON only. Keep text sharp, punchy, 3-4 sentences max, no fluff."
    },
    { role: "user", content: prompt }
  ]);

  const content = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
  const raw = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  return schema.parse(JSON.parse(raw));
}

async function runAgentLine(prompt: string): Promise<{ text: string }> {
  const model = llm();
  const res = await model.invoke([
    {
      role: "system",
      content:
        "You are a precision debate engine. Return valid JSON with a single key `text`. Keep response 3-4 sentences, punchy and opinionated."
    },
    { role: "user", content: prompt }
  ]);

  const content = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
  const raw = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  try {
    return agentLineSchema.parse(JSON.parse(raw));
  } catch {
    if (raw) {
      return agentLineSchema.parse({ text: raw });
    }
    throw new Error("Model returned invalid response format");
  }
}

async function runStructuredWithRepair<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  try {
    return await runJson(prompt, schema);
  } catch {
    const model = llm();
    const repair = await model.invoke([
      {
        role: "system",
        content:
          "You repair malformed model output into valid JSON matching the required schema. Return JSON only with required fields present."
      },
      {
        role: "user",
        content: `Return valid JSON for this exact task:\n${prompt}`
      }
    ]);
    const repaired = typeof repair.content === "string" ? repair.content : JSON.stringify(repair.content);
    const cleaned = repaired.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    return schema.parse(JSON.parse(cleaned));
  }
}

async function buildContext(input: DebateRequest): Promise<DebateContext> {
  const prompt = `
Build reality context for this idea.
Title: ${input.title}
Description: ${input.description}
Context: ${input.context ?? "none"}

Output JSON with keys:
- keywords (3-8)
- likelyCompetitors (2-6 names or categories)
- failurePatterns (2-6 concrete patterns)
- marketSignals (2-6 brief signals/trends)
`;
  return runStructuredWithRepair(prompt, contextSchema);
}

function basePrompt(agent: AgentName, input: DebateRequest, context: DebateContext, previous?: string) {
  return `
Role: ${agent}
Idea title: ${input.title}
Idea description: ${input.description}
Optional context: ${input.context ?? "none"}
User follow-up for round 2: ${previous ?? "none"}

Reality context:
Keywords: ${context.keywords.join(", ")}
Likely competitors: ${context.likelyCompetitors.join(", ")}
Failure patterns: ${context.failurePatterns.join(", ")}
Market signals: ${context.marketSignals.join(", ")}

Style constraints:
- Max 3-4 sentences
- Opinionated and concise
- No hedging fluff
- Mention at least one reality-context point directly
`;
}

async function initialRound(agent: AgentName, promptBase: string) {
  const prompt = `${promptBase}\nTask: Write your INITIAL argument.`;
  return runAgentLine(prompt);
}

async function critiqueRound(agent: AgentName, promptBase: string, targets: string[]) {
  const prompt = `${promptBase}
Other agent statements to attack:
${targets.map((t, i) => `${i + 1}. ${t}`).join("\n")}
Task: Critique at least one statement above and expose a weak point.`;
  return runAgentLine(prompt);
}

async function refineRound(agent: AgentName, promptBase: string, critique: string) {
  const prompt = `${promptBase}
Critique received:
${critique}
Task: Refine your position after hearing attacks. Stay sharp.`;
  return runAgentLine(prompt);
}

async function runAgentDebate(input: DebateRequest, context: DebateContext): Promise<AgentState> {
  const optimistPrompt = basePrompt("Optimist", input, context, input.previousRound?.userResponse);
  const skepticPrompt = basePrompt("Skeptic", input, context, input.previousRound?.userResponse);
  const riskPrompt = basePrompt("Risk Analyst", input, context, input.previousRound?.userResponse);

  const [optimistInit, skepticInit, riskInit] = await Promise.all([
    initialRound("Optimist", optimistPrompt),
    initialRound("Skeptic", skepticPrompt),
    initialRound("Risk Analyst", riskPrompt)
  ]);

  const [optimistCritique, skepticCritique, riskCritique] = await Promise.all([
    critiqueRound("Optimist", optimistPrompt, [skepticInit.text, riskInit.text]),
    critiqueRound("Skeptic", skepticPrompt, [optimistInit.text, riskInit.text]),
    critiqueRound("Risk Analyst", riskPrompt, [optimistInit.text, skepticInit.text])
  ]);

  const [optimistRefined, skepticRefined, riskRefined] = await Promise.all([
    refineRound("Optimist", optimistPrompt, skepticCritique.text),
    refineRound("Skeptic", skepticPrompt, optimistCritique.text),
    refineRound("Risk Analyst", riskPrompt, skepticCritique.text)
  ]);

  return {
    optimist: {
      initial: optimistInit.text,
      critique: optimistCritique.text,
      refined: optimistRefined.text
    },
    skeptic: {
      initial: skepticInit.text,
      critique: skepticCritique.text,
      refined: skepticRefined.text
    },
    risk: {
      initial: riskInit.text,
      critique: riskCritique.text,
      refined: riskRefined.text
    }
  };
}

async function moderate(input: DebateRequest, context: DebateContext, agents: AgentState) {
  const prompt = `
You are Moderator Agent.
Idea: ${input.title}
Description: ${input.description}
Reality context: ${JSON.stringify(context)}

Optimist refined: ${agents.optimist.refined}
Skeptic refined: ${agents.skeptic.refined}
Risk refined: ${agents.risk.refined}

Output JSON with:
- summary: key disagreements + verdict + 1-2 actionable suggestions, max 4 sentences
- verdict: one of Likely to Fail | Needs Pivot | Promising with Conditions
- optimistScore: integer 1-10
- skepticScore: integer 1-10
- riskLevel: Low | Medium | High
- actions: 1-2 suggestions
`;

  return runStructuredWithRepair(prompt, moderatorSchema);
}

export async function runDebate(input: DebateRequest): Promise<DebateResult> {
  const context = await buildContext(input);
  const agents = await runAgentDebate(input, context);
  const mod = await moderate(input, context, agents);

  const moderator = `${mod.summary} Action: ${mod.actions.join(" | ")}`;

  return {
    ideaName: input.title,
    context,
    optimist: agents.optimist,
    skeptic: agents.skeptic,
    risk: agents.risk,
    moderator,
    verdict: mod.verdict as Verdict,
    scores: {
      optimist: mod.optimistScore,
      skeptic: mod.skepticScore,
      riskLevel: mod.riskLevel
    },
    createdAt: new Date().toISOString()
  };
}
