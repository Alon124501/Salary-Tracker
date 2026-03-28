export default function MonthlySummary({ summary }) {
  if (!summary) return null;

  const items = [
    { label: 'Insurance Tests', value: summary.insurance, color: '#6366f1' },
    { label: 'Screening Tests', value: summary.screening, color: '#8b5cf6' },
    { label: 'Mixed Screening', value: summary.mixed, color: '#a78bfa' },
    { label: 'Partial Tests', value: summary.partial, color: '#c4b5fd' },
    { label: 'Kilometers', value: summary.km, color: '#06b6d4' },
    { label: 'Learning Hours', value: summary.learning, color: '#10b981' },
    { label: 'Expenses', value: summary.expenses, color: '#f59e0b' },
  ];

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 16
      }}>
        {items.map(item => (
          <div key={item.label} className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${item.color}` }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
              {item.value.toFixed(0)} ₪
            </div>
          </div>
        ))}
        <div className="card" style={{ padding: '14px 16px', borderTop: '3px solid #1a1a2e' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total ({summary.days} days)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>
            {summary.total.toFixed(0)} ₪
          </div>
        </div>
      </div>
    </div>
  );
}
