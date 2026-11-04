import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

// The static web export's document. This is Expo Router's default template with one change:
// `interactive-widget=resizes-content` in the viewport meta. Chrome on Android otherwise keeps the layout
// viewport at full height when the keyboard opens (it only shrinks the visual viewport), so the docked Check
// bar and the bottom of every typing screen stayed behind the keys. With resizes-content the layout shrinks
// and everything pinned to the bottom follows. (Safari ignores it; useDockLift covers that with visualViewport.)
export default function Root({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, interactive-widget=resizes-content"
        />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
