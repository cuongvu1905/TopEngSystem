import json, os, glob

project_dir = r"C:\Users\TOPV.LAPTOP.130\Documents\TOPVSystem\projects\topeng_loop_engineering_20260903"
svg_files = sorted(glob.glob(os.path.join(project_dir, "svg_output", "P*.svg")))

slides_data = []
for svg_path in svg_files:
    fname = os.path.basename(svg_path)
    base_id = os.path.splitext(fname)[0]
    note_path = os.path.join(project_dir, "notes", f"{base_id}.md")
    note_content = ""
    if os.path.exists(note_path):
        with open(note_path, "r", encoding="utf-8") as f:
            note_content = f.read().strip()
    
    # Read title from SVG text or notes
    title = base_id
    if note_content:
        lines = note_content.splitlines()
        if lines and lines[0].startswith("#"):
            title = lines[0].lstrip("# ").strip()
    
    slides_data.append({
        "id": base_id,
        "filename": fname,
        "title": title,
        "note": note_content
    })

html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TOPVSystem - Loop Engineering Presentation (35 Slides)</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #070B14;
      color: #F1F5F9;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }}
    /* Sidebar */
    #sidebar {{
      width: 320px;
      background: #0B1120;
      border-right: 1px solid #1E293B;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }}
    .sidebar-header {{
      padding: 18px 20px;
      border-bottom: 1px solid #1E293B;
      background: #0F172A;
    }}
    .sidebar-header h1 {{
      font-size: 16px;
      font-weight: 700;
      color: #38BDF8;
      letter-spacing: 0.5px;
    }}
    .sidebar-header p {{
      font-size: 12px;
      color: #94A3B8;
      margin-top: 4px;
    }}
    .download-bar {{
      padding: 12px 16px;
      background: #0B1120;
      border-bottom: 1px solid #1E293B;
    }}
    .btn-download {{
      display: block;
      width: 100%;
      padding: 10px 14px;
      background: linear-gradient(135deg, #10B981, #059669);
      color: white;
      text-align: center;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      transition: all 0.2s;
    }}
    .btn-download:hover {{
      background: linear-gradient(135deg, #059669, #047857);
      transform: translateY(-1px);
    }}
    .slide-list {{
      flex: 1;
      overflow-y: auto;
      padding: 12px 10px;
    }}
    .slide-item {{
      display: flex;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 6px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }}
    .slide-item:hover {{
      background: #1E293B;
    }}
    .slide-item.active {{
      background: #1E293B;
      border-color: #38BDF8;
    }}
    .slide-num {{
      width: 32px;
      font-size: 12px;
      font-weight: 700;
      color: #38BDF8;
    }}
    .slide-info {{
      flex: 1;
      overflow: hidden;
    }}
    .slide-title {{
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #E2E8F0;
    }}
    /* Main Viewport */
    #main {{
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #070B14;
    }}
    .top-toolbar {{
      height: 56px;
      background: #0B1120;
      border-bottom: 1px solid #1E293B;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
    }}
    .slide-counter {{
      font-size: 14px;
      font-weight: 600;
      color: #94A3B8;
    }}
    .slide-counter span {{
      color: #38BDF8;
    }}
    .nav-controls {{
      display: flex;
      gap: 10px;
    }}
    .btn {{
      padding: 8px 16px;
      background: #1E293B;
      border: 1px solid #334155;
      color: #F1F5F9;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }}
    .btn:hover {{
      background: #334155;
      border-color: #38BDF8;
    }}
    .btn:disabled {{
      opacity: 0.4;
      cursor: not-allowed;
    }}
    .stage-container {{
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow: hidden;
    }}
    .slide-frame {{
      width: 100%;
      max-width: 1060px;
      aspect-ratio: 16 / 9;
      background: #0F172A;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
      border: 1px solid #1E293B;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .slide-frame iframe {{
      width: 100%;
      height: 100%;
      border: none;
    }}
    /* Notes Panel */
    .notes-drawer {{
      height: 140px;
      background: #0B1120;
      border-top: 1px solid #1E293B;
      padding: 16px 24px;
      overflow-y: auto;
    }}
    .notes-header {{
      font-size: 12px;
      font-weight: 700;
      color: #10B981;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }}
    .notes-body {{
      font-size: 13px;
      line-height: 1.6;
      color: #CBD5E1;
    }}
  </style>
</head>
<body>
  <div id="sidebar">
    <div class="sidebar-header">
      <h1>TOPVSYSTEM AI PRESENTATION</h1>
      <p>Kỹ Nghệ Loop Engineering (35 Trang)</p>
    </div>
    <div class="download-bar">
      <a class="btn-download" href="exports/topeng_loop_engineering_20260903_113931.pptx" download>
        ⬇ Tải File PPTX (35 Slide Hoàn Chỉnh)
      </a>
    </div>
    <div class="slide-list" id="slideList"></div>
  </div>

  <div id="main">
    <div class="top-toolbar">
      <div class="slide-counter" id="counter">Trang <span>1</span> / 35</div>
      <div class="nav-controls">
        <button class="btn" id="btnPrev" onclick="navigate(-1)">← Trang Trước</button>
        <button class="btn" id="btnNext" onclick="navigate(1)">Trang Sau →</button>
        <button class="btn" onclick="openFullscreen()">⛶ Toàn Màn Hình</button>
      </div>
    </div>
    <div class="stage-container">
      <div class="slide-frame" id="slideFrame">
        <iframe id="svgViewer" src="svg_output/P01.svg"></iframe>
      </div>
    </div>
    <div class="notes-drawer">
      <div class="notes-header">🎤 Lời thoại diễn thuyết (Speaker Notes):</div>
      <div class="notes-body" id="notesBody">Đang tải...</div>
    </div>
  </div>

  <script>
    const slides = {json.dumps(slides_data, ensure_ascii=False)};
    let currentIndex = 0;

    function renderSidebar() {{
      const list = document.getElementById('slideList');
      list.innerHTML = '';
      slides.forEach((s, idx) => {{
        const item = document.createElement('div');
        item.className = 'slide-item' + (idx === currentIndex ? ' active' : '');
        item.onclick = () => selectSlide(idx);
        item.innerHTML = `
          <div class="slide-num">P${{String(idx + 1).padStart(2, '0')}}</div>
          <div class="slide-info">
            <div class="slide-title">${{s.title}}</div>
          </div>
        `;
        list.appendChild(item);
      }});
    }}

    function selectSlide(idx) {{
      if (idx < 0 || idx >= slides.length) return;
      currentIndex = idx;
      const s = slides[idx];
      document.getElementById('svgViewer').src = 'svg_output/' + s.filename;
      document.getElementById('counter').innerHTML = `Trang <span>${{idx + 1}}</span> / ${{slides.length}}`;
      
      let noteClean = s.note;
      if (noteClean.startsWith('#')) {{
        const lines = noteClean.split('\\n');
        lines.shift();
        noteClean = lines.join('\\n').trim();
      }}
      document.getElementById('notesBody').innerText = noteClean || '(Không có ghi chú diễn thuyết)';

      document.getElementById('btnPrev').disabled = (idx === 0);
      document.getElementById('btnNext').disabled = (idx === slides.length - 1);

      document.querySelectorAll('.slide-item').forEach((el, i) => {{
        el.className = 'slide-item' + (i === idx ? ' active' : '');
        if (i === idx) el.scrollIntoView({{ block: 'nearest', behavior: 'smooth' }});
      }});
    }}

    function navigate(delta) {{
      selectSlide(currentIndex + delta);
    }}

    function openFullscreen() {{
      const viewer = document.getElementById('svgViewer');
      window.open(viewer.src, '_blank');
    }}

    document.addEventListener('keydown', (e) => {{
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') navigate(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') navigate(-1);
    }});

    renderSidebar();
    selectSlide(0);
  </script>
</body>
</html>
"""

with open(os.path.join(project_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(html_content)

print("Generated interactive index.html preview successfully!")
