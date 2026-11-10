import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import ExamChoiceCard from '@/components/exam/ExamChoiceCard';
import ExamMatchCard from '@/components/exam/ExamMatchCard';
import ExamTilesCard from '@/components/exam/ExamTilesCard';
import ExamTypeCard from '@/components/exam/ExamTypeCard';

// One question of a grammar test on its exam card (the lesson test and the random round share it).
// `instant`: no reveal and Next on the card, `onDone` fires at once (the match card has no such mode, the random round leaves it out).
export default function TestQuestionView({
  q,
  learnedLang,
  strictAccents,
  instant,
  bottomPad,
  onDone,
}: {
  q: LessonTestQuestion;
  learnedLang: string;
  strictAccents: boolean;
  instant?: boolean;
  bottomPad?: number;
  onDone: (correct: boolean, given?: string) => void;
}) {
  const v = q.view;
  switch (v.card) {
    case 'choice':
      return <ExamChoiceCard heading={v.heading} text={v.text} options={v.options} correctIndex={v.correctIndex} instant={instant} onDone={onDone} />;
    case 'type':
      return (
        <ExamTypeCard
          prompt={v.prompt}
          bottomPad={bottomPad}
          hint={v.hint}
          answer={v.answer}
          accept={v.accept}
          sentence={v.sentence}
          targetLang={learnedLang}
          strictAccents={strictAccents}
          keepUmlauts={v.keepUmlauts}
          instant={instant}
          onDone={onDone}
        />
      );
    case 'tiles':
      return <ExamTilesCard prompt={v.prompt} answerTokens={v.answerTokens} sentence={v.sentence} distractors={[]} instant={instant} onDone={onDone} />;
    case 'match':
      return <ExamMatchCard pairs={v.pairs} onDone={onDone} />;
  }
}
