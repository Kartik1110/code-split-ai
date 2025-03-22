import fs from "fs";
import path from "path";
import * as globModule from "glob";

// Simple file finder utility
function findFilesRecursively(
  dir: string,
  pattern: RegExp,
  ignorePattern: RegExp
): string[] {
  const results: string[] = [];

  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (ignorePattern.test(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  scan(dir);
  return results;
}

interface CodeToken {
  value: string;
  file: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  context?: string;
}

interface CodeBlock {
  type: "function" | "route" | "import" | "class" | "interface" | "middleware";
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  path?: string;
  method?: string;
  file: string;
}

interface TokenizedFile {
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

interface CodebaseIndex {
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

/**
 * Tokenizes a single file with metadata
 */
function tokenizeFile(filePath: string): TokenizedFile {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const tokens: CodeToken[] = [];
  const functionLocations = [];
  const routeDefinitions = [];
  const codeBlocks: CodeBlock[] = [];

  // Regex patterns for detecting different code structures
  const functionRegex =
    /function\s+(\w+)\s*\(([^)]*)\)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
  const routeRegex =
    /app\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
  const importRegex = /import\s+.+\s+from\s+['"](.+)['"]/g;
  const classRegex = /class\s+(\w+)/g;
  const interfaceRegex = /interface\s+(\w+)/g;
  const middlewareRegex = /app\.use\(([^)]+)\)/g;

  // Track blocks by finding start and end of scopes
  function findBlockEnd(startLineIdx: number): number {
    let braceCount = 0;
    let foundOpening = false;

    for (let i = startLineIdx; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === "{") {
          foundOpening = true;
          braceCount++;
        } else if (char === "}") {
          braceCount--;
        }

        if (foundOpening && braceCount === 0) {
          return i;
        }
      }
    }

    return startLineIdx; // If we can't find the end, just return the start line
  }

  // Track token position in each line for detailed source mapping
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let colPos = 0;

    // Store line content for context
    const lineContent = line.trim();

    // Function detection
    let funcMatch;
    while ((funcMatch = functionRegex.exec(line)) !== null) {
      const funcName = funcMatch[1] || funcMatch[3]; // Get function name from different capture groups
      const endLineIdx = findBlockEnd(lineIdx);

      // Extract the full function content
      const blockContent = lines.slice(lineIdx, endLineIdx + 1).join("\n");

      functionLocations.push({
        name: funcName,
        startLine: lineIdx + 1,
        endLine: endLineIdx + 1,
        signature: funcMatch[2] || "",
      });

      codeBlocks.push({
        type: "function",
        name: funcName,
        startLine: lineIdx + 1,
        endLine: endLineIdx + 1,
        content: blockContent,
        file: filePath,
      });
    }

    // Route detection
    let routeMatch;
    while ((routeMatch = routeRegex.exec(line)) !== null) {
      const method = routeMatch[1];
      const path = routeMatch[2];
      const endLineIdx = findBlockEnd(lineIdx);

      // Extract the full route handler content
      const blockContent = lines.slice(lineIdx, endLineIdx + 1).join("\n");

      routeDefinitions.push({
        method,
        path,
        handlerName: "handler", // This is simplified
        lineNumber: lineIdx + 1,
      });

      codeBlocks.push({
        type: "route",
        name: `${method} ${path}`,
        startLine: lineIdx + 1,
        endLine: endLineIdx + 1,
        content: blockContent,
        method,
        path,
        file: filePath,
      });
    }

    // Import detection
    let importMatch;
    while ((importMatch = importRegex.exec(line)) !== null) {
      codeBlocks.push({
        type: "import",
        name: importMatch[1],
        startLine: lineIdx + 1,
        endLine: lineIdx + 1,
        content: line,
        file: filePath,
      });
    }

    // Class detection
    let classMatch;
    while ((classMatch = classRegex.exec(line)) !== null) {
      const className = classMatch[1];
      const endLineIdx = findBlockEnd(lineIdx);

      // Extract the full class content
      const blockContent = lines.slice(lineIdx, endLineIdx + 1).join("\n");

      codeBlocks.push({
        type: "class",
        name: className,
        startLine: lineIdx + 1,
        endLine: endLineIdx + 1,
        content: blockContent,
        file: filePath,
      });
    }

    // Interface detection
    let interfaceMatch;
    while ((interfaceMatch = interfaceRegex.exec(line)) !== null) {
      const interfaceName = interfaceMatch[1];
      const endLineIdx = findBlockEnd(lineIdx);

      // Extract the full interface content
      const blockContent = lines.slice(lineIdx, endLineIdx + 1).join("\n");

      codeBlocks.push({
        type: "interface",
        name: interfaceName,
        startLine: lineIdx + 1,
        endLine: endLineIdx + 1,
        content: blockContent,
        file: filePath,
      });
    }

    // Middleware detection
    let middlewareMatch;
    while ((middlewareMatch = middlewareRegex.exec(line)) !== null) {
      codeBlocks.push({
        type: "middleware",
        name: middlewareMatch[1].trim(),
        startLine: lineIdx + 1,
        endLine: lineIdx + 1,
        content: line,
        file: filePath,
      });
    }

    // Tokenize the line
    const words = line
      .split(/(\s+|\b|[;:,.(){}[\]<>+=\-*/%&|^!~?])/g)
      .filter(Boolean);

    for (const word of words) {
      const columnStart = colPos;
      const columnEnd = colPos + word.length;

      tokens.push({
        value: word,
        file: filePath,
        lineNumber: lineIdx + 1,
        columnStart,
        columnEnd,
        context: lineContent,
      });

      colPos += word.length;
    }

    // Add a newline token
    tokens.push({
      value: "\n",
      file: filePath,
      lineNumber: lineIdx + 1,
      columnStart: colPos,
      columnEnd: colPos + 1,
      context: lineContent,
    });
  }

  return {
    filePath,
    tokens,
    lineCount: lines.length,
    functionLocations,
    routeDefinitions,
    codeBlocks,
  };
}

