import { render, screen } from '@testing-library/react';

test('renders the test environment', () => {
  render(<div>Skybridge Flights</div>);
  expect(screen.getByText(/Skybridge Flights/i)).toBeInTheDocument();
});
