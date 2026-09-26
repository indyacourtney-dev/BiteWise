import re
from pathlib import Path

TS = Path(__file__).resolve().parent.parent.parent / 'frontend' / 'constants' / 'recipes.ts'

ADD_ALLERGENS = {
    'r8': ['gluten'],     # soy sauce contains wheat
    'r10': ['gluten'],    # soy sauce
    'r17': ['gluten'],    # soy sauce
    'r12': ['sesame'],    # sesame oil
    'r18': ['eggs'],      # egg in the batter
    'r137': ['corn'],     # corn
}
REMOVE_DIETARY = {'r17': ['vegan']}   # contains honey


def recipe_span(text, rid):
    m = re.search(rf"\bid:\s*'{re.escape(rid)}',", text)
    if not m:
        raise SystemExit(f'Recipe {rid} not found in {TS}')
    nxt = re.search(r"\bid:\s*'", text[m.end():])
    return m.end(), (m.end() + nxt.start() if nxt else len(text))


def edit_array(text, rid, field, add=(), remove=()):
    start, end = recipe_span(text, rid)
    m = re.compile(rf"({field}:\s*)\[([^\]]*)\]").search(text, start, end)
    if not m:
        raise SystemExit(f'Recipe {rid} has no single-line {field} array')
    items = [s.strip().strip("'\"") for s in m.group(2).split(',') if s.strip()]
    new = [i for i in items if i not in remove] + [a for a in add if a not in items]
    if new == items:
        return text, False
    return text[:m.start()] + m.group(1) + '[' + ', '.join(f"'{i}'" for i in new) + ']' + text[m.end():], True


text = TS.read_text(encoding='utf-8')
for rid, add in ADD_ALLERGENS.items():
    text, changed = edit_array(text, rid, 'allergens', add=add)
    print(f'{rid}: allergens += {add}' if changed else f'{rid}: already fixed')
for rid, remove in REMOVE_DIETARY.items():
    text, changed = edit_array(text, rid, 'dietary', remove=remove)
    print(f'{rid}: dietary -= {remove}' if changed else f'{rid}: already fixed')
TS.write_text(text, encoding='utf-8')
print('Done.')
