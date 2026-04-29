export type Verdict = "Likely to Fail" | "Needs Pivot" | "Promising with Conditions";

export type RiskLevel = "Low" | "Medium" | "High";

export interface DebateTurn {
  initial: string;
  critique: string;
  refined: string;
}

export interface DebateRequest {
  title: string;
  description: string;
  context?: string;
  previousRound?: {
    userResponse: string;
  };
}

export interface DebateContext {
  keywords: string[];
  likelyCompetitors: string[];
  failurePatterns: string[];
  marketSignals: string[];
}

export interface DebateResult {
  ideaName: string;
  context: DebateContext;
  optimist: DebateTurn;
  skeptic: DebateTurn;
  risk: DebateTurn;
  moderator: string;
  verdict: Verdict;
  scores: {
    optimist: number;
    skeptic: number;
    riskLevel: RiskLevel;
  };
  createdAt: string;
}
