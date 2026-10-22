"use client";
import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import HeroQwlee from "@/components/Home/HeroQwlee/HeroQwlee";
import MarketplaceStats from "@/components/Home/HeroSection/MarketplaceStats";
import RecentlyViewedGigs from "@/components/Home/RecentlyViewed/RecentlyViewedGigs";
import RecommendedGigs from "@/components/Home/Recommended/RecommendedGigs";
import JoinCNNCTR from "@/components/Home/JoinCNNCTR/JoinCNNCTR";
import MostPopularCategories from "@/components/Home/MostPopularCategories/MostPopularCategories";
import MostPopularFreelancers from "@/components/Home/MostPopularFreelancers/MostPopularFreelancers";
import Testimonials from "@/components/Home/Testimonials/Testimonials";
import TheLatestNewsAndBlog from "@/components/Home/TheLatestNewsAndBlog/TheLatestNewsAndBlog";
import WhyChooseUs from "@/components/Home/WhyChooseUs/WhyChooseUs";
import Reveal from "@/components/common/Reveal";

// Every section animates in on scroll via a shared <Reveal> wrapper.
// The hero stays animation-free (it's above the fold and instant content
// is the priority) — animations only kick in for sections the user
// reaches by scrolling.
const Home = () => {
  return (
    <PrimaryLayout>
      <main>
        <HeroQwlee />
        <Reveal>
          <MarketplaceStats />
        </Reveal>
        {/* Renders nothing for first-time visitors with empty localStorage */}
        <Reveal>
          <RecentlyViewedGigs />
        </Reveal>
        <Reveal>
          <RecommendedGigs />
        </Reveal>
        <Reveal>
          <MostPopularCategories />
        </Reveal>
        <Reveal>
          <MostPopularFreelancers />
        </Reveal>
        <Reveal>
          <WhyChooseUs />
        </Reveal>
        <Reveal>
          <Testimonials />
        </Reveal>
        <Reveal>
          <JoinCNNCTR />
        </Reveal>
        <Reveal>
          <TheLatestNewsAndBlog />
        </Reveal>
      </main>
    </PrimaryLayout>
  );
};

export default Home;
