import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveQuestion, useAnswers } from "@/hooks/useQuizRealtime";
import { AnswerChart } from "@/components/AnswerChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Trophy, Star, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidUUID, isValidOptionIndex } from "@/lib/utils";

function fmtTime(ms: number | null): string {
  if (ms === null) return "—";
  return (ms / 1000).toFixed(1) + "s";
}

const Quiz = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const studentId = searchParams.get("student");
  const { question, loading, totalQuestions } = useActiveQuestion();
  const answers = useAnswers(question?.id);

  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const username = sessionStorage.getItem("username") ?? "Player";
  const [score, setScore] = useState<number>(() =>
    parseInt(sessionStorage.getItem("score") ?? "0", 10)
  );
  const [avgTimeMs, setAvgTimeMs] = useState<number | null>(() => {
    const t = sessionStorage.getItem("totalTimeMs");
    const c = sessionStorage.getItem("submittedCount");
    if (t && c && parseInt(c, 10) > 0)
      return Math.round(parseInt(t, 10) / parseInt(c, 10));
    return null;
  });

  // Timer ref: set when the new question is first shown (not already answered)
  const questionStartRef = useRef<number | null>(null);

  // Reset state when question changes and start the response timer
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
    questionStartRef.current = Date.now();
  }, [question?.id]);

  // Check if student already answered this question
  useEffect(() => {
    if (!question?.id || !studentId) return;
    supabase
      .from("answers")
      .select("selected_option_index")
      .eq("question_id", question.id)
      .eq("student_id", studentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSelected(data.selected_option_index);
          setSubmitted(true);
          // Already answered — invalidate timer so we don't count reload time
          questionStartRef.current = null;
        }
      });
  }, [question?.id, studentId]);

  if (!studentId || !isValidUUID(studentId)) {
    navigate("/");
    return null;
  }

  const options: string[] = Array.isArray(question?.options) ? (question.options as string[]) : [];

  const handleSubmit = async () => {
    if (selected === null || !question || !studentId || submitted) return;
    if (!isValidOptionIndex(selected, options.length)) return;
    setSubmitting(true);
    // Optimistic — mark submitted immediately to prevent double-clicks
    setSubmitted(true);

    const responseTimeMs =
      questionStartRef.current !== null ? Date.now() - questionStartRef.current : null;

    const { error } = await supabase.from("answers").insert({
      question_id: question.id,
      student_id: studentId,
      selected_option_index: selected,
      response_time_ms: responseTimeMs,
    });

    if (error) {
      // If it's a duplicate (unique constraint), stay submitted; otherwise revert
      if (!error.message?.includes("duplicate") && !error.code?.startsWith("23")) {
        setSubmitted(false);
      }
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    // Update personal score if correct
    if (selected === question.correct_option_index) {
      const newScore = score + 1;
      setScore(newScore);
      sessionStorage.setItem("score", String(newScore));
    }

    // Update running average response time
    if (responseTimeMs !== null) {
      const prevTotal = parseInt(sessionStorage.getItem("totalTimeMs") ?? "0", 10);
      const prevCount = parseInt(sessionStorage.getItem("submittedCount") ?? "0", 10);
      const newTotal = prevTotal + responseTimeMs;
      const newCount = prevCount + 1;
      sessionStorage.setItem("totalTimeMs", String(newTotal));
      sessionStorage.setItem("submittedCount", String(newCount));
      setAvgTimeMs(Math.round(newTotal / newCount));
    }
  };

  // Fixed username / score badge shown on all states
  const userBadge = (
    <div className="fixed top-3 right-3 z-50">
      <div className="flex items-center gap-2 rounded-full bg-card border shadow-md px-3 py-1.5">
        <span className="text-sm font-semibold text-foreground">{username}</span>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
          <Star className="h-3 w-3" />
          {score}
        </span>
        {avgTimeMs !== null && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            <Timer className="h-3 w-3" />
            {fmtTime(avgTimeMs)}
          </span>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {userBadge}
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!question) {
    // Quiz is fully finished: questions exist but none are active
    if (!loading && totalQuestions > 0) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          {userBadge}
          <Card className="w-full max-w-md text-center border-0 shadow-lg">
            <CardContent className="py-16">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Quiz finished!</h2>
              <p className="text-muted-foreground mb-2">Thanks for participating, <span className="font-semibold">{username}</span>!</p>
              <p className="text-muted-foreground mb-2">
                Your score: <span className="font-bold text-primary">{score}</span> correct answer{score !== 1 ? "s" : ""}.
              </p>
              {avgTimeMs !== null && (
                <p className="text-muted-foreground mb-6">
                  Avg response time: <span className="font-bold text-primary">{fmtTime(avgTimeMs)}</span>
                </p>
              )}
              <Button asChild variant="outline">
                <Link to="/rank">View School Ranking</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // No questions yet — quiz hasn't started
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        {userBadge}
        <Card className="w-full max-w-md text-center border-0 shadow-lg">
          <CardContent className="py-16">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Waiting for the next question…</h2>
            <p className="text-muted-foreground">The quiz master will push a question shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const correctIndex = question.correct_option_index;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {userBadge}
      <Card className="w-full max-w-lg border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl leading-relaxed">{question.question_text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.map((opt, i) => {
            const isCorrect = i === correctIndex;
            const isSelected = i === selected;
            let variant: "default" | "outline" | "destructive" | "secondary" | "ghost" = "outline";
            let extraClass = "justify-start text-left h-auto py-3 px-4 text-base font-normal";

            if (submitted) {
              if (isCorrect) {
                extraClass += " border-success bg-success/10 text-success";
              } else if (isSelected && !isCorrect) {
                extraClass += " border-destructive bg-destructive/10 text-destructive";
              } else {
                extraClass += " opacity-50";
              }
            } else if (isSelected) {
              variant = "default";
            }

            return (
              <Button
                key={i}
                variant={variant}
                className={cn("w-full", extraClass)}
                disabled={submitted}
                onClick={() => !submitted && setSelected(i)}
              >
                <span className="flex items-center gap-2 w-full">
                  {submitted && isCorrect && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                  {submitted && isSelected && !isCorrect && <XCircle className="h-5 w-5 shrink-0" />}
                  {opt}
                </span>
              </Button>
            );
          })}

          {!submitted && (
            <Button
              className="w-full h-12 text-base font-semibold mt-4"
              disabled={selected === null || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting…" : "Submit Answer"}
            </Button>
          )}

          {submitted && <AnswerChart answers={answers} correctIndex={correctIndex} />}
        </CardContent>
      </Card>
    </div>
  );
};

export default Quiz;
