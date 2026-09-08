import DictationGame from '@/components/games/DictationGame';

// FB187: „…akár a dátumot. legyen két külön. Legyenek benne hónapok és napok is."
export default function DateDictationScreen() {
  return <DictationGame gameId="date-dictation" mode="date" />;
}
