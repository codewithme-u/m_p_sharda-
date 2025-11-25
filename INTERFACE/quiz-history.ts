export interface QuizHistory {
  id: number;
  quizTitle: string;
  quizCode: string; // ✅ Added
  score: number;
  totalQuestions: number;
  dateAttempted: string;
  status: 'Completed' | 'Incomplete';
}