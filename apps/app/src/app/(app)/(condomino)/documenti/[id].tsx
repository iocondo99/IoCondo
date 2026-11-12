import { DettaglioDocumentoScreen } from '@/screens/DettaglioDocumentoScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function DettaglioDocumentoPage() {
  return (
    <GuardiaModulo modulo="abilita_documenti" titolo="Documenti non attivi">
      <DettaglioDocumentoScreen />
    </GuardiaModulo>
  );
}

