import React from "react";
import { Redirect, Slot, usePathname, type Href } from "expo-router";
import { SessionLoading } from "@/components/auth/SessionLoading";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { ProfiloProvider } from "@/context/ProfiloContext";

/**
 * Guardia delle pagine protette. Finché la sessione non è letta mostra il caricamento (niente lampo
 * della pagina protetta); senza sessione porta a /login ricordando la pagina richiesta. Con la sessione
 * carica il profilo reale e disegna il layout dell’app. Se la password non è ancora stata scelta (invito o
 * recupero) porta alla schermata per sceglierla.
 */
export default function ProtectedLayout() {
  const { status, passwordPending } = useAuth();
  const pathname = usePathname();

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
        <Slot />
      </AppShell>
    </ProfiloProvider>
  );
}
