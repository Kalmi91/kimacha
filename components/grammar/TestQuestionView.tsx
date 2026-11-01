import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import ExamChoiceCard from '@/components/exam/ExamChoiceCard';
import ExamMatchCard from '@/components/exam/ExamMatchCard';
import ExamTilesCard from '@/components/exam/ExamTilesCard';
import ExamTypeCard from '@/components/exam/ExamTypeCard';

// One question of a grammar test on its exam card (the lesson test and the random round share it).
export default function TestQuestionView({
  q,
  learnedLang,
  strictAccents,
  onDone,
}: {
  q: LessonTestQuestion;
  learnedLang: string;
  strictAccents: boolean;
  onDone: (correct: boolean) => void;
}) {
  const v = q.view;
  switch (v.card) {
    case 'choice':
      return <ExamChoiceCard heading={v.heading} text={v.text} options={v.options} correctIndex={v.correctIndex} onDone={onDone} />;
    case 'type':
      return (
        <ExamTypeCard
          prompt={v.prompt}
          hint={v.hint}
          answer={v.answer}
          accept={v.accept}
          sentence={v.sentence}
          targetLang={learnedLang}
          strictAccents={strictAccents}
          onDone={onDone}
        />
      );
    case 'tiles':
      return <ExamTilesCard prompt={v.prompt} answerTokens={v.answerTokens} sentence={v.sentence} distractors={[]} onDone={onDone} />;
    case 'match':
      return <ExamMatchCard pairs={v.pairs} onDone={onDone} />;
  }
}
