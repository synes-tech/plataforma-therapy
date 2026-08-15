import { useEffect, useState } from 'react';
import { rateLimitUserMessage } from '@shared/lib/rate-limit-message';

export function RateLimitMessage({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);

  return <>{rateLimitUserMessage(left)}</>;
}
