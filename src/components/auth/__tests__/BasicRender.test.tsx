import React from 'react';
import { render, screen } from '@testing-library/react';

import { LoginForm } from '../LoginForm';

describe('Basic Rendering Test', () => {
  it('should render without crashing', () => {
    render(<LoginForm />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });
});