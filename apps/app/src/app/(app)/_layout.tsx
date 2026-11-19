import React, { useEffect } from "react";
import { Redirect, Slot, usePathname, type Href } from "expo-router";
import { SessionLoading } from "@/components/auth/SessionLoading";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { ProfiloProvider } from "@/context/ProfiloContext";
import { ConfineErrori, avviaRaccoltaErrori } from "@/lib/logErrori";

/**
 * Guardia delle pagine protette. Finché la sessione non è letta mostra il caricamento (niente lampo
 * della pagina protetta); senza sessione porta a /login ricordando la pagina richiesta. Con la sessione
 * carica il profilo reale e disegna il layout dell’app. Se la password non è ancora stata scelta (invito o
 * recupero) porta alla schermata per sceglierla.
 */
export default function ProtectedLayout() {
  const { status, passwordPending } = useAuth();
  const pathname = usePathname();

  // Errori non gestiti dell'app: registrati solo con la sessione aperta (servono l'utente e i permessi).
  useEffect(() => (status === "authenticated" ? avviaRaccoltaErrori() : undefined), [status]);

  if (status === "loading") return <SessionLoading />;
  if (status === "unauthenticated") {
    const target = pathname && pathname !== "/" ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
    // Il caricamento resta visibile finché la nuova pagina non è pronta: niente schermo vuoto.
    return (
      <>
        <Redirect href={target as Href} />
        <SessionLoading />
      </>
    );
  }

  // Sessione aperta da un link di invito o di recupero: senza la password scelta non si entra nell'app.
  if (passwordPending) {
    return (
      <>
        <Redirect href={(passwordPending === "invite" ? "/imposta-password" : "/reimposta-password") as Href} />
        <SessionLoading />
      </>
    );
  }

  return (
    <ProfiloProvider>
      <AppShell>
        <ConfineErrori ripiego={<SessionLoading message="Si è verificato un errore. Ricarica la pagina." />}>
          <Slot />
        </ConfineErrori>
      </AppShell>
    </ProfiloProvider>
  );
}
