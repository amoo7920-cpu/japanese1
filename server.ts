import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const app = express();
const PORT = 3000;

app.use(express.json());

// API: Generate Study Plan
app.post("/api/gemini/generate-study-plan", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { targetLevel, periodWeeks, dailyHours, surveySummary } = req.body;

    const prompt = `
      You are an expert Japanese OPIc exam coach. Prepare a daily study plan for a candidate preparing for the Japanese OPIc exam.
      
      User Profile:
      - Target Level: ${targetLevel || "IH"}
      - Study Period: ${periodWeeks || "2"} weeks
      - Daily Study Time: ${dailyHours || "1.5"} hours
      - Background Survey Selections: ${surveySummary || "Recommended standard options"}

      Generate a highly actionable day-by-day study plan in Korean.
      Return the response in a JSON array format representing days.
      
      Each day should be an object with:
      - day: number (e.g., 1, 2, 3...)
      - title: string (Main focus, e.g., "자기소개 마스터하기", "공원 가기 주제 학습")
      - tasks: string[] (Checklist of 2-3 specific study tasks)
      - tip: string (Japanese expression or exam tip for that day)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.INTEGER },
              title: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              tip: { type: Type.STRING }
            },
            required: ["day", "title", "tasks", "tip"]
          }
        }
      }
    });

    const text = response.text || "[]";
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Error generating study plan:", error);
    res.status(500).json({ error: "학습 플래너를 생성하는 중 오류가 발생했습니다." });
  }
});

// API: Generate Questions (Customized predicted questions based on survey conditions)
app.post("/api/gemini/generate-questions", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { surveyConditions, difficultyLevel } = req.body;

    const prompt = `
      You are an expert Japanese OPIc examiner. Generate 5 realistic exam questions based on the candidate's background survey and self-selected difficulty level.
      
      Candidate Conditions:
      - Survey choices: ${JSON.stringify(surveyConditions)}
      - Difficulty Selected: ${difficultyLevel || "Level 5"} (typically Level 3-4 for intermediate, Level 5-6 for advanced)

      Provide the questions in Japanese with Korean translation.
      Also, generate a comprehensive model answer (모범답안) in Japanese for each question.
      Crucially, for each model answer, you MUST provide:
      1. The Japanese text (using Kanji, Hiragana, Katakana as appropriate).
      2. The Korean pronunciation (한국어 발음) - write how to read the Japanese phonetically in Korean (e.g. "와타시와 코엔니 이쿠노가 스키데스").
      3. The Korean translation (해석).

      Return the response in a JSON array format.
      Each item must have:
      - id: string (unique key, e.g., "q-1")
      - category: string (e.g., "자기소개", "여가활동", "돌발질문", "롤플레이")
      - questionJp: string (Japanese question text)
      - questionKr: string (Korean translation of the question)
      - explanation: string (A brief tip on how to score high on this question in Korean)
      - modelAnswer: {
          jp: string,         // Japanese model answer
          pronunciation: string, // Korean pronunciation transcription of the Japanese answer
          kr: string          // Korean translation of the answer
        }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              category: { type: Type.STRING },
              questionJp: { type: Type.STRING },
              questionKr: { type: Type.STRING },
              explanation: { type: Type.STRING },
              modelAnswer: {
                type: Type.OBJECT,
                properties: {
                  jp: { type: Type.STRING },
                  pronunciation: { type: Type.STRING },
                  kr: { type: Type.STRING }
                },
                required: ["jp", "pronunciation", "kr"]
              }
            },
            required: ["id", "category", "questionJp", "questionKr", "explanation", "modelAnswer"]
          }
        }
      }
    });

    const text = response.text || "[]";
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Error generating questions:", error);
    res.status(500).json({ error: "예상 문제를 생성하는 중 오류가 발생했습니다." });
  }
});

// API: Evaluate Practice Answer
app.post("/api/gemini/evaluate-answer", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { questionJp, questionKr, userAnswer, targetLevel } = req.body;

    if (!userAnswer || userAnswer.trim().length === 0) {
       res.status(400).json({ error: "답변 내용을 입력해주세요." });
       return;
    }

    const prompt = `
      You are an expert Japanese OPIc exam evaluator. Grade and provide helpful feedback on this candidate's response.
      
      Question (Japanese): ${questionJp}
      Question (Korean Translation): ${questionKr}
      Candidate's Target Level: ${targetLevel || "IH"}
      Candidate's Response: ${userAnswer}

      Perform a rigorous analysis.
      Provide the feedback in Korean.
      The output must be JSON format with the following fields:
      - estimatedLevel: string (e.g., NH, IL, IM1, IM2, IM3, IH, AL)
      - scoreColor: string (tailwind class color, e.g. "text-emerald-600", "text-amber-600")
      - feedbackText: string (General assessment of their response and confidence in Korean)
      - pronunciationTips: string[] (Tips on intonation, natural pauses, filler words like '아노...', '소노...', '네...' etc.)
      - keyVocabularySuggestions: { original: string, suggested: string, explanationKr: string }[] (Upgraded vocabulary or grammar to score higher)
      - betterAlternativeJp: string (An upgraded, more natural native Japanese version of their answer)
      - betterAlternativePronunciation: string (Korean phonetic pronunciation of the upgraded version)
      - betterAlternativeKr: string (Korean translation of the upgraded version)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedLevel: { type: Type.STRING },
            scoreColor: { type: Type.STRING },
            feedbackText: { type: Type.STRING },
            pronunciationTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            keyVocabularySuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  suggested: { type: Type.STRING },
                  explanationKr: { type: Type.STRING }
                },
                required: ["original", "suggested", "explanationKr"]
              }
            },
            betterAlternativeJp: { type: Type.STRING },
            betterAlternativePronunciation: { type: Type.STRING },
            betterAlternativeKr: { type: Type.STRING }
          },
          required: [
            "estimatedLevel",
            "scoreColor",
            "feedbackText",
            "pronunciationTips",
            "keyVocabularySuggestions",
            "betterAlternativeJp",
            "betterAlternativePronunciation",
            "betterAlternativeKr"
          ]
        }
      }
    });

    const text = response.text || "{}";
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Error evaluating answer:", error);
    res.status(500).json({ error: "답변을 평가하는 중 오류가 발생했습니다." });
  }
});

// Setup Vite Dev Server / Static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
