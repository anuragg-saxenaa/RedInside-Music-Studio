// frontend/tests/unit/VUMeter.test.tsx
import { test, expect } from '@playwright/test';
import { render } from '@testing-library/react';
import VUMeter from '../../../components/Mastering/VUMeter';

test('renders vu meter with correct segments', () => {
  render(<VUMeter level={50} isActive={true} />);
  const meter = document.querySelector('[data-testid="vu-meter"]');
  expect(meter.children.length).toBe(20);
});
