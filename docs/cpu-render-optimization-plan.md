# CPU render optimization plan

The runtime keeps two valid render backends:

1. GPU scene rendering when both active layers have a usable GPU module and the
   selected runtime mode allows GPU rendering.
2. CPU composition for CPU-only animations, CPU mode, GPU readback failure, and
   output/preview startup fallback.

Optimization order:

1. Protect the backend contract with a regression test and collect baseline
   timings for pixel preview, output, and layer transitions.
2. Move backend selection into one small policy function so preview and output
   cannot make different GPU/CPU decisions for the same frame.
3. Reduce CPU hot-path work: reuse normalized parameters, coordinates, palette
   lookup tables, and frame buffers; avoid per-pixel temporary arrays.
4. Ensure output-clock rendering publishes one frame that both preview and
   transports consume, without duplicate CPU composition or GPU readback.
5. Add targeted benchmarks and verify 30x10, 8x300, CPU-only, mixed GPU/CPU,
   transitions, and minimized-window output scenarios.

Each step should remain independently testable and should not alter the
operator's selected preview mode or output safety gates.
