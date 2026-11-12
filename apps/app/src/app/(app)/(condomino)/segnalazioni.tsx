import { SegnalazioniScreen } from '@/screens/SegnalazioniScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function SegnalazioniPage() {
  return (
    <GuardiaModulo modulo="abilita_ticket" titolo="Segnalazioni non attive">
      <SegnalazioniScreen />
    </GuardiaModulo>
  );
}

