import { test, expect } from '@playwright/test';
import { render } from '@testing-library/react';
import UploadZone from '../../../components/Mastering/UploadZone';

test('renders upload zone', () => {
  render(<UploadZone projectId="test" onUploadComplete={() => {}} />);
  expect(document.querySelector('[data-testid="upload-zone"]')).toBeTruthy();
});