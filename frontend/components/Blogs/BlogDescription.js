function BlogDescription({ content }) {
    return <div className="py-5 rich-text text-gray-700" dangerouslySetInnerHTML={{ __html: content }} />;
  }
  
  export default BlogDescription;
  