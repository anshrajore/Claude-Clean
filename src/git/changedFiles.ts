import { spawn } from "node:child_process";
import { AppError } from "../utils/types.js";

export async function gitChangedFiles(staged: boolean, cwd = process.cwd()): Promise<string[]> {
  await assertGitRepo(cwd);
  const args = staged
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    : ["diff", "HEAD", "--name-only", "--diff-filter=ACMR"];
  const output = await runGit(args, cwd);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function assertGitRepo(cwd: string): Promise<void> {
  try {
    const result = await runGit(["rev-parse", "--is-inside-work-tree"], cwd);
    if (result.trim() !== "true") {
      throw new AppError("GIT", "Not a git repository.");
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("GIT", "Not a git repository.");
  }
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new AppError("GIT_TIMEOUT", "git command timed out."));
    }, 10_000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new AppError("GIT", error.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new AppError("GIT", stderr.trim() || `git exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}
