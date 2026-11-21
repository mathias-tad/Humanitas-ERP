import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordDrawerProvider, useRecordDrawer } from './RecordDrawer';
import { registerEntity, type EntityFormProps } from './entityRegistry';

function OuterForm({ onSaved }: EntityFormProps) {
  const drawer = useRecordDrawer();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState('');
  return (
    <div>
      <input aria-label="outer field" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={() => drawer.open({ type: 'inner', mode: 'create', onSaved: (r) => setPicked((r as { id: string }).id) })}>open inner</button>
      <span data-testid="picked">{picked}</span>
      <button onClick={() => onSaved({ id: 'outer-1' })}>save outer</button>
    </div>
  );
}
function InnerForm({ onSaved }: EntityFormProps) {
  return <button onClick={() => onSaved({ id: 'inner-1' })}>save inner</button>;
}
registerEntity({ type: 'outer', label: 'outer thing', module: 'm', permissions: { view: 'v', create: 'c' }, search: async () => [], toOption: () => ({ id: '', label: '' }), Form: OuterForm });
registerEntity({ type: 'inner', label: 'inner thing', module: 'm', permissions: { view: 'v', create: 'c' }, search: async () => [], toOption: () => ({ id: '', label: '' }), Form: InnerForm });

function Opener() {
  const drawer = useRecordDrawer();
  return <button onClick={() => drawer.open({ type: 'outer', mode: 'create' })}>open outer</button>;
}

describe('RecordDrawer', () => {
  it('stacks drawers and keeps unsaved input of the drawer underneath', async () => {
    render(<RecordDrawerProvider><Opener /></RecordDrawerProvider>);
    fireEvent.click(screen.getByText('open outer'));
    fireEvent.change(await screen.findByLabelText('outer field'), { target: { value: 'half-typed' } });
    fireEvent.click(screen.getByText('open inner'));
    expect(await screen.findByTestId('record-drawer-1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('save inner'));
    await waitFor(() => expect(screen.queryByTestId('record-drawer-1')).not.toBeInTheDocument());
    expect(screen.getByLabelText('outer field')).toHaveValue('half-typed');
    expect(screen.getByTestId('picked')).toHaveTextContent('inner-1');
  });

  it('closes the drawer after saving', async () => {
    render(<RecordDrawerProvider><Opener /></RecordDrawerProvider>);
    fireEvent.click(screen.getByText('open outer'));
    fireEvent.click(await screen.findByText('save outer'));
    await waitFor(() => expect(screen.queryByTestId('record-drawer-0')).not.toBeInTheDocument());
  });
});
