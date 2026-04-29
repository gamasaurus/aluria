import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMermaid, generatePSB, generateBPMNFromV2, generateUMLSequence, generateERD } from '@/lib/ai/bpmn'
import { createEmptyKB, createEmptyKBV2 } from '@/lib/ai/extract'
import { calculateDepth, computeProgress, calculateDepthV2, computeProgressV2 } from '@/lib/ai/depth'
import type { KnowledgeBase, KnowledgeBaseV2 } from '@/lib/types'

/**
 * GET /api/pdf?project_id=X
 * Returns a print-optimized HTML page.
 * The Mermaid diagram is rendered to a PNG image client-side before printing.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const project_id = searchParams.get('project_id')

    if (!project_id) {
      return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { data: kbRow } = await supabase
      .from('knowledge_bases')
      .select('json_content, kb_version')
      .eq('project_id', project_id)
      .single()

    const kbVersion: 1 | 2 = (kbRow?.kb_version ?? 1) as 1 | 2

    // ── V2: render PSB as print page ─────────────────────────────────────────
    if (kbVersion === 2) {
      const rawKB = kbRow?.json_content
      const kbV2: KnowledgeBaseV2 = rawKB && typeof rawKB === 'object' && 'business' in rawKB
        ? rawKB as KnowledgeBaseV2
        : createEmptyKBV2()

      const psb = generatePSB(kbV2, project.name)
      const bpmnStr = generateBPMNFromV2(kbV2)
      const umlStr = generateUMLSequence(kbV2)
      const erdStr = generateERD(kbV2)

      // Extract mermaid blocks from diagram strings
      const extractMermaid = (s: string) => {
        const m = s.match(new RegExp('```mermaid\\n([\\s\\S]*?)```'))
        return m ? m[1].trim() : ''
      }
      const bpmnChart = bpmnStr ? extractMermaid(bpmnStr) : ''
      const umlChart = umlStr ? extractMermaid(umlStr) : ''
      const erdChart = erdStr ? extractMermaid(erdStr) : ''

      const diagrams = JSON.stringify({ bpmn: bpmnChart, uml: umlChart, erd: erdChart })
      const printPage = buildPSBPrintPage(project.name, psb, diagrams)

      return new NextResponse(printPage, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // ── V1: existing flow ─────────────────────────────────────────────────────
    const kb: KnowledgeBase = kbRow?.json_content ?? createEmptyKB()
    const docHTML = generateDocHTML(kb, project.name)
    const mermaidDef = generateMermaid(kb)
    const mermaidJSON = JSON.stringify(mermaidDef)
    const printPage = buildPrintPage(project.name, docHTML, mermaidJSON)

    return new NextResponse(printPage, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('[pdf/route] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Build PSB print page (V2) ───────────────────────────────────────────────

function buildPSBPrintPage(projectName: string, psbMarkdown: string, diagramsJSON: string): string {
  // Convert PSB markdown to HTML
  const htmlBody = markdownToHtml(psbMarkdown)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)} — PSB</title>
  <style>
    @page { size: A4; margin: 2cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1f2937;
      background: white;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 22pt; font-weight: 700; margin-bottom: 12pt; color: #111827; page-break-after: avoid; }
    h2 { font-size: 15pt; font-weight: 700; margin-top: 22pt; margin-bottom: 8pt; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5pt; page-break-after: avoid; }
    h3 { font-size: 12pt; font-weight: 600; margin-top: 14pt; margin-bottom: 6pt; color: #4b5563; page-break-after: avoid; }
    h4 { font-size: 11pt; font-weight: 600; margin-top: 10pt; margin-bottom: 4pt; color: #6b7280; page-break-after: avoid; }
    p { margin-bottom: 8pt; }
    ul, ol { margin-left: 18pt; margin-bottom: 8pt; }
    li { margin-bottom: 3pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14pt; page-break-inside: avoid; }
    th, td { border: 1px solid #d1d5db; padding: 7pt; text-align: left; font-size: 10pt; }
    th { background: #f3f4f6; font-weight: 600; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 18pt 0; }
    strong { font-weight: 600; color: #111827; }
    em { font-style: italic; color: #6b7280; }
    code { font-family: monospace; font-size: 10pt; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
    pre { background: #f3f4f6; padding: 12pt; border-radius: 6px; overflow: auto; margin-bottom: 12pt; font-size: 9pt; }
    .mermaid-placeholder { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #fafafa; text-align: center; margin: 12pt 0; min-height: 60px; }
    .mermaid-placeholder img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    .toolbar { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 999; }
    .toolbar button { padding: 10px 20px; font-size: 13px; font-weight: 600; color: white; background: #6366f1; border: none; border-radius: 8px; cursor: pointer; }
    .toolbar button:hover { background: #4f46e5; }
    .toolbar button.secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
    .toolbar button.secondary:hover { background: #f9fafb; }
    @media print {
      .toolbar { display: none; }
      .container { padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="secondary" onclick="window.close()">✕ Close</button>
    <button onclick="printWhenReady()">📄 Save as PDF</button>
  </div>
  <div class="container">
    ${htmlBody}
  </div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    const DIAGRAMS = ${diagramsJSON};
    let pendingDiagrams = 0;
    let renderedDiagrams = 0;

    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      flowchart: { curve: 'basis', padding: 20 },
      themeVariables: { primaryColor: '#EEF2FF', primaryTextColor: '#111827', primaryBorderColor: '#6366F1', lineColor: '#6366F1', fontSize: '12px' },
    });

    async function renderDiagramInto(containerId, chartDef) {
      const el = document.getElementById(containerId);
      if (!el || !chartDef) return;
      try {
        const { svg } = await mermaid.render(containerId + '-svg', chartDef);
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = 2;
          canvas.width = (img.naturalWidth || 800) * scale;
          canvas.height = (img.naturalHeight || 400) * scale;
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          el.innerHTML = '<img src="' + canvas.toDataURL('image/png') + '" style="max-width:100%;height:auto;" />';
          renderedDiagrams++;
        };
        img.onerror = () => { el.innerHTML = svg; renderedDiagrams++; };
        img.src = url;
      } catch(e) {
        el.innerHTML = '<p style="color:#9ca3af;font-size:10pt;">Diagram unavailable.</p>';
        renderedDiagrams++;
      }
    }

    function printWhenReady() {
      if (renderedDiagrams >= pendingDiagrams) { window.print(); return; }
      const check = setInterval(() => {
        if (renderedDiagrams >= pendingDiagrams) { clearInterval(check); window.print(); }
      }, 100);
      setTimeout(() => { clearInterval(check); window.print(); }, 6000);
    }

    window.addEventListener('load', () => {
      if (DIAGRAMS.uml)  { pendingDiagrams++; renderDiagramInto('psb-uml-diagram',    DIAGRAMS.uml);  }
      if (DIAGRAMS.erd)  { pendingDiagrams++; renderDiagramInto('psb-erd-diagram',     DIAGRAMS.erd);  }
      if (DIAGRAMS.bpmn) { pendingDiagrams++; renderDiagramInto('psb-bpmn-diagram-0',  DIAGRAMS.bpmn); }
    });
  </script>
</body>
</html>`
}

// ─── Minimal markdown → HTML converter for PSB print ─────────────────────────

function markdownToHtml(md: string): string {
  const e = escapeHtml
  const lines = md.split('\n')
  const out: string[] = []
  let inTable = false
  let inCode = false
  let mermaidBuffer: string[] = []
  let mermaidDiagramIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Fenced mermaid blocks — collect content, emit placeholder with typed ID
    if (line.trim().startsWith('```mermaid')) {
      inCode = true
      mermaidBuffer = []
      continue
    }
    if (line.trim() === '```' && inCode) {
      inCode = false
      const chartContent = mermaidBuffer.join('\n')
      // Detect diagram type from content
      let diagramId: string
      if (/sequenceDiagram/i.test(chartContent)) {
        diagramId = 'psb-uml-diagram'
      } else if (/erDiagram/i.test(chartContent)) {
        diagramId = 'psb-erd-diagram'
      } else {
        // flowchart / BPMN — use index to avoid ID collision if multiple
        diagramId = `psb-bpmn-diagram-${mermaidDiagramIndex++}`
      }
      out.push(`<div class="mermaid-placeholder" id="${diagramId}"><span style="color:#9ca3af;font-size:10pt;">Rendering diagram…</span></div>`)
      mermaidBuffer = []
      continue
    }
    if (inCode) { mermaidBuffer.push(line); continue }

    // Other fenced code blocks — skip
    if (line.trim().startsWith('```')) { continue }

    // Table rows
    if (line.trim().startsWith('|')) {
      if (!inTable) { out.push('<table>'); inTable = true }
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      if (cells.every(c => /^[-:]+$/.test(c))) continue // separator row
      const isFirstRow = out[out.length - 1] === '<table>'
      const tag = isFirstRow ? 'th' : 'td'
      out.push(`<tr>${cells.map(c => `<${tag}>${inlineMarkdown(c)}</${tag}>`).join('')}</tr>`)
      continue
    } else if (inTable) {
      out.push('</table>')
      inTable = false
    }

    if (line.startsWith('#### '))  { out.push(`<h4>${e(line.slice(5))}</h4>`); continue }
    if (line.startsWith('### '))   { out.push(`<h3>${e(line.slice(4))}</h3>`); continue }
    if (line.startsWith('## '))    { out.push(`<h2>${e(line.slice(3))}</h2>`); continue }
    if (line.startsWith('# '))     { out.push(`<h1>${e(line.slice(2))}</h1>`); continue }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      out.push(`<ul><li>${inlineMarkdown(line.slice(2))}</li></ul>`)
      continue
    }
    if (/^\d+\. /.test(line)) {
      out.push(`<ol><li>${inlineMarkdown(line.replace(/^\d+\. /, ''))}</li></ol>`)
      continue
    }
    if (line.trim() === '---' || line.trim() === '***') { out.push('<hr>'); continue }
    if (line.trim() === '') { out.push('<p></p>'); continue }

    out.push(`<p>${inlineMarkdown(line)}</p>`)
  }

  if (inTable) out.push('</table>')

  // Merge consecutive <ul>/<ol> items
  return out.join('\n')
    .replace(/<\/ul>\n<ul>/g, '')
    .replace(/<\/ol>\n<ol>/g, '')
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

// ─── Build the full print HTML page ──────────────────────────────────────────

function buildPrintPage(projectName: string, docHTML: string, mermaidJSON: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)} — PRD</title>
  <style>
    @page { size: A4; margin: 2cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1f2937;
      background: white;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 22pt; font-weight: 700; margin-bottom: 12pt; color: #111827; page-break-after: avoid; }
    h2 { font-size: 16pt; font-weight: 700; margin-top: 22pt; margin-bottom: 8pt; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5pt; page-break-after: avoid; }
    h3 { font-size: 13pt; font-weight: 600; margin-top: 14pt; margin-bottom: 6pt; color: #4b5563; page-break-after: avoid; }
    p { margin-bottom: 8pt; }
    ul, ol { margin-left: 18pt; margin-bottom: 8pt; }
    li { margin-bottom: 3pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14pt; page-break-inside: avoid; }
    th, td { border: 1px solid #d1d5db; padding: 7pt; text-align: left; font-size: 10pt; }
    th { background: #f3f4f6; font-weight: 600; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 18pt 0; }
    strong { font-weight: 600; color: #111827; }
    em { font-style: italic; color: #6b7280; }

    /* Diagram container */
    .diagram-section { margin: 16pt 0; page-break-inside: avoid; }
    .diagram-section h3 { margin-bottom: 10pt; }
    #diagram-container {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      background: #fafafa;
      text-align: center;
      min-height: 80px;
    }
    #diagram-container img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    #diagram-status {
      color: #6b7280;
      font-size: 10pt;
      font-style: italic;
    }

    /* Print button */
    .toolbar {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      z-index: 999;
    }
    .toolbar button {
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 600;
      color: white;
      background: #6366f1;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(99,102,241,0.3);
    }
    .toolbar button:hover { background: #4f46e5; }
    .toolbar button.secondary {
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .toolbar button.secondary:hover { background: #f9fafb; }

    @media print {
      .toolbar { display: none; }
      body { padding: 0; }
      .container { padding: 0; max-width: 100%; }
      #diagram-container { border: 1px solid #e5e7eb; background: white; }
    }
  </style>
</head>
<body>

  <div class="toolbar">
    <button class="secondary" onclick="window.close()">✕ Close</button>
    <button onclick="printWhenReady()">📄 Save as PDF</button>
  </div>

  <div class="container">
    ${docHTML}
  </div>

  <!-- Mermaid CDN -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>

  <script>
    const MERMAID_DEF = ${mermaidJSON};

    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      flowchart: { curve: 'basis', padding: 20, nodeSpacing: 50, rankSpacing: 60 },
      themeVariables: {
        primaryColor: '#EEF2FF',
        primaryTextColor: '#111827',
        primaryBorderColor: '#6366F1',
        lineColor: '#6366F1',
        secondaryColor: '#F3F4F6',
        fontSize: '13px',
      },
    });

    let diagramReady = false;

    async function renderDiagram() {
      const container = document.getElementById('diagram-container');
      const status = document.getElementById('diagram-status');
      if (!container || !MERMAID_DEF) return;

      try {
        status.textContent = 'Rendering diagram…';

        const { svg } = await mermaid.render('mermaid-pdf-diagram', MERMAID_DEF);

        // Convert SVG string → Blob URL → Image element
        // This ensures it prints correctly across all browsers
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          // Draw SVG onto canvas → get PNG data URL (best print compatibility)
          const canvas = document.createElement('canvas');
          const scale = 2; // retina
          canvas.width = img.naturalWidth * scale || 1200;
          canvas.height = img.naturalHeight * scale || 600;
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);

          const pngUrl = canvas.toDataURL('image/png');
          container.innerHTML = '<img src="' + pngUrl + '" alt="Process Flow Diagram" style="max-width:100%;height:auto;" />';
          diagramReady = true;
        };
        img.onerror = () => {
          // SVG blob failed — inject SVG directly as fallback
          container.innerHTML = svg;
          const svgEl = container.querySelector('svg');
          if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.height = 'auto'; }
          diagramReady = true;
        };
        img.src = url;

      } catch (err) {
        console.error('Diagram render error:', err);
        container.innerHTML = '<p style="color:#9ca3af;font-size:11pt;">Diagram could not be rendered.</p>';
        diagramReady = true;
      }
    }

    function printWhenReady() {
      if (diagramReady || !MERMAID_DEF) {
        window.print();
      } else {
        // Wait for diagram then print
        const check = setInterval(() => {
          if (diagramReady) { clearInterval(check); window.print(); }
        }, 100);
        // Timeout after 5s
        setTimeout(() => { clearInterval(check); window.print(); }, 5000);
      }
    }

    // Render on load
    window.addEventListener('load', renderDiagram);
  </script>
