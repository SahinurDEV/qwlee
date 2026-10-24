  
import { Select, Button, Form, Input, notification } from "antd";
import JoditEditor from "jodit-react";
import React, { useEffect, useRef, useState } from "react";
import { IoIosArrowBack } from "react-icons/io";
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import { useUpdateBlogMutation } from "../../../redux/api/apiSlice";
import baseUrl from "../../../baseUrl";

const EditBlog = () => {
  const [updateBlog, { isLoading, error }] = useUpdateBlogMutation();
  const data = useLoaderData();
  const singleData = data.data.attributes;
  const { title, image, content, author, description, _id, kind } = singleData;

  const [descriptionEdit, setDescriptionEdit] = useState(description);
  const [updateImage, setUpdateImage] = useState(null);
  const navigate = useNavigate();
 
  const [form] = Form.useForm();

  const handleUpdateImageChange = (e) => {
    const file = e.target.files[0];
    setUpdateImage(file);
  };

  const handleUpdateBlog = async (values) => {
    const formData = new FormData();
    formData.append("title", values.title);
    formData.append("author", values.author);
      formData.append("kind", values?.kind || "article");
    formData.append("description", descriptionEdit);
    formData.append("content", values.content);
    if (updateImage) {
      formData.append("image", updateImage);
    }

    try {
      await updateBlog({ _id, formData }).unwrap();
      notification.success({
        message: "Success",
        description: "Blog Updated Successfully",
      });
      navigate("/dashboard/blog");
     
    } catch (error) {
      notification.error({
        message: "Error",
        description: "Failed to update blog", error,
      });
      console.error("Failed to update blog:", error);
    }
  };

  if (isLoading) return <div><h1>Loading...</h1></div>;
 

  return (
    <div className="mt-9 mx-6">
      <p className="font-normal text-[24px] flex items-center gap-2">
        <Link to="/dashboard/blog">
          <IoIosArrowBack className="bg-[#00BF63] text-[24px] rounded-md text-white" />
        </Link>
        Edit Blog
      </p>
      <Form
        form={form}
        labelCol={{ span: 22 }}
        wrapperCol={{ span: 40 }}
        layout="vertical"
        initialValues={{
          title: title,
          author: author,
          kind: kind || "article",
          content: content,
        }}
        onFinish={handleUpdateBlog}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-8">
          <div className="w-full">
            <Form.Item
              name="title"
              label={<span className="font-normal text-[18px] text-[#494949]">Blog title</span>}
              rules={[{ required: true, message: "Please input the blog title!" }]}
            >
              <Input
                size="large"
                placeholder="Blog title"
                type="text"
                className="w-full pl-4 h-14 borde mt-4 border-[#00BF63] rounded-md bg-[#E6F9EF]"
              />
            </Form.Item>
          </div>
          <div className="w-full">
            <Form.Item name="kind" label={<span className="font-normal text-[18px] text-[#494949]">Type</span>}>
              <Select
                size="large"
                options={[{ value: "article", label: "Article (blog)" }, { value: "guide", label: "Guide (how-to, shown in Help)" }]}
              />
            </Form.Item>
          </div>
          <div className="w-full">
            <Form.Item
              name="author"
              label={<span className="font-normal text-[18px] text-[#494949]">Author</span>}
              rules={[{ required: true, message: "Please input the author name!" }]}
            >
              <Input
                size="large"
                placeholder="Author name"
                type="text"
                className="w-full pl-4 h-14 borde mt-4 border-[#00BF63] rounded-md bg-[#E6F9EF]"
              />
            </Form.Item>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-8">
          <div className="w-full">
            <Form.Item
              name="content"
              label={<span className="font-normal text-[18px] text-[#494949]">Content</span>}
              rules={[{ required: true, message: "Please input your content!" }]}
            >
              <Input
                size="large"
                placeholder="Content"
                type="text"
                className="w-full pl-4 h-14 border mt-4 border-[#00BF63] rounded-md bg-[#E6F9EF]"
              />
            </Form.Item>
          </div>
          <div className="w-full">
            <Form.Item
              name="image"
              label={<span className="text-[16px] font-medium">Upload Image</span>}
            >
              <input
                onChange={handleUpdateImageChange}
                placeholder="Upload Image"
                type="file"
                className="w-full pl-4 h-14 border pt-3 mt-4 border-[#00BF63] rounded-md bg-[#E6F9EF]"
              />
            </Form.Item>
          </div>
        </div>
        <div className="w-full mt-8">
          <div className="flex-1 mt-[16px]">
            <label htmlFor="description" className="text-[#494949] text-[18px] font-medium">
              Description
            </label>
            <div className="mt-[16px]">
              <JoditEditor
                value={descriptionEdit}
                onChange={(newContent) => setDescriptionEdit(newContent)}
                style={{ backgroundColor: "#FFE7EA4F" }}
              />
            </div>
          </div>
        </div>
        <div className="text-right mt-6">
          <Form.Item>
            <Button
              htmlType="submit"
              className="h-[55px] w-full sm:w-[380px] bg-[#00BF63] rounded-[8px] text-white"
            >
              Update Blog
            </Button>
          </Form.Item>
        </div>
      </Form>
    </div>
  );
};

export default EditBlog;
