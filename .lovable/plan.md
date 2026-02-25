

# Live Quiz App — Implementation Plan

## Overview
A real-time classroom quiz app where an admin controls questions and students answer live, with instant feedback and live-updating charts.

---

## 1. Database (Supabase)

- **Schools** — 5 predefined schools (placeholder names: School A–E)
- **Students** — tracks each student session (school selection, anonymous)
- **Questions** — question text, multiple choice options, correct answer, active/inactive status
- **Answers** — stores each student's submitted answer per question

Real-time subscriptions enabled on questions and answers tables so everything updates live.

---

## 2. Student Flow

### Login Screen
- Clean, centered card with a dropdown to select one of 5 schools
- "Join" button → takes student to the quiz page
- No password, no account — just pick a school

### Quiz Page
- Shows **one question at a time** (the currently active question set by admin)
- Multiple choice options displayed as large, tappable buttons (mobile-friendly)
- Student selects an answer and clicks "Submit"
- **After submitting:**
  - Their selection is locked (cannot change)
  - The correct answer is highlighted in green, wrong answers in red
  - A live bar chart appears showing the distribution of all answers, updating in real time
- If no question is active, a waiting screen with a subtle animation is shown ("Waiting for the next question...")

---

## 3. Admin Interface

### Access
- Navigate to `/admin` → prompted for a simple password (hardcoded or stored as env variable)

### Question Management
- Create new questions with a text field + multiple choice options (2–6 options)
- Mark one option as the correct answer
- Edit existing questions
- List of all questions with status indicators

### Live Control Panel
- **Activate** a question → instantly pushes it to all connected students
- **Deactivate** the current question (hides it from students)
- See the count of how many students have answered the current question
- Live bar chart showing answer distribution in real time
- Button to move to the next question

---

## 4. Real-Time Features (Supabase Realtime)
- When admin activates a question → students see it instantly
- When a student submits → the bar chart updates live for everyone (admin + students)
- No page refresh needed

---

## 5. Design & UX
- Modern, clean UI using shadcn/ui components
- Fully responsive / mobile-first layout
- Color-coded answer feedback (green = correct, red = incorrect)
- Animated bar chart using Recharts
- Waiting states with friendly messaging and subtle animations

