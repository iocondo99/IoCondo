import { DocumentiScreen } from '@/screens/DocumentiScreen';
import { GuardiaModulo } from '@/components/layout/GuardiaModulo';

export default function DocumentiPage() {
  return (
    <GuardiaModulo modulo="abilita_documenti" titolo="Documenti non attivi">
      <DocumentiScreen />
    </GuardiaModulo>
  );
}
