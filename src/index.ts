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
import { MetadataFilters, VectorStoreIndex, Document, storageContextFromDefaults } from "llamaindex";
import { ChromaVectorStore } from "@llamaindex/chroma";

dotenv.config();

// Create LLM instance
const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
  temperature: 1,
});
const collectionName = "code-data"

const app = express();
const port = 3000;

app.use(express.json());

// Modify the connectChromaDb function to store and manage code tokens
async function connectChromaDb(collectionName: string) {
  const chromaVS = new ChromaVectorStore({ collectionName });
  const ctx = await storageContextFromDefaults({ vectorStore: chromaVS });
  
  const storeCodeTokens = async (fileData: TokenizedFile) => {
    try {
      // Convert tokens and codeBlocks to Documents
      const docs = [
        ...fileData.tokens.map((token, idx) => 
          new Document({
            id_: `${fileData.filePath}-token-${idx}`,
            text: JSON.stringify(token),
            metadata: {
              filePath: fileData.filePath,
              type: 'token',
              lineCount: fileData.lineCount
            }
          })
        ),
        ...fileData.codeBlocks.map((block, idx) => 
          new Document({
            id_: `${fileData.filePath}-block-${idx}`,
            text: JSON.stringify(block),
            metadata: {
              filePath: fileData.filePath,
              type: 'codeBlock',
              lineCount: fileData.lineCount
            }
          })
        )
      ];

      // Create index and store documents
      const index = await VectorStoreIndex.fromDocuments(docs, {
        storageContext: ctx,
      });

      return index;
    } catch (error) {
      console.error("Error storing tokens:", error);
      return null;
    }
  };

  const queryTokens = async (filters?: MetadataFilters) => {
    try {
      const index = await VectorStoreIndex.fromVectorStore(chromaVS);
      const queryEngine = index.asQueryEngine({
        preFilters: filters,
        similarityTopK: 10,
      });
      const response = await queryEngine.query({ 
        query: filters?.query || "List all code tokens" 
      });
      return response;
    } catch (error) {
      console.error("Error querying tokens:", error);
      throw error;
    }
  };

  return {
    vectorStore: chromaVS,
    storeCodeTokens,
    queryTokens,
    queryFn: queryTokens
  };
}

// Initialize ChromaDB connection
let chromaClient: Awaited<ReturnType<typeof connectChromaDb>>;

app.get('/api/query', async (req, res) => {
  try {
    if (!chromaClient) {
      chromaClient = await connectChromaDb(collectionName);
    }
    const filters = req.query.filters ? JSON.parse(String(req.query.filters)) : undefined;
    const response = await chromaClient.queryFn(filters);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Error querying the database' });
  }
});

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

// Modify the loadCodebaseIndex function to store data in ChromaDB
async function loadCodebaseIndex() {
  const mdPath = path.join(__dirname, "codebase-index.md");
  const jsonPath = path.join(__dirname, "codebase-index.json");

  if (!fs.existsSync(mdPath) || !fs.existsSync(jsonPath)) {
    console.log("Generating codebase index files...");
    generateCodebaseIndex();
  }

  try {
    const mdContent = fs.readFileSync(mdPath, "utf-8");
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    if (!chromaClient) {
      chromaClient = await connectChromaDb(collectionName);
    }

    // Store each file's tokens in ChromaDB
    for (const fileData of jsonContent.files) {
      await chromaClient.storeCodeTokens(fileData);
    }

    return {
      markdown: mdContent,
      json: jsonContent,
    };
  } catch (error) {
    console.error("Error loading codebase index:", error);
    return null;
  }
}

// Modify the API endpoint to support more complex filters
app.get('/api/tokens', async (req: Request, res: Response) => {
  try {
    if (!chromaClient) {
      chromaClient = await connectChromaDb(collectionName);
    }

    const filters: MetadataFilters = {
      filters: []
    };

    // Add file path filter if provided
    if (req.query.filePath) {
      filters.filters.push({
        key: "filePath",
        value: req.query.filePath as string,
        operator: "=="
      });
    }

    // Add type filter if provided
    if (req.query.type) {
      filters.filters.push({
        key: "type",
        value: req.query.type as string,
        operator: "=="
      });
    }

    // Add condition if multiple filters
    if (filters.filters.length > 1) {
      filters.condition = "and";
    }

    const response = await chromaClient.queryTokens({
      ...filters,
      query: req.query.query as string
    });

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Error querying tokens' });
  }
});

// Define route handlers
const homeHandler = async (req: Request, res: Response) => {
  try {
    // Load codebase index
    const codebaseIndex = await loadCodebaseIndex();

    if (!codebaseIndex) {
      return res.status(500).json({ error: "Failed to load codebase index" });
    }

    // Get token data specifically for index.ts file
    const indexFileData = codebaseIndex.json.files.find((file: TokenizedFile) =>
      file.filePath.endsWith("/index.ts")
    );

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
  } catch (error) {
    res.status(500).json({ error: "Error processing request" });
  }
};

const codeQueryHandler = async (req: Request, res: Response) => {
  try {
    const { query = "What is the main function in the index.ts file?" } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Load codebase index
    const codebaseIndex = await loadCodebaseIndex();

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

    const response = await llm.complete({
      prompt: prompt,
    });

    res.json({
      query,
      result: response,
    });
  } catch (error) {
    console.error("Error processing code query:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
};

// Register routes
app.get("/", homeHandler as RequestHandler);
app.post("/api/code-query", codeQueryHandler as RequestHandler);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Generating codebase index...");
  // generateCodebaseIndex();
});
