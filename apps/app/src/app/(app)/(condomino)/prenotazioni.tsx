import { PrenotazioniScreen } from '@/screens/PrenotazioniScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function PrenotazioniPage() {
  return (
    <GuardiaModulo modulo="abilita_prenotazioni" titolo="Prenotazioni non attive">
      <PrenotazioniScreen />
    </GuardiaModulo>
  );
}
