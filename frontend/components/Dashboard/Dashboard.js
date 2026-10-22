"use client";
// Picks the seller or buyer dashboard from the active view mode (set
// via the navbar's Switch to Selling / Switch to Buying toggle), not
// the persisted user.role. A freelancer can browse as a buyer too.

import useUser from "@/hooks/useUser";
import useViewMode from "@/hooks/useViewMode";
import FreelancerDashboard from "./FreelancerDashboard/FreelancerDashboard";
import BuyerDashboard from "./BuyerDashboard/BuyerDashboard";

export default function Dashboard() {
  const user = useUser();
  const { isSelling, ready } = useViewMode(user);
  if (!ready) return <div className="min-h-[60vh]" aria-busy="true" />;
  return isSelling ? <FreelancerDashboard /> : <BuyerDashboard />;
}
