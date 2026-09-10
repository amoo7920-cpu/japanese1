export interface BackgroundSurvey {
  workStatus: string;
  studentStatus: string;
  residence: string;
  leisure: string[];
  sports: string[];
  travel: string[];
}

export interface ModelAnswer {
  jp: string;
  pronunciation: string;
  kr: string;
}

export interface Question {
  id: string;
  category: string;
  questionJp: string;
  questionKr: string;
  explanation: string;
  modelAnswer: ModelAnswer;
}

export interface StudyDay {
  day: number;
  title: string;
  tasks: string[];
  tip: string;
  completed?: boolean;
}

export interface EvaluationResult {
  estimatedLevel: string;
  scoreColor: string;
  feedbackText: string;
  pronunciationTips: string[];
  keyVocabularySuggestions: {
    original: string;
    suggested: string;
    explanationKr: string;
  }[];
  betterAlternativeJp: string;
  betterAlternativePronunciation: string;
  betterAlternativeKr: string;
}
