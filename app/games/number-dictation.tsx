import DictationGame from '@/components/games/DictationGame';

// FB187: „mondja spanyolul nekem meg le kell írnom akár a számot" — a szám-ág.
export default function NumberDictationScreen() {
  return <DictationGame gameId="number-dictation" mode="number" />;
}
