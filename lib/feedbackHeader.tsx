import { createContext, useMemo, type ReactNode } from 'react';

// Lets a screen put its 💬 button into the tab navigator's header (headerRight) without importing the router: the tabs
// layout wraps every screen in this provider (screenLayout). Where there is no provider (jest renders the screens bare)
// the context is null and the button sits in the screen's top right corner instead (components/FeedbackModal.tsx).
export type HeaderRightSetter = (render: (() => ReactNode) | undefined) => void;

export const FeedbackHeaderContext = createContext<HeaderRightSetter | null>(null);

export function FeedbackHeaderProvider({
  navigation,
  children,
}: {
  navigation: { setOptions: (options: { headerRight?: (() => ReactNode) | undefined }) => void };
  children: ReactNode;
}) {
  const setHeaderRight = useMemo<HeaderRightSetter>(() => (render) => navigation.setOptions({ headerRight: render }), [navigation]);
  return <FeedbackHeaderContext.Provider value={setHeaderRight}>{children}</FeedbackHeaderContext.Provider>;
}
