import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CheckedAgainst, ResolvedTarget } from '@/domain/check';
import WikiTargetPicker, {
  pickerCategoryDefault,
  type PickerCategory,
  type PickerEntry,
} from './WikiTargetPicker';

const CATEGORIES: PickerCategory[] = [
  { id: 'character', label: 'People' },
  { id: 'world', label: 'Places' },
];
const ENTRIES: PickerEntry[] = [
  { id: 'maren', name: 'Maren', kind: 'character' },
  { id: 'tobias', name: 'Tobias', kind: 'character' },
  { id: 'the-verge', name: 'The Verge', kind: 'world' },
];

// A new person, Ilsa, with her first detail already proposed.
const NEW_ILSA: ResolvedTarget = {
  category: { id: 'character' },
  entry: { proposeName: 'Ilsa' },
  fact: { key: 'Carries', value: 'a brass ring' },
};
// A new detail on an entry that already exists.
const ON_MAREN: ResolvedTarget = {
  category: { id: 'character' },
  entry: { id: 'maren' },
  fact: { key: 'Carries', value: 'a brass ring' },
};

const setup = (resolvedTarget: ResolvedTarget = NEW_ILSA, checkedAgainst?: CheckedAgainst) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <WikiTargetPicker
      resolvedTarget={resolvedTarget}
      checkedAgainst={checkedAgainst}
      categories={CATEGORIES}
      entries={ENTRIES}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
};

