import Image from "next/image";
const JoinCNNCTR = () => {
  return (
    <div className="bg-secondary h-[200px] md:h-[500px]">
      <div className="container">
        <div className="flex items-center justify-between">
          <div className="w-full">
            <h2 className="text-[20px] md:text-[40px] font-bold">
              Freelance Services Just a Click Away!
            </h2>
            <button className=" mt-5 justify-center items-center mx-auto cursor-pointer ring-1 ring-primary  py-1 px-5 rounded text-center text-white hover:bg-transparent bg-primary hover:text-primary transition duration-300">
              Join Qwlee
            </button>
          </div>
          <div className="w-full h-[500px] relative">
            <Image
              fill
              className="absolute object-cover"
              src={"/images/home/man-image.png"}
              alt="Join Qwlee"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinCNNCTR;
