import type { Metadata } from "next";
import { SuspendedNotice } from "@/components/suspended-notice";

export const metadata: Metadata = { title: "Hizmet durduruldu", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function Suspended() {
  return <SuspendedNotice />;
}
