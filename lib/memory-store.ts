import { DebateResult } from "@/types/debate";

const debateMemory: DebateResult[] = [];

export function saveDebate(debate: DebateResult) {
  debateMemory.unshift(debate);
  if (debateMemory.length > 50) {
    debateMemory.pop();
  }
}

export function getDebates(limit = 10) {
  return debateMemory.slice(0, limit);
}
