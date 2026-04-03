import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Loader2, Timer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

const RANK_POLL_INTERVAL_MS = 30_000; // safety-net (was 2s)
const RANK_DEBOUNCE_MS = 500; // batch rapid events

const SCHOOL_COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(199, 89%, 48%)",
  "hsl(262, 80%, 60%)",
  "hsl(35, 92%, 55%)",
  "hsl(0, 72%, 55%)",
  "hsl(310, 60%, 50%)",
  "hsl(170, 65%, 40%)",
  "hsl(50, 85%, 50%)",
];

const MEDAL_CONFIG = {
  1: {
    circle: "bg-yellow-400 text-yellow-900 shadow-yellow-200",
    bar: "bg-yellow-400/20 border-yellow-400 text-yellow-700",
    barH: "h-28",
  },
  2: {
    circle: "bg-slate-300 text-slate-700 shadow-slate-200",
    bar: "bg-slate-200/40 border-slate-400 text-slate-700",
    barH: "h-20",
  },
  3: {
    circle: "bg-orange-400 text-orange-900 shadow-orange-100",
    bar: "bg-orange-400/20 border-orange-400 text-orange-700",
    barH: "h-16",
  },
} as const;

function MedalCircle({ rank }: { rank: 1 | 2 | 3 }) {
  const cfg = MEDAL_CONFIG[rank];
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-md ${cfg.circle}`}
    >
      {rank}
    </div>
  );
}

function fmtTime(ms: number | null): string {
  if (ms === null) return "";
  return (ms / 1000).toFixed(1) + "s";
}

interface SchoolRankRow {
  school: string;
  correct: number;
  total: number;
  pct: number;
  studentsInSchool: number;
  weightedScore: number; // correct / studentsInSchool  (avg correct per student)
}

interface PlayerRankRow {
  username: string;
  correct: number;
  avgTimeMs: number | null;
}

interface PodiumItem {
  player: PlayerRankRow;
  rank: 1 | 2 | 3;
}

const Rank = () => {
  const [data, setData] = useState<SchoolRankRow[]>([]);
  const [top3, setTop3] = useState<PlayerRankRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [questionsRes, answersRes, studentsRes, schoolsRes] = await Promise.all([
      supabase.from("questions").select("id, correct_option_index"),
      supabase.from("answers").select("*"),
      supabase.from("students").select("id, school_id, username"),
      supabase.from("schools").select("id, name"),
    ]);

    const questions = questionsRes.data;
    const answers = answersRes.data;
    const students = studentsRes.data;
    const schools = schoolsRes.data;

    if (
      !Array.isArray(questions) ||
      !Array.isArray(answers) ||
      !Array.isArray(students) ||
      !Array.isArray(schools)
    ) {
      setLoading(false);
      return;
    }

    const correctMap = new Map<string, number>();
    for (const q of questions) {
      correctMap.set(q.id as string, q.correct_option_index as number);
    }

    const studentSchoolMap = new Map<string, string>();
    const studentUsernameMap = new Map<string, string>();
    for (const s of students) {
      studentSchoolMap.set(s.id as string, s.school_id as string);
      if (s.username) studentUsernameMap.set(s.id as string, s.username as string);
    }

    const schoolNameMap = new Map<string, string>();
    for (const s of schools) {
      schoolNameMap.set(s.id as string, s.name as string);
    }

    // Build studentsPerSchool count using DB data (dynamic, not hardcoded)
    const studentsPerSchool: Record<string, number> = {};
    for (const s of students) {
      const sId = s.school_id as string;
      const sName = sId ? (schoolNameMap.get(sId) ?? "Unknown") : "Unknown";
      studentsPerSchool[sName] = (studentsPerSchool[sName] ?? 0) + 1;
    }

    const schoolMap: Record<string, { correct: number; total: number }> = {};
    const playerMap: Record<string, { correct: number; totalTimeMs: number; timeCount: number }> = {};

    for (const a of answers) {
      const studentId = a.student_id as string;
      const schoolId = studentSchoolMap.get(studentId);
      const schoolName = schoolId ? (schoolNameMap.get(schoolId) ?? "Unknown") : "Unknown";

      if (!schoolMap[schoolName]) schoolMap[schoolName] = { correct: 0, total: 0 };
      schoolMap[schoolName].total++;

      const correctIdx = correctMap.get(a.question_id as string);
      const isCorrect =
        correctIdx !== undefined && (a.selected_option_index as number) === correctIdx;

      if (isCorrect) schoolMap[schoolName].correct++;

      const uname = studentUsernameMap.get(studentId);
      if (uname) {
        if (!playerMap[uname]) playerMap[uname] = { correct: 0, totalTimeMs: 0, timeCount: 0 };
        if (isCorrect) playerMap[uname].correct++;
        const rt = a.response_time_ms as number | null;
        if (rt !== null && rt !== undefined) {
          playerMap[uname].totalTimeMs += rt;
          playerMap[uname].timeCount++;
        }
      }
    }

    const rows: SchoolRankRow[] = Object.entries(schoolMap)
      .map(([school, { correct, total }]) => {
        const displayName = school.length > 22 ? school.slice(0, 22) + "..." : school;
        const studentsInSchool = studentsPerSchool[school] ?? 1;
        const weightedScore = parseFloat((correct / studentsInSchool).toFixed(2));
        return {
          school: displayName,
          correct,
          total,
          pct: total > 0 ? Math.round((correct / total) * 100) : 0,
          studentsInSchool,
          weightedScore,
        };
      })
      .sort((a, b) => b.weightedScore - a.weightedScore);

    setData(rows);

    const playerRows: PlayerRankRow[] = Object.entries(playerMap)
      .map(([username, { correct, totalTimeMs, timeCount }]) => ({
        username,
        correct,
        avgTimeMs: timeCount > 0 ? Math.round(totalTimeMs / timeCount) : null,
      }))
      .sort((a, b) => {
        if (b.correct !== a.correct) return b.correct - a.correct;
        const ta = a.avgTimeMs ?? Infinity;
        const tb = b.avgTimeMs ?? Infinity;
        return ta - tb;
      })
      .slice(0, 3);

    setTop3(playerRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Debounce handler for realtime events
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchData, RANK_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("rank-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "answers" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, debouncedFetch)
      .subscribe();

    // Safety-net polling (30s)
    const interval = setInterval(fetchData, RANK_POLL_INTERVAL_MS);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Build podium: rank is locked to sorted position, visual order is 2nd-1st-3rd
  const podiumItems: PodiumItem[] = (() => {
    if (top3.length === 0) return [];
    const ranked: PodiumItem[] = top3.map((player, i) => ({
      player,
      rank: (i + 1) as 1 | 2 | 3,
    }));
    if (ranked.length === 1) return ranked;
    if (ranked.length === 2) return [ranked[1], ranked[0]];
    return [ranked[1], ranked[0], ranked[2]];
  })();

  const chartHeight = Math.max(200, data.length * 56);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 bg-background">

      {/* Top Players Podium */}
      {top3.length > 0 && (
        <Card className="w-full max-w-2xl shadow-lg border-0 bg-card">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold">Top Players</CardTitle>
            <CardDescription>
              Correct answers  tiebreak by fastest avg response
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-center gap-4 pt-2 pb-4">
              {podiumItems.map(({ player, rank }) => {
                const cfg = MEDAL_CONFIG[rank];
                return (
                  <div
                    key={`${player.username}-${rank}`}
                    className="flex flex-col items-center gap-1.5 flex-1 max-w-[150px]"
                  >
                    <MedalCircle rank={rank} />
                    <span className="text-sm font-semibold text-center break-all leading-tight">
                      {player.username}
                    </span>
                    {player.avgTimeMs !== null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="h-3 w-3" />
                        {fmtTime(player.avgTimeMs)}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t-lg flex flex-col items-center justify-center gap-0.5 font-bold text-lg ${cfg.barH} ${cfg.bar} border-t-2 border-x-2`}
                    >
                      <span>{player.correct}</span>
                      <span className="text-xs font-normal opacity-70">correct</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* School Ranking */}
      <Card className="w-full max-w-2xl shadow-lg border-0 bg-card">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Trophy className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">School Ranking</CardTitle>
          <CardDescription className="text-base">
            Average correct answers per student, grouped by school
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No answers have been submitted yet.
            </p>
          ) : (
            <div style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={true}
                    tick={{ fontSize: 12 }}
                    domain={[0, "dataMax"]}
                  />
                  <YAxis
                    type="category"
                    dataKey="school"
                    width={130}
                    tick={{ fontSize: 13 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: 13,
                    }}
                    formatter={(_value: number, _name: string, props: any) => [
                      `${props.payload.weightedScore.toFixed(2)} correct/student  (${props.payload.correct} correct, ${props.payload.studentsInSchool} students, ${props.payload.pct}% accuracy)`,
                      props.payload.school,
                    ]}
                  />
                  <Bar dataKey="weightedScore" radius={[0, 6, 6, 0]} maxBarSize={40}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={SCHOOL_COLORS[i % SCHOOL_COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="weightedScore"
                      position="right"
                      fontSize={13}
                      fontWeight={700}
                      formatter={(v: number) => (v > 0 ? v.toFixed(2) : "")}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Rank;
