import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('Captain bootstrap', () => {
  it('renders its app-specific identity and active contract reference', () => {
    let component: renderer.ReactTestRenderer;
    renderer.act(() => { component = renderer.create(<App />); });
    const tree = component!.toJSON();
    expect(JSON.stringify(tree)).toContain('Dusky Captain');
    expect(JSON.stringify(tree)).toContain('FOUND-APP-CAP-001');
  });
});
