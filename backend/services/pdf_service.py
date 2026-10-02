from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.platypus import KeepTogether
from io import BytesIO
from datetime import datetime, timezone
import asyncio, re
from services.bypass_service import generate_anonymous_id

PRIMARY = colors.HexColor("#034168")
ACCENT  = colors.HexColor("#FF6A00")
LIGHT   = colors.HexColor("#F0F4F8")

def _build_pdf_sync(product: dict, supplier: dict, unlocked: bool) -> bytes:
    buf = BytesIO()
    styles = getSampleStyleSheet()
    now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    title_s  = ParagraphStyle("T", parent=styles["Heading1"], fontSize=15, textColor=PRIMARY, fontName="Helvetica-Bold", spaceAfter=4)
    section_s= ParagraphStyle("S", parent=styles["Heading2"], fontSize=9, textColor=colors.white, fontName="Helvetica-Bold")
    body_s   = ParagraphStyle("B", parent=styles["Normal"], fontSize=9, leading=13, textColor=colors.HexColor("#333"))
    label_s  = ParagraphStyle("L", parent=styles["Normal"], fontSize=8.5, fontName="Helvetica-Bold", textColor=PRIMARY)
    small_s  = ParagraphStyle("Sm", parent=styles["Normal"], fontSize=7.5, textColor=colors.HexColor("#666"))

    def sec(text):
        t = Table([[Paragraph(f"  {text}", section_s)]], colWidths=[170*mm])
        t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PRIMARY),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
        return t

    def kv(rows):
        data = [[Paragraph(l, label_s), Paragraph(str(v) if v else "N/A", body_s)] for l,v in rows]
        t = Table(data, colWidths=[70*mm, 100*mm])
        t.setStyle(TableStyle([("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.white,LIGHT]),("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#CCC")),("VALIGN",(0,0),(-1,-1),"TOP"),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),("LEFTPADDING",(0,0),(-1,-1),5)]))
        return t

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=15*mm, bottomMargin=15*mm)
    story = []

    # Header
    hdr = Table([[
        Paragraph('<font color="#034168" size="14"><b>AfriSupply</b></font><br/><font color="#666" size="8">Marketplace B2B — Zone CEMAC</font>', body_s),
        Paragraph(f'<font color="#FF6A00" size="11"><b>FICHE PRODUIT</b></font><br/><font color="#666" size="7">Émise le {now}</font>', ParagraphStyle("R", parent=body_s, alignment=2)),
    ]], colWidths=[95*mm, 75*mm])
    hdr.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LINEBELOW",(0,0),(-1,-1),1.5,ACCENT),("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    story += [hdr, Spacer(1,6*mm), Paragraph(product.get("name",""), title_s)]
    if product.get("description"):
        story.append(Paragraph(product["description"][:400], body_s))
    story.append(Spacer(1,4*mm))

    # Identification
    story += [sec("1. IDENTIFICATION"), Spacer(1,1*mm), kv([
        ("Référence", product.get("id","")[:16].upper()),
        ("Catégorie", product.get("category_name","N/A")),
        ("Unité", product.get("unit","N/A")),
        ("Qté min.", f"{product.get('min_order_quantity',1)} {product.get('unit','')}"),
        ("Stock", f"{product.get('stock_quantity',0)} {product.get('unit','')}"),
        ("Prix (XAF)", f"{product.get('price',0):,.0f} XAF HT"),
        ("Disponible", "✓ En stock" if product.get("is_available") else "✗ Rupture"),
    ]), Spacer(1,4*mm)]

    # Specs
    specs = product.get("specifications") or {}
    story += [sec("2. SPÉCIFICATIONS TECHNIQUES"), Spacer(1,1*mm)]
    if isinstance(specs, dict) and specs:
        story.append(kv([(k.replace("_"," ").title(), v) for k,v in specs.items()]))
    else:
        story.append(Paragraph("Spécifications disponibles sur demande.", ParagraphStyle("i", parent=body_s, textColor=colors.HexColor("#888"))))
    story.append(Spacer(1,4*mm))

    # Fournisseur
    story += [sec("3. FOURNISSEUR"), Spacer(1,1*mm), kv([
        ("Fournisseur", supplier.get("company_name") or supplier.get("full_name","") if unlocked else generate_anonymous_id(product.get("supplier_id",""))),
        ("Pays", supplier.get("country","N/A")),
        ("Ville", supplier.get("city","N/A") if unlocked else "—"),
        ("Statut", "✓ Fournisseur vérifié AfriSupply"),
        ("Contact", "Via AfriSupply — messagerie sécurisée"),
    ]), Spacer(1,4*mm)]

    # Commercial
    story += [sec("4. CONDITIONS COMMERCIALES"), Spacer(1,1*mm), kv([
        ("Paiement", "Mobile Money (MTN, Orange, Airtel) • Carte bancaire"),
        ("Zone livraison", "Cameroun, Gabon, Congo, Tchad, Guinée Éq., Centrafrique"),
        ("Devis", "Via AfriSupply RFQ — réponse 24h"),
        ("Devise", "XAF — Prix HT"),
    ]), Spacer(1,4*mm)]

    # Rating
    if product.get("rating", 0) > 0:
        stars = "★" * round(product["rating"]) + "☆" * (5 - round(product["rating"]))
        story += [sec("5. ÉVALUATION"), Spacer(1,1*mm), kv([
            ("Note", f"{product['rating']:.1f}/5  {stars}"),
            ("Avis", str(product.get("review_count",0))),
        ]), Spacer(1,4*mm)]

    story += [HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CCC")), Spacer(1,2*mm),
        Paragraph(f"Document généré par AfriSupply — Non contractuel. Réf: AS-{product.get('id','')[:8].upper()} — {now}", small_s)]

    doc.build(story)
    return buf.getvalue()

async def generate_product_pdf(product: dict, supplier: dict, unlocked: bool) -> bytes:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _build_pdf_sync, product, supplier, unlocked)