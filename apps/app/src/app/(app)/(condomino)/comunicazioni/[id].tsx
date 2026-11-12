import { DettaglioComunicazioneScreen } from '@/screens/DettaglioComunicazioneScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function DettaglioComunicazionePage() {
  return (
    <GuardiaModulo modulo={['abilita_bacheca', 'abilita_chat']} titolo="Comunicazioni non attive">
      <DettaglioComunicazioneScreen />
    </GuardiaModulo>
  );
}