/**
 * Creates an index of the entire codebase
 */
function indexCodebase(rootDir: string): CodebaseIndex {
  // Find all code files, ignoring node_modules
  const files = findFilesRecursively(
    rootDir,
    /\.(js|ts|jsx|tsx)$/,
    /node_modules|\.git/
  );

  const tokenizedFiles: TokenizedFile[] = [];
  const componentMap: Record<string, string> = {};
  const routeMap: Record<string, any> = {};
  const blocksByType: Record<string, CodeBlock[]> = {
    function: [],
    route: [],
    import: [],
    class: [],
    interface: [],
    middleware: [],
  };

  for (const file of files) {
    const tokenizedFile = tokenizeFile(file);
    tokenizedFiles.push(tokenizedFile);

    // Extract components (simplified heuristic)
    if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
      const filename = path.basename(file, path.extname(file));
      componentMap[filename] = file;
    }

    // Build route map
    for (const route of tokenizedFile.routeDefinitions) {
      routeMap[route.path] = {
        method: route.method,
        path: route.path,
        handler: route.handlerName,
        file: tokenizedFile.filePath,
        line: route.lineNumber,
      };
    }

    // Organize code blocks by type
    for (const block of tokenizedFile.codeBlocks) {
      if (!blocksByType[block.type]) {
        blocksByType[block.type] = [];
      }
      blocksByType[block.type].push(block);
    }
  }

  return {
    files: tokenizedFiles,
    componentMap,
    routeMap,
    blocksByType,
  };
}

/**
 * Converts the codebase index to a format optimized for LLM queries
 */
