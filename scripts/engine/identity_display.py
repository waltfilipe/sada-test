"""Camada de apresentação da identidade — nome e foto canônicos por atleta.

A identidade (athlete_id/person_key) já é resolvida pela cadeia; este módulo
cuida do que o site mostra: `name_display` (nome de guerra curado em
identity-overrides.json → person.display_name) e a foto canônica da pessoa.

Política de foto — "tudo ou nada" por atleta:
  - pessoa com foto canônica → TODAS as linhas recebem a mesma foto;
  - pessoa sem foto canônica → só se remove o que é provadamente estranho
    (url de CDN Transfermarkt embutindo outro tm_id, ou /photos/{ss_id} que
    não consta nas âncoras SofaScore da própria pessoa);
  - foto local /photos/{ss_id} sem âncoras ss na pessoa → deixa (não se pode
    provar que é de outro — foto errada é pior que sem foto, mas remover
    foto certa também é).

`name` nunca é sobrescrito: é chave de match dos scripts e termo de busca.
"""

from __future__ import annotations

import re

# url CDN Transfermarkt: .../portrait/{tamanho}/{tm_id}-{timestamp}.jpg
_TM_PHOTO_ID = re.compile(r"/(?:portrait|header)/[a-z]+/(\d{5,})-")
# perfil TM: .../apelido/profil/spieler/{tm_id}
_TM_PROFILE_ID = re.compile(r"/spieler/(\d+)")
# foto local servida pelo site, chaveada por sofascore id: /photos/789084.jpg
LOCAL_PHOTO = re.compile(r"^/photos/(\d+)\.(?:jpg|jpeg|png|webp)$")
_LOCAL_PHOTO = LOCAL_PHOTO


def _tm_photo_id(photo: str) -> str | None:
    m = _TM_PHOTO_ID.search(photo or "")
    return m.group(1) if m else None


def _profile_id(url: str) -> str | None:
    m = _TM_PROFILE_ID.search(url or "")
    return m.group(1) if m else None


def photo_is_foreign(photo: str, row_tm_id: str | None, person: dict) -> bool:
    """A foto da linha é provadamente de outro atleta?

    - CDN TM com id != âncora da pessoa (e != id da própria linha)
    - /photos/{ss_id} quando a pessoa tem âncoras SofaScore e o id não é dela
    """
    photo = str(photo or "")
    if not photo:
        return False
    local = _LOCAL_PHOTO.match(photo)
    if local:
        ss_ids = {str(v) for v in (person.get("sofascore") or {}).values()}
        return bool(ss_ids) and local.group(1) not in ss_ids
    fid = _tm_photo_id(photo)
    if not fid:
        return False
    p_tm = str(person.get("tm_id") or "")
    if p_tm:
        return fid != p_tm
    rid = str(row_tm_id or "")
    return bool(rid) and fid != rid


def profile_url_is_foreign(url: str, person: dict) -> bool:
    pid = _profile_id(url or "")
    p_tm = str(person.get("tm_id") or "")
    return bool(pid and p_tm and pid != p_tm)


def sync_row_presentation(row: dict, person: dict) -> bool:
    """Carimba o cartão canônico do atleta na linha. Retorna True se mudou.

    - name_display: nome de exibição da pessoa (override), removido quando
      a pessoa não tem um ou quando coincide com `name`.
    - foto: canônica da pessoa em todas as linhas; sem canônica, remove
      foto/url provadamente estranhas.
    """
    changed = False
    person = person or {}

    display = person.get("display_name")
    if display and display != row.get("name"):
        if row.get("name_display") != display:
            row["name_display"] = display
            changed = True
    elif row.get("name_display") is not None:
        del row["name_display"]
        changed = True

    p_photo = person.get("photo")
    tm = row.get("transfermarkt")
    if p_photo:
        if not isinstance(tm, dict):
            tm = {}
            row["transfermarkt"] = tm
            changed = True
        if tm.get("photo") != p_photo:
            tm["photo"] = p_photo
            changed = True
        if profile_url_is_foreign(str(tm.get("profile_url") or ""), person):
            del tm["profile_url"]
            changed = True
        if not tm.get("profile_url") and person.get("profile_url"):
            tm["profile_url"] = person["profile_url"]
            changed = True
    elif isinstance(tm, dict):
        rid = str(tm.get("id") or "")
        if photo_is_foreign(str(tm.get("photo") or ""), rid, person):
            del tm["photo"]
            changed = True
        if profile_url_is_foreign(str(tm.get("profile_url") or ""), person):
            del tm["profile_url"]
            changed = True

    return changed
