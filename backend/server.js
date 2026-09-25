require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 5000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "AI StudyMate backend is running"
  });
});

// Generate study material
app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({
      error: "Prompt is required"
    });
  }

  try {
    console.log("Generating study material...");

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `
You are a study assistant.

Create study material from the user's topic or notes.

Return ONLY valid JSON.
Do not use markdown.
Do not add any explanation outside the JSON.

The JSON must have exactly this structure:

{
  "title": "string",
  "cards": [
    {
      "question": "string",
      "answer": "string"
    }
  ],
  "quiz": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answer": 0
    }
  ]
}

Rules:
- Generate 5 flashcards.
- Generate 5 quiz questions.
- Each quiz question must have exactly 4 options.
- "answer" must be the zero-based index of the correct option.
- Keep questions and answers clear and useful.
- Do not return empty strings.

User topic/notes:

${prompt}
      `
    });

    const text = response.text;

    console.log("AI response received.");

    if (!text) {
      return res.status(500).json({
        error: "AI returned an empty response."
      });
    }

    res.json({
      result: text
    });

  } catch (error) {
    console.error("Gemini API ERROR:", error);

    const status = error?.status || error?.statusCode;
    const message = error?.message || "";

    // AI usage/rate limit
    if (
      status === 429 ||
      message.includes("429") ||
      message.toLowerCase().includes("resource exhausted") ||
      message.toLowerCase().includes("quota")
    ) {
      return res.status(429).json({
        error: "AI limit reached. Please try again later."
      });
    }

    // AI service busy
    if (status === 503) {
      return res.status(503).json({
        error: "The AI service is temporarily busy. Please try again."
      });
    }

    // Invalid request
    if (status === 400) {
      return res.status(400).json({
        error: "Invalid request sent to the AI service."
      });
    }

    // Authentication
    if (status === 401 || status === 403) {
      return res.status(status).json({
        error: "Gemini API key is invalid or not authorized."
      });
    }

    return res.status(500).json({
      error: "Failed to generate study material. Please try again."
    });
  }
}); // <-- THIS WAS MISSING

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Keep server alive and show unexpected errors
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED REJECTION:", error);
});

server.on("error", (error) => {
  console.error("SERVER ERROR:", error);
});