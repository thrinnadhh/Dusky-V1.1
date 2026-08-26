import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { AppErrorBoundary } from './AppErrorBoundary';

describe('Captain bootstrap', () => {
  it('renders its app-specific identity and active contract reference', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Dusky Captain');
    expect(html).toContain('FOUND-APP-CAP-001');
  });

  it('renders an accessible fallback after a bootstrap error', () => {
    const boundary = new AppErrorBoundary({ children: null });
    boundary.state = AppErrorBoundary.getDerivedStateFromError();
    expect(renderToStaticMarkup(boundary.render() as React.ReactElement)).toContain('role="alert"');
  });
});
