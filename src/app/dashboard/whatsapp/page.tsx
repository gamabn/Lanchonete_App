"use client";

import { useCallback, useContext } from "react";
import { Context } from "@/app/Context";
import { WhatsAppPanel } from "./WhatsAppPanel";

export default function WhatsAppPage() {
  const { user, authStatus, revalidateAuth } = useContext(Context);
  const expired = useCallback(() => { void revalidateAuth(); }, [revalidateAuth]);
  // A new authenticated owner gets a new component/controller; late prior responses cannot carry QR across accounts.
  return authStatus === "authenticated" && user ? <WhatsAppPanel key={user.id} ownerId={user.id} onExpired={expired} /> : null;
}
