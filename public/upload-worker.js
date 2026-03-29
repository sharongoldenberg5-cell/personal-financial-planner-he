// Web Worker for file upload processing
// Runs in a separate thread - not affected by tab visibility throttling

self.onmessage = async function(e) {
  const { fileData, fileName, fileType, id } = e.data;

  try {
    const blob = new Blob([fileData], { type: fileType });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const response = await fetch('/api/parse-file', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const result = await response.json();
    self.postMessage({ id, success: true, result });
  } catch (e) {
    self.postMessage({ id, success: false, error: String(e) });
  }
};
