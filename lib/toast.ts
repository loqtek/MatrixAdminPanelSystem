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

export const formatError = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    // Try to parse Matrix API error format
    if (error.message.includes('{') && error.message.includes('errcode')) {
      try {
        const errorMatch = error.message.match(/\{.*\}/);
        if (errorMatch) {
          const errorObj = JSON.parse(errorMatch[0]);
          if (errorObj.error) {
            return errorObj.error;
          }
          if (errorObj.errcode) {
            return `${errorObj.errcode}: ${errorObj.error || 'Unknown error'}`;
          }
        }
      } catch (e) {
        // If parsing fails, continue with original message
      }
    }
    return error.message;
  }
  
  if (error?.detail) {
    return error.detail;
  }
  
  if (error?.error) {
    return error.error;
  }
  
  return 'An unexpected error occurred';
};

