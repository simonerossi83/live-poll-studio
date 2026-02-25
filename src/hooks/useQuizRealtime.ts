import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Question = Tables<"questions">;
type Answer = Tables<"answers">;

export function useActiveQuestion() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActive = useCallback(async () => {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    setQuestion(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActive();

    const channel = supabase
      .channel("questions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions" },
        () => fetchActive()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchActive]);

  return { question, loading };
}

export function useAnswers(questionId: string | undefined) {
  const [answers, setAnswers] = useState<Answer[]>([]);

  const fetchAnswers = useCallback(async () => {
    if (!questionId) { setAnswers([]); return; }
    const { data } = await supabase
      .from("answers")
      .select("*")
      .eq("question_id", questionId);
    setAnswers(data || []);
  }, [questionId]);

  useEffect(() => {
    fetchAnswers();

    if (!questionId) return;

    const channel = supabase
      .channel(`answers-${questionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `question_id=eq.${questionId}` },
        (payload) => {
          setAnswers((prev) => [...prev, payload.new as Answer]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [questionId, fetchAnswers]);

  return answers;
}

export function useAllQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .order("display_order", { ascending: true });
    setQuestions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("all-questions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions" },
        () => fetchAll()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return { questions, loading, refetch: fetchAll };
}
