
import type { CSSProperties } from "react";

type FontConfig = { variable?: string } & Record<string, unknown>;

type MockFont = {
  variable: string;
  className: string;
  style: CSSProperties;
};

// Returns a mock object that satisfies the font interface
const mockFont = (config?: FontConfig): MockFont => {
  const variable = config?.variable || "--font-mock";
  return {
    variable: variable,
    className: `font-mock`,
    style: { fontFamily: "inherit" }
  };
};

export const Inter = (config?: FontConfig) => mockFont(config);
export const JetBrains_Mono = (config?: FontConfig) => mockFont(config);
export const IBM_Plex_Serif = (config?: FontConfig) => mockFont(config);
