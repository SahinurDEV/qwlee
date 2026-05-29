import { Button, Descriptions, Form, Input, notification } from "antd";
import JoditEditor from "jodit-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoIosArrowBack } from "react-icons/io";
import { Link, useNavigate } from "react-router-dom";
import baseUrl from '../../../baseUrl'
import { useAddBlogsMutation } from "../../../redux/api/apiSlice";
import { PropagateLoader } from "react-spinners";
 

const Addblog = () => {
  
  const [addBlogs,  {isLoading, error}] = useAddBlogsMutation()
 
  
  const [description,setDescription] = useState('')
  // console.log(description);
  const [image, setImage] = useState(null);
 
  const navigate = useNavigate()

  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
  };
 
  
  
  const handleCreateBlog = async (values) => {
 
      // const strippedDescription = description.replace(/\/?/, '');
      
  console.log(values);
      const formData = new FormData();

      formData.append("title", values?.title);
      formData.append("author", values?.author);
      formData.append("image", image);
      formData.append('description',description);
      formData.append('content', values?.content)
      // formData.append('description', values.description)
      console.log(formData)
      try {
        await addBlogs(formData).unwrap();
       
        notification.success({
          message: 'Success',
          description:  `Blog Created Successfully`,
          
        });
        
        navigate("/dashboard/blog");
      
      } catch (error) {
        notification.error({
          message: 'Error',
          description:  `${error?.data?.message}`,
        });
        setTimeout(() => {
          // window.location.reload();
          navigate("/dashboard/blog");
        }, 1600); 
        console.error('Failed to create category:', error);
      }
     
  };


  if (isLoading) {
    return (
      <div className="w-4/12 mx-auto mt-40">
        <PropagateLoader color="#00BF63" size={30} />
      </div>
    );
  } 
 
  return (
    <div className="mt-9 mx-6">
      <p className=" font-normal text-[24px] flex items-center gap-2">
        {" "}
        <Link to="/dashboard/blog">
          <IoIosArrowBack className=" bg-[#00BF63] text-[24px] rounded-md text-white" />
        </Link>
        Add Blog
      </p>
      <Form
        labelCol={{ span: 22 }}
        wrapperCol={{ span: 40 }}
        layout="vertical"
        initialValues={{
          remember: true,
          
        }}
        onFinish = {handleCreateBlog}
      >
        <div className="flex items-center gap-6 mt-8">
          <div className=" w-full">
            <Form.Item
              name="title"
              label={
                <span className="font-normal text-[18px] text-[#494949]">
                  Blog Title
                </span>
              }
              rules={[
                {
                  required: true,
                  message: "Please Input Category name!",
                },
              ]}
            >
              <Input
                size="large"
                placeholder="blog name"
                type="text"
                className="w-full pl-4 h-14 borde mt-4 border-[#00BF63] rounded-md bg-[#E6F9EF]"
                required
              />
            </Form.Item>
          </div>
          <div className=" w-full">
            <Form.Item
              name="author"
              label={
                <span className="font-normal text-[18px] text-[#494949]">
                  Author
                </span>
              }
              rules={[
                {
                  required: true,
                  message: "Please Input Category name!",
                },
              ]}
            >
              <Input
                size="large"
                placeholder="author name"
                type="text"
                className="w-full pl-4 h-14 borde mt-4 border-[#00BF63] rounded-md bg-[#E6F9EF]"
                required
              />
            </Form.Item>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-8">
          <div className=" w-full">
            <Form.Item
              name="content"
              label={
                <span className="font-normal text-[18px] text-[#494949]">
                  Content
                </span>
              }
              rules={[
                {
                  required: true,
                  message: "Please Input your content!",
                },
              ]}
            >
              <Input
                size="large"
                placeholder="content"
                type="text"
                className="w-full pl-4 h-14 border mt-4 border-[#00BF63] rounded-md bg-[#E6F9EF]"
                required
              />
            </Form.Item>
          </div>
          <div className=" w-full">
            <Form.Item
              name="image"
              label={
                <span className=" text-[16px] font-medium">Uploard Image</span>
              }
              rules={[
                {
                  required: true,
                  message: "Please input your Uploard Image!",
                },
              ]}
            >
              <input
                // size="large"
                onChange={handleImageChange}
                placeholder="Uploard Image"
                name="image"
                type="file"
                className="w-full pl-4 h-14 border pt-3 mt-4 border-[#00BF63] rounded-md bg-[#E6F9EF]"
              />
            </Form.Item>
          </div>
        </div>

        <div className=" w-full mt-8">
        
          <div className="flex-1 mt-[16px]">
            <label htmlFor="" className="text-white text-[18px] font-medium">
              Description
            </label>
            <div className="mt-[16px]">
              <JoditEditor  
                value={description}
                onChange={(newContent) => {
                  setDescription(newContent);
                }}
                style={{ backgroundColor: "#FFE7EA4F" }} 
              />
            </div>
          </div> 
             
        </div>
        <div className="text-right mt-6">
          <Form.Item>
            <Button
              htmlType="submit"
              className=" h-[55px] w-[380px] bg-[#00BF63] rounded-[8px] text-white"
            >
              Add Blog
            </Button>
          </Form.Item>
        </div>
      </Form>
    </div>
  );
};

export default Addblog;
