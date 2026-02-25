import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllQuestions, useAnswers } from "@/hooks/useQuizRealtime";
import { AnswerChart } from "@/components/AnswerChart";
import { QuestionForm } from "./QuestionForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play, Square, Plus, Pencil, Trash2 } from "lucide-react";

export function AdminDashboard() {
  const { questions, loading } = useAllQuestions();
  const activeQuestion = questions.find((q) => q.is_active) || null;
  const answers = useAnswers(activeQuestion?.id);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<typeof questions[0] | null>(null);

  const activateQuestion = async (id: string) => {
    // Deactivate all first
    await supabase.from("questions").update({ is_active: false }).neq("id", "");
    await supabase.from("questions").update({ is_active: true }).eq("id", id);
  };

  const deactivateAll = async () => {
    await supabase.from("questions").update({ is_active: false }).neq("id", "");
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from("questions").delete().eq("id", id);
  };

  const options: string[] = activeQuestion && Array.isArray(activeQuestion.options)
    ? (activeQuestion.options as string[])
    : [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quiz Admin</h1>
          <Button onClick={() => { setEditingQuestion(null); setShowForm(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Question
          </Button>
        </div>

        {/* Active question panel */}
        {activeQuestion && (
          <Card className="border-primary/30 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-success text-success-foreground">LIVE</Badge>
                <Button variant="outline" size="sm" onClick={deactivateAll}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              </div>
              <CardTitle className="text-lg mt-2">{activeQuestion.question_text}</CardTitle>
            </CardHeader>
            <CardContent>
              <AnswerChart options={options} answers={answers} />
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Question list */}
        {showForm && (
          <QuestionForm
            question={editingQuestion}
            order={questions.length}
            onClose={() => { setShowForm(false); setEditingQuestion(null); }}
          />
        )}

        <div className="space-y-3">
          {loading && <p className="text-muted-foreground text-sm">Loading questions…</p>}
          {questions.map((q) => {
            const opts: string[] = Array.isArray(q.options) ? (q.options as string[]) : [];
            return (
              <Card key={q.id} className="relative">
                <CardContent className="py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{q.question_text}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {opts.length} options · Correct: {opts[q.correct_option_index] || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!q.is_active && (
                      <Button variant="ghost" size="icon" onClick={() => activateQuestion(q.id)} title="Activate">
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
