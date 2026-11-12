import { PacchiScreen } from '@/screens/PacchiScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function PacchiPage() {
  return (
    <GuardiaModulo modulo="abilita_pacchi" titolo="Registro pacchi non attivo">
      <PacchiScreen />
    </GuardiaModulo>
  );
}
