import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllQuestions, useAnswers } from "@/hooks/useQuizRealtime";
import { AnswerChart } from "@/components/AnswerChart";
import { QuestionForm } from "./QuestionForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Plus, Pencil, Trash2, SkipForward, Users, Database, RotateCcw } from "lucide-react";

export function AdminDashboard() {
  const { questions, loading } = useAllQuestions();
  const activeQuestion = questions.find((q) => q.is_active) || null;
  const answers = useAnswers(activeQuestion?.id);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<typeof questions[0] | null>(null);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();

  // Only deactivate rows that are currently active — avoids UUID/empty-string filter issues
  const deactivateAll = async () => {
    const { error } = await supabase.from("questions").update({ is_active: false }).eq("is_active", true);
    if (error) toast({ title: "Could not deactivate questions", description: error.message, variant: "destructive" });
    return error;
  };

  const activateQuestion = async (id: string) => {
    const err = await deactivateAll();
    if (err) return;
    const { error } = await supabase.from("questions").update({ is_active: true }).eq("id", id);
    if (error) toast({ title: "Could not activate question", description: error.message, variant: "destructive" });
  };

  const deleteQuestion = async (id: string) => {
    if (activeQuestion?.id === id) await deactivateAll();
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast({ title: "Could not delete question", description: error.message, variant: "destructive" });
  };

  const clearAnswersForQuestion = async (questionId: string) => {
    setClearing(true);
    const { error } = await supabase.from("answers").delete().eq("question_id", questionId);
    setClearing(false);
    if (error) {
      toast({ title: "Could not clear answers", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Answers cleared for this question" });
    }
  };

  const clearAllAnswers = async () => {
    const ids = questions.map((q) => q.id);
    if (ids.length === 0) return;
    setClearing(true);
    const { error } = await supabase.from("answers").delete().in("question_id", ids);
    setClearing(false);
    if (error) {
      toast({ title: "Could not reset answers", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "All answers reset successfully" });
    }
  };

  // Sequential navigation
  const activeIndex = activeQuestion
    ? questions.findIndex((q) => q.id === activeQuestion.id)
    : -1;
  const nextQuestion =
    activeIndex >= 0 && activeIndex < questions.length - 1
      ? questions[activeIndex + 1]
      : null;

  const goToNextQuestion = async () => {
    if (!nextQuestion) return;
    await activateQuestion(nextQuestion.id);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quiz Admin</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Database className="h-3.5 w-3.5" />
              {questions.length} question{questions.length !== 1 ? "s" : ""} saved in database
            </p>
          </div>
          <div className="flex items-center gap-2">
            {questions.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Answers
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all answers?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete every submitted answer across all questions. Students will be able to answer again. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={clearAllAnswers}
                      disabled={clearing}
                    >
                      {clearing ? "Resetting…" : "Reset all answers"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={() => { setEditingQuestion(null); setShowForm(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Question
            </Button>
          </div>
        </div>

        {/* Active question panel */}
        {activeQuestion && (
          <Card className="border-primary/30 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge className="bg-success text-success-foreground">● LIVE</Badge>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="font-semibold text-foreground">{answers.length}</span>
                    <span>{answers.length === 1 ? "response" : "responses"}</span>
                  </div>
                  {nextQuestion && (
                    <Button size="sm" onClick={goToNextQuestion}>
                      <SkipForward className="h-3 w-3 mr-1" /> Next
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        title="Clear answers for this question"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Clear
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear answers for this question?</AlertDialogTitle>
                        <AlertDialogDescription>
                          All submitted answers for "<strong>{activeQuestion.question_text}</strong>" will be deleted. Students will be able to answer again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => clearAnswersForQuestion(activeQuestion.id)}
                          disabled={clearing}
                        >
                          {clearing ? "Clearing…" : "Clear answers"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="outline" size="sm" onClick={deactivateAll}>
                    <Square className="h-3 w-3 mr-1" /> Stop
                  </Button>
                </div>
              </div>
              <CardTitle className="text-lg mt-2">{activeQuestion.question_text}</CardTitle>
            </CardHeader>
            <CardContent>
              <AnswerChart answers={answers} correctIndex={activeQuestion.correct_option_index} />
            </CardContent>
          </Card>
        )}

        {!activeQuestion && questions.length > 0 && (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              No question is live. Press <Play className="h-3.5 w-3.5 inline mx-1" /> on a question below to start.
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Question form */}
        {showForm && (
          <QuestionForm
            question={editingQuestion}
            order={questions.length}
            onClose={() => { setShowForm(false); setEditingQuestion(null); }}
          />
        )}

        {/* Question list */}
        <div className="space-y-3">
          {loading && <p className="text-muted-foreground text-sm">Loading questions…</p>}
          {!loading && questions.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">
              No questions yet. Create one above to get started.
            </p>
          )}
          {questions.map((q, idx) => {
            const opts: string[] = Array.isArray(q.options) ? (q.options as string[]) : [];
            return (
              <Card key={q.id} className={q.is_active ? "border-success/50 bg-success/5" : ""}>
                <CardContent className="py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{q.question_text}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {opts.length} options · Correct: <span className="text-success font-medium">{opts[q.correct_option_index] || "—"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {q.is_active ? (
                      <Badge className="bg-success/20 text-success border-success/30 text-xs">Live</Badge>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => activateQuestion(q.id)} title="Go live">
                        <Play className="h-4 w-4 text-success" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditingQuestion(q); setShowForm(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
