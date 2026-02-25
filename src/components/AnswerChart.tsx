import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_COLORS } from "@/lib/constants";

interface AnswerChartProps {
  options: string[];
  answers: { selected_option_index: number }[];
}

export function AnswerChart({ options, answers }: AnswerChartProps) {
  const data = options.map((label, index) => ({
    name: label.length > 20 ? label.slice(0, 20) + "…" : label,
    count: answers.filter((a) => a.selected_option_index === index).length,
  }));

  const totalAnswers = answers.length;

  return (
    <div className="w-full mt-6">
      <p className="text-sm text-muted-foreground mb-2">
        {totalAnswers} {totalAnswers === 1 ? "response" : "responses"}
      </p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={36}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
