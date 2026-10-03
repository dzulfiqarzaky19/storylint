import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { MarkAction } from '@/domain/check';
import { mark } from '@/domain/check/testing/wiki';
import Note, { type NoteAi } from './Note';

const WIKI: MarkAction = { id: 'wiki', label: 'The wiki is out of date — change it' };
const ASK: MarkAction = { id: 'text', label: 'Ask AI' };
const EDIT: MarkAction = { id: 'edit', label: 'Fix the text' };

const CONFLICT = mark({
  kind: 'conflict',
  noteText: 'Maren Vale records grey eyes.',
  actions: [WIKI, ASK, EDIT],
});

function noteAi(over: Partial<NoteAi> = {}): NoteAi {
  return { enabled: true, onExplain: vi.fn(), ...over };
}

describe('Note', () => {
  it.each([
    ['conflict', 'Contradicts the gazetteer'],
    ['missing', 'Not written down yet'],
  ] as const)('heads a %s mark "%s" above its note', (kind, heading) => {
    render(<Note mark={mark({ kind, noteText: 'The note.' })} onAction={() => {}} />);

    expect(screen.getByText(heading)).toBeDefined();
    expect(screen.getByText('The note.')).toBeDefined();
  });

  it('reports the action that was chosen, with its mark', async () => {
    const onAction = vi.fn();
    render(<Note mark={CONFLICT} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', { name: WIKI.label }));

    expect(onAction).toHaveBeenCalledExactlyOnceWith(CONFLICT, WIKI);
  });

  it('disables every action while the note is busy', () => {
    render(<Note mark={CONFLICT} busy onAction={() => {}} ai={noteAi()} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveProperty('disabled', true);
    }
  });

  describe('with the AI off', () => {
    it.each([
      ['no AI settings at all', undefined],
      ['the AI disabled', noteAi({ enabled: false, explanation: 'Because.' })],
    ])('hides the AI actions and advice, given %s', (_name, ai) => {
      render(<Note mark={CONFLICT} onAction={() => {}} ai={ai} />);

      expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([WIKI.label]);
      expect(screen.queryByTestId('write-ai-advice')).toBeNull();
    });
  });

  describe('with the AI on', () => {
    it('offers the AI actions beside the others', () => {
      render(<Note mark={CONFLICT} onAction={() => {}} ai={noteAi()} />);

      expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
        WIKI.label,
        ASK.label,
        EDIT.label,
      ]);
      expect(screen.queryByTestId('write-ai-advice')).toBeNull();
    });

    it('locks only the AI actions while the AI is answering', () => {
      render(<Note mark={CONFLICT} onAction={() => {}} ai={noteAi({ busy: true })} />);

      const asking = screen.getAllByRole('button', { name: 'Asking…' });
      expect(asking).toHaveLength(2);
      for (const button of asking) expect(button).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: WIKI.label })).toHaveProperty('disabled', false);
    });

    it('shows the explanation', () => {
      render(
        <Note mark={CONFLICT} onAction={() => {}} ai={noteAi({ explanation: 'Chapter 1 says grey.' })} />,
      );

      expect(screen.getByTestId('write-ai-advice').textContent).toBe('Chapter 1 says grey.');
    });

    it('shows an error in place of the explanation and rewrite', () => {
      render(
        <Note
          mark={CONFLICT}
          onAction={() => {}}
          ai={noteAi({
            error: 'The AI did not answer.',
            explanation: 'Chapter 1 says grey.',
            rewrite: 'Her grey eyes narrowed.',
            onApplyRewrite: vi.fn(),
          })}
        />,
      );

      expect(screen.getByTestId('write-ai-advice').textContent).toBe('The AI did not answer.');
    });

    it('applies the suggested rewrite to the editor', async () => {
      const onApplyRewrite = vi.fn();
      render(
        <Note
          mark={CONFLICT}
          onAction={() => {}}
          ai={noteAi({
            explanation: 'Chapter 1 says grey.',
            rewrite: 'Her grey eyes narrowed.',
            onApplyRewrite,
          })}
        />,
      );
      expect(screen.getByText('“Her grey eyes narrowed.”')).toBeDefined();

      await userEvent.click(screen.getByRole('button', { name: 'Use in editor' }));

      expect(onApplyRewrite).toHaveBeenCalledExactlyOnceWith('Her grey eyes narrowed.');
    });

    it('shows a rewrite without an apply button when it cannot be applied', () => {
      render(
        <Note
          mark={CONFLICT}
          onAction={() => {}}
          ai={noteAi({ explanation: 'Chapter 1 says grey.', rewrite: 'Her grey eyes narrowed.' })}
        />,
      );

      expect(screen.getByText('“Her grey eyes narrowed.”')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Use in editor' })).toBeNull();
    });
  });

  it('keeps a press inside the note from reaching the editor around it', async () => {
    const onEditorMouseDown = vi.fn();
    render(
      <div onMouseDown={onEditorMouseDown}>
        <Note mark={CONFLICT} onAction={() => {}} />
      </div>,
    );

    await userEvent.click(screen.getByText('Maren Vale records grey eyes.'));

    expect(onEditorMouseDown).not.toHaveBeenCalled();
  });
});
