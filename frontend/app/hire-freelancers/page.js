// Server component — exports metadata. The dynamic({ssr:false}) child lives
// in HireFreelancersClient.js (a "use client" file) so it can call dynamic
// without conflicting with metadata export rules.

import HireFreelancersClient from "./HireFreelancersClient";

export const metadata = {
  title: "Hire Freelancers",
  description:
    "Browse Qwlee's vetted freelancers — developers, designers, video editors, marketers and more.",
};

export default function Page() {
  return <HireFreelancersClient />;
}
