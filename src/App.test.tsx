import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the coffee shop hero', () => {
  render(<App />);

  expect(screen.getByText(/coffee that feels like a slow morning/i)).toBeInTheDocument();
  expect(screen.getByText(/build an order/i)).toBeInTheDocument();
});
