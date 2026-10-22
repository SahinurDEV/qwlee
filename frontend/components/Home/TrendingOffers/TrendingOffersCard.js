import Image from "next/image";
const TrendingOffersCard = ({ data }) => {
  return (
    <div style={
      {boxShadow:"0px 0px 15px 0px rgba(0, 0, 0, 0.08)"}
    } className="w-full h-[350px] md:h-[350px] p-2 my-5  cursor-pointer relative bg-white  rounded-xl">
      <div className="relative">
        <Image
          src={data?.img}
          width={500}
          height={500}
          alt="Categories Background"
          className=" w-[345px] h-[200px] md:w-[345px] md:h-[210px] flex justify-center mx-auto  items-center rounded-xl"
        />
        <div className="absolute right-2 px-2 text-white top-2 bg-primary rounded-md">
          25 % OFF
        </div>
      </div>
      <div className="items-center flex flex-col">
        <h2 className="text-[26px] font-bold text-primary">{data.name}</h2>
        <p className="text-[19px] font-bold text-primary">{data.description}</p>

        <button className="flex gap-2 mt-5 justify-center items-center mx-auto cursor-pointer ring-1 ring-primary  text-primary py-1 px-5 rounded text-center hover:bg-primary hover:text-white transition duration-300">
          See more deals
        </button>
      </div>
    </div>
  );
};

export default TrendingOffersCard;
