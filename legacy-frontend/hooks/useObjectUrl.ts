import React from 'react';

export const useObjectUrl = (blob?: Blob | null) => {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(blob);
    setObjectUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [blob]);

  return objectUrl;
};

export default useObjectUrl;
