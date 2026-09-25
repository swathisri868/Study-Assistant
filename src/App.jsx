
import { useRef, useState } from "react";
import "./App.css";
import InputForm from "./components/InputForm";
import Flashcard from "./components/Flashcard";
import Quiz from "./components/Quiz";

function App() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studyData, setStudyData] = useState(null);

  const requestId = useRef(0);

  function parseAndValidateStudyData(result) {
    if (!result) {
      throw new Error("AI returned an empty response.");
    }

    let parsed;

    try {
      let cleanedResult = result;

      if (typeof result === "string") {
        cleanedResult = result.trim();

        // Remove markdown code fences if AI adds them
        if (cleanedResult.startsWith("```")) {
          cleanedResult = cleanedResult
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/, "");
        }

        parsed = JSON.parse(cleanedResult);
      } else {
        parsed = result;
      }
    } catch (error) {
      throw new Error("AI returned invalid JSON.");
    }

    // Check main structure
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.title !== "string" ||
      !Array.isArray(parsed.cards) ||
      !Array.isArray(parsed.quiz) ||
      parsed.cards.length === 0 ||
      parsed.quiz.length === 0
    ) {
      throw new Error("AI returned incomplete study material.");
    }

    // Check flashcards
    for (const card of parsed.cards) {
      if (
        !card ||
        typeof card.question !== "string" ||
        typeof card.answer !== "string" ||
        !card.question.trim() ||
        !card.answer.trim()
      ) {
        throw new Error("AI returned invalid flashcard data.");
      }
    }

    // Check quiz
    for (const question of parsed.quiz) {
      if (
        !question ||
        typeof question.question !== "string" ||
        !question.question.trim() ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        !Number.isInteger(question.answer) ||
        question.answer < 0 ||
        question.answer > 3
      ) {
        throw new Error("AI returned invalid quiz data.");
      }

      // Check that all options are valid strings
      for (const option of question.options) {
        if (typeof option !== "string" || !option.trim()) {
          throw new Error("AI returned invalid quiz options.");
        }
      }
    }

    return parsed;
  }

  async function handleGenerate() {
    if (!input.trim()) {
      setError("Please enter a topic or some notes first.");
      return;
    }

    requestId.current += 1;
    const currentRequestId = requestId.current;

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    setError("");
    setLoading(true);
    setStudyData(null);

    try {
     const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: input
          })
        }
      );

     const responseText = await response.text();

let data;

try {
  data = responseText ? JSON.parse(responseText) : {};
} catch {
  throw new Error("Server returned an invalid response.");
}

if (!response.ok) {
  throw new Error(
    data.error || "Failed to generate study material."
  );
}
      if (!data.result) {
        throw new Error("AI returned an empty response.");
      }

      const parsedData = parseAndValidateStudyData(data.result);

      // Only update UI if this is still the latest request
      if (currentRequestId === requestId.current) {
        setStudyData(parsedData);
      }

    } catch (error) {
      console.error(error);

      if (currentRequestId === requestId.current) {
        if (error.name === "AbortError") {
          setError(
            "The request took too long. Please try again."
          );
        } else {
          setError(
            error.message ||
            "Something went wrong. Please try again."
          );
        }
      }

    } finally {
      clearTimeout(timeoutId);

      if (currentRequestId === requestId.current) {
        setLoading(false);
      }
    }
  }

  return (
    <div className="app">
      <h1>AI StudyMate</h1>

      <p>
        Enter your notes or a topic and generate study material.
      </p>

      <InputForm
        input={input}
        setInput={setInput}
        onGenerate={handleGenerate}
        loading={loading}
      />

      {error && (
        <div className="error-box">
          <p>{error}</p>

          <button onClick={handleGenerate} disabled={loading}>
            Try Again
          </button>
        </div>
      )}

      {loading && (
        <div className="loading">
          <p>Generating your study material...</p>
        </div>
      )}

      {studyData && (
        <div className="study-material">
          <h2>{studyData.title}</h2>

          <h3>Flashcards</h3>

          <div className="flashcards">
            {studyData.cards.map((card, index) => (
              <Flashcard key={index} card={card} />
            ))}
          </div>

          <h3>Quiz</h3>

          <Quiz quiz={studyData.quiz} />
        </div>
      )}
    </div>
  );
}

export default App;

