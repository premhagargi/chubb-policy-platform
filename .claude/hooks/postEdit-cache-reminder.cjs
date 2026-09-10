#!/usr/bin/env node
// PostToolUse hook: non-blocking reminder when application/infrastructure files
// change, since a mutation that skips cache invalidation serves stale reads for
// the whole TTL. Runs identically under PowerShell or the Bash tool (Node, not sh).

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let filePath = "";
  try {
    const input = JSON.parse(raw || "{}");
    filePath = input.tool_input?.file_path || "";
  } catch {
    process.exit(0);
  }

  const normalized = filePath.replace(/\\/g, "/");
  const isRelevant =
    /backend\/app\/(infrastructure|application)\//.test(normalized);

  if (isRelevant) {
    console.error(
      `[cache-reminder] ${normalized} touched a layer that reads/writes data.\n` +
        "If this added or changed a mutation, confirm it invalidates the cache " +
        "via CacheInvalidatingPolicyCommandService (see CLAUDE.md > Caching)."
    );
  }
  process.exit(0);
});
