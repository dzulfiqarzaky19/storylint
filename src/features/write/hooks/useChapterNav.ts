import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { scopedHref, type ActiveScope } from '@/domain/scope/activeScope';
import { createChapter, deleteChapter, renameChapter } from '@/server/actions/write/chapters';

/** Moving between chapters and adding, renaming or deleting them. */
export function useChapterNav(args: {
  chapterNumber: number;
  scope: ActiveScope;
  onError: (error: string) => void;
}) {
  const { chapterNumber, scope, onError } = args;
  const { universeId, worldId, bookId } = scope;
  const router = useRouter();

  const [pendingDeleteNumber, setPendingDeleteNumber] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const hrefOf = useCallback(
    (n: number) => scopedHref('/write', { universeId, worldId, bookId }, { chapter: String(n) }),
    [universeId, worldId, bookId],
  );

  const select = useCallback(
    (n: number) => {
      if (n !== chapterNumber) router.push(hrefOf(n));
    },
    [router, chapterNumber, hrefOf],
  );

  const add = useCallback(() => {
    void createChapter({ bookId }).then((res) => {
      if (res.ok) router.push(hrefOf(res.data.number));
    });
  }, [router, hrefOf, bookId]);

  const rename = useCallback(
    (n: number, title: string) => {
      void renameChapter({ number: n, title, bookId }).then((res) => {
        if (res.ok) router.refresh();
        else onError(res.error);
      });
    },
    [router, bookId, onError],
  );

  const confirmDelete = useCallback(() => {
    if (pendingDeleteNumber === null) return;
    setDeleteBusy(true);
    void deleteChapter({ number: pendingDeleteNumber, bookId }).then((res) => {
      setDeleteBusy(false);
      setPendingDeleteNumber(null);
      if (res.ok) {
        router.push(hrefOf(res.data.next));
        router.refresh();
      } else onError(res.error);
    });
  }, [pendingDeleteNumber, bookId, router, hrefOf, onError]);

  return {
    select,
    add,
    rename,
    pendingDeleteNumber,
    deleteBusy,
    requestDelete: setPendingDeleteNumber,
    cancelDelete: useCallback(() => setPendingDeleteNumber(null), []),
    confirmDelete,
  };
}
