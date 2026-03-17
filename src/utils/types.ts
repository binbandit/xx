export interface TransformResult {
  code: string;
  map?: {
    mappings: string;
    names: string[];
    sources: (string | null)[];
    version: number;
    sourcesContent?: (string | null)[];
  };
}

export interface TsoxOptions {
  noCache?: boolean;
  tsconfigPath?: string;
}
