import { create } from 'zustand';

export interface ConfirmRequest {
  title: string;
  text: string;
  ok: string;
  danger?: boolean;
  resolve(ok: boolean): void;
}

export const useConfirm = create<{ req: ConfirmRequest | null }>(() => ({ req: null }));

/** Promise-based confirm dialog rendered by <ConfirmHost/>. */
export function confirm(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirm.setState({
      req: {
        ...opts,
        resolve(ok) {
          useConfirm.setState({ req: null });
          resolve(ok);
        },
      },
    });
  });
}
