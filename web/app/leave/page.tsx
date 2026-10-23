import { SenderFlow } from "@/components/Flow/SenderFlow";
import { Gate } from "@/components/Gate/Gate";

// The recorder flow, screens 01–05 (spec 9.2). Screen 01 is rendered on the server;
// the rest happens in the browser, so the recording never leaves it until shared.
export default function LeavePage() {
  return <SenderFlow gate={<Gate />} turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? null} />;
}
