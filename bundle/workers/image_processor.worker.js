/* BoobaStudio local image conversion worker.
 * Keeps the recovered Cibola worker contract intact without a server dependency.
 */
self.addEventListener("message", async (event) => {
  const { id, type, payload } = event.data || {};
  if (type !== "convert-image") {
    self.postMessage({ id, success: false, error: `Unsupported image worker operation: ${type || "unknown"}` });
    return;
  }
  try {
    const source = String(payload?.url || "");
    if (!source) throw new Error("Image URL is empty");
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Image request failed (${response.status})`);
    const blob = await response.blob();
    const reader = new FileReader();
    const result = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to read image response"));
      reader.readAsDataURL(blob);
    });
    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: String(error?.message || error) });
  }
});
