import React from "react";
import { Redirect, type Href } from "expo-router";
import { homeDi } from "@iocondo/data";
import { NonAutorizzato } from "@iocondo/ui";
import { useProfilo } from "@/context/ProfiloContext";

/** "/" porta alla pagina iniziale della vista attiva. */
export default function IndiceRoute() {
  const { vista } = useProfilo();
  if (!vista) return <NonAutorizzato />;
  return <Redirect href={homeDi(vista) as Href} />;
}
