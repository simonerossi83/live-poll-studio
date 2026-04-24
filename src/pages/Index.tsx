import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateUsername } from "@/lib/username";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap } from "lucide-react";
import { isValidUUID, sanitizeText } from "@/lib/utils";

const Index = () => {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  // If the student has already joined, redirect back to the quiz
  useEffect(() => {
    const existingStudentId = sessionStorage.getItem("studentId");
    if (existingStudentId && isValidUUID(existingStudentId)) {
      navigate(`/quiz?student=${existingStudentId}`, { replace: true });
    } else if (existingStudentId) {
      // Invalid stored ID — clear it
      sessionStorage.removeItem("studentId");
    }
  }, [navigate]);

  // Generate a username once per session
  useEffect(() => {
    if (!sessionStorage.getItem("username")) {
      sessionStorage.setItem("username", generateUsername());
    }
  }, []);

  useEffect(() => {
    supabase.from("schools").select("id, name").order("name").then(({ data }) => {
      if (data) setSchools(data);
    });
  }, []);

  const handleJoin = async () => {
    if (!selectedSchool || !isValidUUID(selectedSchool)) return;
    setJoining(true);
    const username = sanitizeText(
      sessionStorage.getItem("username") ?? generateUsername(),
      30
    );
    sessionStorage.setItem("username", username);
    const { data, error } = await supabase
      .from("students")
      .insert({ school_id: selectedSchool, username })
      .select("id")
      .single();

    if (data && !error) {
      sessionStorage.setItem("studentId", data.id);
      navigate(`/quiz?student=${data.id}`);
    }
    setJoining(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg border-0 bg-card">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Live Quiz</CardTitle>
          <CardDescription className="text-base">Select your class to join the quiz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <Select value={selectedSchool} onValueChange={setSelectedSchool}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Choose your class" />
            </SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={!selectedSchool || joining}
            onClick={handleJoin}
          >
            {joining ? "Joining…" : "Join Quiz"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
