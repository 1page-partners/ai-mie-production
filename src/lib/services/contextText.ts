import type { Memory, KnowledgeChunk } from "./context";

export function buildContextText(params: {
  memories: (Memory & { score?: number | null })[];
  chunks: (KnowledgeChunk & { score?: number | null; source_name?: string })[];
}) {
  const memoryLines = params.memories.map((m) => {
    const score = m.score ?? null;
    return `- (id:${m.id} score:${score ?? ""} pinned:${m.pinned} confidence:${m.confidence}) title:${m.title} / content:${m.content}`;
  });

  const knowledgeLines = params.chunks.map((c) => {
    const score = (c as any).score ?? null;
    const source = (c as any).source_name ?? "";
    const meta = c.meta ? JSON.stringify(c.meta) : "{}";
    return `- (chunk_id:${c.id} score:${score ?? ""} source:${source} meta:${meta}) content:${c.content}`;
  });

  return [
    "[CONTEXT]",
    "",
    "## MEMORY",
    ...(memoryLines.length ? memoryLines : ["- (none)"]),
    "",
    "## KNOWLEDGE",
    ...(knowledgeLines.length ? knowledgeLines : ["- (none)"]),
    "",
    "## RULES",
    "- 長期記憶と知識を根拠に回答する",
    "- 回答末尾に参照IDをJSONで必ず付与：",
    "  {\"memory_ids\":[...],\"knowledge_chunk_ids\":[...]}",
    "",
    "[/CONTEXT]",
  ].join("\n");
}
