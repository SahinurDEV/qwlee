import { toHtml } from "@/utils/miniMarkdown";
function BlogDescription({ content }) {
    return <div className="py-5 rich-text text-gray-700" dangerouslySetInnerHTML={{ __html: toHtml(content || "") }} />;
  }
  
  export default BlogDescription;
  