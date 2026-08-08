import React from 'react';

const RN_ONLY_DOM_PROPS = new Set([
  'importantForAccessibility',
  'accessibilityElementsHidden',
  'accessibilityViewIsModal',
  'accessibilityLiveRegion',
  'collapsable',
  'needsOffscreenAlphaCompositing',
  'renderToHardwareTextureAndroid',
  'shouldRasterizeIOS',
]);

const originalCreateElement = React.createElement.bind(React);

// React Native Web occasionally forwards Android/iOS-only props onto host DOM nodes.
// Strip them (and normalize transform-origin) so DevTools stays clean.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(React as any).createElement = (type: any, props: Record<string, unknown> | null, ...children: any[]) => {
  if (!props || typeof type !== 'string') {
    return originalCreateElement(type, props as never, ...children);
  }

  let changed = false;
  const next: Record<string, unknown> = { ...props };

  for (const key of RN_ONLY_DOM_PROPS) {
    if (key in next) {
      delete next[key];
      changed = true;
    }
  }

  if ('transform-origin' in next) {
    const origin = next['transform-origin'];
    delete next['transform-origin'];
    const style =
      next.style && typeof next.style === 'object'
        ? { ...(next.style as object), transformOrigin: origin }
        : { transformOrigin: origin };
    next.style = style;
    changed = true;
  }

  return originalCreateElement(type, (changed ? next : props) as never, ...children);
};
