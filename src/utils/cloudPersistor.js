let persistFn = null;
export function installCloudPersistor(fn) { persistFn = fn; }
export function persistCloudNow() { if (persistFn) persistFn(); }