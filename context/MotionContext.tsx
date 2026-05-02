import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

const MotionContext = createContext(false);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  return <MotionContext.Provider value={reduceMotion}>{children}</MotionContext.Provider>;
}

export function useReduceMotion() {
  return useContext(MotionContext);
}
