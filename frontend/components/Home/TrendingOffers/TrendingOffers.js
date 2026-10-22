"use client";
import { MdArrowForward } from "react-icons/md";
import React, { useRef, useState } from "react";
// Import Swiper React components
import { Swiper, SwiperSlide } from "swiper/react";

// Import Swiper styles
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/pagination";
import TrendingOffersCard from "./TrendingOffersCard";

const trendingData = [
  {
    id:1,
    name:"Top Deal Australia",
    description:"Limited time deal",
    discount:25,
    img:'/images/home/offer.png'
  },
  {
    id:2,
    name:"Top Deal Australia",
    description:"Limited time deal",
    discount:25,
    img:'/images/home/offer.png'
  },
  {
    id:3,
    name:"Top Deal Australia",
    description:"Limited time deal",
    discount:25,
    img:'/images/home/offer.png'
  },
  {
    id:4,
    name:"Top Deal Australia",
    description:"Limited time deal",
    discount:25,
    img:'/images/home/offer.png'
  },
  {
    id:5,
    name:"Top Deal Australia",
    description:"Limited time deal",
    discount:25,
    img:'/images/home/offer.png'
  },
  {
    id:6,
    name:"Top Deal Australia",
    description:"Limited time deal",
    discount:25,
    img:'/images/home/offer.png'
  },
  {
    id:7,
    name:"Top Deal Australia",
    description:"Limited time deal",
    discount:25,
    img:'/images/home/offer.png'
  },
  {
    id:8,
    name:"Top Deal Australia",
    description:"Limited time deal",
    discount:25,
    img:'/images/home/offer.png'
  },
]

const TrendingOffers = () => {
  return (
    <div className="py-10 bg-white">
    <div>
      <div className="text-center">
      <h2 className="text-[20px] md:text-[35px] font-bold text-center">
      Trending offers
      </h2>
      <p>Best deal offer</p>
      </div>
      <div className=" mt-10 ">
        <Swiper
            breakpoints={{
              // when window width is >= 340px
              340: {
                slidesPerView: 2,
              },
              // when window width is >= 640px
              640: {
                slidesPerView: 3,
              },
              // when window width is >= 768px
              768: {
                slidesPerView: 3,
              },
              // when window width is >= 1024px
              992: {
                slidesPerView: 4,
              },
              1200: {
                slidesPerView: 5,
              },
              1620: {
                slidesPerView: 5,
              },
            }}
          spaceBetween={10}
        >
          {trendingData.map((data) => (
            <SwiperSlide key={data.id}>
              <TrendingOffersCard data={data} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <button className="flex gap-2 mt-10 justify-center items-center mx-auto cursor-pointer ring-1 ring-primary  text-primary py-1 px-5 rounded text-center hover:bg-primary hover:text-white transition duration-300">
        <span>ALL Trending offers</span> <MdArrowForward />
      </button>
    </div>
  </div>
  )
}

export default TrendingOffers