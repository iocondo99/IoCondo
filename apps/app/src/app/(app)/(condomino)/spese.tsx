import { SpeseScreen } from '@/screens/SpeseScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function SpesePage() {
  return (
    <GuardiaModulo modulo="abilita_spese" titolo="Spese non attive">
      <SpeseScreen />
    </GuardiaModulo>
  );
}
