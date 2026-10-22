import { Suspense } from "react";
import GoogleCallback from "@/components/SignIn/GoogleCallback";

export const metadata = { title: "Signing in | Qwlee" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GoogleCallback />
    </Suspense>
  );
}
