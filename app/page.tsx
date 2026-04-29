"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import { AlertCircle, Brain, ShieldAlert, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DebateResult } from "@/types/debate";

type DebateApiResponse = {
  optimist: string;
  skeptic: string;
  risk: string;
  moderator: string;
  verdict: string;
  full: DebateResult;
};

export default function Home() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [round2, setRound2] = useState("");
  const [result, setResult] = useState<DebateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const thinkingSteps = [
    "Extracting idea signals and market context",
    "Generating independent agent opening positions",
    "Running cross-critiques between agents",
    "Refining final agent stances",
    "Moderator scoring and verdict synthesis"
  ];

  useEffect(() => {
    if (!loading) {
      setThinkingStep(0);
      return;
    }
    const id = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % thinkingSteps.length);
    }, 900);
    return () => clearInterval(id);
  }, [loading, thinkingSteps.length]);

  const messages = useMemo(() => {
    if (!result) return [];
    return [
      { key: "optimist", label: "Optimist", tone: "🟢", icon: TrendingUp, text: result.optimist.refined, color: "text-emerald-300" },
      { key: "skeptic", label: "Skeptic", tone: "🔴", icon: AlertCircle, text: result.skeptic.refined, color: "text-rose-300" },
      { key: "risk", label: "Risk", tone: "⚠️", icon: ShieldAlert, text: result.risk.refined, color: "text-amber-300" },
      { key: "moderator", label: "Moderator", tone: "🧠", icon: Brain, text: result.moderator, color: "text-sky-300" }
    ];
  }, [result]);

  async function submitDebate(isRound2 = false) {
    if (!title || !description) return;
    setLoading(true);
    setError(null);
    setVisibleCount(0);
    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          context,
          previousRound: isRound2 && round2 ? { userResponse: round2 } : undefined
        })
      });
      const data = (await res.json()) as DebateApiResponse | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error((data as { error: string }).error || "Debate failed");
      }

      setResult(data.full);
      [1, 2, 3, 4].forEach((value, index) => {
        setTimeout(() => setVisibleCount(value), (index + 1) * 350);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function copyText() {
    if (!result) return;
    const res = await fetch("/api/share-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea: result.ideaName,
        optimist: result.optimist.refined,
        skeptic: result.skeptic.refined,
        risk: result.risk.refined,
        verdict: result.verdict
      })
    });
    const data = await res.json();
    await navigator.clipboard.writeText(data.text);
  }

  async function copyImage() {
    if (!shareRef.current) return;
    const png = await toPng(shareRef.current, { cacheBust: true, pixelRatio: 2 });
    const blob = await (await fetch(png)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-14">
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">KillMyIdea</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">Fast, sharp multi-agent decision debate.</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pitch Your Idea</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Idea title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Describe the idea" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Textarea
            placeholder="Optional market, audience, constraints"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="min-h-20"
          />
          <Button onClick={() => submitDebate(false)} disabled={loading || !title || !description}>
            {loading ? "Agents thinking..." : "Start Debate"}
          </Button>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <AnimatePresence>
          {messages.slice(0, visibleCount).map((m) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span>{m.tone}</span>
                      <Icon size={18} className={m.color} />
                      {m.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-slate-200">{m.text}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loading ? (
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 text-sm font-medium text-slate-200">Debate in progress</p>
              <div className="space-y-2">
                {thinkingSteps.map((step, index) => {
                  const active = index === thinkingStep;
                  const completed = index < thinkingStep;
                  return (
                    <p
                      key={step}
                      className={`text-xs ${
                        active ? "animate-pulse text-primary" : completed ? "text-emerald-300" : "text-muted-foreground"
                      }`}
                    >
                      {completed ? "✓" : active ? "•" : "○"} {step}
                    </p>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {result ? (
        <section className="mt-6 space-y-4">
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>Final Verdict</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <p>Idea: <strong>{result.ideaName}</strong></p>
              <p>Optimist Score: <strong>{result.scores.optimist}/10</strong></p>
              <p>Skeptic Score: <strong>{result.scores.skeptic}/10</strong></p>
              <p>Risk Level: <strong>{result.scores.riskLevel}</strong></p>
              <p className="md:col-span-2 text-base">Verdict: <strong className="text-primary">{result.verdict}</strong></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Round 2</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                className="min-h-20"
                placeholder="Respond to the agents, then trigger second round"
                value={round2}
                onChange={(e) => setRound2(e.target.value)}
              />
              <Button variant="outline" onClick={() => submitDebate(true)} disabled={loading || !round2.trim()}>
                Trigger Second Debate Round
              </Button>
            </CardContent>
          </Card>

          <div ref={shareRef} className="rounded-xl border border-border bg-[#0a1020] p-5">
            <p className="text-lg font-semibold">Idea: {result.ideaName}</p>
            <p className="mt-3 text-sm">🟢 Optimist: {result.optimist.refined}</p>
            <p className="mt-2 text-sm">🔴 Skeptic: {result.skeptic.refined}</p>
            <p className="mt-2 text-sm">⚠️ Risk: {result.risk.refined}</p>
            <p className="mt-4 text-base font-bold text-primary">Verdict: {result.verdict}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={copyImage}>Copy as Image</Button>
            <Button variant="outline" onClick={copyText}>Copy as Text</Button>
          </div>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-border/70 pt-5 text-xs text-muted-foreground">
        Built By{" "}
        <a className="text-sky-300 hover:text-sky-200" href="https://harishkotra.me" target="_blank" rel="noreferrer">
          Harish Kotra
        </a>{" "}
        + Checkout my other builds at{" "}
        <a className="text-sky-300 hover:text-sky-200" href="https://dailybuild.xyz" target="_blank" rel="noreferrer">
          dailybuild.xyz
        </a>
      </footer>
    </main>
  );
}
