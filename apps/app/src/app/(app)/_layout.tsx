import React from "react";
import { Redirect, Slot, usePathname, type Href } from "expo-router";
import { SessionLoading } from "@/components/auth/SessionLoading";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { ProfiloProvider } from "@/context/ProfiloContext";

/**
 * Guardia delle pagine protette. Finché la sessione non è letta mostra il caricamento (niente lampo
 * della pagina protetta); senza sessione porta a /login ricordando la pagina richiesta. Con la sessione
 * carica il profilo reale e disegna il layout dell’app.
 */
export default function ProtectedLayout() {
  const { status } = useAuth();
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

  return (
    <ProfiloProvider>
      <AppShell>
        <Slot />
      </AppShell>
    </ProfiloProvider>
  );
}
