import fs from "fs";
import path from "path";
import dotenv from "dotenv";

export function loadEnv(): void {
  // If OPENAI_API_KEY is already present, respect the existing environment.
  if (process.env.OPENAI_API_KEY) {
    return;
  }

  const cwd = process.cwd();

  const candidatePaths = [
    // 1) Current working directory (e.g. callcrew-backend/.env when running from backend)
    path.join(cwd, ".env"),
    // 2) Parent of cwd (e.g. repo root .env when cwd is callcrew-backend)
    path.join(cwd, "..", ".env"),
    // 3) Explicit callcrew-backend/.env based on this file's location
    path.join(__dirname, "..", "..", ".env"),
    // 4) Repo root .env based on this file's location
    path.join(__dirname, "..", "..", "..", ".env"),
  ];

  let loadedPath: string | null = null;

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate });
        loadedPath = candidate;
        break;
      }
    } catch {
      // Ignore filesystem errors and continue to next candidate.
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    const searched = candidatePaths.join(", ");
    const err: any = new Error("Missing OPENAI_API_KEY");
    err.code = "MISSING_OPENAI_API_KEY";
    err.locations = searched;
    throw err;
  }

  // Optional: MongoDB is used only for persistence; absence should not block simulations.
  if (!process.env.MONGODB_URI && !process.env.SIM_MONGODB_URI) {
    // Intentionally keep this quiet or minimal; simulator will log when persistence is skipped.
  }
}

