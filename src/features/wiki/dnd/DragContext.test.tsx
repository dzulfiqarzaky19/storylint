import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { DragProvider, useDrag } from './DragContext';

const setup = () => renderHook(() => useDrag(), { wrapper: DragProvider });

describe('useDrag', () => {
  it('starts with nothing dragged', () => {
    const { result } = setup();

    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragging).toBeNull();
    expect(result.current.hoverTarget).toBeNull();
    expect(result.current.dropZone).toBeNull();
  });

  it('tracks the dragged item, the hover target and the drop zone', () => {
    const { result } = setup();

    act(() => result.current.startDrag({ type: 'entry', id: 'maren', from: 'people' }));
    act(() => result.current.setHover({ type: 'entry', id: 'the-verge' }));
    act(() => result.current.setZone({ type: 'shelf', id: 'places' }));

    expect(result.current.isDragging).toBe(true);
    expect(result.current.dragging).toEqual({ type: 'entry', id: 'maren', from: 'people' });
    expect(result.current.hoverTarget).toEqual({ type: 'entry', id: 'the-verge' });
    expect(result.current.dropZone).toEqual({ type: 'shelf', id: 'places' });
  });

  it('clears the hover target and drop zone when a new drag starts', () => {
    const { result } = setup();
    act(() => result.current.startDrag({ type: 'entry', id: 'maren', from: 'people' }));
    act(() => result.current.setHover({ type: 'entry', id: 'the-verge' }));
    act(() => result.current.setZone({ type: 'shelf', id: 'places' }));

    act(() => result.current.startDrag({ type: 'fact', id: 'maren.Carries', from: 'maren' }));

    expect(result.current.dragging?.type).toBe('fact');
    expect(result.current.hoverTarget).toBeNull();
    expect(result.current.dropZone).toBeNull();
  });

  it('resets everything when the drag ends', () => {
    const { result } = setup();
    act(() => result.current.startDrag({ type: 'entry', id: 'maren', from: 'people' }));
    act(() => result.current.setHover({ type: 'entry', id: 'the-verge' }));

    act(() => result.current.endDrag());

    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragging).toBeNull();
    expect(result.current.hoverTarget).toBeNull();
  });

  it('refuses to run outside a DragProvider', () => {
    // React logs the render error before rethrowing it.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useDrag())).toThrow('useDrag must be used within a DragProvider');

    consoleError.mockRestore();
  });
});
