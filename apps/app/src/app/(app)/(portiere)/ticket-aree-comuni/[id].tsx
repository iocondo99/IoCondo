import { DettaglioTicketAreaComuneScreen } from '@/screens/DettaglioTicketAreaComuneScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function DettaglioTicketAreaComunePage() {
  return (
    <GuardiaModulo modulo="abilita_ticket" titolo="Ticket aree comuni non attivi">
      <DettaglioTicketAreaComuneScreen />
    </GuardiaModulo>
  );
}

