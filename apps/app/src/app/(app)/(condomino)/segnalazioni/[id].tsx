import { DettaglioSegnalazioneScreen } from '@/screens/DettaglioSegnalazioneScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function DettaglioSegnalazionePage() {
  return (
    <GuardiaModulo modulo="abilita_ticket" titolo="Segnalazioni non attive">
      <DettaglioSegnalazioneScreen />
    </GuardiaModulo>
  );
}

