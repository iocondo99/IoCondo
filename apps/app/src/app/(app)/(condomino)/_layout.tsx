import React from "react";
import { GuardiaVista } from "@/components/layout/GuardiaVista";

export default function Guardia() {
  return <GuardiaVista vista="RESIDENTE" ruoli={["CONDOMINO", "PORTIERE"]} />;
}
