import Constants from "expo-constants";

// Where the app finds apps/web's API. EXPO_PUBLIC_API_URL (in
// apps/mobile/.env.local) wins; otherwise, in development, assume the
// Next dev server runs on port 3000 of the same machine that's serving
// this bundle — Expo Go already knows that machine's LAN address.
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:3000`;
  throw new Error("Set EXPO_PUBLIC_API_URL to the LeanAcademy web server's address.");
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  { token, method = "GET", body }: { token?: string | null; method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}.`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

// Response shapes of apps/web's routes (src/app/api/mobile/*,
// src/app/api/training-sessions/*).

export interface MobileUser {
  id?: string;
  email: string | null;
  name: string | null;
  locale: string | null;
}

export interface LoginResponse {
  token: string;
  user: MobileUser;
}

export interface HomeData {
  user: MobileUser;
  onboarded: boolean;
  streak: {
    currentStreakDays: number;
    longestStreakDays: number;
    trainedToday: boolean;
  } | null;
  trainingLevel: { totalXp: number; level: number; xpIntoLevel: number; xpForNextLevel: number };
  nBack: { currentDifficulty: number; scoredTrials: number } | null;
}

/** Same wire shape as apps/web/src/lib/session-types.ts's TrialInput. */
export interface TrialInput {
  correct: boolean;
  reactionTimeMs?: number;
  stimulusStartedAtMs: number;
  respondedAtMs?: number;
  wasInterrupted: boolean;
  difficultyAtTrial: number;
  metadata?: Record<string, unknown>;
}

export interface ExerciseOutcome {
  method: string;
  startDifficulty: number;
  endDifficulty: number;
  trials: TrialInput[];
}
