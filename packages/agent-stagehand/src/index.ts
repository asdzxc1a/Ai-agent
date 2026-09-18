import {
  Stagehand,
  type LLMClient
} from "@browserbasehq/stagehand";

export interface CreateStagehandForSteelOptions {
  cdpUrl: string;
  llmClient: LLMClient;
}

export function createStagehandForSteel({
  cdpUrl,
  llmClient
}: CreateStagehandForSteelOptions): Stagehand {
  return new Stagehand({
    env: "LOCAL",
    llmClient,
    localBrowserLaunchOptions: {
      cdpUrl
    },
    keepAlive: true,
    selfHeal: false,
    verbose: 0,
    disablePino: true
  });
}
