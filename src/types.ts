export interface Profile {
  baseURL?: string;
  model?: string;
  size?: string;
  quality?: string;
  outputFormat?: string;
  proxy?: string;
  timeoutSeconds?: number;
  retries?: number;
}

export interface AppConfig {
  defaultProfile?: string;
  profiles: Record<string, Profile>;
}

export interface SecretConfig {
  profiles: Record<string, { apiKey: string }>;
}

export interface CompressConfig {
  format?: string;
  background?: string;
  suffix?: string;
  recursive?: boolean;
}

export interface ProjectConfig {
  profile?: string;
  rawDir?: string;
  publishDir?: string;
  generation?: Profile;
  compress?: CompressConfig;
}

export interface PromptJob {
  out: string;
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  outputFormat?: string;
  n?: number;
}

export interface ResolvedGenerationOptions {
  profileName: string;
  baseURL: string;
  model: string;
  size: string;
  quality: string;
  outputFormat: string;
  proxy?: string;
  timeoutSeconds: number;
  retries: number;
  apiKey: string;
  rawDir: string;
  skipExisting: boolean;
  force: boolean;
}

export interface GeneratedImageResult {
  out: string;
  rawPath: string;
  status: "generated" | "skipped";
  durationMs: number;
}

export const DEFAULT_PROFILE: Required<Omit<Profile, "proxy">> = {
  baseURL: "https://api.openai.com/v1",
  model: "gpt-image-2",
  size: "1536x1024",
  quality: "medium",
  outputFormat: "png",
  timeoutSeconds: 360,
  retries: 2
};
