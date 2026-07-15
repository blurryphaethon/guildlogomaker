const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const editor = document.querySelector('#editor');
const ctx = editor.getContext('2d');
const wrap = document.querySelector('#canvas-wrap');
const preview = document.querySelector('#preview');
const zoom = document.querySelector('#zoom');
const zoomControl = document.querySelector('#zoom-control');
const zoomValue = document.querySelector('#zoom-value');
const download = document.querySelector('#download');
const replace = document.querySelector('#replace');
const uploadWarning = document.querySelector('#upload-warning');
const warningMessage = document.querySelector('#warning-message');
const warningClose = document.querySelector('#warning-close');
const maxFileSize = 128 * 1024 * 1024;
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const allowedExtensions = /\.(png|jpe?g|webp)$/i;

let image;
let scale;
let baseScale;
let x;
let y;
let crop;
let dragging = false;
let last = null;
const activePointers = new Map();
let pinchStart = null;

function resizeCanvas() {
  const rect = wrap.getBoundingClientRect();
  editor.width = rect.width * devicePixelRatio;
  editor.height = rect.height * devicePixelRatio;
  editor.style.width = `${rect.width}px`;
  editor.style.height = `${rect.height}px`;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  return rect;
}

function editorBounds() {
  const rect = wrap.getBoundingClientRect();
  return { w: rect.width, h: rect.height };
}

function defaultCrop() {
  const { w, h } = editorBounds();
  const size = Math.min(w, h) * 0.72;
  return { size, left: (w - size) / 2, top: (h - size) / 2 };
}

function constrain() {
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  x = Math.min(crop.left, Math.max(crop.left + crop.size - imageWidth, x));
  y = Math.min(crop.top, Math.max(crop.top + crop.size - imageHeight, y));
}

function updatePreview() {
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = previewCanvas.height = 200;
  drawImageCrop(previewCanvas.getContext('2d'), 200);
  preview.replaceChildren(previewCanvas);
}

function drawImageCrop(context, outputSize) {
  const sourceX = (crop.left - x) / scale;
  const sourceY = (crop.top - y) / scale;
  const sourceSize = crop.size / scale;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
}

function draw() {
  if (!image) return;
  const { w, h } = editorBounds();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#12141b';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
  ctx.fillStyle = 'rgba(0, 0, 0, .57)';
  ctx.fillRect(0, 0, w, crop.top);
  ctx.fillRect(0, crop.top + crop.size, w, h - crop.top - crop.size);
  ctx.fillRect(0, crop.top, crop.left, crop.size);
  ctx.fillRect(crop.left + crop.size, crop.top, w - crop.left - crop.size, crop.size);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(crop.left, crop.top, crop.size, crop.size);
  updatePreview();
}

function showWarning(message) {
  warningMessage.textContent = message;
  uploadWarning.showModal();
}

function isSupportedImage(file) {
  return allowedTypes.has(file.type) || (file.type === '' && allowedExtensions.test(file.name));
}

function load(file) {
  if (!file) return;
  if (!isSupportedImage(file)) return showWarning('Please choose a PNG, JPG, JPEG, or WEBP image. Other file types are not supported.');
  if (file.size > maxFileSize) return showWarning('This image is larger than the 128 MB limit. Please choose a smaller file.');
  const url = URL.createObjectURL(file);
  image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    document.querySelector('#empty').style.display = 'none';
    wrap.style.display = 'block';
    document.querySelector('#hint').style.display = 'block';
    const rect = resizeCanvas();
    crop = defaultCrop();
    baseScale = Math.max(crop.size / image.width, crop.size / image.height);
    scale = baseScale;
    x = (rect.width - image.width * scale) / 2;
    y = (rect.height - image.height * scale) / 2;
    download.disabled = replace.disabled = false;
    zoomControl.style.display = 'flex';
    zoom.value = 1;
    zoom.style.setProperty('--zoom-progress', '0%');
    zoomValue.textContent = '100%';
    draw();
  };
  image.src = url;
}

function zoomImage(nextScale) {
  const centerX = crop.left + crop.size / 2;
  const centerY = crop.top + crop.size / 2;
  const scaleRatio = nextScale / scale;
  scale = nextScale;
  x = centerX - (centerX - x) * scaleRatio;
  y = centerY - (centerY - y) * scaleRatio;
  constrain();
  draw();
}

function setZoomValue(value) {
  const nextValue = Math.min(Number(zoom.max), Math.max(Number(zoom.min), value));
  zoom.value = nextValue;
  zoomImage(baseScale * nextValue);
  zoom.style.setProperty('--zoom-progress', `${((nextValue - Number(zoom.min)) / (Number(zoom.max) - Number(zoom.min))) * 100}%`);
  zoomValue.textContent = `${Math.round(nextValue * 100)}%`;
}

function pinchDistance() {
  const [first, second] = [...activePointers.values()];
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function startPinch() {
  pinchStart = { distance: pinchDistance(), scale };
  dragging = false;
  last = null;
}

fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  event.target.value = '';
  load(file);
});
replace.addEventListener('click', () => fileInput.click());
warningClose.addEventListener('click', () => uploadWarning.close());
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('drag'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('drag'); }));
dropZone.addEventListener('drop', (event) => load(event.dataTransfer.files[0]));

zoom.addEventListener('input', () => {
  setZoomValue(Number(zoom.value));
});

editor.addEventListener('pointerdown', (event) => {
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  editor.setPointerCapture(event.pointerId);
  if (activePointers.size === 1) {
    dragging = true;
    last = { x: event.clientX, y: event.clientY };
  }
  if (activePointers.size === 2) startPinch();
});

editor.addEventListener('pointermove', (event) => {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activePointers.size >= 2 && pinchStart) {
    const zoomRatio = pinchDistance() / pinchStart.distance;
    setZoomValue((pinchStart.scale * zoomRatio) / baseScale);
    return;
  }
  if (!dragging) return;
  x += event.clientX - last.x;
  y += event.clientY - last.y;
  last = { x: event.clientX, y: event.clientY };
  constrain();
  draw();
});

['pointerup', 'pointercancel'].forEach((eventName) => editor.addEventListener(eventName, (event) => {
  activePointers.delete(event.pointerId);
  pinchStart = null;
  if (activePointers.size === 1) {
    const [remainingPointer] = activePointers.values();
    dragging = true;
    last = { x: remainingPointer.x, y: remainingPointer.y };
  } else {
    dragging = false;
    last = null;
  }
}));

editor.addEventListener('wheel', (event) => {
  if (!image || event.deltaY === 0) return;
  event.preventDefault();
  const zoomStep = 0.1;
  setZoomValue(Number(zoom.value) - Math.sign(event.deltaY) * zoomStep);
}, { passive: false });

download.addEventListener('click', () => {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportCanvas.height = 200;
  drawImageCrop(exportCanvas.getContext('2d'), 200);
  const link = document.createElement('a');
  link.href = exportCanvas.toDataURL('image/jpeg', 0.98);
  link.download = 'square-crop-200x200.jpeg';
  link.click();
});

window.addEventListener('resize', () => {
  if (!image) return;
  resizeCanvas();
  crop = defaultCrop();
  baseScale = Math.max(crop.size / image.width, crop.size / image.height);
  scale = Math.max(scale, baseScale);
  zoom.value = Math.min(Number(zoom.max), scale / baseScale);
  zoom.style.setProperty('--zoom-progress', `${((Number(zoom.value) - Number(zoom.min)) / (Number(zoom.max) - Number(zoom.min))) * 100}%`);
  zoomValue.textContent = `${Math.round(Number(zoom.value) * 100)}%`;
  constrain();
  draw();
});
