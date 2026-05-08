import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import VUMeter from '../../src/components/Mastering/VUMeter';

describe('VUMeter', () => {
  it('renders vu meter with correct segments', () => {
    render(<VUMeter level={50} isActive={true} />);
    const meter = document.querySelector('[data-testid="vu-meter"]');
    expect(meter).toBeTruthy();
  });
});
