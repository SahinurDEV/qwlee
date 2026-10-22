import Image from "next/image";
import React from "react";

const AboutCards = () => {
  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row gap-5 items-center justify-between">
        <div className=" md:w-1/2">
          <h2 className="text-3xl md:text-[50px] font-semibold">Our Story</h2>
          <p className="md:text-lg mt-8">
            There are many variations of passages of Lorem Ipsum available, but
            the majority have suffered alteration in some form, by injected
            humour, or randomised words which don&lsquo;t look even slightly
            believable. If you are going to use a passage of Lorem Ipsum, you
            need to be sure there isn&lsquo;t anything embarrassing hidden in
            the middle of text. the middle of text. All the Lorem Ipsum
            generators on the Internet tend to repeat predefined chunks as
            necessary, making this the first true generator on the Internet. It
            uses a dictionary of over 200 Latin words, 
          </p>
        </div>
        <div className=" md:w-1/2">
          <Image
            src="/orthers/about1.jpg"
            width={500}
            height={500}
            alt="aboutus"
            className="w-full h-[250px] md:h-[500px] object-cover rounded-lg"
          />
        </div>
      </div>
      <div className="flex flex-col-reverse md:flex-row gap-5 mt-5 items-center justify-between">
        <div className=" md:w-1/2">
          <Image
            src="/orthers/about2.jpg"
            width={500}
            height={500}
            alt="aboutus"
            className="w-full h-[500px] object-cover rounded-lg"
          />
        </div>
        <div className=" md:w-1/2">
          <h2 className="text-3xl md:text-[50px] font-semibold">Our Mission</h2>
          <p className="md:text-lg mt-8">
            There are many variations of passages of Lorem Ipsum available, but
            the majority have suffered alteration in some form, by injected
            humour, or randomised words which don&lsquo;t look even slightly
            believable. If you are going to use a passage of Lorem Ipsum, you
            need to be sure there isn&lsquo;t anything embarrassing hidden in
            the middle of text. the middle of text. All the Lorem Ipsum
            generators on the Internet tend to repeat predefined chunks as
            necessary, making this the first true generator on the Internet. It
            uses a dictionary of over 200 Latin words, 
          </p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-5 items-center justify-between">
        <div className=" md:w-1/2">
          <h2 className="text-3xl md:text-[50px] font-semibold">Our Goal</h2>
          <p className="md:text-lg mt-8">
            There are many variations of passages of Lorem Ipsum available, but
            the majority have suffered alteration in some form, by injected
            humour, or randomised words which don&lsquo;t look even slightly
            believable. If you are going to use a passage of Lorem Ipsum, you
            need to be sure there isn&lsquo;t anything embarrassing hidden in
            the middle of text. the middle of text. All the Lorem Ipsum
            generators on the Internet tend to repeat predefined chunks as
            necessary, making this the first true generator on the Internet. It
            uses a dictionary of over 200 Latin words, 
          </p>
        </div>
        <div className="mt-5 md:w-1/2">
          <Image
            src="/orthers/about3.jpg"
            width={500}
            height={500}
            alt="aboutus"
            className="w-full h-[250px] md:h-[500px] object-cover rounded-lg"
          />
        </div>
      </div>
      {/* Our values */}
      <div>
        <div>
          <h2 className="text-3xl text-textGray text-center my-10 md:text-[50px] font-semibold">
            Our values
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div>
              <h2 className="text-3xl  my-10 md:text-[45px] font-semibold">
                Big market
              </h2>
              <p className="md:text-lg mt-8">
                There are many variations of passages of Lorem Ipsum available,
                but the majority have suffered alteration in some form, by
                injected humour, or randomised words which don&lsquo;t look even
                slightly believable. If you are going to use a passage of Lorem
                Ipsum, you need to be sure there isn&lsquo;t anything
                embarrassing hidden in the middle of text. the middle of text.
                All the Lorem Ipsum generators on the Internet tend to repeat
                predefined chunks as
              </p>
            </div>
            <div>
              <h2 className="text-3xl  my-10 md:text-[45px] font-semibold">
                Easy Process
              </h2>
              <p className="md:text-lg mt-8">
                There are many variations of passages of Lorem Ipsum available,
                but the majority have suffered alteration in some form, by
                injected humour, or randomised words which don&lsquo;t look even
                slightly believable. If you are going to use a passage of Lorem
                Ipsum, you need to be sure there isn&lsquo;t anything
                embarrassing hidden in the middle of text. the middle of text.
                All the Lorem Ipsum generators on the Internet tend to repeat
                predefined chunks as
              </p>
            </div>
            <div>
              <h2 className="text-3xl  my-10 md:text-[45px] font-semibold">
                Flexibility
              </h2>
              <p className="md:text-lg mt-8">
                There are many variations of passages of Lorem Ipsum available,
                but the majority have suffered alteration in some form, by
                injected humour, or randomised words which don&lsquo;t look even
                slightly believable. If you are going to use a passage of Lorem
                Ipsum, you need to be sure there isn&lsquo;t anything
                embarrassing hidden in the middle of text. the middle of text.
                All the Lorem Ipsum generators on the Internet tend to repeat
                predefined chunks as
              </p>
            </div>
            <div>
              <h2 className="text-3xl  my-10 md:text-[45px] font-semibold">
                Services Quality
              </h2>
              <p className="md:text-lg mt-8">
                There are many variations of passages of Lorem Ipsum available,
                but the majority have suffered alteration in some form, by
                injected humour, or randomised words which don&lsquo;t look even
                slightly believable. If you are going to use a passage of Lorem
                Ipsum, you need to be sure there isn&lsquo;t anything
                embarrassing hidden in the middle of text. the middle of text.
                All the Lorem Ipsum generators on the Internet tend to repeat
                predefined chunks as
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutCards;
