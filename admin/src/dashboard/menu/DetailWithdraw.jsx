import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetSingleWithdrawUserQuery,
  useWithdrawCancelByIdMutation,
  useWithdrawPostByIdMutation,
} from "../../redux/api/apiSlice";
import baseUrl from "../../baseUrl";
import { notification } from "antd";
import getImageUrl from "../../utils/getImageUrl";

const DetailWithdraw = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: singleUser, isLoading } = useGetSingleWithdrawUserQuery(id);
  const user = singleUser?.data?.attributes;
  const [setWithdrawApprove, { error }] = useWithdrawPostByIdMutation();
  // console.log(withdrawApprove);
  const [cancelWithdraw] = useWithdrawCancelByIdMutation();

  const handleCancel = async (id) => {
    console.log(id);

    const response = await cancelWithdraw(id);
    // console.log("dddddd", response.error?.data.message);
    if (response?.data?.code === 202) {
      notification.info({ message: response.data.message });
      navigate("/dashboard/approvals");
    } else if (response?.data?.code === 200) {
      notification.success({
        message: `${response?.data?.message}`,
      });
    } else {
      notification.error({
        message: `${response.error?.data.message}`,
      });
    }
  };

  const handleApprove = async (id) => {
    // console.log("aimannnnnnnnnnnnnnnnn",id);
    const response = await setWithdrawApprove(id);
    console.log(response);
    if (response?.data?.code === 202) {
      notification.info({ message: response.data.message });
      navigate("/dashboard/approvals");
    } else if (response?.data?.code === 200) {
      notification.success({
        message: `${response?.data?.message}`,
      });
      navigate("/dashboard/withdraw");
    } else {
      notification.error({
        message: `${error}`,
      });
    }
  };

  if (isLoading) return <h1>Loading ........</h1>;
  return (
    <div className="mt-6 mx-6">
      <h1 className="text-2xl font-medium">Withdraw Details</h1>
      <div className="flex items-center justify-center gap-10 h-96">
        <div className="bg-[#E6F9EF] shadow-lg h-88 w-[40%] px-8">
          <p className=" font-bold">user details</p>
          <div className=" py-6">
            <img
              className="h-40 w-40 mx-auto rounded-full"
              src={getImageUrl(user?.userId?.image)}
              alt=""
            />
            <h1 className="ml-32 mt-2 text-xl font-normal">
              {user?.userId?.fullName}
            </h1>
            <p className="ml-32 mt-2">{user?.userId?.email}</p>
            <p className="ml-32 mt-2">{user?.userId?.role}</p>
          </div>
        </div>
        <div className=" bg-[#E6F9EF] shadow-lg h-88 w-[60%] px-8 py-8">
          <p className="font-bold">Transaction details</p>
          <div className="py-8">
            <p className=" font-semibold">
              AccountNumber: {user?.accountNumber}
            </p>
            <p className=" my-5">Account Type: {user?.accountType}</p>
            <p>Bank Name: {user?.bankName}</p>
            <p className={
  user?.status === "Failed" ? "text-red-600" :
  user?.status === "Pending" ? "text-orange-400" :
  user?.status === "Completed" ? "text-green-500" : 'black font-semibold' 
}>
 <span className="text-black"> Status</span>: {user?.status}
</p>
          </div>

          {user?.status == "Pending" ? (
            <>
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => handleApprove(user?._id)}
                  className="bg-green-400 px-2 py-1 rounded font-medium"
                >
                  Approve
                </button>
                <br />
                <button
                  onClick={() => handleCancel(user?._id)}
                  className="bg-red-500 px-2 py-1 rounded font-medium"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            ""
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailWithdraw;
