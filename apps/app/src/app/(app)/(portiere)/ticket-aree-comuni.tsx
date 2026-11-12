import { TicketAreeComuniScreen } from '@/screens/TicketAreeComuniScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function TicketAreeComuniPage() {
  return (
    <GuardiaModulo modulo="abilita_ticket" titolo="Ticket aree comuni non attivi">
      <TicketAreeComuniScreen />
    </GuardiaModulo>
  );
}

