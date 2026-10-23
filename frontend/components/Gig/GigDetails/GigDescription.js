function GigDescription({content}) {
  return (
    <div className="py-5 rich-text" dangerouslySetInnerHTML={{ __html: content }} />
  );
}

export default GigDescription;
