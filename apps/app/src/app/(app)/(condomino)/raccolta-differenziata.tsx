import { RaccoltaDifferenziataScreen } from '@/screens/RaccoltaDifferenziataScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function RaccoltaDifferenziataPage() {
  return (
    <GuardiaModulo modulo="abilita_raccolta_differenziata" titolo="Raccolta differenziata non attiva">
      <RaccoltaDifferenziataScreen />
    </GuardiaModulo>
  );
}
