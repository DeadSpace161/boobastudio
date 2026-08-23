#!/usr/bin/env node

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = resolve(root, "logs/qwen-delegations.jsonl");
const args = process.argv.slice(2);
const labelIndex = args.indexOf("--label");
const label = labelIndex >= 0 ? args[labelIndex + 1] : "unspecified";
const maxTurns = 32;

function execWithInput(program, commandArgs, input) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(program, commandArgs, { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectCommand);
    child.on("close", (code) => {
      if (code === 0) resolveCommand({ stdout, stderr });
      else {
        const error = new Error(`${program} exited with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        rejectCommand(error);
      }
    });
    child.stdin.end(input);
  });
}

if (!label || label.startsWith("--")) {
  console.error("Usage: node scripts/qwen-delegate.mjs --label <short-task-name>");
  process.exit(2);
}

const task = await new Promise((resolveTask, rejectTask) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { value += chunk; });
  process.stdin.on("end", () => resolveTask(value.trim()));
  process.stdin.on("error", rejectTask);
});

if (!task) {
  console.error("Provide the task specification on standard input.");
  process.exit(2);
}

const system = [
  "You are the local implementation worker for BoobaStudio.",
  "Use the provided repository tools to inspect the code and implement the task.",
  "Make the smallest structure-preserving change and run relevant checks.",
  "You may edit only files inside the current repository.",
  "Never commit, push, publish releases, access credentials, or perform destructive operations.",
  "Never print or record secrets, API keys, passwords, or live provider responses.",
  "Do not stop after describing what you would inspect: use the tools and complete the task.",
  "At the end, report changed files, important decisions, and checks run."
].join(" ");

const tools = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List repository files. Use a relative path and optional glob pattern.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative directory, default ." },
          pattern: { type: "string", description: "Optional rg glob such as *.mjs or templates/**" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a text file inside the repository.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" },
          start_line: { type: "integer", minimum: 1 },
          end_line: { type: "integer", minimum: 1 }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_text",
      description: "Search repository text with rg. Do not search for secrets.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          path: { type: "string", description: "Optional relative path, default ." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description: "Inspect the current uncommitted diff and status.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "run_check",
      description: "Run a safe repository check. Allowed commands are npm scripts, node --check, and git diff --check.",
      parameters: {
        type: "object",
        required: ["command"],
        properties: { command: { type: "string" } }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "apply_patch",
      description: "Apply a standard unified git diff inside the repository after reviewing it.",
      parameters: {
        type: "object",
        required: ["patch"],
        properties: { patch: { type: "string" } }
      }
    }
  }
];

function safePath(input = ".") {
  const candidate = resolve(root, input);
  if (candidate !== root && !candidate.startsWith(`${root}/`)) {
    throw new Error("Path is outside the repository");
  }
  return candidate;
}

function cleanOutput(value, limit = 20000) {
  return String(value ?? "").slice(0, limit);
}

async function runTool(name, rawArgs) {
  const toolArgs = rawArgs ?? {};
  if (name === "list_files") {
    const path = safePath(toolArgs.path || ".");
    const relativePath = relative(root, path) || ".";
    const rgArgs = ["--files", "--hidden", "--glob", "!.git", "--glob", "!logs/**"];
    if (toolArgs.pattern) rgArgs.push("--glob", toolArgs.pattern);
    rgArgs.push(relativePath);
    try {
      const result = await execFileAsync("rg", rgArgs, { cwd: root, maxBuffer: 2_000_000 });
      return cleanOutput(result.stdout, 30000);
    } catch (error) {
      return cleanOutput(error.stdout || "No matching files.");
    }
  }
  if (name === "read_file") {
    const path = safePath(toolArgs.path);
    const content = await readFile(path, "utf8");
    const start = Math.max(1, Number(toolArgs.start_line || 1));
    const end = Math.max(start, Number(toolArgs.end_line || content.split("\n").length));
    return cleanOutput(content.split("\n").slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join("\n"), 120000);
  }
  if (name === "search_text") {
    const path = safePath(toolArgs.path || ".");
    const relativePath = relative(root, path) || ".";
    try {
      const result = await execFileAsync("rg", ["-n", "--hidden", "--glob", "!.git", "--glob", "!logs/**", toolArgs.query, relativePath], { cwd: root, maxBuffer: 2_000_000 });
      return cleanOutput(result.stdout, 30000);
    } catch (error) {
      return cleanOutput(error.stdout || "No matches.");
    }
  }
  if (name === "git_diff") {
    const result = await execFileAsync("git", ["status", "--short"], { cwd: root });
    const diff = await execFileAsync("git", ["diff", "--", "."], { cwd: root, maxBuffer: 4_000_000 });
    return cleanOutput(`${result.stdout}\n${diff.stdout}`, 60000);
  }
  if (name === "run_check") {
    const command = String(toolArgs.command || "");
    if (!(command === "git diff --check" || command.startsWith("npm run ") || command.startsWith("node --check "))) {
      throw new Error("Command is not in the safe check allowlist");
    }
    const [program, ...commandArgs] = command.split(/\s+/);
    const result = await execFileAsync(program, commandArgs, { cwd: root, maxBuffer: 2_000_000 });
    return cleanOutput(`${result.stdout}${result.stderr || ""}`, 30000);
  }
  if (name === "apply_patch") {
    const patch = String(toolArgs.patch || "");
    if (!patch.includes("diff --git a/") || patch.includes("/etc/") || patch.includes("/home/") || patch.includes(".env")) {
      throw new Error("Patch must be a repository-relative standard unified git diff");
    }
    await execWithInput("git", ["apply", "--check", "--whitespace=nowarn", "-"], patch);
    await execWithInput("git", ["apply", "--whitespace=nowarn", "-"], patch);
    return "Patch applied successfully. Inspect the diff and run checks.";
  }
  throw new Error(`Unknown tool: ${name}`);
}

const startedAt = new Date().toISOString();
await mkdir(dirname(auditPath), { recursive: true });
await appendFile(auditPath, `${JSON.stringify({ startedAt, label, model: "qwen3.8:27b", status: "started", mode: "tool-agent" })}\n`);

const messages = [
  { role: "system", content: system },
  { role: "user", content: task }
];
let finalText = "";
let exitCode = 0;

try {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "qwen3.8:27b", messages, tools, stream: false, think: false, options: { temperature: 0.2 } })
    });
    if (!response.ok) throw new Error(`Ollama API returned HTTP ${response.status}`);
    const body = await response.json();
    const message = body.message || {};
    messages.push(message);
    if (!message.tool_calls?.length) {
      finalText = message.content || "Qwen completed without a final report.";
      break;
    }
    for (const call of message.tool_calls) {
      const name = call.function?.name;
      const rawArgs = call.function?.arguments || {};
      let result;
      try {
        result = await runTool(name, rawArgs);
      } catch (error) {
        result = `Tool error: ${error.message}`;
        exitCode = 1;
      }
      messages.push({ role: "tool", tool_name: name, content: cleanOutput(result, 60000) });
    }
  }
  if (!finalText) finalText = "Qwen reached the delegation turn limit.";
  console.log(finalText);
} catch (error) {
  exitCode = 1;
  console.error(`Qwen delegation failed: ${error.message}`);
} finally {
  await appendFile(auditPath, `${JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), label, model: "qwen3.8:27b", status: exitCode === 0 ? "completed" : "failed", exitCode, mode: "tool-agent" })}\n`);
}

process.exit(exitCode);
