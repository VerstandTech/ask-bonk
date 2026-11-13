// Given the composite action, require the supported Bun setup before any
// orchestration runs. This reads configuration only; it never runs Bonk.
const action = Bun.YAML.parse(await Bun.file("github/action.yml").text()) as {
  runs: { steps: { uses?: string; with?: Record<string, string>; name?: string }[] };
};
const setup = action.runs.steps.findIndex((step) => step.uses?.startsWith("oven-sh/setup-bun@"));
const orchestration = action.runs.steps.findIndex((step) => step.name === "Pre-flight orchestration");
if (setup < 0 || orchestration <= setup) {
  throw new Error("Bun setup must precede orchestration");
}
if (action.runs.steps[setup].with?.["bun-version"] !== "1.4.4") {
  throw new Error("The composite action must install Bun 1.4.4");
}

// The sandbox base embeds EOL Node 20. Require explicit patched runtime
// overlays instead of assuming a Bun action pin also patches the container.
const dockerfile = await Bun.file("Dockerfile").text();
for (const required of [
  "FROM node:22.23.5-bookworm-slim AS patched-node",
  "FROM oven/bun:1.4.4-debian AS patched-bun",
  "COPY --from=patched-node /usr/local/bin/node /usr/local/bin/node",
  "COPY --from=patched-node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm",
  "COPY --from=patched-bun /usr/local/bin/bun /usr/local/bin/bun",
]) {
  if (!dockerfile.includes(required)) throw new Error(`Missing patched sandbox runtime: ${required}`);
}

const workflow = await Bun.file(".github/workflows/runtime-validation.yml").text();
if (!workflow.includes("docker run --rm --entrypoint sh runtime-validation")) {
  throw new Error("Runtime check must override the sandbox entrypoint");
}
