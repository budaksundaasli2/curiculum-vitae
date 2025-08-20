const toggleBtn = document.getElementById('toggle-edit');
const uploadBtn = document.getElementById('upload-btn');
const uploadBtnInline = document.getElementById('upload-btn-inline');
const fileInput = document.getElementById('file-input');
const profileImg = document.getElementById('profile-photo');
const modal = document.getElementById('cropper-modal');
const cropImg = document.getElementById('cropper-image');
const closeModalBtn = document.getElementById('close-modal');
const cancelCropBtn = document.getElementById('cancel-crop');
const confirmCropBtn = document.getElementById('confirm-crop');
const savePdfBtn = document.getElementById('save-pdf');
const downloadDocBtn = document.getElementById('download-doc');
const addExperienceBtn = document.getElementById('add-experience');
const addEducationBtn = document.getElementById('add-education');
const photoDrop = document.getElementById('photo-drop');
const removePhotoBtn = document.getElementById('remove-photo');
const removePhotoInlineBtn = document.getElementById('remove-photo-inline');
const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTQwJyBoZWlnaHQ9JzE0MCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48cmVjdCB3aWR0aD0nMTQwJyBoZWlnaHQ9JzE0MCcgZmlsbD0nI2VlZWVmZicvPjxjbGkgY3g9JzcwJyBjeT0nNzAnIHI9JzQwJyBmaWxsPScjY2NjZDNmJy8+PHBhdGggZD0nTTQ1IDk1IGgxNTAgeyBtYXJrZXIgcGxhY2Vob2xkZXIgfScgZmlsbD0nI2RkZGVlZicvPjwvc3ZnPg==';

let editing = false;
let cropper = null;
let currentObjectUrl = null;
let datePopoverEl = null;
let datePopoverAnchor = null;
let dateBackdropEl = null;

// Dynamically ensure Cropper.js is available (fallback if CDN fails)
async function ensureCropperLoaded(){
	if (window.Cropper) return;
	// Try loading from jsDelivr as fallback
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css';
	document.head.appendChild(link);
	await new Promise((resolve, reject)=>{
		const s = document.createElement('script');
		s.src = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js';
		s.onload = ()=> resolve();
		s.onerror = ()=> reject(new Error('Gagal memuat Cropper.js.'));
		document.head.appendChild(s);
	});
}

// Reposition helper for date popover
function repositionPopover(){
	if(!datePopoverEl || !datePopoverAnchor) return;
	const rect = datePopoverAnchor.getBoundingClientRect();
	datePopoverEl.style.top = `${rect.bottom + window.scrollY + 8}px`;
	datePopoverEl.style.left = `${Math.min(rect.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - datePopoverEl.offsetWidth - 8)}px`;
}

function setEditing(enabled){
	editing = enabled;
	document.body.classList.toggle('locked', !enabled);
	const nodes = document.querySelectorAll('[data-editable]');
	nodes.forEach(n => n.setAttribute('contenteditable', enabled ? 'true' : 'false'));
	toggleBtn.textContent = enabled ? 'Kunci Edit' : 'Aktifkan Edit';
}

toggleBtn.addEventListener('click', ()=> setEditing(!editing));
setEditing(false);

function openModal(){ if (modal) modal.classList.add('show'); }
function closeModal(){ if (modal) modal.classList.remove('show'); }
function destroyCropper(){ /* no-op: crop disabled */ }

function handleFiles(file){
	if(!file) return;
	// Read as Data URL so it embeds into exported .doc
	const reader = new FileReader();
	reader.onload = () => {
		profileImg.src = reader.result;
	};
	reader.readAsDataURL(file);
}

function toCirclePng(squareCanvas){
	const size = Math.min(squareCanvas.width, squareCanvas.height);
	const c = document.createElement('canvas');
	c.width = size; c.height = size;
	const ctx = c.getContext('2d');
	ctx.clearRect(0,0,size,size);
	ctx.save();
	ctx.beginPath();
	ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(squareCanvas, 0, 0, size, size);
	ctx.restore();
	return c.toDataURL('image/png');
}

