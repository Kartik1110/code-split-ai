import dotenv from "dotenv";
import express from 'express';
import { OpenAI } from "llamaindex";
import {
  Workflow,
  StartEvent,
  StopEvent,
  WorkflowEvent,
} from "@llamaindex/workflow";
import authRoutes from './routes/auth.route';

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
app.use('/api/auth', authRoutes);

app.get('/', async (req, res) => {
  const response = await llm.complete({
    prompt: "What is 1 + 1?",
  });
  res.send(response);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
