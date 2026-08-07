import { Button, Drawer, ListRow } from 'storylint'

export function OpenRight() {
  return (
    <div style={{ position: 'relative', height: 360 }}>
      <Drawer open side="right" label="Chapter details" onClose={() => {}}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
          }}
        >
          <h2 style={{ margin: 0, font: 'inherit', fontWeight: 600 }}>Chapter details</h2>
          <ListRow meta="1,842">1. The Lighthouse Keeper</ListRow>
          <ListRow meta="2,310">2. Salt and Rope</ListRow>
          <Button variant="primary">Save chapter</Button>
        </div>
      </Drawer>
    </div>
  )
}

export function OpenLeft() {
  return (
    <div style={{ position: 'relative', height: 360 }}>
      <Drawer open side="left" label="Binder" onClose={() => {}}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
          }}
        >
          <h2 style={{ margin: 0, font: 'inherit', fontWeight: 600 }}>Binder</h2>
          <ListRow active>Draft</ListRow>
          <ListRow>Characters</ListRow>
          <ListRow>Places</ListRow>
        </div>
      </Drawer>
    </div>
  )
}
