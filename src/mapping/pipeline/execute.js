/**
 * Mapping pipeline skeleton:
 * Shader Space -> Virtual Canvas -> Mapping Space -> Physical Outputs -> Packet Outputs
 */

function toVirtualCanvas(renderFrame, mappingState) {
  return {
    width: Number(mappingState.width || renderFrame.width || 0),
    height: Number(mappingState.height || renderFrame.height || 0),
    pixels: renderFrame.pixels,
    timestamp: renderFrame.timestamp
  };
}

function toMappingSpace(virtualCanvas, segment) {
  return {
    segmentId: segment.id,
    output: segment.output,
    universe: segment.universe,
    pixelStart: segment.pixelStart,
    pixelCount: segment.pixelCount,
    direction: segment.direction,
    brightness: segment.brightness,
    gamma: segment.gamma,
    grouping: segment.grouping,
    transform: segment.transform,
    objectType: segment.objectType,
    sampling: segment.sampling,
    source: virtualCanvas
  };
}

function toPhysicalOutput(mappedSegment) {
  return {
    outputId: mappedSegment.output,
    universe: mappedSegment.universe,
    pixelCount: mappedSegment.pixelCount,
    payload: null,
    timestamp: mappedSegment.source.timestamp,
    meta: {
      segmentId: mappedSegment.segmentId,
      pixelStart: mappedSegment.pixelStart,
      direction: mappedSegment.direction,
      brightness: mappedSegment.brightness,
      gamma: mappedSegment.gamma,
      grouping: mappedSegment.grouping
    }
  };
}

export function executeMappingPipeline(renderFrame, normalizedMappingState) {
  const virtualCanvas = toVirtualCanvas(renderFrame, normalizedMappingState);
  const segments = normalizedMappingState.segments.filter((segment) => segment.enabled && segment.output !== 'none');

  return segments
    .map((segment) => toMappingSpace(virtualCanvas, segment))
    .map((mapped) => toPhysicalOutput(mapped));
}
