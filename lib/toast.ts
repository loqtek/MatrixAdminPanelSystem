import toast from 'react-hot-toast';

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 4000,
    });
  },
  error: (message: string) => {
    toast.error(message, {
      duration: 5000,
    });
  },
  info: (message: string) => {
    toast(message, {
      duration: 4000,
    });
  },
  loading: (message: string) => {
    return toast.loading(message);
  },
};

function getStringField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

export function formatError(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('{') && msg.includes('errcode')) {
      try {
        const errorMatch = msg.match(/\{.*\}/);
        if (errorMatch) {
          const errorObj = JSON.parse(errorMatch[0]) as unknown;
          if (errorObj && typeof errorObj === 'object') {
            const o = errorObj as Record<string, unknown>;
            if (typeof o.error === 'string') {
              return o.error;
            }
            if (typeof o.errcode === 'string') {
              const errText = typeof o.error === 'string' ? o.error : 'Unknown error';
              return `${o.errcode}: ${errText}`;
            }
          }
        }
      } catch {
        // If parsing fails, continue with original message
      }
    }
    return msg;
  }

  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    const fromFields =
      getStringField(o, 'message') ?? getStringField(o, 'detail') ?? getStringField(o, 'error');
    if (fromFields) return fromFields;
  }

  return 'An unexpected error occurred';
}
