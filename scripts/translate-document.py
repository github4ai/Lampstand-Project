"""Extract and rebuild translatable documents while retaining native structure."""
import argparse, json, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'

def docx_parts(path):
    with zipfile.ZipFile(path) as archive:
        names = [n for n in archive.namelist() if n == 'word/document.xml' or n.startswith('word/header') or n.startswith('word/footer') or n in ('word/footnotes.xml','word/endnotes.xml')]
        return [(name, archive.read(name)) for name in names]

def extract_docx(path):
    segments=[]
    for part, raw in docx_parts(path):
        root=ET.fromstring(raw)
        for i, paragraph in enumerate(root.iter(W+'p')):
            text=''.join(node.text or '' for node in paragraph.iter(W+'t')).strip()
            if text: segments.append({'id':f'{part}|{i}','text':text})
    return segments

def apply_docx(source, output, translations):
    mapping={x['id']:x['text'] for x in translations}
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            raw=src.read(info.filename)
            if info.filename == 'word/document.xml' or info.filename.startswith('word/header') or info.filename.startswith('word/footer') or info.filename in ('word/footnotes.xml','word/endnotes.xml'):
                root=ET.fromstring(raw)
                for i,p in enumerate(root.iter(W+'p')):
                    value=mapping.get(f'{info.filename}|{i}')
                    if value is None: continue
                    nodes=list(p.iter(W+'t'))
                    if nodes:
                        # Put translated text in the dominant original run. This
                        # retains the paragraph's representative formatting and
                        # avoids accidentally making a whole paragraph inherit
                        # a short superscript marker or decorative first run.
                        target=max(nodes,key=lambda node:len(node.text or ''))
                        for node in nodes: node.text=value if node is target else ''
                raw=ET.tostring(root,encoding='utf-8',xml_declaration=True)
            dst.writestr(info,raw)

def pptx_part(name):
    return (name.startswith('ppt/slides/slide') or name.startswith('ppt/notesSlides/notesSlide')
            or name.startswith('ppt/charts/chart') or name.startswith('ppt/diagrams/data')) and name.endswith('.xml')

def extract_pptx(path):
    segments=[]
    with zipfile.ZipFile(path) as archive:
        for part in archive.namelist():
            if not pptx_part(part): continue
            root=ET.fromstring(archive.read(part))
            for i,paragraph in enumerate(root.iter(A+'p')):
                text=''.join(node.text or '' for node in paragraph.iter(A+'t')).strip()
                if text: segments.append({'id':f'{part}|{i}','text':text})
    return segments

def apply_pptx(source, output, translations):
    mapping={x['id']:x['text'] for x in translations}
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            raw=src.read(info.filename)
            if pptx_part(info.filename):
                root=ET.fromstring(raw)
                for i,paragraph in enumerate(root.iter(A+'p')):
                    value=mapping.get(f'{info.filename}|{i}')
                    if value is None: continue
                    nodes=list(paragraph.iter(A+'t'))
                    if nodes:
                        target=max(nodes,key=lambda node:len(node.text or ''))
                        for node in nodes: node.text=value if node is target else ''
                raw=ET.tostring(root,encoding='utf-8',xml_declaration=True)
            dst.writestr(info,raw)

def extract_plain(path):
    suffix=Path(path).suffix.lower()
    if suffix=='.pdf':
        from pypdf import PdfReader
        result=[]
        for i,page in enumerate(PdfReader(path).pages):
            text=page.extract_text() or ''
            if text.strip(): result.append({'id':f'page|{i}','text':text,'width':float(page.mediabox.width),'height':float(page.mediabox.height)})
        return result
    if suffix in ('.html','.htm'):
        source=Path(path).read_text(encoding='utf-8',errors='replace'); result=[]; hidden=False
        for i,part in enumerate(re.split(r'(<[^>]+>)',source)):
            if part.startswith('<'):
                tag=re.match(r'</?\s*([\w:-]+)',part)
                if tag and tag.group(1).lower() in ('script','style'): hidden=not part.lstrip().startswith('</')
            elif not hidden and part.strip(): result.append({'id':f'text|{i}','text':part})
        return result
    text=Path(path).read_text(encoding='utf-8',errors='replace')
    return [{'id':'document|0','text':text}]

def apply_plain(source, output, translations):
    suffix=Path(source).suffix.lower()
    text='\n\n'.join(x['text'] for x in translations)
    if suffix=='.pdf':
        from reportlab.pdfgen.canvas import Canvas
        from reportlab.pdfbase.pdfmetrics import stringWidth
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        first=translations[0]; width=float(first.get('width',595)); height=float(first.get('height',842))
        canvas=Canvas(output,pagesize=(width,height))
        for item in translations:
            width=float(item.get('width',width)); height=float(item.get('height',height)); canvas.setPageSize((width,height))
            font='Helvetica'
            candidates=[Path(r'C:\Windows\Fonts\Nirmala.ttf'),Path(r'C:\Windows\Fonts\Nirmala.ttc'),Path(r'C:\Windows\Fonts\arial.ttf')]
            for candidate in candidates:
                if candidate.exists():
                    try: pdfmetrics.registerFont(TTFont('AIOSUnicode',str(candidate))); font='AIOSUnicode'; break
                    except Exception: pass
            y=height-54
            for para in item['text'].splitlines():
                words=para.split(); line=''
                for word in words:
                    trial=(line+' '+word).strip()
                    if stringWidth(trial,font,10)>width-108:
                        canvas.setFont(font,10); canvas.drawString(54,y,line); y-=14; line=word
                    else: line=trial
                    if y<54: canvas.showPage(); y=height-54
                canvas.setFont(font,10); canvas.drawString(54,y,line); y-=18
            canvas.showPage()
        canvas.save()
    elif suffix in ('.html','.htm'):
        source_text=Path(source).read_text(encoding='utf-8',errors='replace'); mapping={x['id']:x['text'] for x in translations}
        parts=re.split(r'(<[^>]+>)',source_text)
        for i in range(len(parts)):
            if f'text|{i}' in mapping: parts[i]=mapping[f'text|{i}']
        Path(output).write_text(''.join(parts),encoding='utf-8')
    else: Path(output).write_text(text,encoding='utf-8')

parser=argparse.ArgumentParser(); parser.add_argument('mode',choices=['extract','apply']); parser.add_argument('source'); parser.add_argument('--output'); parser.add_argument('--translations')
args=parser.parse_args(); suffix=Path(args.source).suffix.lower()
if args.mode=='extract':
    print(json.dumps(extract_docx(args.source) if suffix=='.docx' else extract_pptx(args.source) if suffix=='.pptx' else extract_plain(args.source),ensure_ascii=False))
else:
    data=json.loads(Path(args.translations).read_text(encoding='utf-8'))
    apply_docx(args.source,args.output,data) if suffix=='.docx' else apply_pptx(args.source,args.output,data) if suffix=='.pptx' else apply_plain(args.source,args.output,data)
