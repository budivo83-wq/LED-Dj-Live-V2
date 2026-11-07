export const MAPPING_OUTPUTS = ['none', 'serial', 'blx', 'artnet', 'sacn', 'dmx'];
export const MAPPING_OBJECT_TYPES = ['line', 'grid', 'matrix', 'ring', 'triangle', 'polygon', 'volume3d'];
export const SAMPLING_MODES = ['nearest', 'linear', 'smooth', 'supersample'];

export const DEFAULT_SEGMENT = {
  id: '',
  enabled: true,
  output: 'none',
  universe: 0,
  pixelStart: 0,
  pixelCount: 1,
  direction: 'forward',
  brightness: 1,
  gamma: 1,
  grouping: 1,
  objectType: 'line',
  sampling: 'nearest',
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    mirror: { x: false, y: false, z: false },
    warp: 0,
    curve: 0
  }
};