// Safe event bindings
if (uploadBtn) uploadBtn.addEventListener('click', ()=> fileInput && fileInput.click());
if (uploadBtnInline) uploadBtnInline.addEventListener('click', ()=> fileInput && fileInput.click());
if (fileInput) fileInput.addEventListener('change', (e)=>{
	const file = e.target.files && e.target.files[0];
	if(!file) return;
	handleFiles(file);
});
if (closeModalBtn) closeModalBtn.addEventListener('click', (e)=> e.preventDefault());
if (cancelCropBtn) cancelCropBtn.addEventListener('click', (e)=> e.preventDefault());
if (confirmCropBtn) confirmCropBtn.addEventListener('click', (e)=> e.preventDefault());

if (savePdfBtn) savePdfBtn.addEventListener('click', ()=> window.print());

// Remove Word export handler (button no longer exists)
if (downloadDocBtn) {
	// Intentionally left blank: Word export removed
}

function buildDocHtml(){
	const cv = document.getElementById('cv-root').cloneNode(true);
	const inputs = cv.querySelectorAll('input,button'); inputs.forEach(el=>el.remove());
	cv.querySelectorAll('.photo-hint, .photo-actions').forEach(el=>el.remove());
	// Ensure image has explicit size for Word
	const img = cv.querySelector('#profile-photo');
	if (img){ img.setAttribute('width','120'); img.setAttribute('height','120'); }
	const wrapperStyle = `
		body{font-family:'Poppins',Arial,sans-serif;color:#1f2937}
		h1{font-size:24pt;margin:0 0 6pt}
		h2{font-size:13pt;margin:12pt 0 6pt;border-bottom:1px solid #e5e7eb;padding-bottom:4pt}
		.muted{color:#6b7280}
		.skills-grid{display:block; columns:2}
		/* Word-friendly header layout: float image left */
		.cv-header{display:block; overflow:hidden}
		.cv-header .photo{float:left; width:120px; height:120px; margin:0 14px 0 0; border-radius:8px}
		.cv-header .photo img{width:120px; height:120px; object-fit:cover; display:block; border-radius:8px}
		.cv-header .header-text{overflow:hidden}
	`;
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CV</title>
	<style>${wrapperStyle}</style></head><body>${cv.outerHTML}</body></html>`;
}

// --------- Dynamic Add/Remove Items ---------
function makeItemRemovable(container){
	container.addEventListener('click', (e)=>{
		const btn = e.target.closest('.remove-btn');
		if(btn){
			e.preventDefault();
			const item = btn.closest('.item');
			if(item) item.remove();
		}
	});
}

makeItemRemovable(document.getElementById('education'));
makeItemRemovable(document.getElementById('experience'));

function createEducationItem(){
	const div = document.createElement('div');
	div.className = 'item';
	div.innerHTML = `
		<div data-editable contenteditable="true"><strong>Nama Universitas</strong> — Program Studi / Jurusan</div>
		<div class="muted"><span class="date-field" data-date-start="2020" data-date-end="2024">2020 – 2024</span> | <span class="loc-field" data-city="Kota" data-province="Provinsi">Kota, Provinsi</span> <span data-editable contenteditable="true">| IPK: 3.80</span></div>
		<div class="edit-actions"><button class="btn small remove-btn">Hapus</button></div>
	`;
	return div;
}

function createExperienceItem(){
	const div = document.createElement('div');
	div.className = 'item';
	div.innerHTML = `
		<div data-editable contenteditable="true"><strong>Posisi / Jabatan</strong> — Nama Perusahaan</div>
		<div class="muted"><span class="date-field" data-date-start="2023" data-date-end="present">2023 – Sekarang</span> | <span class="loc-field" data-city="Kota" data-province="Provinsi">Kota, Provinsi</span></div>
		<ul data-editable contenteditable="true"></ul>
		<div class="edit-actions"><button class="btn small remove-btn">Hapus</button></div>
	`;
	return div;
}

addEducationBtn.addEventListener('click', ()=>{
	const section = document.getElementById('education');
	section.appendChild(createEducationItem());
});

addExperienceBtn.addEventListener('click', ()=>{
	const section = document.getElementById('experience');
	section.appendChild(createExperienceItem());
});

// --------- Date Popover Editor (Year-only) ---------
function formatYearLabel(value){
	if(!value || value === 'present') return 'Sekarang';
	// Accept YYYY or YYYY-MM and return YYYY
	return String(value).slice(0,4);
}

function parseDateLabel(text){
	// Accept: "2019 – 2023", "Jan 2022 – Des 2023", "Jan 2022 – Sekarang"
	const parts = text.replace(/\u2013|\u2014/g,'-').split('-');
	if(parts.length < 2) return {start:'', end:''};
	const left = parts[0].trim();
	const right = parts.slice(1).join('-').trim();
	function parseSide(side){
		if(!side) return '';
		if(/sekarang/i.test(side)) return 'present';
		const yearMatch = side.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
		return yearMatch ? yearMatch[0] : '';
	}
	return { start: parseSide(left), end: parseSide(right) };
}

function openDatePopover(target){
	closeDatePopover();
	let start = target.getAttribute('data-date-start') || '';
	let end = target.getAttribute('data-date-end') || '';
	if(!start || (!end && !/present/.test(end))){
		const parsed = parseDateLabel(target.textContent || '');
		if(parsed.start) start = parsed.start;
		if(parsed.end) end = parsed.end;
	}
	const pop = document.createElement('div');
	pop.className = 'date-popover centered';
	pop.innerHTML = `
		<h4>Atur Periode</h4>
		<div class="row">
			<label style="min-width:80px">Mulai</label>
			<input type="number" id="dp-start" min="1900" max="2100" step="1" ${start?`value="${formatYearLabel(start)}"`:''}>
		</div>
		<div class="row">
			<label style="min-width:80px">Selesai</label>
			<input type="number" id="dp-end" min="1900" max="2100" step="1" ${end && end!=='present'?`value="${formatYearLabel(end)}"`:''}>
		</div>
		<div class="row">
			<label style="min-width:80px"></label>
			<label><input type="checkbox" id="dp-present" ${end==='present'?'checked':''}> Saat ini</label>
		</div>
		<div class="actions">
			<button class="btn" id="dp-cancel">Batal</button>
			<button class="btn primary" id="dp-apply">Terapkan</button>
		</div>
	`;

	const backdrop = document.createElement('div');
	backdrop.className = 'date-backdrop show';
	document.body.appendChild(backdrop);
	document.body.appendChild(pop);
	datePopoverEl = pop;
	datePopoverAnchor = target;
	dateBackdropEl = backdrop;
	pop.addEventListener('click', (e)=> e.stopPropagation());
	backdrop.addEventListener('click', closeDatePopover);

	const endInput = pop.querySelector('#dp-end');
	const startInput = pop.querySelector('#dp-start');
	const presentCb = pop.querySelector('#dp-present');
	const applyBtn = pop.querySelector('#dp-apply');
	const cancelBtn = pop.querySelector('#dp-cancel');

	presentCb.addEventListener('change', ()=>{ endInput.disabled = presentCb.checked; if(presentCb.checked){ endInput.value = ''; } });
	if(end==='present'){ endInput.disabled = true; }

	cancelBtn.addEventListener('click', closeDatePopover);
	applyBtn.addEventListener('click', ()=> applyDate());
	pop.addEventListener('keydown', (ev)=>{
		if(ev.key === 'Escape'){ ev.preventDefault(); closeDatePopover(); }
		if(ev.key === 'Enter'){ ev.preventDefault(); applyDate(); }
	});
	startInput.focus();

	function applyDate(){
		const s = (startInput.value || '').trim();
		const e = presentCb.checked ? 'present' : (endInput.value || '').trim();
		if(!/^\d{4}$/.test(s)){ startInput.focus(); return; }
		if(e && e!=='present' && !/^\d{4}$/.test(e)){ endInput.focus(); return; }
		target.setAttribute('data-date-start', s);
		target.setAttribute('data-date-end', e || '');
		let label = '';
		label += s;
		label += ' – ';
		label += e ? formatYearLabel(e) : '';
		target.textContent = label;
		closeDatePopover();
	}
}

function closeDatePopover(){
	if(datePopoverEl){ datePopoverEl.remove(); datePopoverEl = null; datePopoverAnchor = null; }
	if(dateBackdropEl){ dateBackdropEl.remove(); dateBackdropEl = null; }
}

// --------- Location Popover Editor ---------
function openLocationPopover(target){
	closeLocationPopover();
	const currentCity = target.getAttribute('data-city') || (target.textContent.split(',')[0]||'').trim();
	const currentProv = target.getAttribute('data-province') || (target.textContent.split(',')[1]||'').trim();

	// Rich suggestions (extendable)
	const CITY_ALL = [
		'Jakarta','Bandung','Surabaya','Medan','Semarang','Makassar','Yogyakarta','Denpasar','Bekasi','Depok','Bogor','Tangerang',
		'Palembang','Pekanbaru','Batam','Padang','Malang','Samarinda','Balikpapan','Banjarmasin','Pontianak','Manado','Ambon','Jayapura',
		'Kupang','Kudus','Kuningan','Kendari','Karawang','Cirebon','Cimahi','Sukabumi','Tasikmalaya','Mataram','Kuta','Gianyar','Singaraja',
		'Banda Aceh','Lhokseumawe','Binjai','Pematangsiantar','Tebing Tinggi','Tanjung Pinang','Serang','Purwokerto','Solo','Salatiga','Magelang',
		'Tegal','Cilacap','Jember','Probolinggo','Pasuruan','Sidoarjo','Gresik','Mojokerto','Kediri','Blitar','Tuban','Lamongan'
	];
	const PROV_ALL = [
		'DKI Jakarta','Jawa Barat','Jawa Timur','Jawa Tengah','Banten','DI Yogyakarta','Bali','Sumatera Utara','Sumatera Barat',
		'Riau','Kepulauan Riau','Sumatera Selatan','Lampung','Kalimantan Barat','Kalimantan Timur','Kalimantan Selatan','Kalimantan Tengah',
		'Kalimantan Utara','Sulawesi Selatan','Sulawesi Tenggara','Sulawesi Utara','Sulawesi Tengah','Gorontalo','Maluku','Maluku Utara',
		'Papua','Papua Barat','Nusa Tenggara Barat','Nusa Tenggara Timur','Bengkulu','Jambi','Aceh','Bangka Belitung'
	];

	function buildOptions(list, keyword){
		const q = (keyword||'').toLowerCase();
		return list.filter(v=>!q || v.toLowerCase().includes(q)).slice(0,20).map(v=>`<option value="${v}"></option>`).join('');
	}

	const pop = document.createElement('div');
	pop.className = 'date-popover centered';
	pop.innerHTML = `
		<h4>Atur Lokasi</h4>
		<div class="row">
			<label style="min-width:80px">Kota</label>
			<input list="lp-city-list" type="text" id="lp-city" placeholder="Kota" value="${currentCity || ''}">
			<datalist id="lp-city-list">${buildOptions(CITY_ALL, currentCity)}</datalist>
		</div>
		<div class="row">
			<label style="min-width:80px">Provinsi</label>
			<input list="lp-prov-list" type="text" id="lp-prov" placeholder="Provinsi" value="${currentProv || ''}">
			<datalist id="lp-prov-list">${buildOptions(PROV_ALL, currentProv)}</datalist>
		</div>
		<div class="actions">
			<button class="btn" id="lp-cancel">Batal</button>
			<button class="btn primary" id="lp-apply">Terapkan</button>
		</div>
	`;
	const backdrop = document.createElement('div');
	backdrop.className = 'date-backdrop show';
	document.body.appendChild(backdrop);
	document.body.appendChild(pop);
	pop.addEventListener('click', (e)=> e.stopPropagation());
	backdrop.addEventListener('click', closeLocationPopover);

	const cityInput = pop.querySelector('#lp-city');
	const provInput = pop.querySelector('#lp-prov');
	const cityList = pop.querySelector('#lp-city-list');
	const provList = pop.querySelector('#lp-prov-list');
	const applyBtn = pop.querySelector('#lp-apply');
	const cancelBtn = pop.querySelector('#lp-cancel');

	cityInput.addEventListener('input', ()=>{ cityList.innerHTML = buildOptions(CITY_ALL, cityInput.value); });
	provInput.addEventListener('input', ()=>{ provList.innerHTML = buildOptions(PROV_ALL, provInput.value); });

	cityInput.focus();

	function apply(){
		const c = (cityInput.value || '').trim();
		const p = (provInput.value || '').trim();
		if(!c){ cityInput.focus(); return; }
		target.setAttribute('data-city', c);
		if(p) target.setAttribute('data-province', p); else target.removeAttribute('data-province');
		target.textContent = p ? `${c}, ${p}` : c;
		closeLocationPopover();
	}

	applyBtn.addEventListener('click', apply);
	cancelBtn.addEventListener('click', closeLocationPopover);
	pop.addEventListener('keydown', (ev)=>{
		if(ev.key === 'Escape'){ ev.preventDefault(); closeLocationPopover(); }
		if(ev.key === 'Enter'){ ev.preventDefault(); apply(); }
	});

	window._locBackdrop = backdrop;
	window._locPopover = pop;
}

function closeLocationPopover(){
	if(window._locPopover){ window._locPopover.remove(); window._locPopover = null; }
	if(window._locBackdrop){ window._locBackdrop.remove(); window._locBackdrop = null; }
}

// Hook clicks for loc-field
document.addEventListener('click', (e)=>{
	const lf = e.target.closest('.loc-field');
	if(lf && !document.body.classList.contains('locked')){
		e.preventDefault();
		openLocationPopover(lf);
	}
});

// Global interactions for date popover
window.addEventListener('scroll', repositionPopover, {passive:true});
window.addEventListener('resize', repositionPopover, {passive:true});
document.addEventListener('click', (e)=>{
	const df = e.target.closest('.date-field');
	if(df && !document.body.classList.contains('locked')){
		e.preventDefault();
		openDatePopover(df);
		return;
	}
	if(datePopoverEl && !datePopoverEl.contains(e.target)){
		closeDatePopover();
	}
});

if (photoDrop) photoDrop.addEventListener('click', ()=> fileInput && fileInput.click());

if (photoDrop) ['dragenter','dragover'].forEach(evt=>{
	photoDrop.addEventListener(evt, (e)=>{ e.preventDefault(); e.stopPropagation(); photoDrop.classList.add('dragover'); });
});
if (photoDrop) ['dragleave','drop'].forEach(evt=>{
	photoDrop.addEventListener(evt, (e)=>{ e.preventDefault(); e.stopPropagation(); photoDrop.classList.remove('dragover'); });
});
if (photoDrop) photoDrop.addEventListener('drop', (e)=>{
	const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
	if(!file) return;
	handleFiles(file);
});

function resetPhoto(){
	try{
		if (currentObjectUrl){ URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
	}catch(_){/* noop */}
	profileImg.src = PLACEHOLDER_IMG;
	if (fileInput) fileInput.value = '';
	if (photoDrop) photoDrop.classList.remove('dragover');
	destroyCropper();
}

removePhotoBtn.addEventListener('click', resetPhoto);
removePhotoInlineBtn.addEventListener('click', resetPhoto);

// Delegated fallback for remove photo buttons
document.addEventListener('click', (e)=>{
	const rm = e.target.closest && (e.target.closest('#remove-photo') || e.target.closest('#remove-photo-inline'));
	if(rm){ e.preventDefault(); resetPhoto(); }
});

// Ensure Enter creates bullets in experience description lists
(function setupExperienceBullets(){
	const experienceRoot = document.getElementById('experience');
	if(!experienceRoot) return;

	function placeCaretAtStart(el){
		const range = document.createRange();
		range.selectNodeContents(el);
		range.collapse(true);
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}

	function isLiEmpty(li){
		return !li || (li.innerText || '').trim() === '';
	}

	function sanitizeExperienceList(ul){
		const items = Array.from(ul.querySelectorAll('li'));
		const nonEmpty = items.filter(li => !isLiEmpty(li));
		if (nonEmpty.length === 0){
			// Keep only one empty li when list is entirely empty
			items.forEach((li, idx)=>{ if(idx>0) li.remove(); });
			const first = ul.querySelector('li') || ul.appendChild(document.createElement('li'));
			if (isLiEmpty(first)) first.innerHTML = '<br>';
			return;
		}
		// Remove all empty lis
		items.forEach(li => { if (isLiEmpty(li)) li.remove(); });
	}

	document.addEventListener('keydown', (e)=>{
		if(e.key !== 'Enter' || e.shiftKey) return; // Shift+Enter => line break in same bullet
		if(!e.target || !e.target.isContentEditable) return;
		const ul = e.target.closest('ul[data-editable]');
		if(!ul) return;
		if(!experienceRoot.contains(ul)) return; // only in Pengalaman Kerja

		e.preventDefault();
		let currentLi = e.target.closest('li');
		const newLi = document.createElement('li');
		newLi.innerHTML = '<br>';
		if(currentLi && currentLi.nextSibling){
			ul.insertBefore(newLi, currentLi.nextSibling);
		}else{
			ul.appendChild(newLi);
		}
		placeCaretAtStart(newLi);
	});

	// Live sanitize on input within experience lists
	document.addEventListener('input', (e)=>{
		const ul = e.target && e.target.closest && e.target.closest('ul[data-editable]');
		if(ul && experienceRoot.contains(ul)) sanitizeExperienceList(ul);
	});
})();

// Cleanup empty bullets before DOC export
(function enhanceExportCleanup(){
	const origBuild = typeof buildDocHtml === 'function' ? buildDocHtml : null;
	if(!origBuild) return;
	window.buildDocHtml = function(){
		const html = origBuild();
		// As a simple cleanup, remove <li> that are empty (<li>\s*</li>)
		return html.replace(/<li>(?:\s|<br\/??>)*<\/li>/g, '');
	};
})();

// --------- Role & Company Popover Editor ---------
(function setupRoleCompanyEditors(){
	function openSimplePopover(target, title, fieldAttr, placeholder){
		const current = target.getAttribute(fieldAttr) || target.textContent.trim();
		const pop = document.createElement('div');
		pop.className = 'date-popover centered';
		pop.innerHTML = `
			<h4>${title}</h4>
			<div class="row">
				<label style="min-width:80px">${title}</label>
				<input type="text" id="sp-input" placeholder="${placeholder}" value="${current||''}">
			</div>
			<div class="actions">
				<button class="btn" id="sp-cancel">Batal</button>
				<button class="btn primary" id="sp-apply">Terapkan</button>
			</div>
		`;
		const backdrop = document.createElement('div');
		backdrop.className = 'date-backdrop show';
		document.body.appendChild(backdrop);
		document.body.appendChild(pop);
		pop.addEventListener('click', (e)=> e.stopPropagation());
		backdrop.addEventListener('click', close);
		const input = pop.querySelector('#sp-input');
		const applyBtn = pop.querySelector('#sp-apply');
		const cancelBtn = pop.querySelector('#sp-cancel');
		input.focus();
		function close(){ pop.remove(); backdrop.remove(); }
		function apply(){
			const v = (input.value||'').trim();
			if(!v){ input.focus(); return; }
			target.setAttribute(fieldAttr, v);
			target.textContent = v;
			close();
		}
		applyBtn.addEventListener('click', apply);
		cancelBtn.addEventListener('click', close);
		pop.addEventListener('keydown', (ev)=>{
			if(ev.key==='Escape'){ ev.preventDefault(); close(); }
			if(ev.key==='Enter'){ ev.preventDefault(); apply(); }
		});
	}

	document.addEventListener('click', (e)=>{
		if(document.body.classList.contains('locked')) return;
		const roleEl = e.target.closest('.role-field');
		if(roleEl){ e.preventDefault(); openSimplePopover(roleEl, 'Posisi', 'data-role', 'Posisi / Jabatan'); return; }
		const compEl = e.target.closest('.company-field');
		if(compEl){ e.preventDefault(); openSimplePopover(compEl, 'Perusahaan', 'data-company', 'Nama Perusahaan'); return; }
	});
})();

// Update new experience items to include role/company spans as editable popovers
(function patchNewExperienceTemplate(){
	const originalCreate = createExperienceItem;
	if(typeof originalCreate !== 'function') return;
	window.createExperienceItem = function(){
		const div = originalCreate();
		const header = div.querySelector('div[contenteditable]');
		if(header){
			header.innerHTML = `<strong><span class="role-field" data-role="Posisi / Jabatan">Posisi / Jabatan</span></strong> — <span class="company-field" data-company="Nama Perusahaan">Nama Perusahaan</span>`;
		}
		return div;
	};
})();

// --------- Education Popover Editors ---------
(function setupEducationEditors(){
	function openInputPopover(target, title, attr, placeholder){
		const current = target.getAttribute(attr) || target.textContent.trim();
		const pop = document.createElement('div');
		pop.className = 'date-popover centered';
		pop.innerHTML = `
			<h4>${title}</h4>
			<div class="row">
				<label style="min-width:80px">${title}</label>
				<input type="text" id="ei-input" placeholder="${placeholder}" value="${current||''}">
			</div>
			<div class="actions">
				<button class="btn" id="ei-cancel">Batal</button>
				<button class="btn primary" id="ei-apply">Terapkan</button>
			</div>
		`;
		const backdrop = document.createElement('div');
		backdrop.className = 'date-backdrop show';
		document.body.appendChild(backdrop);
		document.body.appendChild(pop);
		pop.addEventListener('click', (e)=> e.stopPropagation());
		backdrop.addEventListener('click', close);
		const input = pop.querySelector('#ei-input');
		const applyBtn = pop.querySelector('#ei-apply');
		const cancelBtn = pop.querySelector('#ei-cancel');
		input.focus();
		function close(){ pop.remove(); backdrop.remove(); }
		function apply(){
			const v = (input.value||'').trim();
			if(!v){ input.focus(); return; }
			target.setAttribute(attr, v);
			target.textContent = v;
			close();
		}
		applyBtn.addEventListener('click', apply);
		cancelBtn.addEventListener('click', close);
		pop.addEventListener('keydown', (ev)=>{ if(ev.key==='Escape'){ev.preventDefault();close();} if(ev.key==='Enter'){ev.preventDefault();apply();}});
	}

	document.addEventListener('click', (e)=>{
		if(document.body.classList.contains('locked')) return;
		const u = e.target.closest('.edu-univ');
		if(u){ e.preventDefault(); openInputPopover(u, 'Universitas', 'data-univ', 'Nama Universitas'); return; }
		const m = e.target.closest('.edu-major');
		if(m){ e.preventDefault(); openInputPopover(m, 'Jurusan', 'data-major', 'Program Studi / Jurusan'); return; }
		// Period uses existing date popover on .date-field (edu-period), so clicking it already works
		const p = e.target.closest('.edu-period');
		if(p){ e.preventDefault(); openDatePopover(p); return; }
		// Location uses existing loc-field popover, so clicking it already works
	});
})();

// --------- Education Description Bullets (Enter to create li) ---------
(function setupEducationBullets(){
	const educationRoot = document.getElementById('education');
	if(!educationRoot) return;

	function placeCaretAtStart(el){
		const range = document.createRange();
		range.selectNodeContents(el);
		range.collapse(true);
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}
	function isLiEmpty(li){ return !li || (li.innerText||'').trim()===''; }
	function sanitizeList(ul){
		const items = Array.from(ul.querySelectorAll('li'));
		const nonEmpty = items.filter(li=>!isLiEmpty(li));
		if(nonEmpty.length===0){ items.forEach((li,i)=>{ if(i>0) li.remove(); }); const first = ul.querySelector('li')||ul.appendChild(document.createElement('li')); if(isLiEmpty(first)) first.innerHTML='<br>'; return; }
		items.forEach(li=>{ if(isLiEmpty(li)) li.remove(); });
	}

	document.addEventListener('keydown', (e)=>{
		if(e.key!=='Enter' || e.shiftKey) return;
		if(!e.target || !e.target.isContentEditable) return;
		const ul = e.target.closest('ul[data-editable]');
		if(!ul) return;
		if(!educationRoot.contains(ul)) return;
		e.preventDefault();
		let currentLi = e.target.closest('li');
		const newLi = document.createElement('li');
		newLi.innerHTML = '<br>';
		if(currentLi && currentLi.nextSibling){ ul.insertBefore(newLi, currentLi.nextSibling); } else { ul.appendChild(newLi); }
		placeCaretAtStart(newLi);
	});

	document.addEventListener('input', (e)=>{
		const ul = e.target && e.target.closest && e.target.closest('ul[data-editable]');
		if(ul && educationRoot.contains(ul)) sanitizeList(ul);
	});
})();

// --------- Extras Description Bullets ---------
(function setupExtrasBullets(){
	const extrasRoot = document.getElementById('extras');
	if(!extrasRoot) return;
	function placeCaretAtStart(el){ const r=document.createRange(); r.selectNodeContents(el); r.collapse(true); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);}
	function isLiEmpty(li){ return !li || (li.innerText||'').trim()===''; }
	function sanitizeList(ul){
		const items = Array.from(ul.querySelectorAll('li'));
		const nonEmpty = items.filter(li=>!isLiEmpty(li));
		if(nonEmpty.length===0){ items.forEach((li,i)=>{ if(i>0) li.remove(); }); const first = ul.querySelector('li')||ul.appendChild(document.createElement('li')); if(isLiEmpty(first)) first.innerHTML='<br>'; return; }
		items.forEach(li=>{ if(isLiEmpty(li)) li.remove(); });
	}
	document.addEventListener('keydown', (e)=>{
		if(e.key!=='Enter' || e.shiftKey) return;
		if(!e.target || !e.target.isContentEditable) return;
		const ul = e.target.closest('ul[data-editable]');
		if(!ul || !extrasRoot.contains(ul)) return;
		e.preventDefault();
		let currentLi = e.target.closest('li');
		const newLi = document.createElement('li'); newLi.innerHTML = '<br>';
		if(currentLi && currentLi.nextSibling){ ul.insertBefore(newLi, currentLi.nextSibling); } else { ul.appendChild(newLi); }
		placeCaretAtStart(newLi);
	});
		document.addEventListener('input', (e)=>{
		const ul = e.target && e.target.closest && e.target.closest('ul[data-editable]');
		if(ul && extrasRoot.contains(ul)) sanitizeList(ul);
	});
})(); 