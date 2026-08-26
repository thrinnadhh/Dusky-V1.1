import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('Captain bootstrap', () => {
  it('renders its app-specific identity and active contract reference', () => {
    const tree = renderer.create(<App />).toJSON();
    expect(JSON.stringify(tree)).toContain('Dusky Captain');
    expect(JSON.stringify(tree)).toContain('FOUND-APP-CAP-001');
  });
});

