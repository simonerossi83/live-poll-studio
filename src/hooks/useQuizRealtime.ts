import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Question = Tables<"questions">;

/** Answer row enriched with school name via students join */
export type AnswerWithSchool = {
  id: string;
  question_id: string;
  student_id: string;
  selected_option_index: number;
  created_at: string;
  students: { schools: { name: string } | null } | null;
};

// ---------------------------------------------------------------------------
// Debounce helper — batches rapid-fire realtime events into a single fetch
// ---------------------------------------------------------------------------
function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number,
): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback(
    (...args: any[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs],
  ) as unknown as T;
}

// ---------------------------------------------------------------------------
// Shared caches for students & schools (rarely change, read by many hooks)
// ---------------------------------------------------------------------------
let _studentCache: Map<string, string> | null = null; // student_id → school_id
let _schoolCache: Map<string, string> | null = null;  // school_id → name
let _cacheTs = 0;
const CACHE_TTL_MS = 30_000; // refresh every 30 seconds at most

async function getStudentSchoolMaps() {
  const now = Date.now();
  if (_studentCache && _schoolCache && now - _cacheTs < CACHE_TTL_MS) {
    return { studentSchoolMap: _studentCache, schoolNameMap: _schoolCache };
  }

  const [studentsRes, schoolsRes] = await Promise.all([
    supabase.from("students").select("id, school_id"),
    supabase.from("schools").select("id, name"),
  ]);

  const studentSchoolMap = new Map<string, string>();
  for (const s of studentsRes.data ?? []) {
    studentSchoolMap.set(s.id as string, s.school_id as string);
  }
  const schoolNameMap = new Map<string, string>();
  for (const s of schoolsRes.data ?? []) {
    schoolNameMap.set(s.id as string, s.name as string);
  }

  _studentCache = studentSchoolMap;
  _schoolCache = schoolNameMap;
  _cacheTs = now;
  return { studentSchoolMap, schoolNameMap };
}

/** Invalidate student/school cache (call when a new student joins) */
export function invalidateStudentCache() {
  _cacheTs = 0;
}

// ---------------------------------------------------------------------------
// POLLING_INTERVAL — safety-net fallback (main sync is via Realtime)
// ---------------------------------------------------------------------------
const POLLING_INTERVAL_MS = 30_000; // 30s (was 2s — x15 reduction)
const DEBOUNCE_MS = 300; // batch rapid events within 300ms

// ---------------------------------------------------------------------------
// useActiveQuestion
// ---------------------------------------------------------------------------
export function useActiveQuestion() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const fetchActive = useCallback(async () => {
    const [activeRes, allRes] = await Promise.all([
      supabase
        .from("questions")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase.from("questions").select("id", { count: "exact", head: true }),
    ]);
    setQuestion(activeRes.data as Question | null);
    // Use count header instead of downloading all ids
    setTotalQuestions(allRes.count ?? 0);
    setLoading(false);
  }, []);

  const debouncedFetch = useDebouncedCallback(fetchActive, DEBOUNCE_MS);

  useEffect(() => {
    fetchActive();

    const channel = supabase
      .channel("questions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions" },
        () => debouncedFetch(),
      )
      .subscribe();

    // Safety-net polling (30s instead of 2s)
    const interval = setInterval(fetchActive, POLLING_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchActive, debouncedFetch]);

  return { question, loading, totalQuestions };
}

// ---------------------------------------------------------------------------
// useAnswers
// ---------------------------------------------------------------------------
export function useAnswers(questionId: string | undefined) {
  const [answers, setAnswers] = useState<AnswerWithSchool[]>([]);

  const fetchAnswers = useCallback(async () => {
    if (!questionId) {
      setAnswers([]);
      return;
    }

    // Fetch answers for this question + use cached student/school maps
    const [answersRes, maps] = await Promise.all([
      supabase.from("answers").select("*").eq("question_id", questionId),
      getStudentSchoolMaps(),
    ]);

    const rawAnswers = answersRes.data ?? [];
    const { studentSchoolMap, schoolNameMap } = maps;

    // Check if any student_id is missing from cache → refresh once
    let needsRefresh = false;
    for (const a of rawAnswers) {
      if (!studentSchoolMap.has(a.student_id as string)) {
        needsRefresh = true;
        break;
      }
    }
    let finalStudentMap = studentSchoolMap;
    let finalSchoolMap = schoolNameMap;
    if (needsRefresh) {
      invalidateStudentCache();
      const fresh = await getStudentSchoolMaps();
      finalStudentMap = fresh.studentSchoolMap;
      finalSchoolMap = fresh.schoolNameMap;
    }

    const enriched: AnswerWithSchool[] = rawAnswers.map((a: any) => {
      const schoolId = finalStudentMap.get(a.student_id as string);
      const schoolName = schoolId ? finalSchoolMap.get(schoolId) ?? null : null;
      return {
        id: a.id,
        question_id: a.question_id,
        student_id: a.student_id,
        selected_option_index: a.selected_option_index,
        created_at: a.created_at,
        students: schoolName ? { schools: { name: schoolName } } : null,
      } satisfies AnswerWithSchool;
    });

    setAnswers(enriched);
  }, [questionId]);

  const debouncedFetch = useDebouncedCallback(fetchAnswers, DEBOUNCE_MS);

  useEffect(() => {
    fetchAnswers();

    if (!questionId) return;

    // Only subscribe to answers table filtered by question_id
    const channel = supabase
      .channel(`answers-${questionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "answers",
          filter: `question_id=eq.${questionId}`,
        },
        () => debouncedFetch(),
      )
      .subscribe();

    // Safety-net polling (30s)
    const interval = setInterval(fetchAnswers, POLLING_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [questionId, fetchAnswers, debouncedFetch]);

  return answers;
}

// ---------------------------------------------------------------------------
// useAllQuestions  (admin only — single user)
// ---------------------------------------------------------------------------
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

  const debouncedFetch = useDebouncedCallback(fetchAll, DEBOUNCE_MS);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("all-questions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions" },
        () => debouncedFetch(),
      )
      .subscribe();

    // Safety-net polling (30s)
    const interval = setInterval(fetchAll, POLLING_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchAll, debouncedFetch]);

  return { questions, loading, refetch: fetchAll };
}
