"use client";
// Import Swiper React components
import { Swiper, SwiperSlide } from "swiper/react";

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";

// import required modules
import { Autoplay, Pagination } from "swiper/modules";
import Image from "next/image";

const Testimonials = () => {
  return (
    <div className="my-10 ">
      <div className="container">
        <div className="flex flex-col mx-auto items-center">
          <h2 className="text-center text-3xl font-bold">Testimonials</h2>
          <Image
            width={350}
            height={34}
            src={"/images/home/Line.png"}
            alt="Line"
          />
        </div>
        <Swiper
          autoplay={{
            delay: 2500,
            disableOnInteraction: false,
          }}
          pagination={{
            clickable: true,
          }}
          modules={[Autoplay, Pagination]}
          className="mySwiper"
        >
          <SwiperSlide>
            <TestimonialsCard />
          </SwiperSlide>
          <SwiperSlide>
            <TestimonialsCard />
          </SwiperSlide>
          <SwiperSlide>
            <TestimonialsCard />
          </SwiperSlide>
          <SwiperSlide>
            <TestimonialsCard />
          </SwiperSlide>
        </Swiper>
      </div>
    </div>
  );
};

export default Testimonials;

const TestimonialsCard = ({ data }) => {
  return (
    <div className="p-5 w-full mb-10 flex flex-col md:w-[700px]  mx-auto items-center">
      <p className="text-center text-[#717070] text-[20px] ">
        Your work is going to fill a large part of your life, and the only way
        to be truly satisfied is to do what you believe is great work. And the
        only way to do great work is to love what you do. If you haven&lsquo;t
        found it yet, keep Peopeative are the luckiest people.
      </p>

      <Image
        src={"/images/home/testimonial.png"}
        width={300}
        height={300}
        alt="test"
        className="w-[100px] h-[100px] mt-5 rounded-full ring-primary ring-2"
      />
      <h2 className="text-[22px] py-5 font-bold text-primary">Ed Bagley</h2>
      <p className="text-center">
        Director of Product Marketing, O.C. Tanner Company
      </p>
    </div>
  );
};
