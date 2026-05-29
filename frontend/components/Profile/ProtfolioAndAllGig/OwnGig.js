"use client";
import Image from "next/image";
import React from "react";
import { IoStar } from "react-icons/io5";
import { imageBaseUrl, imgUrl} from "@/lib/constant";
import { useRouter } from "next/navigation";
import { useDeleteGigMutation } from "@/app/redux/features/deleteGigApi";
import { toast } from "sonner";
const OwnGig = ({ item }) => {
  const [setData, { isLoading }] = useDeleteGigMutation();
  const router = useRouter();
  const handleDelete = async (id) => {
    try {
      await setData(id).unwrap();
      toast.success("Gig deleted");
    } catch (error) {
      toast.error(error?.data?.message || "Failed to delete gig");
    }
  };
  return (
    <div
      style={{ boxShadow: "0px 0px 24px 0px #0000001A" }}
      key={item.id}
      className="w-full flex gap-2 flex-col rounded-lg"
    >
      <div>
        <Image
          src={item.images[0]&&imgUrl(item.images[0])}
          width={200}
          height={200}
          alt="gig"
          className="w-full h-[180px] rounded-t-lg"
        />
      </div>
      <div className="w-full p-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image
              src={imgUrl(item?.userId?.image)}
              width={100}
              height={100}
              alt="gig"
              className="w-[50px] h-[50px] rounded-full"
            />
            <div>
              <p className="text-[14px] font-bold">{item?.userId?.fullName}</p>
              <div className="flex gap-1">
                <IoStar className="text-primary" />
                <p className="text-[12px] text-primary">
                  {item?.userId?.rating || 4.5}
                </p>
                <p className="text-[12px]">
                  ({item?.userId?.totalRating || 5})
                </p>
              </div>
            </div>
          </div>
        </div>
        <p>{item?.title}</p>
        <div className="flex justify-between py-3">
          <button
            onClick={() => router.push(`/gig/edit?id=${item?._id}`)}
            className=" text-primary hover:text-white hover:bg-primary transition-all  items-center  border-primary border-2 px-8 py-1 "
          >
            Edit
          </button>
          <button
            disabled={isLoading}
            onClick={() => handleDelete(item?._id)}
            className=" hover:text-primary text-white hover:bg-transparent bg-primary transition-all  items-center  border-primary border-2 px-5 py-1 "
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnGig;
