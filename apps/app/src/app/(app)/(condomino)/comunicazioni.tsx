import { ComunicazioniScreen } from '@/screens/ComunicazioniScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function ComunicazioniPage() {
  return (
    <GuardiaModulo modulo={['abilita_bacheca', 'abilita_chat']} titolo="Comunicazioni non attive">
      <ComunicazioniScreen />
    </GuardiaModulo>
  );
}
