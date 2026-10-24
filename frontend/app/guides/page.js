import { redirect } from "next/navigation";

// Short link for the guides list.
export default function Guides() {
  redirect("/blogs?kind=guide");
}
