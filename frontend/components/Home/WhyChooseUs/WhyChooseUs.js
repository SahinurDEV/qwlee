"use client";
import Image from "next/image";
import React from "react";
import { motion } from "framer-motion";
import { RevealStagger, RevealItem } from "@/components/common/Reveal";

const whyChooseUsData = [
  {
    id: 1,
    name: "Credibility",
    description:
      "We verify Freelancers, publish their feedback scores and All-Time Transaction Data to help you identify time-tested professionals across the globe.",
    img: "/home/credibility.png",
  },
  {
    id: 2,
    name: "Security",
    description:
      "We offer Safe Pay payment protection and your choice of preferred payment method for financial peace of mind.",
    img: "/home/security.png",
  },
  {
    id: 3,
    name: "Support",
    description:
      "Our dedicated support team works 24/7 to resolve all of your queries over the phone or email, no matter where you are located.",
    img: "/home/support.png",
  },
  {
    id: 4,
    name: "Flexibility",
    description:
      "We provide multiple Payment terms and flexible Agreements to enable you to work the way you want.",
    img: "/home/flexibility.png",
  },
  {
    id: 5,
    name: "Value",
    description:
      "We have the lowest fees in the industry, providing you with maximum value at minimum cost.",
    img: "/home/value.png",
  },
  {
    id: 6,
    name: "Services Quality",
    description:
      "We have the lowest fees in the industry, providing you with maximum value at minimum cost.",
    img: "/home/value.png",
  },
];

const WhyChooseUs = () => {
  return (
    <div className="bg-secondary py-10">
      <div className="container mx-auto">
        <h2 className="text-[28px] md:text-[35px] text-center my-5 font-bold">
          Why Choose Us
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <RevealStagger gap={0.08} className="flex flex-col gap-5 md:items-end">
            {whyChooseUsData.slice(0, 3).map((item) => (
              <RevealItem key={item.id} className="w-full md:w-auto">
                <WhyChooseUsCard1 data={item} />
              </RevealItem>
            ))}
          </RevealStagger>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px 0px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center items-center"
          >
            <Image
              src="/home/WhyChooseUs.png"
              width={3840}
              height={2880}
              className="w-[290px] h-[240px]"
              alt="Why Choose Us"
            />
          </motion.div>
          <RevealStagger gap={0.08} className="flex flex-col gap-5 items-start">
            {whyChooseUsData.slice(3).map((item) => (
              <RevealItem key={item.id} className="w-full md:w-auto">
                <WhyChooseUsCard data={item} />
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </div>
    </div>
  );
};

export default WhyChooseUs;

const WhyChooseUsCard = ({ data }) => {
  return (
    <div className="p-5 w-full md:w-[300px]">
      <div className="flex items-start gap-2">
        <Image
          src={data.img}
          width={32}
          height={32}
          className="w-[32px] h-[32px]"
          alt={data.name}
        />
        <h2 className="text-[16px] font-bold">{data.name}</h2>
      </div>
      <div className="mt-3">
        <p className="text-[14px]">{data.description}</p>
      </div>
    </div>
  );
};

const WhyChooseUsCard1 = ({ data }) => {
  return (
    <div className="p-5 flex flex-col justify-end w-full md:w-[300px]">
      <div className="flex items-center md:flex-row-reverse justify-start gap-2">
        <Image
          src={data.img}
          width={32}
          height={32}
          className="w-[32px] h-[32px]"
          alt={data.name}
        />
        <h2 className="text-[16px] font-bold">{data.name}</h2>
      </div>
      <div className="mt-3">
        <p className="text-[14px] md:text-end">{data.description}</p>
      </div>
    </div>
  );
};
