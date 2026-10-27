import { redirect } from "next/navigation";

// Short link → Learn hub (guides list still at /blogs?kind=guide).
export default function Guides() {
  redirect("/learn");
}
