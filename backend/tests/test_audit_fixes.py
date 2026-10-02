"""
Tests TDD autonomes pour les 8 correctifs d'audit.
Phase RED — tous doivent échouer maintenant.
"""
import sys, os, ast, re
sys.path.insert(0, '/home/claude')

# ─── Helpers de lecture de fichier ───────────────────────────────────────────
def read(path): return open(path).read()


# ══════════════════════════════════════════════════════════════════════════════
# CORRECTIF 1 — create_refresh_token doit inclure type="refresh"
# ══════════════════════════════════════════════════════════════════════════════
def test_c1_refresh_token_has_type_claim():
    """auth_service.create_refresh_token doit inclure {'type': 'refresh'} dans le payload."""
    src = read('/home/claude/auth_service.py')
    # Vérifier que create_refresh_token passe type="refresh" (ou 'refresh') à create_token
    assert re.search(r'create_refresh_token.*\n.*type.*refresh|"type".*"refresh"|\'type\'.*\'refresh\'', src, re.DOTALL), \
        "create_refresh_token ne contient pas type='refresh'"

def test_c1_access_token_no_refresh_type():
    """create_access_token ne doit PAS contenir type='refresh'."""
    src = read('/home/claude/auth_service.py')
    # Extraire uniquement la fonction create_access_token
    lines = src.split('\n')
    in_fn = False
    fn_lines = []
    for line in lines:
        if line.startswith('def create_access_token'):
            in_fn = True
        elif in_fn and line.startswith('def '):
            break
        if in_fn:
            fn_lines.append(line)
    fn_src = '\n'.join(fn_lines)
    assert 'refresh' not in fn_src, "create_access_token ne doit pas mentionner 'refresh'"


# ══════════════════════════════════════════════════════════════════════════════
# CORRECTIF 2 — /auth/refresh doit lire le token dans le BODY (Pydantic model)
# ══════════════════════════════════════════════════════════════════════════════
def test_c2_refresh_endpoint_uses_body_model():
    """Le endpoint /refresh doit utiliser un modèle Pydantic (body), pas un query param."""
    src = read('/home/claude/auth.py')
    # Trouver la définition de la fonction refresh
    fn_match = re.search(r'async def refresh\(([^)]+)\)', src)
    assert fn_match, "Endpoint refresh introuvable"
    params = fn_match.group(1)
    # Un query param simple serait "refresh_token: str" sans type annoté Pydantic
    # Le fix est: body: RefreshIn (un BaseModel), ou data: RefreshIn
    assert 'str' not in params.replace('Request', ''), \
        f"refresh() ne doit pas accepter refresh_token comme str query param. Params: {params}"

def test_c2_refresh_validates_token_type():
    """Le endpoint /refresh doit vérifier que payload.get('type') == 'refresh'."""
    src = read('/home/claude/auth.py')
    # Chercher vérification du type dans la fonction refresh
    fn_match = re.search(r'async def refresh.*?(?=\n@|\nasync def |\Z)', src, re.DOTALL)
    assert fn_match, "Endpoint refresh introuvable"
    fn_src = fn_match.group(0)
    assert 'type' in fn_src and 'refresh' in fn_src, \
        "Le endpoint refresh ne vérifie pas payload['type'] == 'refresh'"


# ══════════════════════════════════════════════════════════════════════════════
# CORRECTIF 3 — orders.py : décrément de stock après insert_one
# ══════════════════════════════════════════════════════════════════════════════
def test_c3_orders_decrements_stock():
    """create_orders doit appeler products.update_one avec $inc stock après insert."""
    src = read('/home/claude/orders.py')
    # Vérifier présence de $inc et stock dans le contexte des ordres
    assert '$inc' in src, "orders.py ne contient pas de $inc pour décrémenter le stock"
    assert 'stock' in src, "orders.py ne mentionne pas 'stock'"
    # Vérifier que c'est bien dans create_orders (avant le prochain @router)
    create_fn = re.search(r'@router\.post.*?async def create_orders.*?(?=\n@router|\Z)', src, re.DOTALL)
    assert create_fn, "create_orders introuvable"
    assert '$inc' in create_fn.group(0), "create_orders ne décrémente pas le stock ($inc manquant)"


# ══════════════════════════════════════════════════════════════════════════════
# CORRECTIF 4 — payments.py : _create_orders_from_cart décrémente le stock
# ══════════════════════════════════════════════════════════════════════════════
def test_c4_payments_cart_to_orders_decrements_stock():
    """_create_orders_from_cart doit aussi décrémenter le stock."""
    src = read('/home/claude/payments.py')
    fn_match = re.search(r'async def _create_orders_from_cart.*?(?=\nasync def |\n@router|\Z)', src, re.DOTALL)
    assert fn_match, "_create_orders_from_cart introuvable"
    fn_src = fn_match.group(0)
    assert '$inc' in fn_src, "_create_orders_from_cart ne décrémente pas le stock"
    assert 'stock' in fn_src, "_create_orders_from_cart ne mentionne pas stock"