const categoryPills = () => screen.getByRole('radiogroup', { name: 'Category' });
const entryPills = () => screen.getByRole('radiogroup', { name: 'Entry' });
const pill = (group: HTMLElement, name: string) => within(group).getByRole('radio', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const pillNames = (group: HTMLElement) =>
  within(group)
    .getAllByRole('radio')
    .map((radio) => radio.textContent);
const checkedPills = (group: HTMLElement) =>
  within(group)
    .getAllByRole('radio')
    .filter((radio) => radio.getAttribute('aria-checked') === 'true')
    .map((radio) => radio.textContent);

describe('pickerCategoryDefault', () => {
  it.each<[string, ResolvedTarget, PickerCategory[], string]>([
    ['the resolved category', { category: { id: 'world' }, entry: { proposeKind: 'lore' } }, CATEGORIES, 'world'],
    ['the proposed kind', { category: {}, entry: { proposeKind: 'lore' } }, CATEGORIES, 'lore'],
    ['the first category', { category: {}, entry: {} }, CATEGORIES, 'character'],
    ['lore, when there are no categories', { category: {}, entry: {} }, [], 'lore'],
  ])('prefers %s', (_name, target, categories, expected) => {
    expect(pickerCategoryDefault(target, categories)).toBe(expected);
  });
});

describe('WikiTargetPicker', () => {
  describe('proposing a new entry', () => {
    it('opens on the proposed category, name and detail', () => {
      setup();

      expect(screen.getByRole('dialog', { name: 'Add to the wiki' })).toBeDefined();
      expect(checkedPills(categoryPills())).toEqual(['People']);
      expect(checkedPills(entryPills())).toEqual(['+ Add new']);
      expect(field('New entry name')).toHaveProperty('value', 'Ilsa');
      expect(field('Detail key')).toHaveProperty('value', 'Carries');
      expect(field('Detail value')).toHaveProperty('value', 'a brass ring');
    });

    it('confirms a new entry with its first detail', async () => {
      const { onConfirm } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Create entry' }));

      expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
        categoryId: 'character',
        proposeCategoryName: undefined,
        entryId: undefined,
        entryName: 'Ilsa',
        factKey: 'Carries',
        factValue: 'a brass ring',
      });
    });

    it('trims what was typed', async () => {
      const { onConfirm } = setup();

      await userEvent.clear(field('New entry name'));
      await userEvent.type(field('New entry name'), '  Ilsa Vale ');
      await userEvent.click(screen.getByRole('button', { name: 'Create entry' }));

      expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({ entryName: 'Ilsa Vale' });
    });

    it.each(['New entry name', 'Detail value'])('cannot confirm with %s blank', async (name) => {
      const { onConfirm } = setup();

      await userEvent.clear(field(name));

      const confirm = screen.getByRole('button', { name: 'Create entry' });
      expect(confirm).toHaveProperty('disabled', true);
      await userEvent.click(confirm);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('adding a detail to an existing entry', () => {
    it('opens on that entry', () => {
      setup(ON_MAREN);

      expect(checkedPills(entryPills())).toEqual(['Maren']);
      expect(screen.queryByRole('textbox', { name: 'New entry name' })).toBeNull();
    });

    it('confirms against the entry id', async () => {
      const { onConfirm } = setup(ON_MAREN);

      await userEvent.click(screen.getByRole('button', { name: 'Add detail' }));

      expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
        categoryId: 'character',
        proposeCategoryName: undefined,
        entryId: 'maren',
        entryName: 'Carries',
        factKey: 'Carries',
        factValue: 'a brass ring',
      });
    });

    it('cannot confirm without a detail key', async () => {
      setup(ON_MAREN);

      await userEvent.clear(field('Detail key'));

      expect(screen.getByRole('button', { name: 'Add detail' })).toHaveProperty('disabled', true);
    });

    it('picks another entry in the category', async () => {
      const { onConfirm } = setup(ON_MAREN);

      await userEvent.click(pill(entryPills(), 'Tobias'));
      await userEvent.click(screen.getByRole('button', { name: 'Add detail' }));

      expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({ entryId: 'tobias' });
    });
  });

  describe('the entry list', () => {
    const entryNames = () => pillNames(entryPills());

    it('shows only the entries of the chosen category', () => {
      setup();

      expect(entryNames()).toEqual(['+ Add new', 'Maren', 'Tobias']);
    });

    it('follows the category, and falls back to a new entry', async () => {
      setup(ON_MAREN);

      await userEvent.click(pill(categoryPills(), 'Places'));

      expect(entryNames()).toEqual(['+ Add new', 'The Verge']);
      expect(checkedPills(entryPills())).toEqual(['+ Add new']);
    });

    it('narrows to what the search matches, whatever the case', async () => {
      setup();

      await userEvent.type(field('Search entries'), 'TOB');

      expect(entryNames()).toEqual(['+ Add new', 'Tobias']);
    });
  });

  describe('proposing a new category', () => {
    it('asks for its name before it can be confirmed', async () => {
      setup();

      await userEvent.click(pill(categoryPills(), '+ Add new'));

      expect(field('New category name')).toHaveProperty('value', '');
      expect(screen.getByRole('button', { name: 'Create entry' })).toHaveProperty('disabled', true);
    });

    it('confirms with the proposed name in place of a category id', async () => {
      const { onConfirm } = setup();

      await userEvent.click(pill(categoryPills(), '+ Add new'));
      await userEvent.type(field('New category name'), ' Rituals ');
      await userEvent.click(screen.getByRole('button', { name: 'Create entry' }));

      expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
        categoryId: '',
        proposeCategoryName: 'Rituals',
        entryId: undefined,
        entryName: 'Ilsa',
        factKey: 'Carries',
        factValue: 'a brass ring',
      });
    });
  });

  describe('correcting a recorded fact', () => {
    const EYES: CheckedAgainst = {
      entryId: 'maren',
      factId: 'maren.Eyes',
      factKey: 'Eyes',
      recordedValue: 'grey',
    };
    const GREEN_EYES: ResolvedTarget = {
      category: { id: 'character' },
      entry: { id: 'maren' },
      fact: { key: 'Eyes', value: 'green' },
    };

    it('says what the text was checked against', () => {
      setup(GREEN_EYES, EYES);

      const dialog = screen.getByRole('dialog', { name: 'Change the wiki' });
      expect(dialog.textContent).toContain('Checked against Maren — Eyes: grey');
    });

    it('fixes the category, the entry and the key', () => {
      setup(GREEN_EYES, EYES);

      expect(screen.queryByRole('radiogroup')).toBeNull();
      expect(screen.getByRole('region', { name: 'Category' }).textContent).toBe('CategoryPeople');
      expect(screen.getByRole('region', { name: 'Entry' }).textContent).toBe('EntryMaren');
      expect(field('Detail key')).toHaveProperty('readOnly', true);
    });

    it('confirms the changed value', async () => {
      const { onConfirm } = setup(GREEN_EYES, EYES);

      await userEvent.clear(field('Detail value'));
      await userEvent.type(field('Detail value'), 'hazel');
      await userEvent.click(screen.getByRole('button', { name: 'Change it' }));

      expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
        entryId: 'maren',
        factKey: 'Eyes',
        factValue: 'hazel',
      });
    });
  });

  it.each([
    ['the cancel button', () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape', () => userEvent.type(screen.getByRole('textbox', { name: 'Detail value' }), '{Escape}')],
  ])('cancels from %s', async (_name, dismiss) => {
    const { onConfirm, onCancel } = setup();

    await dismiss();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
