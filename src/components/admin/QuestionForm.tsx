import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  question: Tables<"questions"> | null;
  order: number;
  onClose: () => void;
}

export function QuestionForm({ question, order, onClose }: Props) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (question) {
      setText(question.question_text);
      const opts = Array.isArray(question.options) ? (question.options as string[]) : ["", ""];
      setOptions(opts);
      setCorrectIndex(question.correct_option_index);
    }
  }, [question]);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ""]);
  };

  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, idx) => idx !== i);
    setOptions(next);
    if (correctIndex >= next.length) setCorrectIndex(0);
    else if (correctIndex === i) setCorrectIndex(0);
  };

  const handleSave = async () => {
    if (!text.trim() || options.some((o) => !o.trim())) return;
    setSaving(true);

    const payload = {
      question_text: text.trim(),
      options: options.map((o) => o.trim()),
      correct_option_index: correctIndex,
      display_order: question ? question.display_order : order,
    };

    if (question) {
      await supabase.from("questions").update(payload).eq("id", question.id);
    } else {
      await supabase.from("questions").insert(payload);
    }

    setSaving(false);
    onClose();
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{question ? "Edit Question" : "New Question"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Question text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-12 text-base"
        />

        <div className="space-y-2">
          <Label className="text-sm font-medium">Options (select correct answer)</Label>
          <RadioGroup value={String(correctIndex)} onValueChange={(v) => setCorrectIndex(Number(v))}>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <RadioGroupItem value={String(i)} id={`opt-${i}`} />
                <Input
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    setOptions(next);
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1"
                />
                {options.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => removeOption(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </RadioGroup>
          {options.length < 6 && (
            <Button variant="outline" size="sm" onClick={addOption}>
              <Plus className="h-4 w-4 mr-1" /> Add Option
            </Button>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving…" : question ? "Update" : "Create"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