</body>
</html>`
}

// ─── Generate document HTML directly (no markdown intermediate) ──────────────

function generateDocHTML(kb: KnowledgeBase, projectName: string): string {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const depthScore = calculateDepth(kb)
  const completionPct = Math.round(computeProgress(kb) * 100)

  const e = escapeHtml

  let html = `
    <h1>${e(projectName)}</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:4pt;">Generated by Aluria — AI System Analyst &nbsp;·&nbsp; ${e(date)}</p>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:16pt;">Completion: <strong>${completionPct}%</strong> &nbsp;·&nbsp; Depth Score: <strong>${depthScore}/100</strong></p>
    <hr>

    <h2>1. Executive Summary</h2>
    <h3>Problem</h3>
    <p>${kb.problem ? e(kb.problem) : '<em>(Not yet defined)</em>'}</p>
  `

  if (kb.problem_why.length > 0) {
    html += `<h3>Goal</h3><ul>${kb.problem_why.map(w => `<li>${e(w)}</li>`).join('')}</ul>`
  }
  if (kb.affected_who.length > 0) {
    html += `<h3>Affected Stakeholders</h3><ul>${kb.affected_who.map(s => `<li>${e(s)}</li>`).join('')}</ul>`
  }

  html += `<hr><h2>2. Actors &amp; Roles</h2>`
  if (kb.actors.length > 0) {
    html += `<table><thead><tr><th>Name</th><th>Role</th><th>Responsibility</th></tr></thead><tbody>`
    kb.actors.forEach(a => {
      html += `<tr><td><strong>${e(a.name)}</strong></td><td>${e(a.role || '—')}</td><td>${e(a.responsibility || '—')}</td></tr>`
    })
    html += `</tbody></table>`
  } else {
    html += `<p><em>(Not yet defined)</em></p>`
  }

  html += `<hr><h2>3. Process Flow</h2>`
  if (kb.process_flow.length > 0) {
    html += `<ol>${kb.process_flow.map(s => `<li>${e(s)}</li>`).join('')}</ol>`
    if (kb.decision_points.length > 0) {
      html += `<h3>Decision Points</h3><ul>${kb.decision_points.map(d => `<li>${e(d)}</li>`).join('')}</ul>`
    }
    if (kb.edge_cases.length > 0) {
      html += `<h3>Edge Cases</h3><ul>${kb.edge_cases.map(ec => `<li>${e(ec)}</li>`).join('')}</ul>`
    }
    // Diagram placeholder — filled by client-side Mermaid rendering
    html += `
      <div class="diagram-section">
        <h3>Process Flow Diagram</h3>
        <div id="diagram-container">
          <span id="diagram-status">Loading diagram…</span>
        </div>
      </div>
    `
  } else {
    html += `<p><em>(Not yet defined)</em></p>`
  }

  html += `<hr><h2>4. Functional Requirements</h2>`
  if (kb.functional_requirements.length > 0) {
    html += `<table><thead><tr><th>ID</th><th>Requirement</th><th>Priority</th></tr></thead><tbody>`
    kb.functional_requirements.forEach((req, i) => {
      html += `<tr><td><strong>FR-${i + 1}</strong></td><td>${e(req)}</td><td>High</td></tr>`
    })
    html += `</tbody></table>`
  } else {
    html += `<p><em>(Not yet defined)</em></p>`
  }

  html += `<hr><h2>5. Business Rules</h2>`
  if (kb.business_rules.length > 0) {
    html += `<table><thead><tr><th>ID</th><th>Rule</th></tr></thead><tbody>`
    kb.business_rules.forEach((rule, i) => {
      html += `<tr><td><strong>BR-${i + 1}</strong></td><td>${e(rule)}</td></tr>`
    })
    html += `</tbody></table>`
  } else {
    html += `<p><em>(None defined)</em></p>`
  }

  html += `<hr><h2>6. System Specification (SRS)</h2>`

  html += `<h3>Roles &amp; Permissions</h3>`
  if (kb.actors.length > 0) {
    html += `<table><thead><tr><th>Role</th><th>Responsibility</th><th>System Access</th></tr></thead><tbody>`
    kb.actors.forEach(a => {
      html += `<tr><td>${e(a.name)}</td><td>${e(a.role || '—')}</td><td>${e(a.responsibility || '—')}</td></tr>`
    })
    html += `</tbody></table>`
  }

  html += `<h3>Non-Functional Requirements</h3>
    <table><thead><tr><th>Category</th><th>Requirement</th></tr></thead><tbody>
      <tr><td>Performance</td><td>System should respond within 2 seconds</td></tr>
      <tr><td>Security</td><td>All user data must be encrypted at rest and in transit</td></tr>
      <tr><td>Availability</td><td>99.9% uptime target</td></tr>
      <tr><td>Scalability</td><td>Must support concurrent users without degradation</td></tr>
    </tbody></table>`

  html += `<hr><h2>Analysis Metadata</h2>
    <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
      <tr><td>Completion Score</td><td>${completionPct}%</td></tr>
      <tr><td>Depth Score</td><td>${depthScore}/100</td></tr>
      <tr><td>Total Actors</td><td>${kb.actors.length}</td></tr>
      <tr><td>Total Process Steps</td><td>${kb.process_flow.length}</td></tr>
      <tr><td>Total Functional Requirements</td><td>${kb.functional_requirements.length}</td></tr>
      <tr><td>Total Business Rules</td><td>${kb.business_rules.length}</td></tr>
    </tbody></table>`

  html += `<p style="color:#9ca3af;font-size:9pt;margin-top:24pt;text-align:center;">Generated by Aluria — Deterministic AI System Analyst</p>`

  return html
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
