import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '@/api/fetcher';
import { qrAdminGenerate } from '@/api/generated/qr-codes/qr-codes';
import { ok } from '@/api/ok';
import { useErrorMessage } from '@/components/common';
import type { ConfirmOptions } from '@/components/confirm';

/** Downloads a Blob as a file (QR label sheet). */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Prints a lot's QR label sheet (PDF). When labels already exist the API answers
 * `qr_deja_generes`: the manager confirms before new codes replace them.
 */
export function usePrintLabels(confirm: (options: ConfirmOptions) => Promise<boolean>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [printing, setPrinting] = useState<string | null>(null);

  const print = async (lotId: string, numero: string, regenerer = false): Promise<void> => {
    setPrinting(lotId);
    try {
      const res = await qrAdminGenerate(lotId, { regenerer: regenerer ? 'true' : 'false' });
      const blob = ok(res) as unknown as Blob;
      download(blob, `qr-${numero}.pdf`);
      toast.success(t('qr.labelsReady'));
      void queryClient.invalidateQueries();
    } catch (e) {
      const code =
        e instanceof ApiError ? (e.problem as { code?: string } | undefined)?.code : undefined;
      if (code !== 'qr_deja_generes') {
        toast.error(errorMessage(e));
        return;
      }
      setPrinting(null);
      const yes = await confirm({
        title: t('qr.regenerateTitle'),
        description: t('qr.confirmRegenerate'),
        confirmLabel: t('qr.regenerate'),
        destructive: true,
      });
      if (yes) await print(lotId, numero, true);
    } finally {
      setPrinting(null);
    }
  };

  return { print, printing };
}
