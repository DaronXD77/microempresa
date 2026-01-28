const SectionCard = ({ title, description, children }) => (
  <section className="content-card">
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {children}
  </section>
);

export default SectionCard;
