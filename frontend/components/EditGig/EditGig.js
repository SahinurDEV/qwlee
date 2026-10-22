"use client";
import {
  Form,
  Input,
  Space,
  Button,
  Image,
  Select,
  Card,
  InputNumber,
} from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useGetSingleGigQuery } from "@/app/redux/features/getSingleGigApi";
import { PlusOutlined, CloseOutlined } from "@ant-design/icons";
import { Suspense, useState, useEffect, useRef } from "react";
import { useGetAllCategoryQuery } from "@/app/redux/features/getAllCategoryApi";
import { imageBaseUrl, imgUrl} from "@/lib/constant";
import { useEditGigMutation } from "@/app/redux/features/editGigApi";
import GigExtrasEditor, { cleanGigExtras } from "@/components/common/GigExtrasEditor";
import dynamic from "next/dynamic";
import { TiDelete } from "react-icons/ti";
import { usePostDeleteMutation } from "@/app/redux/features/postDeleteApi";
import { usePostGigImageUpoadMutation } from "@/app/redux/features/postGigImageUpoadApi";
import { toast } from "sonner";
import Loading from "../CustomCreate/Loading";
const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

const EditGigContent = () => {
  const { data } = useGetAllCategoryQuery({});
  const [content, setContent] = useState("");
  const editor = useRef(null);
  const router = useSearchParams();
  const navigate = useRouter();
  const id = router.get("id");
  const [gigImage, setGigImages] = useState([]);
  const [setGigUploadData] = usePostGigImageUpoadMutation();
  const [setData] = useEditGigMutation();
  const [gigExtras, setGigExtras] = useState(null);
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [subStale, setSubStale] = useState(false);
  const {
    data: singleGig,
    isLoading: loading,
    refetch,
  } = useGetSingleGigQuery(id);
  const [setDeleteData] = usePostDeleteMutation();
  useEffect(() => {
    if (singleGig) {
      setContent(singleGig?.data?.attributes?.gig?.description);
      setGigImages(singleGig?.data?.attributes?.gig?.images);
      const g = singleGig?.data?.attributes?.gig || {};
      setGigExtras({ extras: g.extras || [], faq: g.faq || [], requirementQuestions: g.requirementQuestions || [], video: g.video || "" });
    }
  }, [singleGig]);

  const initialValues = singleGig
    ? {
        title: singleGig?.data?.attributes?.gig?.title,
        description: singleGig?.data?.attributes?.gig?.description,
        price: singleGig?.data?.attributes?.gig?.price,
        categoriesId: idOf(singleGig?.data?.attributes?.gig?.categoriesId),
        subCategoryId: idOf(singleGig?.data?.attributes?.gig?.subCategoryId) || undefined,
        package: singleGig?.data?.attributes?.gig?.package.map((pkg) => ({
          name: pkg?.name,
          price: pkg?.price,
          deliveryDate: pkg?.deliveryDate,
          features: pkg?.features?.map((feature) => ({
            feature: feature?.feature,
          })),
        })),
      }
    : {};
  const currentCategoryId =
    editCategoryId ?? idOf(singleGig?.data?.attributes?.gig?.categoriesId);
  if (loading) {
    return <Loading height={"screen"} />;
  }

  const handleEditEvent = async (values) => {
    const result = {
      ...values,
      subCategoryId: (!subStale && values.subCategoryId) || null,
      ...cleanGigExtras(gigExtras),
      description: content,
    };

    try {
      const response = await setData({ id: id, data: result });
      if (response?.data) {
        toast.success("Gig updated successfully");
        navigate.refresh();
        navigate.push("/profile");
      }
    } catch (error) {
      toast.error(error?.data?.message || "Failed to update gig");
    }
  };

  const handleChange = async (e) => {
    e.preventDefault();
    const files = e.target.files;
    const imageFiles = Array.from(files); // Convert FileList to array
  
    if (imageFiles.length === 0) {
      toast.error("No images selected");
      return;
    }
  
    try {
      const formData = new FormData();
  
      // Append all selected images to formData
      imageFiles.forEach((file) => {
        formData.append('images', file); // The field name should match what the backend expects
      });
  
      const res = await setGigUploadData({
        gigId: id,  // Assuming `id` is your gig ID
        formData: formData,
      });
  
      if (res.error) {
        toast.error(res?.error?.data?.message || "Failed to upload images");
        return;
      }
      if (res.data) {
        refetch();
        toast.success("Images uploaded successfully");
      }
    } catch (error) {
      toast.error(error?.data?.message || "Failed to update gig");
    }
  };
  

  const transformedArray = data?.results.map((item) => ({
    type: item.id,
    label: item.name,
  }));

  const handleRemoveImage = async (image, index) => {
    const response = await setDeleteData({
      gigId: id,
      imagePath: image,
    });
    if (response?.data?.code === 200) {
      toast.success(response?.data?.message);
      setGigImages((prevImages) => prevImages.filter((_, i) => i !== index));
    } else {
      toast.error(response?.data?.message);
    }
  };

  return (
    <div className="container">
      <div className="py-5">
        <h1 className="text-[24px] font-medium">Edit your gig</h1>
        <p className="text-textGray">
          Complete your profile and keep it updated to help us connect you with
          the right people.
        </p>
      </div>
      <div>
        <div className="flex gap-5">
          {gigImage?.map((image, index) => (
            <div key={index} style={{ position: "relative" }}>
              <Image
                width={100}
                height={100}
                src={imgUrl(image)}
                className="rounded-lg"
                alt="image"
              />
              <TiDelete
                size={25}
                style={{
                  position: "absolute",
                  top: "-10px",
                  right: "-10px",
                  color: "red",
                  cursor: "pointer",
                }}
                onClick={() => handleRemoveImage(image, index)}
              />
            </div>
          ))}
        </div>
        <div className="my-5">
          <p className=" text-[18px] ">Upload Gig Images:</p>
          <input
            type="file"
            id="image"
            name="image"
            accept="image/*"
            className="hidden"
            multiple
            onChange={handleChange}
          />
          <div className="flex gap-2 mt-2">
            <label
              htmlFor="image"
              className=" size-[100px] border border-dashed border-gray-950 flex flex-col justify-center  items-center gap-1 cursor-pointer rounded-lg"
            >
              <PlusOutlined className=" size-4" />
              <span>Upload</span>
            </label>
          </div>
        </div>
        <Form
          labelCol={{ span: 22 }}
          wrapperCol={{ span: 40 }}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleEditEvent}
          onValuesChange={(changed, all) => {
            if ("categoriesId" in changed) {
              setEditCategoryId(changed.categoriesId);
              setSubStale(true);
            }
            if ("subCategoryId" in changed) setSubStale(false);
          }}
          autoComplete="off"
        >
          <div className="flex gap-5">
            <Form.Item
              name="title"
              label={<span className=" text-[18px] ">Gig Title</span>}
              className="flex-1"
              rules={[
                {
                  required: true,
                  message: "Please input your gig title!",
                },
              ]}
            >
              <Input
                placeholder="Gig Title"
                className="p-4 bg-[#F5F5F5] rounded w-full justify-start mt-[12px] items-center gap-4 inline-flex hover:bg=[#F5F5F5]"
              />
            </Form.Item>
          </div>

          <div className="flex-1 mt-[16px]">
            <Form.Item
              name="description"
              label={<span className=" text-[18px] ">About Gig</span>}
              className="flex-1"
              rules={[
                {
                  required: true,
                  message: "Please input Per About Gigs!",
                },
              ]}
            >
              <JoditEditor
                ref={editor}
                value={content}
                onChange={(newContent) => {
                  setContent(newContent);
                }}
                className="text-wrap"
                style={{ width: "100%", height: "400px" }}
              />
            </Form.Item>
          </div>
          <div className="flex-1">
            <Form.Item
              name="categoriesId"
              label={<span className=" text-[18px] ">Category</span>}
              className="flex-1"
              rules={[
                {
                  required: true,
                  message: "Please input Category Type!",
                },
              ]}
            >
              <Select className="bg-[#F5F5F5] ">
                {transformedArray?.map((item) => (
                  <>
                    <Select.Option value={item?.type}>
                      {item?.label}
                    </Select.Option>
                  </>
                ))}
              </Select>
            </Form.Item>
            <SubCategoryField categoryId={currentCategoryId} />
          </div>
          <div className="flex-1 mt-[16px]">
            <Form.Item
              name="price"
              label={<span className=" text-[18px] ">Basic Price</span>}
              className="flex-1"
              rules={[
                {
                  required: true,
                  message: "Please input Price!",
                },
              ]}
            >
              <Input
                placeholder="Price"
                className="p-4 bg-[#F5F5F5]
            rounded w-full 
            justify-start 
            mt-[12px]
            items-center 
            gap-4 inline-flex hover:bg=[#F5F5F5]"
              />
            </Form.Item>
          </div>

          <Form.List name="package">
            {(fields, { add, remove }) => (
              <div
                style={{
                  display: "flex",
                  rowGap: 16,
                  flexDirection: "column",
                }}
              >
                {fields.map((field) => (
                  <Card
                    size="small"
                    title={`Package ${field.name + 1}`}
                    key={field.key}
                    extra={
                      <CloseOutlined
                        onClick={() => {
                          remove(field.name);
                        }}
                      />
                    }
                  >
                    <Form.Item
                      rules={[
                        {
                          required: true,
                          message: "Please input package name!",
                        },
                      ]}
                      label="Name"
                      name={[field.name, "name"]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      rules={[
                        {
                          required: true,
                          message: "Please input package price!",
                        },
                      ]}
                      label="Price"
                      name={[field.name, "price"]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      label="Delivery Timage"
                      name={[field.name, "deliveryDate"]}
                      rules={[
                        {
                          required: true,
                          message: "Please input package delivery time!",
                        },
                        {
                          type: "number",
                          min: 1,
                          max: 180,
                          message:
                            "Delivery date must be between 1 and 180 days",
                        },
                      ]}
                    >
                      <InputNumber min={1} max={180} className="w-full" />
                    </Form.Item>

                    <Form.Item label="Features">
                      <Form.List name={[field.name, "features"]}>
                        {(subFields, subOpt) => (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              rowGap: 16,
                            }}
                          >
                            {subFields.map((subField) => (
                              <Space key={subField.key}>
                                <Form.Item
                                  noStyle
                                  name={[subField.name, "feature"]}
                                >
                                  <Input placeholder="feature" block />
                                </Form.Item>

                                <CloseOutlined
                                  onClick={() => {
                                    subOpt.remove(subField.name);
                                  }}
                                />
                              </Space>
                            ))}
                            <Button
                              type="dashed"
                              onClick={() => subOpt.add()}
                              block
                            >
                              + Add Features
                            </Button>
                          </div>
                        )}
                      </Form.List>
                    </Form.Item>
                  </Card>
                ))}

                <Button
                  type="dashed"
                  onClick={() => {
                    if (fields.length < 3) {
                      add();
                    }
                  }}
                  block
                  disabled={fields.length >= 3}
                >
                  + Add Packages
                </Button>
              </div>
            )}
          </Form.List>

          <div className="my-8 max-w-[700px]">
            <GigExtrasEditor value={gigExtras} onChange={setGigExtras} />
          </div>

          <Button
            htmlType="submit"
            block
            className="block w-[500px] h-[56px] my-[30px] px-2 py-4  text-white bg-primary hover:bg-primary active:bg-primary"
            style={{
              marginTop: "30px",
              backgroundColor: "#00BF63",
              color: "#fff",
              size: "18px",
              height: "56px",
            }}
          >
            Save
          </Button>
        </Form>
      </div>
    </div>
  );
};

const EditGig = () => (
  <Suspense fallback={<Loading height={"screen"} />}>
    <EditGigContent />
  </Suspense>
);

export default EditGig;


function idOf(v) {
  return v && typeof v === "object" ? v.id || v._id : v;
}

function SubCategoryField({ categoryId }) {
  const { data } = useGetAllCategoryQuery({ parentId: categoryId, limit: 100 }, { skip: !categoryId });
  const subs = categoryId ? data?.results || [] : [];
  if (!subs.length) return null;
  return (
    <Form.Item name="subCategoryId" label={<span className=" text-[18px] ">Subcategory</span>}>
      <Select className="bg-[#F5F5F5]" allowClear placeholder="Optional">
        {subs.map((c) => (
          <Select.Option key={c.id || c._id} value={c.id || c._id}>
            {c.name}
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  );
}
