import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ErrorPage from '../app/error';
import RootLayout from '../app/layout';
import Page from '../app/page';

describe('Admin bootstrap', () => {
  it('renders its app-specific identity and active contract reference', () => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('Dusky Admin');
    expect(html).toContain('FOUND-APP-ADM-001');
  });

  it('renders the document shell and accessible error recovery', () => {
    expect(renderToStaticMarkup(<RootLayout>content</RootLayout>)).toContain('lang="en"');
    const html = renderToStaticMarkup(<ErrorPage error={new Error('private')} reset={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Try again');
    expect(html).not.toContain('private');
  });
});
