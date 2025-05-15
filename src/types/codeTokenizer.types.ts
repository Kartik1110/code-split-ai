export interface CodeToken {
  value: string;
  file: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  context?: string;
}

export interface CodeBlock {
  type: "function" | "route" | "import" | "class" | "interface" | "middleware";
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  path?: string;
  method?: string;
  file: string;
}

export interface TokenizedFile {
  filePath: string;
  tokens: CodeToken[];
  lineCount: number;
  functionLocations: {
    name: string;
    startLine: number;
    endLine: number;
    signature?: string;
  }[];
  routeDefinitions: {
    path: string;
    method: string;
    handlerName: string;
    lineNumber: number;
  }[];
  codeBlocks: CodeBlock[];
}

export interface CodebaseIndex {
  files: TokenizedFile[];
  componentMap: Record<string, string>;
  routeMap: Record<
    string,
    {
      method: string;
      path: string;
      handler: string;
      file: string;
      line: number;
    }
  >;
  blocksByType: Record<string, CodeBlock[]>;
}
