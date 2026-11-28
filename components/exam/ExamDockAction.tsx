import { useDockedAction } from '@/components/learn/DockSlot';
import type { DockedActionTone } from '@/components/learn/DockedAction';

// Announces the docked bar's button for an exam screen that has no card of its own to do it (the mock exam's
// Next / Finish, the exam round's Check / Next / Done). Draws nothing: the screen's DockSlot host draws the bar.
type Props = {
  tone: DockedActionTone;
  /** Only where the word is not the shared default (the last task's finish / done); otherwise leave it out. */
  label?: string;
  testID: string;
  disabled?: boolean;
  onPress: () => void;
};

export default function ExamDockAction({ tone, label, testID, disabled, onPress }: Props) {
  useDockedAction({ tone, label, testID, disabled, onPress });
  return null;
}
