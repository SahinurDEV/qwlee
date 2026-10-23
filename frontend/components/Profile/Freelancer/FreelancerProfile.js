import { useState } from "react";
import Image from "next/image";
import FreelancerMainCard from "./FreelancerMainCard";
import FreelancerOtherCard from "./FreelancerOtherCard";
import useUser from "@/hooks/useUser";
import { imageBaseUrl, imgUrl} from "@/lib/constant";
import { useUpdateCoverImageMutation } from "@/app/redux/features/updateProfileApi";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { setUser } from "@/app/redux/slices/userSlice";
import { IoCameraReverseOutline } from "react-icons/io5";
import { FaSpinner } from "react-icons/fa";
import { useDispatch } from "react-redux";
import defaultCoverImage from '@/public/cover/cover.png'

const FreelancerProfile = () => {
  const user = useUser();
  const [coverImage, setCoverImage] = useState(user?.coverImage);
  const [updateCoverImage, { isLoading: isUploading }] =
    useUpdateCoverImageMutation();
  const dispatch = useDispatch();

  const handleImageChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("image", file);
      const res = await updateCoverImage(formData);
      if (res.error) {
        console.log(res.error);
        return;
      }
      if (res.data) {
        Cookies.set("user", JSON.stringify(res?.data?.data?.attributes));
        dispatch(setUser(res?.data?.data?.attributes));
        setCoverImage(res?.data?.data?.attributes?.coverImage);
        toast.success("Cover image updated successfully");
      }
    }
  };

  return (
    <div className="relative">
      <div className="relative w-full h-[170px] md:h-[330px] flex items-center justify-center">
        {isUploading ? (
          <div className="absolute flex items-center justify-center w-full h-full bg-black bg-opacity-70">
            <FaSpinner className="animate-spin text-white size-8" />
          </div>
        ) : (
          <Image
            src={coverImage ? imgUrl(coverImage) : defaultCoverImage}
            fill
            className="w-full bg-center absolute"
            alt="Cover Image"
          />
        )}

        <div className="absolute flex flex-col justify-end items-end  bottom-5 top-0 left-0 right-3 p-2">
          <div>
            <label
              htmlFor="coverImageUpload"
              className="cursor-pointer p-2 text-white rounded-full"
            >
              <IoCameraReverseOutline className="size-8 mx-auto" />
            </label>
            <span className="text-white text-xs">
              Recommend size 1920x330
            </span>
          </div>
          <input
            id="coverImageUpload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
            disabled={isUploading}
          />
        </div>
      </div>

      <div className="container flex flex-col md:flex-row py-10 md:gap-7">
        <div className="md:w-1/3">
          <FreelancerMainCard />
        </div>
        <div className="md:w-2/3">
          <FreelancerOtherCard />
        </div>
      </div>
    </div>
  );
};

export default FreelancerProfile;
