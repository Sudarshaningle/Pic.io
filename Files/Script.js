(() => {
    const $ = id => document.getElementById(id);

    // State
    let state = {
        imgSrc: null,
        imgObj: null,
        photoW: 50.8, photoH: 50.8, // in mm
        paperW: 210, paperH: 297,
        gap: 1,
        margin: 10,
        bgColor: '#ffffff',
        cutlines: true,
        photoBorder: false,
        quantity: 0,   // 0 = auto/fill page
        dpi: 600,      // print resolution
        mode: 'align', // 'align' | 'preview'
        crop: {
            x: 0, // mm
            y: 0, // mm
            scale: 1, // mm per pixel of original image
            baseScale: 1 // cover scale
        }
    };

    // ── Upload ────────────────────────────────────────────────────────
    const zone = $('uploadZone');
    const fileInput = $('fileInput');

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) loadFile(file);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) loadFile(fileInput.files[0]);
    });

    function loadFile(file) {
        const reader = new FileReader();
        reader.onload = e => {
            state.imgSrc = e.target.result;
            $('preview-img').src = e.target.result;
            zone.classList.add('has-image');
            
            // Load actual image obj
            const img = new Image();
            img.onload = () => {
                state.imgObj = img;
                $('alignImg').src = state.imgSrc;
                resetCrop();
                
                $('genBtn').disabled = false;
                $('floatingToolbar').classList.remove('hidden');
                updateStatus('ready');
                
                updateView();
            };
            img.onerror = () => {
                alert('Failed to load image. Please select a valid photo.');
                zone.classList.remove('has-image');
                $('preview-img').src = '';
            };
            img.src = state.imgSrc;
        };
        reader.onerror = () => {
            alert('Error reading file. Please try again.');
        };
        reader.readAsDataURL(file);
    }

    function resetCrop() {
        if (!state.imgObj) return;
        // Cover scale
        const scaleW = state.photoW / state.imgObj.width;
        const scaleH = state.photoH / state.imgObj.height;
        state.crop.baseScale = Math.max(scaleW, scaleH);
        state.crop.scale = state.crop.baseScale;
        
        // Center
        state.crop.x = (state.photoW - state.imgObj.width * state.crop.scale) / 2;
        state.crop.y = (state.photoH - state.imgObj.height * state.crop.scale) / 2;
        
        $('zoomSlider').value = 1;
    }

    // ── Option buttons ────────────────────────────────────────────────
    document.querySelectorAll('#standardBtns .opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#standardBtns .opt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.photoW = parseFloat(btn.dataset.w);
            state.photoH = parseFloat(btn.dataset.h);
            updateMaxQtyUI();
            if (state.imgObj) {
                resetCrop();
                updateView();
            }
        });
    });

    document.querySelectorAll('#paperBtns .opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#paperBtns .opt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.paperW = parseFloat(btn.dataset.pw);
            state.paperH = parseFloat(btn.dataset.ph);
            updateMaxQtyUI();
            if (state.imgObj && state.mode === 'preview') renderGridPreview();
        });
    });

    // ── Quantity input ────────────────────────────────────────────────
    function getMaxQty() {
        const { cols, rows } = calcLayout();
        return cols * rows;
    }

    function updateMaxQtyUI() {
        const { cols, rows } = calcLayout();
        const max = cols * rows;
        $('qtyMax').textContent = max;
        $('qtyGrid').textContent = `${cols} × ${rows}`;
        $('qtyMaxWarn').textContent = max;
        $('qtyInput').max = max;
        
        if (state.quantity > 0 && state.quantity > max) {
            state.quantity = max;
            $('qtyInput').value = max;
            $('qtyWarning').classList.remove('hidden');
            setTimeout(() => $('qtyWarning').classList.add('hidden'), 3000);
        }
        $('qtyDec').disabled = (state.quantity <= 1 || state.quantity === 0);
        $('qtyInc').disabled = (state.quantity >= max);
    }

    function setQtyAuto() {
        state.quantity = 0;
        $('qtyInput').value = '';
        $('qtyInput').placeholder = 'Auto Fill';
        $('qtyAutoBtn').classList.add('active');
        $('qtyDec').disabled = true;
        $('qtyInc').disabled = false;
        $('qtyWarning').classList.add('hidden');
        if (state.imgObj && state.mode === 'preview') renderGridPreview();
    }

    function setQtyValue(val) {
        const max = getMaxQty();
        if (val < 1) val = 1;
        if (val > max) {
            val = max;
            $('qtyWarning').classList.remove('hidden');
            setTimeout(() => $('qtyWarning').classList.add('hidden'), 3000);
        } else {
            $('qtyWarning').classList.add('hidden');
        }
        state.quantity = val;
        $('qtyInput').value = val;
        $('qtyAutoBtn').classList.remove('active');
        $('qtyDec').disabled = val <= 1;
        $('qtyInc').disabled = val >= max;
        if (state.imgObj && state.mode === 'preview') renderGridPreview();
    }

    $('qtyAutoBtn').addEventListener('click', setQtyAuto);
    $('qtyInput').addEventListener('input', e => {
        const raw = e.target.value.trim();
        if (raw === '' || raw === '0') { setQtyAuto(); return; }
        const val = parseInt(raw);
        if (!isNaN(val)) setQtyValue(val);
    });
    $('qtyDec').addEventListener('click', () => {
        const cur = state.quantity > 0 ? state.quantity : getMaxQty();
        setQtyValue(cur - 1);
    });
    $('qtyInc').addEventListener('click', () => {
        const cur = state.quantity > 0 ? state.quantity : 1;
        setQtyValue(cur + 1);
    });

    // ── DPI / quality buttons ─────────────────────────────────────────
    document.querySelectorAll('#dpiBtns .opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#dpiBtns .opt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.dpi = parseInt(btn.dataset.dpi);
        });
    });

    // ── Color chips ───────────────────────────────────────────────────
    document.querySelectorAll('#bgColors .color-chip[data-color]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#bgColors .color-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.bgColor = chip.dataset.color;
            if (state.imgObj && state.mode === 'preview') renderGridPreview();
            if (state.imgObj && state.mode === 'align') $('alignContainer').style.backgroundColor = state.bgColor;
        });
    });

    $('customBgColor').addEventListener('input', e => {
        document.querySelectorAll('#bgColors .color-chip').forEach(c => c.classList.remove('active'));
        e.target.closest('.color-chip').classList.add('active');
        state.bgColor = e.target.value;
        if (state.imgObj && state.mode === 'preview') renderGridPreview();
        if (state.imgObj && state.mode === 'align') $('alignContainer').style.backgroundColor = state.bgColor;
    });

    // ── Sliders ───────────────────────────────────────────────────────
    $('gapSlider').addEventListener('input', e => {
        state.gap = parseFloat(e.target.value);
        $('gapVal').textContent = state.gap + ' mm';
        updateMaxQtyUI();
        if (state.imgObj && state.mode === 'preview') renderGridPreview();
    });
    $('marginSlider').addEventListener('input', e => {
        state.margin = parseFloat(e.target.value);
        $('marginVal').textContent = state.margin + ' mm';
        updateMaxQtyUI();
        if (state.imgObj && state.mode === 'preview') renderGridPreview();
    });

    // ── Toggles ───────────────────────────────────────────────────────
    $('toggleCutlines').addEventListener('click', () => {
        state.cutlines = !state.cutlines;
        $('cutlineToggle').classList.toggle('on', state.cutlines);
        if (state.imgObj && state.mode === 'preview') renderGridPreview();
    });
    $('toggleBorder').addEventListener('click', () => {
        state.photoBorder = !state.photoBorder;
        $('borderToggle').classList.toggle('on', state.photoBorder);
        if (state.imgObj && state.mode === 'preview') renderGridPreview();
    });

    // ── Modes & Alignment View ────────────────────────────────────────
    $('modeAlignBtn').addEventListener('click', () => {
        state.mode = 'align';
        $('modeAlignBtn').classList.add('active');
        $('modePreviewBtn').classList.remove('active');
        updateView();
    });

    $('modePreviewBtn').addEventListener('click', () => {
        state.mode = 'preview';
        $('modePreviewBtn').classList.add('active');
        $('modeAlignBtn').classList.remove('active');
        updateView();
    });

    function updateView() {
        if (!state.imgObj) return;
        $('emptyState').style.display = 'none';

        if (state.mode === 'align') {
            $('previewCanvas').style.display = 'none';
            $('gridMeta').classList.add('hidden');
            $('alignView').style.display = 'flex';
            renderAlignView();
        } else {
            $('alignView').style.display = 'none';
            $('previewCanvas').style.display = 'block';
            $('gridMeta').classList.remove('hidden');
            renderGridPreview();
        }
    }

    let displayScale = 1; // px per mm

    function renderAlignView() {
        const container = $('alignContainer');
        const imgEl = $('alignImg');
        
        // Define display scale (e.g., make it fit comfortably in view)
        // Let's set height to 300px
        displayScale = 300 / state.photoH;
        
        container.style.width = `${state.photoW * displayScale}px`;
        container.style.height = `${state.photoH * displayScale}px`;
        container.style.backgroundColor = state.bgColor;
        
        // Transform image based on crop
        imgEl.style.width = `${state.imgObj.width}px`;
        imgEl.style.height = `${state.imgObj.height}px`;
        
        updateAlignTransform();
    }

    function updateAlignTransform() {
        const imgEl = $('alignImg');
        const tx = state.crop.x * displayScale;
        const ty = state.crop.y * displayScale;
        const s = state.crop.scale * displayScale;
        imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    }

    // Dragging
    const alignContainer = $('alignContainer');
    let isDragging = false;
    let startX, startY, startCropX, startCropY;

    alignContainer.addEventListener('mousedown', e => {
        if (e.target.tagName.toLowerCase() === 'input') return; // ignore zoom slider clicks if it was inside
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startCropX = state.crop.x;
        startCropY = state.crop.y;
    });

    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        const dx = (e.clientX - startX) / displayScale;
        const dy = (e.clientY - startY) / displayScale;
        state.crop.x = startCropX + dx;
        state.crop.y = startCropY + dy;
        updateAlignTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Zooming
    $('zoomSlider').addEventListener('input', e => {
        if (!state.imgObj) return;
        const zoomMult = parseFloat(e.target.value); // 0.5 to 3
        const newScale = state.crop.baseScale * zoomMult;
        
        // Zoom around center of the box
        const cx = state.photoW / 2;
        const cy = state.photoH / 2;
        
        // img coord under center = (cx - crop.x) / crop.scale
        const imgX = (cx - state.crop.x) / state.crop.scale;
        const imgY = (cy - state.crop.y) / state.crop.scale;
        
        state.crop.scale = newScale;
        state.crop.x = cx - imgX * state.crop.scale;
        state.crop.y = cy - imgY * state.crop.scale;
        
        updateAlignTransform();
    });

    // ── Layout calc ───────────────────────────────────────────────────
    function calcLayout() {
        const usableW = state.paperW - state.margin * 2;
        const usableH = state.paperH - state.margin * 2;
        const cols = Math.floor((usableW + state.gap) / (state.photoW + state.gap));
        const rows = Math.floor((usableH + state.gap) / (state.photoH + state.gap));
        return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
    }

    // ── Preview render ────────────────────────────────────────────────
    function renderGridPreview() {
        if (!state.imgObj) return;

        const { cols, rows } = calcLayout();
        updateMaxQtyUI();
        const maxTotal = cols * rows;
        const total = state.quantity > 0 ? Math.min(state.quantity, maxTotal) : maxTotal;

        // Update chips
        $('chipCount').innerHTML = `<i class="ri-image-2-line"></i> <span>${total} photos</span>`;
        $('chipSize').innerHTML = `<i class="ri-ruler-line"></i> <span>${state.photoW}×${state.photoH} mm</span>`;
        const paperName = document.querySelector('#paperBtns .opt-btn.active').textContent.trim().split('\n')[0].trim();
        $('chipPaper').innerHTML = `<i class="ri-file-paper-2-line"></i> <span>${paperName}</span>`;

        $('metaLayout').textContent = `${cols} × ${rows}`;
        $('metaCount').textContent = total;
        $('metaSize').textContent = `${state.photoW} × ${state.photoH} mm`;
        $('metaDpi').textContent = `${state.dpi} dpi (PDF)`;

        // Draw canvas preview
        const DPX = 2; // preview px per mm
        const cw = state.paperW * DPX;
        const ch = state.paperH * DPX;
        const canvas = $('previewCanvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);

        const pw = state.photoW * DPX;
        const ph = state.photoH * DPX;
        const gap = state.gap * DPX;
        const mgn = state.margin * DPX;

        let placed = 0;
        for (let r = 0; r < rows; r++) {
            if (placed >= total) break;
            for (let c = 0; c < cols; c++) {
                if (placed >= total) break;
                placed++;
                const x = mgn + c * (pw + gap);
                const y = mgn + r * (ph + gap);

                ctx.fillStyle = state.bgColor;
                ctx.fillRect(x, y, pw, ph);

                ctx.save();
                ctx.beginPath();
                ctx.rect(x, y, pw, ph);
                ctx.clip();
                
                // Draw user-cropped image
                const drawX = x + state.crop.x * DPX;
                const drawY = y + state.crop.y * DPX;
                const drawW = state.imgObj.width * state.crop.scale * DPX;
                const drawH = state.imgObj.height * state.crop.scale * DPX;
                
                ctx.drawImage(state.imgObj, drawX, drawY, drawW, drawH);
                ctx.restore();

                // Border
                if (state.photoBorder) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x + 0.25, y + 0.25, pw - 0.5, ph - 0.5);
                }

                // Cut lines
                if (state.cutlines) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.lineWidth = 0.5;
                    ctx.setLineDash([3, 3]);
                    drawCutLine(ctx, x, y, pw, ph);
                    ctx.setLineDash([]);
                }
            }
        }
    }

    function drawCutLine(ctx, x, y, pw, ph) {
        const ext = 5;
        // top
        ctx.beginPath(); ctx.moveTo(x - ext, y); ctx.lineTo(x + pw + ext, y); ctx.stroke();
        // bottom
        ctx.beginPath(); ctx.moveTo(x - ext, y + ph); ctx.lineTo(x + pw + ext, y + ph); ctx.stroke();
        // left
        ctx.beginPath(); ctx.moveTo(x, y - ext); ctx.lineTo(x, y + ph + ext); ctx.stroke();
        // right
        ctx.beginPath(); ctx.moveTo(x + pw, y - ext); ctx.lineTo(x + pw, y + ph + ext); ctx.stroke();
    }

    // ── Status ────────────────────────────────────────────────────────
    function updateStatus(s) {
        const badge = $('statusBadge');
        if (s === 'ready') {
            badge.className = 'status-badge ready';
            badge.innerHTML = '<div class="dot"></div><span>Ready to Gen</span>';
        } else if (s === 'generating') {
            badge.className = 'status-badge';
            badge.innerHTML = '<div class="dot"></div><span>Generating PDF…</span>';
        } else if (s === 'done') {
            badge.className = 'status-badge ready';
            badge.innerHTML = '<div class="dot"></div><span>PDF Ready</span>';
        }
    }

    // ── Generate PDF ──────────────────────────────────────────────────
    $('genBtn').addEventListener('click', generatePDF);

    async function generatePDF() {
        if (!state.imgObj) return;
        updateStatus('generating');
        $('genBtn').disabled = true;

        await new Promise(r => setTimeout(r, 30));

        const { jsPDF } = window.jspdf;
        const orientation = state.paperH >= state.paperW ? 'portrait' : 'landscape';
        const pdf = new jsPDF({ orientation, unit: 'mm', format: [state.paperW, state.paperH] });

        const { cols, rows } = calcLayout();
        const DPI = state.dpi;
        const MM_TO_PX = DPI / 25.4;

        const pw_px = Math.round(state.photoW * MM_TO_PX);
        const ph_px = Math.round(state.photoH * MM_TO_PX);

        const off = $('offscreen');
        off.width = pw_px;
        off.height = ph_px;
        const octx = off.getContext('2d');

        octx.fillStyle = state.bgColor;
        octx.fillRect(0, 0, pw_px, ph_px);

        octx.save();
        octx.beginPath();
        octx.rect(0, 0, pw_px, ph_px);
        octx.clip();
        
        const drawX = state.crop.x * MM_TO_PX;
        const drawY = state.crop.y * MM_TO_PX;
        const drawW = state.imgObj.width * state.crop.scale * MM_TO_PX;
        const drawH = state.imgObj.height * state.crop.scale * MM_TO_PX;
        octx.drawImage(state.imgObj, drawX, drawY, drawW, drawH);
        octx.restore();

        if (state.photoBorder) {
            octx.strokeStyle = 'rgba(0,0,0,0.2)';
            octx.lineWidth = 2;
            octx.strokeRect(1, 1, pw_px - 2, ph_px - 2);
        }

        const usePNG = state.dpi >= 600;
        const tileData = usePNG
            ? off.toDataURL('image/png')
            : off.toDataURL('image/jpeg', 0.99);
        const imgFmt = usePNG ? 'PNG' : 'JPEG';

        const maxTotalPdf = cols * rows;
        const totalPdf = state.quantity > 0 ? Math.min(state.quantity, maxTotalPdf) : maxTotalPdf;

        let placedPdf = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (placedPdf >= totalPdf) break;
                placedPdf++;
                const x = state.margin + c * (state.photoW + state.gap);
                const y = state.margin + r * (state.photoH + state.gap);
                pdf.addImage(tileData, imgFmt, x, y, state.photoW, state.photoH);
            }
        }

        if (state.cutlines) {
            pdf.setDrawColor(150, 150, 150);
            pdf.setLineWidth(0.1);
            pdf.setLineDashPattern([0.8, 0.8], 0);

            let placedCut = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (placedCut >= totalPdf) break;
                    placedCut++;
                    const x = state.margin + c * (state.photoW + state.gap);
                    const y = state.margin + r * (state.photoH + state.gap);
                    const ext = 2;
                    pdf.line(x - ext, y, x + state.photoW + ext, y);
                    pdf.line(x - ext, y + state.photoH, x + state.photoW + ext, y + state.photoH);
                    pdf.line(x, y - ext, x, y + state.photoH + ext);
                    pdf.line(x + state.photoW, y - ext, x + state.photoW, y + state.photoH + ext);
                }
            }
        }

        const pdfBlob = pdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const dl = $('downloadLink');
        dl.href = url;
        dl.classList.remove('hidden');
        $('genBtn').disabled = false;
        updateStatus('done');

        dl.click();
    }

    // ── Mobile Tabs ───────────────────────────────────────────────────
    const tabPreviewBtn = $('tabPreviewBtn');
    const tabSettingsBtn = $('tabSettingsBtn');
    
    if (tabPreviewBtn && tabSettingsBtn) {
        tabPreviewBtn.addEventListener('click', () => {
            document.body.classList.remove('mobile-show-settings');
            tabPreviewBtn.classList.add('active');
            tabSettingsBtn.classList.remove('active');
        });

        tabSettingsBtn.addEventListener('click', () => {
            document.body.classList.add('mobile-show-settings');
            tabSettingsBtn.classList.add('active');
            tabPreviewBtn.classList.remove('active');
        });
    }

    // Init
    $('gapVal').textContent = state.gap + ' mm';
    $('marginVal').textContent = state.margin + ' mm';
    updateMaxQtyUI();

})();
