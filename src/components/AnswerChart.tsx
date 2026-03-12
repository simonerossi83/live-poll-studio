import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { CheckCircle2 } from "lucide-react";
import type { AnswerWithSchool } from "@/hooks/useQuizRealtime";

const CORRECT_COLOR = "hsl(142, 71%, 45%)";
const SCHOOL_COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(199, 89%, 48%)",
  "hsl(262, 80%, 60%)",
  "hsl(35, 92%, 55%)",
  "hsl(0, 72%, 55%)",
];

interface AnswerChartProps {
  answers: AnswerWithSchool[];
  correctIndex: number;
}

export function AnswerChart({ answers, correctIndex }: AnswerChartProps) {
  // Group by school: count total answers and correct answers per school
  const schoolMap: Record<string, { total: number; correct: number }> = {};
  for (const a of answers) {
    const school = a.students?.schools?.name ?? "Unknown";
    if (!schoolMap[school]) schoolMap[school] = { total: 0, correct: 0 };
    schoolMap[school].total++;
    if (a.selected_option_index === correctIndex) schoolMap[school].correct++;
  }

  const data = Object.entries(schoolMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([school, { total, correct }]) => ({
      school: school.length > 18 ? school.slice(0, 18) + "…" : school,
      fullSchool: school,
      correct,
      total,
      pct: total > 0 ? Math.round((correct / total) * 100) : 0,
    }));

  const totalCorrect = answers.filter((a) => a.selected_option_index === correctIndex).length;
  const totalAnswers = answers.length;

  if (answers.length === 0) {
    return (
      <div className="w-full mt-4 text-center text-sm text-muted-foreground py-6">
        Waiting for answers…
      </div>
    );
  }

  const chartHeight = Math.max(160, data.length * 52);

  return (
    <div className="w-full mt-4">
      <div className="flex items-center gap-2 mb-3 px-1">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        <span className="text-sm font-semibold text-success">
          {totalCorrect} correct
        </span>
        <span className="text-sm text-muted-foreground">
          out of {totalAnswers} {totalAnswers === 1 ? "response" : "responses"}
        </span>
      </div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="school" width={110} tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                fontSize: 13,
              }}
              formatter={(_value: number, _name: string, props: any) => [
                `${props.payload.correct} / ${props.payload.total} students (${props.payload.pct}%)`,
                props.payload.fullSchool,
              ]}
            />
            <Bar dataKey="correct" radius={[0, 6, 6, 0]} maxBarSize={38}>
              {data.map((_, i) => (
                <Cell key={i} fill={SCHOOL_COLORS[i % SCHOOL_COLORS.length]} />
              ))}
              <LabelList
                dataKey="correct"
                position="right"
                fontSize={12}
                fontWeight={700}
                formatter={(v: number) => (v > 0 ? v : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
