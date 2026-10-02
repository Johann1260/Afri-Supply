import resend
import logging
from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)
resend.api_key = settings.resend_api_key
_from_domain = settings.frontend_url.replace('https://','').replace('http://','').split(':')[0]
# En dev (localhost) on utilise le domaine Resend sandbox par défaut
FROM = f"AfriSupply <noreply@{_from_domain if '.' in _from_domain else 'onboarding.resend.dev'}>"

async def send_email(to: str, subject: str, html: str) -> bool:
    if not settings.resend_api_key:
        logger.warning(f"[EMAIL SKIP] No RESEND_API_KEY — would send: {subject} → {to}")
        return False
    try:
        r = await resend.Emails.send_async({"from": FROM, "to": [to], "subject": subject, "html": html})
        logger.info(f"[EMAIL] {subject} → {to}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL ERR] {e}")
        return False

def tpl_verify(name: str, link: str) -> str:
    return f'<div style="font-family:sans-serif;padding:32px"><h2>Bienvenue {name}!</h2><a href="{link}" style="background:#FF6A00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmer mon email</a><p style="color:#888;font-size:12px">Expire dans 24h.</p></div>'

def tpl_approved(name: str) -> str:
    return f'<div style="font-family:sans-serif;padding:32px"><h2>Compte activé !</h2><p>Bonjour {name}, votre compte AfriSupply est maintenant actif.</p><a href="{settings.frontend_url}/login" style="background:#FF6A00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none">Accéder à mon compte</a></div>'

def tpl_rejected(name: str) -> str:
    return f'<div style="font-family:sans-serif;padding:32px"><h2>Statut de votre dossier</h2><p>Bonjour {name}, nous ne pouvons pas activer votre compte. Contactez contact@afrisupply.com.</p></div>'

def tpl_reset(link: str) -> str:
    return f'<div style="font-family:sans-serif;padding:32px"><h2>Réinitialisation mot de passe</h2><a href="{link}" style="background:#FF6A00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none">Réinitialiser</a><p style="color:#888;font-size:12px">Expire dans 2h.</p></div>'

def tpl_docs_received(name: str, count: int) -> str:
    return f'<div style="font-family:sans-serif;padding:32px"><h2>Documents reçus ✓</h2><p>Merci {name}, {count} document(s) reçus. Délai de vérification: 48h.</p></div>'

def tpl_admin_docs(company: str, email: str, count: int) -> str:
    return f'<div style="font-family:sans-serif;padding:32px"><h2>Nouveau fournisseur</h2><p><b>{company}</b> ({email}) — {count} document(s).</p></div>'

def tpl_momo_confirmed(name: str, amount: float, network: str, tx_id: str) -> str:
    return (
        f'<div style="font-family:sans-serif;padding:32px;max-width:560px;margin:auto">'
        f'<h2 style="color:#16a34a">Paiement confirmé ✓</h2>'
        f'<p>Bonjour {name},</p>'
        f'<p>Votre paiement Mobile Money a été validé par notre équipe.</p>'
        f'<table style="width:100%;border-collapse:collapse;margin:16px 0">'
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee">Montant</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">{amount:,.0f} XAF</td></tr>'
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee">Réseau</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{network}</td></tr>'
        f'<tr><td style="padding:8px">Référence</td><td style="padding:8px;text-align:right;font-family:monospace">{tx_id[:12].upper()}</td></tr>'
        f'</table>'
        f'<a href="{settings.frontend_url}/dashboard" style="display:inline-block;background:#FF6A00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Voir mes commandes</a>'
        f'<p style="color:#888;font-size:12px;margin-top:24px">Vos commandes sont maintenant en préparation chez les fournisseurs.</p>'
        f'</div>'
    )