import { useState, useEffect } from 'react';

export function useCountUp(endValue, durationMs = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animationFrame;

    const easeOutExpo = (t) => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    };

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      
      const percentage = Math.min(progress / durationMs, 1);
      const easedPercent = easeOutExpo(percentage);
      
      setValue(endValue * easedPercent);

      if (progress < durationMs) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setValue(endValue);
      }
    };

    if (endValue > 0) {
      animationFrame = requestAnimationFrame(step);
    } else {
      setValue(0);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [endValue, durationMs]);

  return value;
}
