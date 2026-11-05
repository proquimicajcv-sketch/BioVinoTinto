import React, { useState, useEffect } from 'react';
import { getCachedImageUrl, cacheSingleImage } from '../utils/offlineImageCache';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackIcon?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  alt = 'Fotografía científica',
  fallbackIcon = 'image',
  className = '',
  ...props
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!src) return;

    // Check if we have an offline cached blob/base64
    getCachedImageUrl(src).then((cached) => {
      if (isMounted && cached) {
        setResolvedSrc(cached);
      }
    });

    // Opportunistically cache for offline use if not data URL
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      cacheSingleImage(src).catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-black/10 text-[#717974] ${className}`}>
        <span className="material-symbols-outlined text-2xl">{fallbackIcon}</span>
        <span className="text-[10px] mt-1">Sin vista previa</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      onError={() => {
        // Try fallback to original src if resolved was different
        if (resolvedSrc !== src) {
          setResolvedSrc(src);
        } else {
          setHasError(true);
        }
      }}
      className={className}
      {...props}
    />
  );
};
