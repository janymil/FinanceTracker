# Using Graphify as the codebase map (token-saving rule)

A pre-built knowledge graph of this repo exists in `graphify-out/` (graphify 0.9.94,
built at commit `f107979a`): 2920 nodes, 8275 edges, 137 named communities.

## Order of operations

1. **Before grepping or walking directories**, read `graphify-out/GRAPH_REPORT.md`
   (~31 KB, ~8 K tokens) to get communities, hubs and known gaps.
2. For "where is X / how does X work / what talks to Y", query the graph instead of
   searching files:
   ```bash
   graphify query "<question>"            # BFS over graph.json
   graphify explain "<Symbol>" --all      # node + every edge + source line
   graphify path "<A>" "<B>"              # shortest path between two concepts
   graphify god-nodes                     # architectural hubs
   graphify affected "<Symbol>"           # reverse impact analysis
   ```
   Run these from the repo root. If the answer is truncated, re-run with the
   `--budget <N>` value the tool prints (default ~2000 tokens per query).
3. Every node carries `[src=... loc=L<n>]`. Read **only** those files/lines with
   `read_files` (use `start_line`/`end_line`). Do not re-read whole folders.
4. `graphify-out/kaptia-callflow.html` holds the call-flow map (16 Mermaid diagrams);
   `graphify-out/graph.json` is the machine-readable graph.

## Keeping it fresh

- After changing code: `graphify update .` — local AST only, **no API cost**.
- If `graphify-out/` is missing: `graphify extract . --code-only` (free, no LLM).
- Do not run the paid semantic pass (`graphify extract . --backend deepseek`) unless
  docs/PDFs must be re-indexed; it costs ~$0.14 per full run on this repo.

## Known limits (do not trust the graph blindly)

- HTTP routes and API endpoints are **not** graph nodes. Route inventory:
  `client/src/App.tsx` (60 `<Route>` entries, `/:lang/...`). API inventory:
  `server/routes/*.ts` (117 unique `/api/...` paths).
- ~1 % of edges are `INFERRED` (model-resolved, avg confidence 0.82) — confirm in
  source at the node's `loc` before relying on them.
- The graph is code + human-written docs only; `.graphifyignore` excludes
  `attached_assets/`, images and PDFs on purpose.
