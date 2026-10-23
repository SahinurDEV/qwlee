import { Suspense } from "react";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import AiAssistant from "@/components/AiAssistant/AiAssistant";

export const metadata = { title: "AI assistant" };

export default function Page() {
  return (
    <PrimaryLayout>
      <Suspense fallback={null}>
        <AiAssistant />
      </Suspense>
    </PrimaryLayout>
  );
}
