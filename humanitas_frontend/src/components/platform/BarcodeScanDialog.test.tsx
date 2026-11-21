import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BarcodeScanDialog, cameraErrorMessage } from './BarcodeScanDialog';
import { getScannerSettings, resetScannerSettings, updateScannerSettings } from '@/lib/scannerSettings';

const mocks = vi.hoisted(() => ({
  getCameras: vi.fn(async () => [] as { id: string; label: string }[]),
  created: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(async () => {}),
  clear: vi.fn(),
}));

vi.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0, CODE_39: 3, CODE_128: 5, ITF: 8, EAN_13: 9, EAN_8: 10, UPC_A: 14, UPC_E: 15 },
  Html5Qrcode: class {
    static getCameras = mocks.getCameras;
    isScanning = true;
    start = mocks.start;
    stop = mocks.stop;
    clear = mocks.clear;
    constructor(id: string) {
      mocks.created(id);
    }
  },
}));

function Harness({ onDetected }: { onDetected: (code: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span data-testid="state">{open ? 'open' : 'closed'}</span>
      <BarcodeScanDialog open={open} onOpenChange={setOpen} onDetected={onDetected} />
    </>
  );
}

describe('BarcodeScanDialog', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
    mocks.start.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
    resetScannerSettings();
  });

  it('uses the camera chosen in Scanner settings', async () => {
    updateScannerSettings({ cameraId: 'usb-cam-1', cameraLabel: 'USB camera' });
    mocks.start.mockResolvedValue(null);
    render(<Harness onDetected={vi.fn()} />);
    await waitFor(() => expect(mocks.start).toHaveBeenCalled());
    expect(mocks.start.mock.calls[0][0]).toEqual({ deviceId: { exact: 'usb-cam-1' } });
  });

  it('forgets a saved camera that is gone and goes back to the back camera', async () => {
    updateScannerSettings({ cameraId: 'unplugged', cameraLabel: 'Old camera' });
    mocks.start.mockRejectedValueOnce(Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' }));
    mocks.start.mockResolvedValue(null);
    render(<Harness onDetected={vi.fn()} />);
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2));
    expect(getScannerSettings().cameraId).toBeNull();
    expect(mocks.start.mock.calls[1][0]).toEqual({ facingMode: 'environment' });
  });

  it('starts the back camera, returns the scanned code once and closes', async () => {
    mocks.start.mockResolvedValue(null);
    const onDetected = vi.fn();
    render(<Harness onDetected={onDetected} />);
    await waitFor(() => expect(mocks.start).toHaveBeenCalled());
    const [camera, , onSuccess] = mocks.start.mock.calls[0];
    expect(camera).toEqual({ facingMode: 'environment' });
    onSuccess('  6291041500213  ', {});
    onSuccess('6291041500213', {});
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('closed'));
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith('6291041500213');
  });

  it('explains a blocked camera instead of failing silently', async () => {
    mocks.start.mockRejectedValue(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
    render(<Harness onDetected={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Camera access is blocked');
  });
});

describe('cameraErrorMessage', () => {
  it('names the problem and what to do', () => {
    expect(cameraErrorMessage(null, false)).toMatch(/secure \(https\)/);
    expect(cameraErrorMessage({ name: 'NotFoundError' }, true)).toMatch(/No camera was found/);
    expect(cameraErrorMessage({ name: 'NotReadableError' }, true)).toMatch(/another app/);
    expect(cameraErrorMessage(new Error('boom'), true)).toMatch(/could not start: boom/);
  });
});
