import { DettaglioEsercizioScreen } from '@/screens/DettaglioEsercizioScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function DettaglioEsercizioPage() {
  return (
    <GuardiaModulo modulo="abilita_spese" titolo="Spese non attive">
      <DettaglioEsercizioScreen />
    </GuardiaModulo>
  );
}