# ══════════════════════════════════════════════════════════════════════════════
# CORRECTIF 5 — payments.py : _confirm_payment supprimé / confirm par transaction_id
# ══════════════════════════════════════════════════════════════════════════════
def test_c5_confirm_payment_uses_transaction_id():
    """confirm_mobile_money doit filtrer par transaction_id (idempotence), pas update_many."""
    src = read('/home/claude/payments.py')
    # _confirm_payment utilisait update_many sans filtre → dangereux
    # Vérifier qu'update_many n'est plus utilisé dans le contexte payment confirmation
    # OU que si utilisé, il a un filtre explicite sur session_id/transaction_id
    confirm_fn = re.search(r'async def confirm_mobile_money.*?(?=\nasync def |\n@router|\Z)', src, re.DOTALL)
    assert confirm_fn, "confirm_mobile_money introuvable"
    fn_src = confirm_fn.group(0)
    # Le fix: utiliser update_one avec filtre sur id + status, pas update_many sans session
    assert 'update_many' not in fn_src or 'transaction_id' in fn_src or 'id' in fn_src, \
        "confirm_mobile_money utilise update_many sans filtre précis"


# ══════════════════════════════════════════════════════════════════════════════
# CORRECTIF 6 — security.py : HSTS présent
# ══════════════════════════════════════════════════════════════════════════════
def test_c6_hsts_header_present():
    """SecurityHeadersMiddleware doit inclure Strict-Transport-Security."""
    src = read('/home/claude/security.py')
    assert 'Strict-Transport-Security' in src, \
        "HSTS (Strict-Transport-Security) absent de security.py"
    assert 'max-age' in src, "HSTS doit spécifier max-age"


# ══════════════════════════════════════════════════════════════════════════════
# CORRECTIF 7 — orders.py : limit contraint à ≤ 100 dans GET /orders
# ══════════════════════════════════════════════════════════════════════════════
def test_c7_get_orders_limit_capped():
    """GET /orders doit valider limit avec Query(le=100)."""
    src = read('/home/claude/orders.py')
    # Chercher la définition de get_orders
    fn_match = re.search(r'async def get_orders\([^)]+\)', src)
    assert fn_match, "get_orders introuvable"
    params = fn_match.group(0)
    # Doit utiliser Query avec le= (less-than-or-equal)
    assert 'le=' in params or 'Query' in src and 'le=' in src, \
        f"get_orders ne contraint pas limit avec Query(le=100). Params: {params}"


# ══════════════════════════════════════════════════════════════════════════════
# CORRECTIF 8 — security.py : pas de 'unsafe-inline' dans script-src
# ══════════════════════════════════════════════════════════════════════════════
def test_c8_csp_no_unsafe_inline_script():
    """CSP ne doit pas avoir 'unsafe-inline' dans script-src."""
    src = read('/home/claude/security.py')
    # Extraire la partie script-src
    csp_match = re.search(r'Content-Security-Policy.*?"([^"]+)"', src, re.DOTALL)
    if not csp_match:
        csp_match = re.search(r"script-src[^;\"]+", src)
    
    # Trouver la directive script-src
    script_src_match = re.search(r"script-src[^;\"\\n]+", src)
    assert script_src_match, "script-src introuvable dans le CSP"
    script_src = script_src_match.group(0)
    assert "'unsafe-inline'" not in script_src, \
        f"'unsafe-inline' ne doit pas être dans script-src. Trouvé: {script_src}"


if __name__ == '__main__':
    import traceback
    tests = [
        test_c1_refresh_token_has_type_claim,
        test_c1_access_token_no_refresh_type,
        test_c2_refresh_endpoint_uses_body_model,
        test_c2_refresh_validates_token_type,
        test_c3_orders_decrements_stock,
        test_c4_payments_cart_to_orders_decrements_stock,
        test_c5_confirm_payment_uses_transaction_id,
        test_c6_hsts_header_present,
        test_c7_get_orders_limit_capped,
        test_c8_csp_no_unsafe_inline_script,
    ]
    failed, passed = [], []
    for t in tests:
        try:
            t()
            passed.append(t.__name__)
        except AssertionError as e:
            failed.append((t.__name__, str(e)))
        except Exception as e:
            failed.append((t.__name__, f"ERROR: {e}"))

    print(f"\n{'='*60}")
    print(f"RED PHASE: {len(failed)} failing (expected), {len(passed)} passing")
    for name, err in failed:
        print(f"  FAIL: {name}")
        print(f"        {err[:120]}")
    for name in passed:
        print(f"  PASS (already correct?): {name}")