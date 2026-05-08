import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import UploadZone from '../../src/components/Mastering/UploadZone';

describe('UploadZone', () => {
  it('renders upload zone', () => {
    render(<UploadZone projectId="test" onUploadComplete={() => {}} />);
    expect(document.querySelector('[data-testid="upload-zone"]')).toBeTruthy();
  });
});