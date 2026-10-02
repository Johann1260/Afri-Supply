import re, unicodedata

_PATTERNS = [
    r'\b(\+?\d[\s\-\.]?){7,15}\b',
    r'\b6\d{8}\b',
    r'\b\+237[\s\-]?[67]\d{7,8}\b',
    r'[a-zA-Z0-9._%+\-]+\s*@\s*[a-zA-Z0-9.\-]+\s*\.\s*[a-zA-Z]{2,}',
    # Obfuscated emails: "john (at) gmail (dot) com", "john [arobase] gmail point com"
    r'[a-zA-Z0-9._%+\-]+\s*[\(\[\{<]?\s*(?:at|arobase|chez)\s*[\)\]\}>]?\s*[a-zA-Z0-9.\-]+\s*[\(\[\{<]?\s*(?:dot|point|punto)\s*[\)\]\}>]?\s*[a-zA-Z]{2,}',
    r'https?://[^\s]+',
    r'www\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}',
    r'wa\.me/|t\.me/',
    r'(?i)(whatsapp|whats?\s*app|telegram|signal|viber|imo|wechat|appelle.?moi|call\s+me|contact.?me|en\s+priv|directly|mon\s+num|my\s+phone|hors\s+plateforme|outside.*platform|skype|messenger\s+fb)',
    # Digits written as words (FR/EN) — 7+ in a row
    r'(?i)\b(?:zero|un|deux|trois|quatre|cinq|six|sept|huit|neuf|one|two|three|four|five|six|seven|eight|nine|zero)(?:\s+(?:zero|un|deux|trois|quatre|cinq|six|sept|huit|neuf|one|two|three|four|five|six|seven|eight|nine)){6,}',
]
_COMPILED = [re.compile(p) for p in _PATTERNS]

BLOCKED_TEXT = (
    "⚠️ Message bloqué — AfriSupply\n"
    "Les échanges de coordonnées sont interdits sur la plateforme. "
    "Finalisez votre commande ici pour profiter de la sécurité offerte par la plateforme."
)

def _normalize(text: str) -> str:
    """Strip accents + collapse repeated spaces/dots/dashes for robust matching."""
    nfkd = unicodedata.normalize("NFKD", text)
    no_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Collapse multi-spaces but keep them (some patterns rely on \s)
    return re.sub(r"\s+", " ", no_accents)

def detect_bypass(text: str) -> bool:
    if not text: return False
    norm = _normalize(text)
    return any(p.search(norm) for p in _COMPILED)

_ANON_PREFIX = {"fr": "Partenaire", "en": "Partner"}

def generate_anonymous_id(user_id: str) -> str:
    """Identifiant anonyme déterministe. Stocké en DB sous forme canonique 'Partenaire-XXXXXX'."""
    import hashlib
    if not user_id:
        return "Partenaire-INCONNU"
    h = hashlib.sha256(str(user_id).encode()).hexdigest()[:6].upper()
    return f"Partenaire-{h}"

def localize_anonymous_id(anon_id: str, lang: str = "fr") -> str:
    """Traduit le préfixe pour la réponse API.
    DB canonical : 'Partenaire-XXXXXX' — ne jamais modifier.
    Appeler uniquement lors de la sérialisation."""
    if not anon_id or not isinstance(anon_id, str):
        return anon_id
    prefix = _ANON_PREFIX.get(lang[:2].lower(), "Partenaire")
    if anon_id.startswith("Partenaire-"):
        return f"{prefix}-{anon_id[len('Partenaire-'):]}"
    return anon_id

async def get_anonymous_id(user_id: str, db=None) -> str:
    """Lit l'anonymous_id stocké en DB. Si absent (ancien compte), le calcule,
    le persiste et le retourne. Garantit qu'il ne change jamais."""
    if not user_id:
        return "Partenaire-INCONNU"
    if db is not None:
        user = await db.users.find_one({"id": user_id}, {"anonymous_id": 1})
        if user and user.get("anonymous_id"):
            return user["anonymous_id"]
        # Ancien compte sans anonymous_id → calcule et persiste
        anon = generate_anonymous_id(user_id)
        await db.users.update_one({"id": user_id}, {"$set": {"anonymous_id": anon}})
        return anon
    return generate_anonymous_id(user_id)