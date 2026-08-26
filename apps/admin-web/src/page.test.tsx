import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Page from '../app/page';

describe('Admin bootstrap', () => {
  it('renders its app-specific identity and active contract reference', () => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('Dusky Admin');
    expect(html).toContain('FOUND-APP-ADM-001');
  });
});

