const DataList = ({ items, emptyLabel }) => (
  <div className="data-list">
    {items.length === 0 ? (
      <p className="muted">{emptyLabel}</p>
    ) : (
      items.map((item) => (
        <div className="data-row" key={item.id || item.tenant_id}>
          <span>{item.label}</span>
          {item.meta && <span className="muted">{item.meta}</span>}
        </div>
      ))
    )}
  </div>
);

export default DataList;
