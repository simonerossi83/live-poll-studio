import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveQuestion, useAnswers } from "@/hooks/useQuizRealtime";
import { AnswerChart } from "@/components/AnswerChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Quiz = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const studentId = searchParams.get("student");
  const { question, loading } = useActiveQuestion();
  const answers = useAnswers(question?.id);

  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when question changes
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
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
        }
      });
  }, [question?.id, studentId]);

  if (!studentId) {
    navigate("/");
    return null;
  }

  const options: string[] = Array.isArray(question?.options) ? (question.options as string[]) : [];

  const handleSubmit = async () => {
    if (selected === null || !question || !studentId) return;
    setSubmitting(true);
    await supabase.from("answers").insert({
      question_id: question.id,
      student_id: studentId,
      selected_option_index: selected,
    });
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
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

          {submitted && <AnswerChart options={options} answers={answers} />}
        </CardContent>
      </Card>
    </div>
  );
};

export default Quiz;
