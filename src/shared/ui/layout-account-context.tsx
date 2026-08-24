import { createContext, useContext, type ReactNode } from 'react';

const LayoutAccountContext = createContext<ReactNode>(null);

export function LayoutAccountProvider({
  value,
  children,
}: {
  value: ReactNode;
  children: ReactNode;
}) {
  return <LayoutAccountContext.Provider value={value}>{children}</LayoutAccountContext.Provider>;
}

export function useLayoutAccount() {
  return useContext(LayoutAccountContext);
}

export function LayoutAccountSlot({ className = '' }: { className?: string }) {
  const account = useLayoutAccount();
  if (!account) return null;
  return <div className={`hidden shrink-0 items-center lg:flex ${className}`.trim()}>{account}</div>;
}
