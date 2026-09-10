import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  CheckCircle2,
  Sparkles,
  Play,
  Volume2,
  Square,
  Mic,
  MicOff,
  RotateCcw,
  FileText,
  Check,
  Settings,
  AlertCircle,
  Calendar,
  Award,
  ChevronRight,
  Plus,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  Clock,
  ListTodo,
  Smile,
  VolumeX,
  Languages
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  BackgroundSurvey,
  Question,
  StudyDay,
  EvaluationResult
} from "./types";
import {
  RECOMMENDED_SURVEY,
  DEFAULT_QUESTIONS,
  DEFAULT_STUDY_PLAN
} from "./data";

export default function App() {
  // State
  const [survey, setSurvey] = useState<BackgroundSurvey>(() => {
    const saved = localStorage.getItem("opic_survey");
    return saved ? JSON.parse(saved) : { ...RECOMMENDED_SURVEY };
  });
  
  const [difficulty, setDifficulty] = useState<number>(() => {
    const saved = localStorage.getItem("opic_difficulty");
    return saved ? parseInt(saved, 10) : 5; // Level 5 is typical for IH/AL prep
  });

  const [targetLevel, setTargetLevel] = useState<string>(() => {
    const saved = localStorage.getItem("opic_target_level");
    return saved || "IH";
  });

  const [studyPlan, setStudyPlan] = useState<StudyDay[]>(() => {
    const saved = localStorage.getItem("opic_study_plan");
    return saved ? JSON.parse(saved) : [...DEFAULT_STUDY_PLAN];
  });

  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem("opic_questions");
    return saved ? JSON.parse(saved) : [...DEFAULT_QUESTIONS];
  });

  const [activeQuestionId, setActiveQuestionId] = useState<string>(() => {
    const saved = localStorage.getItem("opic_active_question");
    return saved || DEFAULT_QUESTIONS[0].id;
  });

  const [userAnswer, setUserAnswer] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordTime, setRecordTime] = useState<number>(0);
  const [isSpeakingResult, setIsSpeakingResult] = useState<boolean>(false);
  
  // Gemini loading states
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);
  const [isLoadingPlanner, setIsLoadingPlanner] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  
  // AI Results
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  // Custom study plan parameters
  const [planPeriod, setPlanPeriod] = useState<number>(2); // weeks
  const [planHours, setPlanHours] = useState<number>(1.5); // hours/day
  const [showPlanConfig, setShowPlanConfig] = useState<boolean>(false);

  // Active question details
  const activeQuestion = questions.find((q) => q.id === activeQuestionId) || questions[0];

  // Timer & Speech Recognition refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Browser TTS State
  const [isTtsSupported, setIsTtsSupported] = useState<boolean>(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState<boolean>(false);
  const [ttsTarget, setTtsTarget] = useState<"question" | "answer" | null>(null);

  // Check Speech Synthesis & Recognition support on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTtsSupported(!!window.speechSynthesis);
      
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "ja-JP"; // default language set to Japanese

        rec.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setUserAnswer((prev) => prev + (prev ? " " : "") + finalTranscript);
          }
        };

        rec.onerror = (e: any) => {
          console.error("Speech recognition error:", e);
          setIsRecording(false);
        };

        rec.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  // Save states to localStorage
  useEffect(() => {
    localStorage.setItem("opic_survey", JSON.stringify(survey));
  }, [survey]);

  useEffect(() => {
    localStorage.setItem("opic_difficulty", difficulty.toString());
  }, [difficulty]);

  useEffect(() => {
    localStorage.setItem("opic_target_level", targetLevel);
  }, [targetLevel]);

  useEffect(() => {
    localStorage.setItem("opic_study_plan", JSON.stringify(studyPlan));
  }, [studyPlan]);

  useEffect(() => {
    localStorage.setItem("opic_questions", JSON.stringify(questions));
  }, [questions]);

  useEffect(() => {
    localStorage.setItem("opic_active_question", activeQuestionId);
    // Clear user answer and evaluation when switching questions
    setUserAnswer("");
    setEvaluation(null);
    stopTts();
  }, [activeQuestionId]);

  // Record timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Format record timer (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Toggle study task completion
  const toggleTask = (dayNum: number, taskIndex: number) => {
    setStudyPlan((prevPlan) =>
      prevPlan.map((d) => {
        if (d.day === dayNum) {
          const updatedTasks = [...d.tasks];
          // We can represent completed state on the StudyDay level, or inline
          // Let's toggle completed state for the whole day if tasks are toggled, or just keep day toggles:
          return { ...d, completed: !d.completed };
        }
        return d;
      })
    );
  };

  // Reset entire state to default
  const resetToDefault = () => {
    if (window.confirm("모든 데이터를 기본 설정으로 초기화하시겠습니까?")) {
      setSurvey({ ...RECOMMENDED_SURVEY });
      setDifficulty(5);
      setTargetLevel("IH");
      setStudyPlan([...DEFAULT_STUDY_PLAN]);
      setQuestions([...DEFAULT_QUESTIONS]);
      setActiveQuestionId(DEFAULT_QUESTIONS[0].id);
      setUserAnswer("");
      setEvaluation(null);
      stopTts();
    }
  };

  // Native Speech Synthesis (Japanese)
  const playTts = (text: string, type: "question" | "answer") => {
    if (!isTtsSupported) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP"; // Japanese voice
    utterance.rate = 0.95; // Slightly slower for language learners

    utterance.onstart = () => {
      setIsTtsPlaying(true);
      setTtsTarget(type);
    };

    utterance.onend = () => {
      setIsTtsPlaying(false);
      setTtsTarget(null);
    };

    utterance.onerror = () => {
      setIsTtsPlaying(false);
      setTtsTarget(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopTts = () => {
    if (isTtsSupported) {
      window.speechSynthesis.cancel();
      setIsTtsPlaying(false);
      setTtsTarget(null);
    }
  };

  // Start / Stop Microphone Recording & Speech Recognition
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      setRecordTime(0);
      setIsRecording(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Speech recognition start failed:", e);
        }
      }
    }
  };

  // AI Request: Generate Customized predicted questions
  const handleGenerateQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const surveySummary = `Work: ${survey.workStatus}, Student: ${survey.studentStatus}, Residence: ${survey.residence}, Hobbies: ${survey.leisure.join(", ")}, Sports: ${survey.sports.join(", ")}, Travel: ${survey.travel.join(", ")}`;
      const response = await fetch("/api/gemini/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyConditions: surveySummary,
          difficultyLevel: `Level ${difficulty}`
        })
      });

      if (!response.ok) throw new Error("AI 생성 오류");
      const newQuestions = await response.json();
      if (newQuestions && newQuestions.length > 0) {
        setQuestions(newQuestions);
        setActiveQuestionId(newQuestions[0].id);
      }
    } catch (e) {
      console.error(e);
      alert("AI 예상 문제를 생성하는 데 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // AI Request: Generate Custom Planner
  const handleGenerateCustomPlanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingPlanner(true);
    try {
      const surveySummary = `Work: ${survey.workStatus}, Student: ${survey.studentStatus}, Residence: ${survey.residence}, Hobbies: ${survey.leisure.join(", ")}, Sports: ${survey.sports.join(", ")}, Travel: ${survey.travel.join(", ")}`;
      const response = await fetch("/api/gemini/generate-study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLevel,
          periodWeeks: planPeriod,
          dailyHours: planHours,
          surveySummary
        })
      });

      if (!response.ok) throw new Error("AI 플래너 생성 오류");
      const newPlan = await response.json();
      if (newPlan && newPlan.length > 0) {
        setStudyPlan(newPlan);
        setShowPlanConfig(false);
      }
    } catch (e) {
      console.error(e);
      alert("AI 학습 플래너 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoadingPlanner(false);
    }
  };

  // AI Request: Evaluate Answer
  const handleEvaluateAnswer = async () => {
    if (!userAnswer || userAnswer.trim().length === 0) {
      alert("연습 답변을 입력하거나 마이크로 말씀해주세요!");
      return;
    }

    setIsEvaluating(true);
    setEvaluation(null);
    try {
      const response = await fetch("/api/gemini/evaluate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionJp: activeQuestion.questionJp,
          questionKr: activeQuestion.questionKr,
          userAnswer,
          targetLevel
        })
      });

      if (!response.ok) throw new Error("평가 오류");
      const result = await response.json();
      setEvaluation(result);
    } catch (e) {
      console.error(e);
      alert("AI 답변 평가에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Modify background survey options dynamically
  const toggleSurveyItem = (category: "leisure" | "sports" | "travel", item: string) => {
    setSurvey((prev) => {
      const currentList = prev[category];
      const newList = currentList.includes(item)
        ? currentList.filter((i) => i !== item)
        : [...currentList, item];
      return { ...prev, [category]: newList };
    });
  };

  return (
    <div id="app" className="min-h-screen bg-[#FBFBFD] text-slate-800 antialiased font-sans">
      {/* Upper Navigation & Branding Header */}
      <header id="header" className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 py-4 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 rounded-xl text-rose-500">
            <Languages className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">일본어 OPIc 합격 학습 플래너</h1>
            <p className="text-xs text-slate-500 font-medium">가장 유리한 시험 조건 최적화 및 인공지능 모의 피드백 트레이너</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            id="btn-reset-default"
            onClick={resetToDefault}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기 기본 설정 복원
          </button>
          
          <div className="text-xs font-medium text-slate-400 bg-slate-100/80 px-2.5 py-1.5 rounded-lg">
            Local Storage 동기화 중
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Background Survey Conditions & Settings (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          
          {/* Section: Recommendation Status Card */}
          <div id="survey-conditions-panel" className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold tracking-wider uppercase">
                Best Strategy
              </span>
            </div>
            
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Settings className="w-4.5 h-4.5 text-slate-500" />
              1. 백그라운드 서베이 추천 설정
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              오픽 시험 시작 전 입력하는 사전 설문조사입니다. 아래 조합은 가장 정형화되고 쉬운 문제들이 출제되어 최고 등급을 획득하기에 <strong>가장 무난하고 완벽한 조건</strong>입니다.
            </p>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">기본 인적사항 추천</span>
                <div className="mt-1.5 space-y-1 text-slate-700 font-medium">
                  <p>• 일 경험 여부: <span className="text-slate-900 font-semibold">일 경험 없음</span></p>
                  <p>• 학생 여부: <span className="text-slate-900 font-semibold">학생 아님</span></p>
                  <p>• 거주지 설정: <span className="text-slate-900 font-semibold">개인 주택이나 아파트에 홀로 거주</span></p>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-900 block mb-2">선택 취미 / 활동 (최소 12개 이상 필수 조합)</span>
                
                {/* Leisure Categories togglers */}
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">여가 활동 ({survey.leisure.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {["영화 보기", "공연 보기", "콘서트 보기", "공원 가기", "카페/커피전문점 가기", "음악 감상하기", "캠핑하기"].map((item) => {
                        const active = survey.leisure.includes(item);
                        return (
                          <button
                            key={item}
                            onClick={() => toggleSurveyItem("leisure", item)}
                            className={`px-2 py-1 rounded-md text-[11px] transition-all font-medium ${
                              active
                                ? "bg-rose-50 text-rose-600 border border-rose-200"
                                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">스포츠 / 운동 ({survey.sports.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {["걷기", "조깅", "자전거 타기", "수영", "피트니스"].map((item) => {
                        const active = survey.sports.includes(item);
                        return (
                          <button
                            key={item}
                            onClick={() => toggleSurveyItem("sports", item)}
                            className={`px-2 py-1 rounded-md text-[11px] transition-all font-medium ${
                              active
                                ? "bg-rose-50 text-rose-600 border border-rose-200"
                                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">휴가 / 여행 ({survey.travel.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {["국내 여행", "해외 여행", "집에서 보내는 휴가"].map((item) => {
                        const active = survey.travel.includes(item);
                        return (
                          <button
                            key={item}
                            onClick={() => toggleSurveyItem("travel", item)}
                            className={`px-2 py-1 rounded-md text-[11px] transition-all font-medium ${
                              active
                                ? "bg-rose-50 text-rose-600 border border-rose-200"
                                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Target & Level Selector */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">목표 등급 선택</label>
                  <select
                    id="select-target-level"
                    value={targetLevel}
                    onChange={(e) => setTargetLevel(e.target.value)}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-800"
                  >
                    {["IL", "IM1", "IM2", "IM3", "IH", "AL"].map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">자가 진단 난이도 (1~6)</label>
                  <div className="flex items-center gap-1">
                    {[3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => setDifficulty(num)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          difficulty === num
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                        title={`난이도 ${num}단계`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  * IM 목표 시 3-4단계, IH/AL 목표 시 5-6단계 자가 진단 설정을 권장합니다.
                </p>
              </div>

              {/* Custom AI generator btn */}
              <button
                id="btn-ai-generate-questions"
                disabled={isLoadingQuestions}
                onClick={handleGenerateQuestions}
                className="w-full py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoadingQuestions ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    AI 맞춤 예상기출 뽑는 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    조건 맞춤 AI 예상문제 뽑기
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section: Interactive Study Planner */}
          <div id="study-planner-panel" className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-slate-500" />
                2. 일일 학습 플래너
              </h2>
              <button
                id="btn-toggle-plan-config"
                onClick={() => setShowPlanConfig(!showPlanConfig)}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                재설정
              </button>
            </div>

            {/* Custom AI Plan Generator Form */}
            <AnimatePresence>
              {showPlanConfig && (
                <motion.form
                  onSubmit={handleGenerateCustomPlanner}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-hidden text-xs space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">준비 기간 (주)</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={planPeriod}
                        onChange={(e) => setPlanPeriod(parseInt(e.target.value, 10))}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-md font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">하루 학습 시간</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="6"
                        value={planHours}
                        onChange={(e) => setPlanHours(parseFloat(e.target.value))}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-md font-medium"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoadingPlanner}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                  >
                    {isLoadingPlanner ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    AI 맞춤 플래너 일정 만들기
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Study Plan List */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {studyPlan.map((day, idx) => (
                <div
                  key={day.day}
                  className={`p-3.5 rounded-xl border transition-all ${
                    day.completed
                      ? "bg-emerald-50/50 border-emerald-100"
                      : "bg-white border-slate-150 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        day.completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        Day {day.day}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 leading-snug">{day.title}</h3>
                    </div>
                    <button
                      id={`chk-task-${day.day}`}
                      onClick={() => toggleTask(day.day, 0)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        day.completed
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-200 hover:border-slate-400 text-transparent"
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>

                  <ul className="mt-2 text-[11px] text-slate-600 space-y-1 pl-1 list-none font-medium">
                    {day.tasks.map((task, tidx) => (
                      <li key={tidx} className="flex items-start gap-1.5">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>

                  {day.tip && (
                    <div className="mt-2.5 bg-slate-50/80 p-2 rounded-lg text-[10px] text-slate-500 leading-normal flex items-start gap-1">
                      <span className="text-amber-500 font-bold">💡 Tip:</span>
                      <span>{day.tip}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Right Column: Main predicted question study area (8 Cols) */}
        <div id="predicted-question-workspace" className="lg:col-span-8 flex flex-col gap-8">
          
          {/* Question List Switcher Grid */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-bold text-slate-900 tracking-wide flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-slate-400" />
                선택 가능 예상 문제 ({questions.length})
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                목표 등급: {targetLevel}
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isActive = q.id === activeQuestionId;
                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveQuestionId(q.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between h-[82px] ${
                      isActive
                        ? "bg-rose-50 border-rose-300 shadow-sm"
                        : "bg-slate-50/50 hover:bg-slate-50 border-slate-200/60"
                    }`}
                  >
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? "bg-rose-100 text-rose-600" : "bg-slate-200/80 text-slate-600"
                    } truncate w-full`}>
                      {q.category}
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-tight mt-1.5">
                      Q{idx + 1}. {q.questionJp}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Display Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            
            {/* Header: Question Details */}
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider bg-rose-50 px-2 py-1 rounded-md">
                  {activeQuestion.category}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2 leading-snug">
                  {activeQuestion.questionJp}
                </h3>
                <p className="text-sm font-medium text-slate-500">
                  {activeQuestion.questionKr}
                </p>
              </div>

              {isTtsSupported && (
                <button
                  id="btn-play-tts-question"
                  onClick={() =>
                    isTtsPlaying && ttsTarget === "question"
                      ? stopTts()
                      : playTts(activeQuestion.questionJp, "question")
                  }
                  className={`p-2.5 rounded-xl border transition-all ${
                    isTtsPlaying && ttsTarget === "question"
                      ? "bg-rose-500 text-white border-rose-500 animate-pulse"
                      : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                  title="질문 본문 음성 듣기"
                >
                  {isTtsPlaying && ttsTarget === "question" ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>

            {/* Content area: Model Answer & Translation */}
            <div className="p-6 space-y-6">
              
              {/* Exam high scoring tips */}
              {activeQuestion.explanation && (
                <div className="p-4 bg-amber-50/50 border border-amber-100/80 rounded-xl text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">고득점 합격 가이드:</strong> {activeQuestion.explanation}
                  </div>
                </div>
              )}

              {/* Model Answer Presentation (모범답안 제시) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-rose-500" />
                    합격 모범 답안 제시 (한국어 발음/해석 포함)
                  </h4>
                  {isTtsSupported && (
                    <button
                      id="btn-play-tts-answer"
                      onClick={() =>
                        isTtsPlaying && ttsTarget === "answer"
                          ? stopTts()
                          : playTts(activeQuestion.modelAnswer.jp, "answer")
                      }
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                        isTtsPlaying && ttsTarget === "answer"
                          ? "bg-rose-500 text-white border-rose-500 animate-pulse"
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      {isTtsPlaying && ttsTarget === "answer" ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          답변 음성 정지
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          답변 음성 듣기
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Japanese model answer */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">일본어 원문 (Japanese)</span>
                    <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-line tracking-wide">
                      {activeQuestion.modelAnswer.jp}
                    </p>
                  </div>

                  {/* Korean Pronunciation - requested */}
                  <div className="bg-rose-50/30 p-4 rounded-xl border border-rose-100/50">
                    <span className="text-[10px] font-bold text-rose-500 block mb-1">한국어 한글 발음 (Pronunciation)</span>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-line tracking-wide">
                      {activeQuestion.modelAnswer.pronunciation}
                    </p>
                  </div>

                  {/* Korean Translation */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">한국어 해석 (Translation)</span>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-line">
                      {activeQuestion.modelAnswer.kr}
                    </p>
                  </div>
                </div>
              </div>

              {/* Speech practice & recording station */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">나의 답변 말하기 연습</h4>
                    <p className="text-xs text-slate-500">실제 오픽 화면처럼 모의 발화를 해보세요. 음성 인식을 지원합니다.</p>
                  </div>

                  {/* Timer display */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatTime(recordTime)}</span>
                  </div>
                </div>

                {/* Answer draft text area with speech input */}
                <div className="relative">
                  <textarea
                    id="user-answer-textarea"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="여기에 말한 텍스트가 인식되거나, 직접 답안을 적어 다듬어 보세요. (아래의 마이크 버튼을 누르면 음성 인식이 켜집니다)"
                    className="w-full h-32 p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none"
                  ></textarea>

                  {/* mic record activation button overlay */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      id="btn-voice-recognize"
                      onClick={toggleRecording}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${
                        isRecording
                          ? "bg-rose-500 text-white animate-pulse"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          음성 인식 중지
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          음성 인식 시작
                        </>
                      )}
                    </button>
                    {userAnswer && (
                      <button
                        onClick={() => setUserAnswer("")}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                        title="지우기"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Evaluate Practice Answer button */}
                <button
                  id="btn-ai-evaluate"
                  disabled={isEvaluating}
                  onClick={handleEvaluateAnswer}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-75 shadow"
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      인공지능 OPIc 채점단 분석 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      나의 답변 AI 상세 맞춤 평가 받기
                    </>
                  )}
                </button>
              </div>

              {/* Section: Dynamic AI Feedback Report panel */}
              <AnimatePresence>
                {evaluation && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="border-t border-slate-100 pt-6 space-y-5"
                  >
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                      
                      {/* Estimated grade head */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                            <Award className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                              AI 예상 성취도 평가
                            </span>
                            <h5 className="text-sm font-bold text-slate-900">
                              목표 대비 현재 등급 예측치
                            </h5>
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] text-slate-400 font-bold">Estimated Grade:</span>
                          <span className={`text-2xl font-black ${evaluation.scoreColor || "text-rose-500"}`}>
                            {evaluation.estimatedLevel}
                          </span>
                        </div>
                      </div>

                      {/* General Assessment Feedback */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">종합 강평 피드백</span>
                        <p className="text-xs font-semibold text-slate-700 leading-relaxed whitespace-pre-line bg-white p-3.5 rounded-xl border border-slate-100">
                          {evaluation.feedbackText}
                        </p>
                      </div>

                      {/* Pronunciation, Intonation & Speech Tips */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">유창성 & 억양, 일본어 고득점 팁</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {evaluation.pronunciationTips && evaluation.pronunciationTips.map((tip, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-100 text-[11px] font-medium text-slate-600 flex items-start gap-2">
                              <span className="text-emerald-500 font-bold">✓</span>
                              <span>{tip}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Key Vocabulary Suggestions */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">표현력 업그레이드 단어/문법 제안</span>
                        <div className="space-y-2">
                          {evaluation.keyVocabularySuggestions && evaluation.keyVocabularySuggestions.map((vocab, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-xl border border-slate-150 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="line-through text-slate-400 font-semibold">{vocab.original}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-rose-600 font-bold">{vocab.suggested}</span>
                              </div>
                              <span className="text-[11px] text-slate-500 font-semibold">{vocab.explanationKr}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Better Alternative Draft */}
                      <div className="bg-slate-900 text-slate-100 p-5 rounded-xl space-y-3.5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            AI가 제안하는 네이티브 고득점(AL) 우회 모범 답안
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-white leading-relaxed tracking-wide">
                            {evaluation.betterAlternativeJp}
                          </p>
                        </div>

                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700/50">
                          <span className="text-[9px] text-rose-300 font-bold block mb-1">한글 발음</span>
                          <p className="text-xs font-semibold text-slate-300 leading-relaxed">
                            {evaluation.betterAlternativePronunciation}
                          </p>
                        </div>

                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block mb-1">한글 해석</span>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {evaluation.betterAlternativeKr}
                          </p>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

        </div>

      </main>

      {/* Footer information */}
      <footer id="footer" className="bg-white border-t border-slate-100 py-8 px-6 mt-16 text-center text-xs text-slate-400 font-medium space-y-2">
        <p>© 2026 일본어 OPIc 합격 학습 플래너. All Rights Reserved.</p>
        <p>본 앱은 수험자 선호도 최적화 서베이 설계 규칙 및 실시간 인공지능 분석 가이드를 엄격히 적용하여 학습 효율을 극대화합니다.</p>
      </footer>
    </div>
  );
}
