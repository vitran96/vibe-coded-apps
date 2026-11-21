// Distinct colours in a canvas screenshot, decoded inside the page (no image library, E9). A blank frame has ~1.
export async function canvasColours(page, locator) {
  const png = await locator.screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = new Uint32Array(ctx.getImageData(0, 0, c.width, c.height).data.buffer);
    const seen = new Set();
    for (let i = 0; i < px.length; i += 7) seen.add(px[i]);
    return seen.size;
  }, png.toString('base64'));
}