function generateLlmTokenIndex(codebaseIndex: CodebaseIndex): string {
  let output = "# Codebase Structure\n\n";

  // Add file summary section
  output += "## Files\n\n";
  codebaseIndex.files.forEach((file: TokenizedFile) => {
    const relativePath = path.relative(process.cwd(), file.filePath);
    output += `- ${relativePath} (${file.lineCount} lines)\n`;
  });

  // Add routes section with line numbers
  output += "\n## Routes\n\n";
  Object.entries(codebaseIndex.routeMap).forEach(([routePath, route]) => {
    output += `- ${route.method.toUpperCase()} ${routePath} - Defined in ${path.relative(
      process.cwd(),
      route.file
    )}:${route.line}\n`;
  });

  // Add functions section with line numbers
  output += "\n## Functions\n\n";
  codebaseIndex.files.forEach((file: TokenizedFile) => {
    const relativePath = path.relative(process.cwd(), file.filePath);

    file.functionLocations.forEach((func) => {
      output += `- ${func.name} - ${relativePath}:${func.startLine}-${func.endLine}\n`;
    });
  });

  // Add components section if any
  if (Object.keys(codebaseIndex.componentMap).length > 0) {
    output += "\n## Components\n\n";
    Object.entries(codebaseIndex.componentMap).forEach(([name, filePath]) => {
      const relativePath = path.relative(process.cwd(), filePath);
      output += `- ${name} - ${relativePath}\n`;
    });
  }

  // Add specific code block types with line numbers
  const blockTypes = ["route", "function", "class", "interface", "middleware"];
  for (const blockType of blockTypes) {
    if (
      codebaseIndex.blocksByType[blockType] &&
      codebaseIndex.blocksByType[blockType].length > 0
    ) {
      output += `\n## ${
        blockType.charAt(0).toUpperCase() + blockType.slice(1)
      }s\n\n`;

      codebaseIndex.blocksByType[blockType].forEach((block) => {
        const relativePath = path.relative(process.cwd(), block.file);
        output += `- ${block.name} - ${relativePath}:${block.startLine}-${block.endLine}\n`;

        // Add additional details for routes
        if (blockType === "route" && block.method && block.path) {
          output += `  - Method: ${block.method.toUpperCase()}, Path: ${
            block.path
          }\n`;
        }
      });
    }
  }

  // Add file contents section with line numbers
  output += "\n## File Contents\n\n";
  codebaseIndex.files.forEach((file: TokenizedFile) => {
    const relativePath = path.relative(process.cwd(), file.filePath);
    output += `### ${relativePath}\n\n`;

    const content = fs.readFileSync(file.filePath, "utf-8");
    const lines = content.split("\n");

    output += "```\n";
    lines.forEach((line, idx) => {
      output += `${idx + 1}: ${line}\n`;
    });
    output += "```\n\n";
  });

  // Add detailed code blocks section
  output += "\n## Code Blocks\n\n";
  codebaseIndex.files.forEach((file: TokenizedFile) => {
    const relativePath = path.relative(process.cwd(), file.filePath);

    file.codeBlocks.forEach((block) => {
      output += `### ${block.type}: ${block.name} (${relativePath}:${block.startLine}-${block.endLine})\n\n`;
      output += "```typescript\n";
      output += block.content + "\n";
      output += "```\n\n";
    });
  });

  return output;
}

// Main execution function
function generateCodebaseIndex(rootDir: string = process.cwd()): void {
  // Create src directory if it doesn't exist
  if (!fs.existsSync(path.join(rootDir, "src"))) {
    fs.mkdirSync(path.join(rootDir, "src"));
  }

  console.log("Indexing codebase...");
  const codebaseIndex = indexCodebase(rootDir);

  console.log("Generating LLM-optimized index...");
  const llmIndex = generateLlmTokenIndex(codebaseIndex);

  // Write to file
  const outputPath = path.join(rootDir, "src", "codebase-index.md");
  fs.writeFileSync(outputPath, llmIndex);

  console.log(`Codebase index written to ${outputPath}`);

  // Also save the raw index for programmatic use
  const rawOutputPath = path.join(rootDir, "src", "codebase-index.json");
  fs.writeFileSync(rawOutputPath, JSON.stringify(codebaseIndex, null, 2));

  console.log(`Raw index written to ${rawOutputPath}`);
}

export default generateCodebaseIndex;

// If file is run directly, execute the indexer
if (require.main === module) {
  generateCodebaseIndex();
}
