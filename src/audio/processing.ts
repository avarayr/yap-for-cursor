import { TARGET_SAMPLE_RATE } from "../config";

/**
 * Processes an audio Blob, decodes it, and resamples it to the target sample rate if necessary.
 * Returns a mono Float32Array suitable for the ASR model.
 *
 * @param blob The input audio Blob.
 * @param targetSr The target sample rate (default: TARGET_SAMPLE_RATE).
 * @returns A Promise that resolves to a Float32Array or null if processing fails.
 */
export async function processAudioBlob(
  blob: Blob | null,
  targetSr: number = TARGET_SAMPLE_RATE
): Promise<Float32Array | null> {
  if (!blob || blob.size === 0) return null;

  // Correctly reference AudioContext
  const AudioContext = window.AudioContext;
  if (!AudioContext) {
    console.error("Browser does not support AudioContext.");
    return null;
  }
  const audioContext = new AudioContext();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    if (audioBuffer.sampleRate === targetSr) {
      // No resampling needed
      await audioContext.close(); // Close context when done
      // Ensure mono by taking the first channel
      return audioBuffer.getChannelData(0);
    }

    // Resampling needed
    console.log(`Resampling from ${audioBuffer.sampleRate}Hz to ${targetSr}Hz`);
    const duration = audioBuffer.duration;
    const offlineContext = new OfflineAudioContext(
      1, // Mono
      Math.ceil(duration * targetSr), // Calculate output buffer size correctly
      targetSr
    );
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start();

    const resampledBuffer = await offlineContext.startRendering();
    await audioContext.close(); // Close original context
    return resampledBuffer.getChannelData(0); // Return Float32Array of the first (only) channel
  } catch (error) {
    console.error("Audio processing failed:", error);
    if (audioContext && audioContext.state !== "closed") {
      await audioContext.close();
    }
    return null;
  }
}
