 
import React, { useEffect, useState } from "react";
import { FaCircleArrowLeft } from "react-icons/fa6";
import { Link, useNavigate } from "react-router-dom";
import baseUrl from '.././../../baseUrl'
import { useGetPrivacyQuery } from "../../../redux/api/apiSlice";
import { PropagateLoader } from "react-spinners";
 
 
const Privacy = () => { 
  
 const {data : pricacy, isLoading ,error} = useGetPrivacyQuery()
 
   const navigate = useNavigate(); 
  //  console.log(pricacy?.data?.attributes);
   

   if (isLoading) {
    return (
      <div className="w-4/12 mx-auto mt-40">
        <PropagateLoader color="#00BF63" size={30} />
      </div>
    );
  } 
  

  return (
    <div className=" h-[575px]">

    <div className=" mt-8 mx-6">
      <Link to ='/dashboard/setting' className="flex items-center gap-2">
      <FaCircleArrowLeft className=" text-[#00BF63] w-8 h-8" />
        <p className=" font-semibold text-[30px]">Privacy Policy</p>
      </Link>
      <div className='mt-4'>
        <p dangerouslySetInnerHTML={{__html: pricacy?.data?.attributes[0]?.content}}>
        
        </p>
      </div>
      <div className=" text-right mt-16"> 
      <button onClick={() => navigate('/dashboard/editprivacypolicy')} className=" h-[55px] w-full sm:w-[480px] bg-[#00BF63] rounded-[8px] text-white">Edit</button>
      </div>
    </div>
    </div>
  );
};

export default Privacy;
