import React from 'react';
type Props = React.PropsWithChildren<{ accessibilityRole?: string }>;
export const View = ({ accessibilityRole, ...props }: Props) =>
  React.createElement('div', { ...props, role: accessibilityRole });
export const Text = ({ accessibilityRole, ...props }: Props) =>
  React.createElement('span', { ...props, role: accessibilityRole });
