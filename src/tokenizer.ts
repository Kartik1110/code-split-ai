import fs from "fs";
import path from "path";

// Function to tokenize code as it appears in the Cursor editor
function tokenizeCode(code: string): string[] {
  // Split by lines first to preserve line structure
  const lines = code.split("\n");
  const tokens: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If line is empty, add a special newline token
    if (line.trim() === "") {
      tokens.push("\n");
      continue;
    }

    // Extract indentation
    const indentMatch = line.match(/^(\s+)/);
    const indent = indentMatch ? indentMatch[0] : "";

    if (indent) {
      tokens.push(indent);
    }

    // Process the actual code content on the line
    const content = line.trim();
    if (content) {
      // Split by whitespace first
      const contentParts = content.split(/(\s+)/).filter(Boolean);

      for (const part of contentParts) {
        if (/^\s+$/.test(part)) {
          // Preserve whitespace token
          tokens.push(part);
        } else {
          // Split code tokens by common delimiters
          const subTokens = part
            .replace(/([;:,.(){}[\]<>+=\-*/%&|^!~?])/g, " $1 ")
            .trim()
            .split(/\s+/)
            .filter((t) => t !== "");

          tokens.push(...subTokens);
        }
      }
    }

    // Add explicit newline token at the end of each line
    tokens.push("\n");
  }

  return tokens;
}

// Path to the index.ts file
const indexPath = path.join(__dirname, "index.ts");

// Read the file
try {
  const code = fs.readFileSync(indexPath, "utf-8");
  const tokens = tokenizeCode(code);

  console.log("Tokens:");
  console.log(tokens);
  console.log(`Total tokens: ${tokens.length}`);

  // Write tokens to a file
  const outputPath = path.join(__dirname, "tokens.json");
  fs.writeFileSync(outputPath, JSON.stringify(tokens, null, 2));
  console.log(`Tokens written to ${outputPath}`);
} catch (error) {
  console.error("Error processing file:", error);
}

export default tokenizeCode;
