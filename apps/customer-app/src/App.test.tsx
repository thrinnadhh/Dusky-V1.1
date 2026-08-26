import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('Customer bootstrap', () => {
  it('renders its app-specific identity and active contract reference', () => {
    const tree = renderer.create(<App />).toJSON();
    expect(JSON.stringify(tree)).toContain('Dusky Customer');
    expect(JSON.stringify(tree)).toContain('FOUND-APP-CUS-001');
  });
});

