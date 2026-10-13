import { usePcicSession } from '@/lib/learn/usePcicSession';
import PcicCardView from '@/components/learn/PcicCardView';

// The PCIC tab: the session hook (lib/learn/usePcicSession.ts) feeds the card view
// (components/learn/PcicCardView.tsx).
export default function PcicScreen() {
  const session = usePcicSession();
  return <PcicCardView {...session} />;
}
