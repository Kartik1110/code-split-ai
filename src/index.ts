import dotenv from "dotenv";
import express, { Request, RequestHandler, Response } from "express";
import { OpenAI } from "llamaindex";
import {
  Workflow,
  StartEvent,
  StopEvent,
  WorkflowEvent,
} from "@llamaindex/workflow";
import authRoutes from "./routes/auth.route";
import tokenizeCode from "./tokenizer";
import generateCodebaseIndex from "./codeTokenizer";
import fs from "fs";
import path from "path";

dotenv.config();

// Create LLM instance
const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
  temperature: 1,
});

const app = express();
const port = 3000;

app.use(express.json());

// Add auth routes
app.use("/api/auth", authRoutes);

// Define interface for file data
interface TokenizedFile {
  filePath: string;
  lineCount: number;
  functionLocations: any[];
  routeDefinitions: any[];
  tokens: any[];
  codeBlocks: any[];
}

// Load codebase index data
function loadCodebaseIndex() {
  const mdPath = path.join(__dirname, "codebase-index.md");
  const jsonPath = path.join(__dirname, "codebase-index.json");

  // Check if files exist
  if (!fs.existsSync(mdPath) || !fs.existsSync(jsonPath)) {
    console.log("Generating codebase index files...");
    generateCodebaseIndex();
  }

  try {
    const mdContent = fs.readFileSync(mdPath, "utf-8");
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    return {
      markdown: mdContent,
      json: jsonContent,
    };
  } catch (error) {
    console.error("Error loading codebase index:", error);
    return null;
  }
}

// Define route handlers
const homeHandler = (req: Request, res: Response) => {
  // Load codebase index
  const codebaseIndex = loadCodebaseIndex();

  if (!codebaseIndex) {
    return res.status(500).json({ error: "Failed to load codebase index" });
  }

  // Get token data specifically for index.ts file
  const indexFileData = codebaseIndex.json.files.find((file: TokenizedFile) =>
    file.filePath.endsWith("/index.ts")
  );

  // Simple response with index.ts tokens
  res.json({
    message: "API is running",
    indexFile: {
      path: indexFileData?.filePath,
      lineCount: indexFileData?.lineCount,
      functionCount: indexFileData?.functionLocations.length,
      routeCount: indexFileData?.routeDefinitions.length,
      tokenCount: indexFileData?.tokens.length,
    },
  });
};

const codeQueryHandler = (req: Request, res: Response) => {
  const { query = "What is the main function in the index.ts file?" } =
    req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  // Load codebase index
  const codebaseIndex = loadCodebaseIndex();

  if (!codebaseIndex) {
    return res.status(500).json({ error: "Failed to load codebase index" });
  }

  // Create prompt with markdown context
  const prompt = `
You are a code assistant with access to the codebase structure below. 
Answer the following question using the provided code context:

QUESTION: ${query}

CODE CONTEXT:
${codebaseIndex.markdown.slice(0, 15000)}
`;

  // Execute LLM query
  llm
    .complete({
      prompt: prompt,
    })
    .then((response) => {
      res.json({
        query,
        result: response,
      });
    })
    .catch((error) => {
      console.error("Error processing code query:", error);
      res.status(500).json({ error: "Failed to process query" });
    });
};

// Register routes
app.get("/", homeHandler as RequestHandler);
app.post("/api/code-query", codeQueryHandler as RequestHandler);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Generating codebase index...");
  // generateCodebaseIndex();
});
